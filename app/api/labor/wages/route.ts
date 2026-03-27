import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'

// ─── GET /api/labor/wages?month=YYYY-MM&group=worker|site ──────────────────

export async function GET(req: NextRequest) {
  try {
    let session: Awaited<ReturnType<typeof requireCompanyAdmin>>
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      return msg === 'UNAUTHORIZED' ? unauthorized() : forbidden()
    }

    const { searchParams } = req.nextUrl
    const month = searchParams.get('month') || (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()
    const group = (searchParams.get('group') || 'worker') as 'worker' | 'site'

    // companyId로 속한 현장 ID 목록
    const companySites = await prisma.siteCompanyAssignment.findMany({
      where: { companyId: session.companyId },
      select: { siteId: true },
    })
    const siteIds = companySites.map((cp) => cp.siteId)

    if (siteIds.length === 0) return ok([])

    // MonthlyWorkConfirmation + Worker + Site + AttendanceDay + SiteWorkLog 집계
    const confirmations = await prisma.monthlyWorkConfirmation.findMany({
      where: { siteId: { in: siteIds }, monthKey: month },
      include: {
        worker: { select: { id: true, name: true, employmentType: true } },
        site:   { select: { id: true, name: true } },
      },
    })

    // 현장별 작업일보 작성일수 (SUBMITTED SiteWorkLog)
    const workLogs = await prisma.siteWorkLog.findMany({
      where: {
        siteId: { in: siteIds },
        workDate: {
          gte: new Date(`${month}-01`),
          lt:  new Date(
            month.slice(0, 4) + '-' +
            String(Number(month.slice(5, 7)) + 1).padStart(2, '0') +
            '-01'
          ),
        },
        status: 'SUBMITTED',
      },
      select: { siteId: true, workDate: true },
    })

    // 현장별 작업일보 날짜 Set
    const workLogDatesBySite = new Map<string, Set<string>>()
    for (const wl of workLogs) {
      const sid = wl.siteId
      if (!workLogDatesBySite.has(sid)) workLogDatesBySite.set(sid, new Set())
      workLogDatesBySite.get(sid)!.add(wl.workDate.toISOString().slice(0, 10))
    }

    // 출근일수: AttendanceDay 에서 월별 집계
    const attendanceDays = await prisma.attendanceDay.findMany({
      where: {
        siteId: { in: siteIds },
        workDate: {
          gte: `${month}-01`,
          lt:  month.slice(0, 4) + '-' +
            String(Number(month.slice(5, 7)) + 1).padStart(2, '0') +
            '-01',
        },
      },
      select: { workerId: true, siteId: true, workDate: true },
    })

    // (workerId+siteId) → 출근일 Set
    const attendanceMap = new Map<string, Set<string>>()
    for (const ad of attendanceDays) {
      const key = `${ad.workerId}::${ad.siteId}`
      if (!attendanceMap.has(key)) attendanceMap.set(key, new Set())
      attendanceMap.get(key)!.add(ad.workDate)
    }

    // 4대보험 스냅샷 (해당 월)
    const insuranceSnapshots = await prisma.insuranceEligibilitySnapshot.findMany({
      where: {
        monthKey: month,
        workerId: { in: Array.from(new Set(confirmations.map((c) => c.workerId))) },
      },
      select: {
        workerId: true,
        nationalPensionEligible: true,
        healthInsuranceEligible: true,
        employmentInsuranceEligible: true,
        industrialAccidentEligible: true,
      },
    })
    const insuranceMap = new Map(insuranceSnapshots.map((s) => [s.workerId, s]))

    // 집계
    const rows = confirmations.map((c) => {
      const attKey = `${c.workerId}::${c.siteId}`
      const attDays = attendanceMap.get(attKey)?.size ?? 0
      const siteLogs = workLogDatesBySite.get(c.siteId)
      // 근로자가 출근한 날 중 작업일보가 작성된 날 수
      const attDates = attendanceMap.get(attKey) ?? new Set<string>()
      const workLogDays = siteLogs
        ? Array.from(attDates).filter((d) => siteLogs.has(d)).length
        : 0
      const ins = insuranceMap.get(c.workerId)
      const insuranceEligible = ins
        ? ins.nationalPensionEligible ||
          ins.healthInsuranceEligible ||
          ins.employmentInsuranceEligible ||
          ins.industrialAccidentEligible
        : false

      // confirmedWorkUnits 합 (Decimal → number)
      const totalManday = Number(c.confirmedWorkUnits)
      const monthlyWage = c.confirmedTotalAmount

      // 일당 = 공수가 0이 아니면 총액 / 공수
      const dailyRate = totalManday > 0 ? Math.round(monthlyWage / totalManday) : 0

      return {
        workerId: c.workerId,
        workerName: c.worker.name,
        siteId: c.siteId,
        siteName: c.site.name,
        monthKey: c.monthKey,
        attendanceDays: attDays,
        workLogDays,
        totalManday,
        dailyRate,
        monthlyWage,
        employmentType: c.worker.employmentType,
        notes: c.notes ?? null,
        paymentStatus: 'UNPAID' as const,   // 향후 PaymentRecord 연동 시 교체
        confirmationStatus: (
          c.confirmationStatus === 'CONFIRMED' ? 'CONFIRMED' : 'DRAFT'
        ) as 'DRAFT' | 'CONFIRMED' | 'LOCKED',
        insuranceEligible,
      }
    })

    // group=site 이면 현장별로 집계
    if (group === 'site') {
      const siteMap = new Map<string, typeof rows[0] & { _count: number }>()
      for (const r of rows) {
        const existing = siteMap.get(r.siteId)
        if (!existing) {
          siteMap.set(r.siteId, { ...r, workerName: `(${r.siteName} 전체)`, _count: 1 })
        } else {
          existing.totalManday += r.totalManday
          existing.monthlyWage += r.monthlyWage
          existing.attendanceDays += r.attendanceDays
          existing.workLogDays = Math.max(existing.workLogDays, r.workLogDays)
          if (r.insuranceEligible) existing.insuranceEligible = true
          existing._count++
        }
      }
      return ok(Array.from(siteMap.values()))
    }

    return ok(rows)
  } catch (err) {
    console.error('[labor/wages GET]', err)
    return internalError()
  }
}
