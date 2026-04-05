import { NextRequest } from 'next/server'
import { getAdminSession, buildAttendanceScopeWhere, buildWorkerScopeWhere } from '@/lib/auth/guards'
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
    const monthKey    = dateStr.slice(0, 7)

    const role = session.role ?? ''

    // ── 역할 기반 scope 빌드 ────────────────────────────────────────────────
    const attScope = await buildAttendanceScopeWhere(session)
    const wrkScope = await buildWorkerScopeWhere(session)

    if (attScope === false || wrkScope === false) {
      return ok(emptyResponse())
    }

    const attScopeWhere = attScope as Record<string, unknown>
    const wrkScopeWhere = wrkScope as Record<string, unknown>

    // TEAM_LEADER/FOREMAN는 siteId 필터 무시 (role scope가 우선)
    const isScopedRole = ['TEAM_LEADER', 'FOREMAN'].includes(role)
    const logSiteFilter  = (siteIdParam && !isScopedRole) ? { siteId: siteIdParam } : {}
    const confSiteFilter = (siteIdParam && !isScopedRole) ? { siteId: siteIdParam } : {}

    const todayAttBase = { workDate: today, ...attScopeWhere, ...logSiteFilter }

    // ── 기본 카운트 ────────────────────────────────────────────────────────
    const [
      totalWorkers, activeSites,
      todayCheckedIn, todayCompleted, todayMissing, todayException,
      pendingMissing, pendingExceptions, pendingDeviceRequests,
      materialRequestCount, docIncompleteCount,
    ] = await Promise.all([
      prisma.worker.count({ where: { isActive: true, ...wrkScopeWhere } }),
      prisma.site.count({ where: { isActive: true } }),
      prisma.attendanceLog.count({ where: { ...todayAttBase, status: 'WORKING' } }),
      prisma.attendanceLog.count({ where: { ...todayAttBase, status: 'COMPLETED' } }),
      prisma.attendanceLog.count({ where: { ...todayAttBase, status: 'MISSING_CHECKOUT' } }),
      prisma.attendanceLog.count({ where: { ...todayAttBase, status: 'EXCEPTION' } }),
      // 이전 일자 누적 미퇴근
      prisma.attendanceLog.count({ where: { ...attScopeWhere, ...logSiteFilter, status: 'MISSING_CHECKOUT', workDate: { lt: today } } }),
      prisma.attendanceLog.count({ where: { ...attScopeWhere, ...logSiteFilter, status: 'EXCEPTION' } }),
      prisma.deviceChangeRequest.count({ where: { status: 'PENDING' } }),
      // 자재신청 건수 (SUBMITTED + REVIEWED)
      prisma.materialRequest.count({
        where: {
          status: { in: ['SUBMITTED', 'REVIEWED'] },
          ...(isScopedRole ? { requestedBy: session.sub } : {}),
        },
      }),
      // 서류미완료 인원 (onboarding PENDING)
      prisma.worker.count({
        where: {
          isActive: true,
          onboardingChecklists: { some: { status: 'PENDING' } },
          ...wrkScopeWhere,
        },
      }),
    ])

    // ── 노임 집계 ──────────────────────────────────────────────────────────
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

    // ── 최근 출근 이상 건 (오늘 MISSING_CHECKOUT + EXCEPTION) ─────────────
    const recentIssues = await prisma.attendanceLog.findMany({
      where: { workDate: today, status: { in: ['MISSING_CHECKOUT', 'EXCEPTION'] }, ...attScopeWhere, ...logSiteFilter },
      include: {
        worker:      { select: { name: true, teamName: true } },
        checkInSite: { select: { name: true } },
      },
      orderBy: { checkInAt: 'desc' },
      take: 10,
    })

    // ── 최근 자재신청 (SUBMITTED + REVIEWED + APPROVED 최근 5건) ──────────
    const recentMaterialRequests = await prisma.materialRequest.findMany({
      where: {
        status: { in: ['SUBMITTED', 'REVIEWED', 'APPROVED'] },
        ...(isScopedRole ? { requestedBy: session.sub } : {}),
      },
      select: {
        id: true, requestNo: true, title: true, status: true, submittedAt: true,
        requestedByName: true,
        site: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // ── 서류미완료 근로자 (onboarding PENDING 상위 10명) ───────────────────
    const docIncompleteWorkers = await prisma.worker.findMany({
      where: {
        isActive: true,
        onboardingChecklists: { some: { status: 'PENDING' } },
        ...wrkScopeWhere,
      },
      select: {
        id: true, name: true, teamName: true,
        onboardingChecklists: {
          where: { status: 'PENDING' },
          select: { checkType: true },
          take: 3,
        },
      },
      take: 10,
    })

    // ── 오늘 출근 기록 (최대 30건 — 기존 호환) ────────────────────────────
    const recentAttendance = await prisma.attendanceLog.findMany({
      where: { workDate: today, ...attScopeWhere, ...logSiteFilter },
      include: {
        worker:      { select: { name: true } },
        checkInSite: { select: { name: true } },
      },
      orderBy: { checkInAt: 'desc' },
      take: 30,
    })

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

    // ── 현장 목록 + 현장별 출근 현황 ──────────────────────────────────────
    const allSites = await prisma.site.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, openedAt: true, closedAt: true },
      orderBy: { name: 'asc' },
    })

    const siteAttCounts = await prisma.attendanceLog.groupBy({
      by:    ['siteId', 'status'],
      where: { workDate: today, ...attScopeWhere },
      _count: true,
    })

    const siteSummaries = allSites.map(site => {
      const counts    = siteAttCounts.filter(c => c.siteId === site.id)
      const working   = counts.find(c => c.status === 'WORKING')?._count          ?? 0
      const completed = counts.find(c => c.status === 'COMPLETED')?._count        ?? 0
      const missing   = counts.find(c => c.status === 'MISSING_CHECKOUT')?._count ?? 0
      const exception = counts.find(c => c.status === 'EXCEPTION')?._count        ?? 0
      return { id: site.id, name: site.name, openedAt: site.openedAt?.toISOString() ?? null, closedAt: site.closedAt?.toISOString() ?? null, working, completed, missing, exception, issue: missing + exception }
    })

    const activeSiteList = siteSummaries
      .filter(s => s.working + s.completed + s.issue > 0 || s.id === siteIdParam)
      .sort((a, b) => (b.issue - a.issue) || (b.missing - a.missing) || (b.working - a.working))
      .slice(0, 10)

    // ── scope 표시 레이블 ────────────────────────────────────────────────
    const scopeLabel = role === 'TEAM_LEADER'
      ? `팀: ${session.teamName ?? '-'}`
      : role === 'FOREMAN'
        ? `담당: ${session.name ?? '-'}`
        : null

    return ok({
      summary: {
        totalWorkers, activeSites,
        todayCheckedIn, todayCompleted,
        todayTotal: todayCheckedIn + todayCompleted + todayMissing + todayException,
        todayMissing, todayException,
        pendingMissing, pendingExceptions, pendingDeviceRequests,
        todayWage:  todayWageAgg._sum.confirmedTotalAmount  ?? 0,
        monthWage:  monthWageAgg._sum.confirmedTotalAmount  ?? 0,
        totalWage:  totalWageAgg._sum.confirmedTotalAmount  ?? 0,
        todayPresenceTotal:      todayPresence.total,
        todayPresencePending:    todayPresence.pending,
        todayPresenceCompleted:  todayPresence.completed,
        todayPresenceNoResponse: todayPresence.noResponse,
        todayPresenceOutOfFence: todayPresence.outOfFence,
        todayPresenceReview:     todayPresence.review,
        materialRequestCount,
        docIncompleteCount,
        scopeLabel,
      },
      recentIssues: recentIssues.map(l => ({
        id:         l.id,
        workerId:   l.workerId,
        workerName: l.worker.name,
        teamName:   l.worker.teamName ?? null,
        siteName:   l.checkInSite.name,
        checkInAt:  l.checkInAt?.toISOString() ?? null,
        status:     l.status,
      })),
      recentMaterialRequests: recentMaterialRequests.map(r => ({
        id:              r.id,
        requestNo:       r.requestNo,
        title:           r.title,
        status:          r.status,
        siteName:        r.site?.name ?? '-',
        requestedByName: r.requestedByName ?? '-',
        submittedAt:     r.submittedAt?.toISOString() ?? null,
      })),
      docIncompleteWorkers: docIncompleteWorkers.map(w => ({
        id:       w.id,
        name:     w.name,
        teamName: w.teamName ?? null,
        issues:   w.onboardingChecklists.map(c => c.checkType),
      })),
      siteSummary: activeSiteList,
      // ── 기존 호환 필드 ────────────────────────────────────────────────
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

function emptyResponse() {
  return {
    summary: {
      totalWorkers: 0, activeSites: 0,
      todayCheckedIn: 0, todayCompleted: 0, todayTotal: 0,
      todayMissing: 0, todayException: 0,
      pendingMissing: 0, pendingExceptions: 0, pendingDeviceRequests: 0,
      todayWage: 0, monthWage: 0, totalWage: 0,
      todayPresenceTotal: 0, todayPresencePending: 0,
      todayPresenceCompleted: 0, todayPresenceNoResponse: 0,
      todayPresenceOutOfFence: 0, todayPresenceReview: 0,
      materialRequestCount: 0, docIncompleteCount: 0, scopeLabel: null,
    },
    recentIssues: [],
    recentMaterialRequests: [],
    docIncompleteWorkers: [],
    siteSummary: [],
    recentAttendance: [],
    sites: [],
    siteOptions: [],
  }
}
