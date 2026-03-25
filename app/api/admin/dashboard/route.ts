import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { kstDateStringToDate, toKSTDateString } from '@/lib/utils/date'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = req.nextUrl
    const siteIdParam = searchParams.get('siteId') || undefined
    const dateStr     = searchParams.get('date') || toKSTDateString()
    const today       = kstDateStringToDate(dateStr)
    const monthKey    = dateStr.slice(0, 7) // 'YYYY-MM'

    const logSiteFilter  = siteIdParam ? { checkInSiteId: siteIdParam } : {}
    const confSiteFilter = siteIdParam ? { siteId: siteIdParam } : {}

    // ── 기본 카운트 ────────────────────────────────────────────────────────
    const [
      totalWorkers, activeSites,
      todayCheckedIn, todayCompleted, todayMissing, todayException,
      pendingMissing, pendingExceptions, pendingDeviceRequests,
    ] = await Promise.all([
      prisma.worker.count({ where: { isActive: true } }),
      prisma.site.count({ where: { isActive: true } }),
      prisma.attendanceLog.count({ where: { workDate: today, status: 'WORKING',           ...logSiteFilter } }),
      prisma.attendanceLog.count({ where: { workDate: today, status: 'COMPLETED',         ...logSiteFilter } }),
      prisma.attendanceLog.count({ where: { workDate: today, status: 'MISSING_CHECKOUT',  ...logSiteFilter } }),
      prisma.attendanceLog.count({ where: { workDate: today, status: 'EXCEPTION',         ...logSiteFilter } }),
      // 이전 일자 누적 미퇴근
      prisma.attendanceLog.count({ where: { status: 'MISSING_CHECKOUT', workDate: { lt: today }, ...logSiteFilter } }),
      prisma.attendanceLog.count({ where: { status: 'EXCEPTION', ...logSiteFilter } }),
      prisma.deviceChangeRequest.count({ where: { status: 'PENDING' } }),
    ])

    // ── 노임 집계 (MonthlyWorkConfirmation 기준) ────────────────────────────
    const [todayWageAgg, monthWageAgg, totalWageAgg] = await Promise.all([
      prisma.monthlyWorkConfirmation.aggregate({
        where: { workDate: dateStr, confirmationStatus: 'CONFIRMED', ...confSiteFilter },
        _sum:  { confirmedTotalAmount: true },
      }),
      prisma.monthlyWorkConfirmation.aggregate({
        where: { monthKey, confirmationStatus: 'CONFIRMED', ...confSiteFilter },
        _sum:  { confirmedTotalAmount: true },
      }),
      prisma.monthlyWorkConfirmation.aggregate({
        where: { confirmationStatus: 'CONFIRMED', ...confSiteFilter },
        _sum:  { confirmedTotalAmount: true },
      }),
    ])

    // ── 체류확인 현황 ───────────────────────────────────────────────────────
    const presenceCounts = await prisma.presenceCheck.groupBy({
      by: ['status'],
      where: { checkDate: dateStr },
      _count: { _all: true },
    })
    const pc = (s: string) => presenceCounts.find(r => r.status === s)?._count._all ?? 0
    const todayPresence = {
      total:      presenceCounts.reduce((sum, r) => sum + r._count._all, 0),
      pending:    pc('PENDING'),
      completed:  pc('COMPLETED') + pc('MANUALLY_CONFIRMED'),
      noResponse: pc('NO_RESPONSE') + pc('MISSED'),
      outOfFence: pc('OUT_OF_GEOFENCE') + pc('MANUALLY_REJECTED'),
      review:     pc('REVIEW_REQUIRED'),
    }

    // ── 오늘 출근 기록 (최대 30건) ─────────────────────────────────────────
    const recentAttendance = await prisma.attendanceLog.findMany({
      where: { workDate: today, ...logSiteFilter },
      include: {
        worker:      { select: { name: true } },
        checkInSite: { select: { name: true } },
      },
      orderBy: { checkInAt: 'desc' },
      take: 30,
    })

    // ── 근로자별 노임 (당일·월·누계) ─────────────────────────────────────
    const workerIds = Array.from(new Set(recentAttendance.map(r => r.workerId)))
    const dayWageMap   = new Map<string, number>()
    const monthWageMap = new Map<string, number>()
    const totalWageMap = new Map<string, number>()

    if (workerIds.length > 0) {
      const [dw, mw, tw] = await Promise.all([
        prisma.monthlyWorkConfirmation.groupBy({
          by: ['workerId'],
          where: { workDate: dateStr, confirmationStatus: 'CONFIRMED', workerId: { in: workerIds } },
          _sum:  { confirmedTotalAmount: true },
        }),
        prisma.monthlyWorkConfirmation.groupBy({
          by: ['workerId'],
          where: { monthKey, confirmationStatus: 'CONFIRMED', workerId: { in: workerIds } },
          _sum:  { confirmedTotalAmount: true },
        }),
        prisma.monthlyWorkConfirmation.groupBy({
          by: ['workerId'],
          where: { confirmationStatus: 'CONFIRMED', workerId: { in: workerIds } },
          _sum:  { confirmedTotalAmount: true },
        }),
      ])
      dw.forEach(r => dayWageMap.set(r.workerId,   r._sum.confirmedTotalAmount ?? 0))
      mw.forEach(r => monthWageMap.set(r.workerId, r._sum.confirmedTotalAmount ?? 0))
      tw.forEach(r => totalWageMap.set(r.workerId, r._sum.confirmedTotalAmount ?? 0))
    }

    // ── 현장 목록 (드롭다운용) ─────────────────────────────────────────────
    const allSites = await prisma.site.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, openedAt: true, closedAt: true },
      orderBy: { name: 'asc' },
    })

    // ── 현장별 출근 현황 ───────────────────────────────────────────────────
    const siteAttCounts = await prisma.attendanceLog.groupBy({
      by:    ['siteId', 'status'],
      where: { workDate: today },
      _count: true,
    })

    // ── 현장별 노임 집계 ───────────────────────────────────────────────────
    const [siteTodayWages, siteMonthWages, siteTotalWages] = await Promise.all([
      prisma.monthlyWorkConfirmation.groupBy({
        by:    ['siteId'],
        where: { workDate: dateStr, confirmationStatus: 'CONFIRMED' },
        _sum:  { confirmedTotalAmount: true },
      }),
      prisma.monthlyWorkConfirmation.groupBy({
        by:    ['siteId'],
        where: { monthKey, confirmationStatus: 'CONFIRMED' },
        _sum:  { confirmedTotalAmount: true },
      }),
      prisma.monthlyWorkConfirmation.groupBy({
        by:    ['siteId'],
        where: { confirmationStatus: 'CONFIRMED' },
        _sum:  { confirmedTotalAmount: true },
      }),
    ])

    const siteTodayWageMap = new Map(siteTodayWages.map(r => [r.siteId, r._sum.confirmedTotalAmount ?? 0]))
    const siteMonthWageMap = new Map(siteMonthWages.map(r => [r.siteId, r._sum.confirmedTotalAmount ?? 0]))
    const siteTotalWageMap = new Map(siteTotalWages.map(r => [r.siteId, r._sum.confirmedTotalAmount ?? 0]))

    const siteSummaries = allSites.map(site => {
      const counts    = siteAttCounts.filter(c => c.siteId === site.id)
      const working   = counts.find(c => c.status === 'WORKING')?._count          ?? 0
      const completed = counts.find(c => c.status === 'COMPLETED')?._count        ?? 0
      const missing   = counts.find(c => c.status === 'MISSING_CHECKOUT')?._count ?? 0
      const exception = counts.find(c => c.status === 'EXCEPTION')?._count        ?? 0
      return {
        id:            site.id,
        name:          site.name,
        openedAt:      site.openedAt?.toISOString() ?? null,
        closedAt:      site.closedAt?.toISOString()  ?? null,
        working,
        completed,
        missing,
        exception,
        issue:         missing + exception,
        todayWage:     siteTodayWageMap.get(site.id) ?? 0,
        monthWage:     siteMonthWageMap.get(site.id) ?? 0,
        totalWage:     siteTotalWageMap.get(site.id) ?? 0,
      }
    })
    // 오늘 활동이 있는 현장 또는 선택된 현장만 노출
    // 정렬: 확인필요 → 미퇴근 → 총 누계 노임
    const activeSiteList = siteSummaries
      .filter(s => s.working + s.completed + s.issue > 0 || s.id === siteIdParam)
      .sort((a, b) => (b.issue - a.issue) || (b.missing - a.missing) || (b.totalWage - a.totalWage))

    return ok({
      summary: {
        totalWorkers,
        activeSites,
        todayCheckedIn,
        todayCompleted,
        todayTotal:    todayCheckedIn + todayCompleted + todayMissing + todayException,
        todayMissing,
        todayException,
        pendingMissing,
        pendingExceptions,
        pendingDeviceRequests,
        todayWage:  todayWageAgg._sum.confirmedTotalAmount  ?? 0,
        monthWage:  monthWageAgg._sum.confirmedTotalAmount  ?? 0,
        totalWage:  totalWageAgg._sum.confirmedTotalAmount  ?? 0,
        todayPresenceTotal:      todayPresence.total,
        todayPresencePending:    todayPresence.pending,
        todayPresenceCompleted:  todayPresence.completed,
        todayPresenceNoResponse: todayPresence.noResponse,
        todayPresenceOutOfFence: todayPresence.outOfFence,
        todayPresenceReview:     todayPresence.review,
      },
      recentAttendance: recentAttendance.map(l => ({
        id:         l.id,
        workerId:   l.workerId,
        workerName: l.worker.name,
        company:    l.companyNameSnapshot ?? '',
        siteName:   l.checkInSite.name,
        checkInAt:  l.checkInAt?.toISOString()  ?? null,
        checkOutAt: l.checkOutAt?.toISOString() ?? null,
        status:     l.status,
        dayWage:    dayWageMap.get(l.workerId)   ?? 0,
        monthWage:  monthWageMap.get(l.workerId) ?? 0,
        totalWage:  totalWageMap.get(l.workerId) ?? 0,
      })),
      sites:       activeSiteList,
      siteOptions: allSites.map(s => ({ id: s.id, name: s.name })),
    })
  } catch (err) {
    console.error('[admin/dashboard]', err)
    return internalError()
  }
}
