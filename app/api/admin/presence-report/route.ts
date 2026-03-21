import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { toKSTDateString } from '@/lib/utils/date'

// GET /api/admin/presence-report?days=7&siteId=
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const days   = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7'), 1), 30)
    const siteId = searchParams.get('siteId') ?? undefined

    // 날짜 범위 계산 (KST 기준)
    const today = toKSTDateString()
    const dates: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - i * 86400000)
      dates.push(d.toISOString().slice(0, 10))
    }

    const items = await prisma.presenceCheck.findMany({
      where: {
        checkDate: { in: dates },
        ...(siteId ? { siteId } : {}),
      },
      select: { checkDate: true, status: true, siteId: true },
    })

    // 현장 목록
    const sites = await prisma.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    // 날짜별 집계
    const dailyMap: Record<string, {
      total: number; completed: number; noResponse: number; outOfFence: number;
      review: number; manualConfirmed: number; manualRejected: number
    }> = {}

    for (const d of dates) {
      dailyMap[d] = { total: 0, completed: 0, noResponse: 0, outOfFence: 0, review: 0, manualConfirmed: 0, manualRejected: 0 }
    }

    for (const item of items) {
      const row = dailyMap[item.checkDate]
      if (!row) continue
      row.total++
      if (item.status === 'COMPLETED')           row.completed++
      else if (item.status === 'NO_RESPONSE' || item.status === 'MISSED') row.noResponse++
      else if (item.status === 'OUT_OF_GEOFENCE') row.outOfFence++
      else if (item.status === 'REVIEW_REQUIRED') row.review++
      else if (item.status === 'MANUALLY_CONFIRMED') { row.completed++; row.manualConfirmed++ }
      else if (item.status === 'MANUALLY_REJECTED')  { row.outOfFence++; row.manualRejected++ }
    }

    const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : null

    const daily = dates.map((date) => {
      const r = dailyMap[date]
      return {
        date,
        total:              r.total,
        completed:          r.completed,
        noResponse:         r.noResponse,
        outOfFence:         r.outOfFence,
        review:             r.review,
        manualConfirmed:    r.manualConfirmed,
        manualRejected:     r.manualRejected,
        completedRate:      pct(r.completed, r.total),
        noResponseRate:     pct(r.noResponse, r.total),
        outOfFenceRate:     pct(r.outOfFence, r.total),
        reviewRate:         pct(r.review, r.total),
        manualRate:         pct(r.manualConfirmed + r.manualRejected, r.total),
      }
    })

    // 현장별 집계 (siteId 미지정 시)
    let siteBreakdown: Array<{ siteId: string; siteName: string; total: number; completedRate: number | null }> = []
    if (!siteId) {
      const siteMap: Record<string, { total: number; completed: number; name: string }> = {}
      for (const item of items) {
        if (!siteMap[item.siteId]) {
          const s = sites.find((s) => s.id === item.siteId)
          siteMap[item.siteId] = { total: 0, completed: 0, name: s?.name ?? item.siteId }
        }
        siteMap[item.siteId].total++
        if (['COMPLETED', 'MANUALLY_CONFIRMED'].includes(item.status)) siteMap[item.siteId].completed++
      }
      siteBreakdown = Object.entries(siteMap).map(([siteId, r]) => ({
        siteId,
        siteName:      r.name,
        total:         r.total,
        completedRate: pct(r.completed, r.total),
      })).sort((a, b) => b.total - a.total)
    }

    // 전체 집계
    const totals = daily.reduce((acc, d) => ({
      total:           acc.total + d.total,
      completed:       acc.completed + d.completed,
      noResponse:      acc.noResponse + d.noResponse,
      outOfFence:      acc.outOfFence + d.outOfFence,
      review:          acc.review + d.review,
      manualConfirmed: acc.manualConfirmed + d.manualConfirmed,
      manualRejected:  acc.manualRejected + d.manualRejected,
    }), { total: 0, completed: 0, noResponse: 0, outOfFence: 0, review: 0, manualConfirmed: 0, manualRejected: 0 })

    return ok({
      days,
      today,
      siteId: siteId ?? null,
      sites,
      daily,
      totals: {
        ...totals,
        completedRate:   pct(totals.completed, totals.total),
        noResponseRate:  pct(totals.noResponse, totals.total),
        outOfFenceRate:  pct(totals.outOfFence, totals.total),
        reviewRate:      pct(totals.review, totals.total),
        manualRate:      pct(totals.manualConfirmed + totals.manualRejected, totals.total),
      },
      siteBreakdown,
    })
  } catch (err) {
    console.error('[admin/presence-report]', err)
    return internalError()
  }
}
