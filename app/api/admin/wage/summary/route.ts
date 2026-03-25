/**
 * GET /api/admin/wage/summary
 *
 * 월별 근로자 공수 + 단가 + 노임 집계
 * Query: monthKey(YYYY-MM), siteId?
 *
 * 데이터 소스:
 *   MonthlyWorkConfirmation → confirmedWorkUnits, confirmedTotalAmount
 *   WorkerContract → dailyWage (최근 유효 계약)
 *   MonthClosing → 마감 상태
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const monthKey = searchParams.get('monthKey')
    const siteId   = searchParams.get('siteId') ?? undefined

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('monthKey(YYYY-MM) 파라미터가 필요합니다.')
    }

    // ── 1. MonthlyWorkConfirmation 집계 ──────────────────────────────
    const confirmations = await prisma.monthlyWorkConfirmation.findMany({
      where: {
        monthKey,
        ...(siteId ? { siteId } : {}),
      },
      include: {
        worker: { select: { id: true, name: true, jobTitle: true, employmentType: true } },
        site:   { select: { id: true, name: true } },
      },
      orderBy: [{ siteId: 'asc' }, { workerId: 'asc' }, { workDate: 'asc' }],
    })

    // ── 2. 근로자별 집계 ──────────────────────────────────────────────
    type WorkerKey = string  // `${workerId}::${siteId}`
    const map = new Map<WorkerKey, {
      workerId: string
      workerName: string
      jobTitle: string
      siteId: string
      siteName: string
      draftUnits: number
      confirmedUnits: number
      totalUnits: number
      totalAmount: number
      draftCount: number
      confirmedCount: number
      invalidCount: number
    }>()

    for (const c of confirmations) {
      const key: WorkerKey = `${c.workerId}::${c.siteId}`
      if (!map.has(key)) {
        map.set(key, {
          workerId: c.workerId,
          workerName: c.worker.name,
          jobTitle: c.worker.jobTitle,
          siteId: c.siteId,
          siteName: c.site.name,
          draftUnits: 0,
          confirmedUnits: 0,
          totalUnits: 0,
          totalAmount: 0,
          draftCount: 0,
          confirmedCount: 0,
          invalidCount: 0,
        })
      }
      const row = map.get(key)!
      const units = Number(c.confirmedWorkUnits)

      if (c.confirmedWorkType === 'INVALID' || units === 0) {
        row.invalidCount++
      } else if (c.confirmationStatus === 'CONFIRMED') {
        row.confirmedUnits += units
        row.confirmedCount++
        row.totalAmount += c.confirmedTotalAmount
      } else {
        row.draftUnits += units
        row.draftCount++
        row.totalAmount += c.confirmedTotalAmount
      }
      row.totalUnits = row.draftUnits + row.confirmedUnits
    }

    // ── 3. 근로자별 현재 단가 조회 (최근 유효 계약) ──────────────────
    const workerIds = Array.from(new Set(confirmations.map((c) => c.workerId)))
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
    const monthStart = `${monthKey}-01`

    const contracts = await prisma.workerContract.findMany({
      where: {
        workerId: { in: workerIds },
        isActive: true,
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
      },
      orderBy: { startDate: 'desc' },
      select: { workerId: true, id: true, dailyWage: true, startDate: true },
    })

    // 근로자별 최근 계약 1개 (정렬이 desc이므로 첫 번째)
    const contractMap = new Map<string, { id: string; dailyWage: number }>()
    for (const c of contracts) {
      if (!contractMap.has(c.workerId)) {
        contractMap.set(c.workerId, { id: c.id, dailyWage: c.dailyWage })
      }
    }

    // ── 4. MonthClosing 상태 ──────────────────────────────────────────
    const closing = await prisma.monthClosing.findFirst({
      where: { monthKey, closingScope: 'GLOBAL' },
      select: { status: true, closedAt: true },
    })
    const closingStatus = closing?.status ?? 'OPEN'

    // ── 5. 결과 조립 ─────────────────────────────────────────────────
    const items = Array.from(map.values()).map((row) => {
      const contract = contractMap.get(row.workerId)
      const dailyWage = contract?.dailyWage ?? 0
      const contractId = contract?.id ?? null

      // 상태 결정
      let status: 'DRAFT' | 'CONFIRMED' | 'CLOSED' = 'DRAFT'
      if (closingStatus === 'CLOSED') {
        status = 'CLOSED'
      } else if (row.draftCount === 0 && row.confirmedCount > 0) {
        status = 'CONFIRMED'
      }

      return {
        workerId: row.workerId,
        workerName: row.workerName,
        jobTitle: row.jobTitle,
        siteId: row.siteId,
        siteName: row.siteName,
        contractId,
        dailyWage,
        totalUnits: Math.round(row.totalUnits * 100) / 100,
        confirmedUnits: Math.round(row.confirmedUnits * 100) / 100,
        draftUnits: Math.round(row.draftUnits * 100) / 100,
        totalAmount: row.totalAmount,
        draftCount: row.draftCount,
        confirmedCount: row.confirmedCount,
        invalidCount: row.invalidCount,
        status,
      }
    })

    // 현장명 기준 정렬
    items.sort((a, b) => {
      const s = a.siteName.localeCompare(b.siteName, 'ko')
      return s !== 0 ? s : a.workerName.localeCompare(b.workerName, 'ko')
    })

    const totals = {
      workerCount: items.length,
      totalMandays: Math.round(items.reduce((s, r) => s + r.totalUnits, 0) * 100) / 100,
      totalAmount:  items.reduce((s, r) => s + r.totalAmount, 0),
    }

    return ok({ items, totals, monthClosingStatus: closingStatus, monthKey })
  } catch (err) {
    console.error('[wage/summary]', err)
    return internalError()
  }
}
