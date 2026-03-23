import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'
import { requireFeature } from '@/lib/feature-flags'

/**
 * GET /api/company/documents?monthKey=YYYY-MM (optional)
 * 업체 관리자용 노임서류 / 집계 목록 조회
 * feature flag: laborDocsEnabled
 */
export async function GET(request: NextRequest) {
  try {
    let session
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'UNAUTHORIZED') return unauthorized()
      if (msg === 'FORBIDDEN') return forbidden()
      throw e
    }

    const flagGuard = await requireFeature(session.companyId, 'laborDocsEnabled')
    if (flagGuard) return flagGuard

    const { searchParams } = new URL(request.url)
    const monthKey = searchParams.get('monthKey') ?? undefined

    // 1. 노임비 집계 (companyId 직접 보유)
    const laborSummaries = await prisma.laborCostSummary.findMany({
      where: {
        companyId: session.companyId,
        ...(monthKey ? { monthKey } : {}),
      },
      include: { site: { select: { id: true, name: true, address: true } } },
      orderBy: [{ monthKey: 'desc' }, { createdAt: 'desc' }],
    })

    // 2. 이 업체 소속 근로자로 확정된 근무 집계 (monthKey별 요약)
    const assignments = await prisma.workerCompanyAssignment.findMany({
      where: { companyId: session.companyId, validTo: null },
      select: { workerId: true },
    })
    const workerIds = assignments.map(a => a.workerId)

    let confirmationSummary: Array<{
      monthKey: string
      confirmedCount: number
      totalWorkUnits: number
      totalAmount: number
    }> = []

    if (workerIds.length > 0) {
      // 월별 그룹 집계
      const confirmations = await prisma.monthlyWorkConfirmation.findMany({
        where: {
          workerId: { in: workerIds },
          confirmationStatus: 'CONFIRMED',
          ...(monthKey ? { monthKey } : {}),
        },
        select: { monthKey: true, confirmedWorkUnits: true, confirmedTotalAmount: true },
        orderBy: { monthKey: 'desc' },
      })

      const monthAgg = new Map<string, { confirmedCount: number; totalWorkUnits: number; totalAmount: number }>()
      for (const c of confirmations) {
        if (!monthAgg.has(c.monthKey)) monthAgg.set(c.monthKey, { confirmedCount: 0, totalWorkUnits: 0, totalAmount: 0 })
        const row = monthAgg.get(c.monthKey)!
        row.confirmedCount += 1
        row.totalWorkUnits += Number(c.confirmedWorkUnits)
        row.totalAmount += c.confirmedTotalAmount
      }
      confirmationSummary = Array.from(monthAgg.entries())
        .map(([mk, v]) => ({ monthKey: mk, ...v }))
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    }

    // 3. 이용 가능한 월 목록 (서류 생성 가능 여부 판단)
    const availableMonths = Array.from(
      new Set([
        ...laborSummaries.map(s => s.monthKey),
        ...confirmationSummary.map(s => s.monthKey),
      ])
    ).sort((a, b) => b.localeCompare(a))

    return ok({
      availableMonths,
      laborSummaries: laborSummaries.map(s => ({
        id: s.id,
        monthKey: s.monthKey,
        siteName: s.site?.name ?? '현장 미지정',
        organizationType: s.organizationType,
        workerCount: s.workerCount,
        confirmedWorkUnits: Number(s.confirmedWorkUnits),
        grossAmount: s.grossAmount,
        withholdingTaxAmount: s.withholdingTaxAmount,
        retirementMutualTargetDays: s.retirementMutualTargetDays,
        createdAt: s.createdAt.toISOString(),
      })),
      confirmationSummary,
      totalWorkers: workerIds.length,
    })
  } catch (err) {
    console.error('[company/documents GET]', err)
    return internalError()
  }
}
