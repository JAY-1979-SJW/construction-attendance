import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/response'
import { requireFeature } from '@/lib/feature-flags'

/**
 * GET /api/company/payroll?monthKey=YYYY-MM
 * 업체 관리자용 월별 공수·급여 집계 조회
 * feature flag: payrollViewEnabled
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

    const flagGuard = await requireFeature(session.companyId, 'payrollViewEnabled')
    if (flagGuard) return flagGuard

    const { searchParams } = new URL(request.url)
    const monthKey = searchParams.get('monthKey')
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('monthKey 파라미터가 필요합니다. (형식: YYYY-MM)')
    }

    // 1. 이 업체 소속 근로자 ID 목록
    const assignments = await prisma.workerCompanyAssignment.findMany({
      where: { companyId: session.companyId, validTo: null },
      select: { workerId: true },
    })
    const workerIds = assignments.map(a => a.workerId)

    if (workerIds.length === 0) {
      return ok({ items: [], totals: { workerCount: 0, workUnits: 0, grossAmount: 0, taxAmount: 0, netAmount: 0 }, monthKey, totalWorkers: 0 })
    }

    // 2. 월별 근무 확정 집계 (per worker)
    const confirmations = await prisma.monthlyWorkConfirmation.findMany({
      where: { workerId: { in: workerIds }, monthKey },
      include: {
        worker: { select: { id: true, name: true, employmentType: true, incomeType: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 3. 임금 계산 (있으면 조인)
    const wageCalcs = await prisma.wageCalculation.findMany({
      where: { workerId: { in: workerIds }, monthKey },
      include: { withholdingCalc: true },
    })
    const wageMap = new Map(wageCalcs.map(w => [w.workerId, w]))

    // 4. worker별 집계
    const workerMap = new Map<string, {
      workerId: string
      workerName: string
      employmentType: string
      incomeType: string
      workDays: number
      workUnits: number
      grossAmount: number
      incomeTax: number
      localTax: number
      netAmount: number
      confirmedCount: number
      hasWageCalc: boolean
    }>()

    for (const c of confirmations) {
      const wid = c.workerId
      if (!workerMap.has(wid)) {
        workerMap.set(wid, {
          workerId: wid,
          workerName: c.worker.name,
          employmentType: c.worker.employmentType,
          incomeType: c.worker.incomeType,
          workDays: 0,
          workUnits: 0,
          grossAmount: 0,
          incomeTax: 0,
          localTax: 0,
          netAmount: 0,
          confirmedCount: 0,
          hasWageCalc: false,
        })
      }
      const row = workerMap.get(wid)!
      row.workDays += 1
      row.workUnits += Number(c.confirmedWorkUnits)
      row.grossAmount += c.confirmedTotalAmount
      row.confirmedCount += 1
    }

    // WageCalc 데이터 덮어쓰기 (더 정확)
    for (const w of wageCalcs) {
      if (!workerMap.has(w.workerId)) continue
      const row = workerMap.get(w.workerId)!
      row.grossAmount = w.grossAmount
      row.incomeTax = w.withholdingCalc?.incomeTaxAmount ?? 0
      row.localTax = w.withholdingCalc?.localIncomeTaxAmount ?? 0
      row.netAmount = w.grossAmount - row.incomeTax - row.localTax
      row.hasWageCalc = true
    }

    // netAmount 기본값
    workerMap.forEach(row => {
      if (!row.hasWageCalc) {
        row.netAmount = row.grossAmount
      }
    })

    const items = Array.from(workerMap.values()).sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko'))

    const totals = items.reduce((acc, r) => ({
      workerCount: acc.workerCount + 1,
      workUnits: acc.workUnits + r.workUnits,
      grossAmount: acc.grossAmount + r.grossAmount,
      taxAmount: acc.taxAmount + r.incomeTax + r.localTax,
      netAmount: acc.netAmount + r.netAmount,
    }), { workerCount: 0, workUnits: 0, grossAmount: 0, taxAmount: 0, netAmount: 0 })

    return ok({ items, totals, monthKey, totalWorkers: workerIds.length })
  } catch (err) {
    console.error('[company/payroll GET]', err)
    return internalError()
  }
}
