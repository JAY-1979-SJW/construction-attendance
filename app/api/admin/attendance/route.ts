import { NextRequest } from 'next/server'
import { AttendanceStatus } from '@prisma/client'
import { getAdminSession, buildSiteScopeWhere, canAccessSite, siteAccessDeniedWithLog } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { kstDateStringToDate, toKSTDateString } from '@/lib/utils/date'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)

    // single-date mode (대시보드 호환) vs range mode
    const dateParam  = searchParams.get('date')
    const dateFrom   = searchParams.get('dateFrom')
    const dateTo     = searchParams.get('dateTo')
    const siteId     = searchParams.get('siteId') || undefined
    const workerId   = searchParams.get('workerId') || undefined
    const status     = searchParams.get('status') || undefined
    const nameSearch = searchParams.get('name') || undefined
    const page       = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize   = parseInt(searchParams.get('pageSize') ?? '200', 10)

    // 날짜 범위 결정
    const resolvedDate = dateParam ?? toKSTDateString()
    const resolvedFrom = dateParam ? dateParam : dateFrom
    const resolvedTo   = dateParam ? dateParam : dateTo

    // ── site scope 강제 ──────────────────────────────────────────────────────
    let siteScopeFilter: Record<string, unknown> = {}
    if (siteId) {
      if (!await canAccessSite(session, siteId)) return siteAccessDeniedWithLog(session, siteId)
      siteScopeFilter = { siteId }
    } else {
      const scope = await buildSiteScopeWhere(session)
      if (scope === false) return ok({ items: [], total: 0, page: 1, pageSize, totalPages: 0, summary: null, siteOptions: [] })
      siteScopeFilter = scope as Record<string, unknown>
    }

    const workDateFilter: { gte?: Date; lte?: Date } = {}
    if (resolvedFrom) workDateFilter.gte = kstDateStringToDate(resolvedFrom)
    if (resolvedTo)   workDateFilter.lte = kstDateStringToDate(resolvedTo)

    // worker name 검색 — 이름 검색은 worker 테이블 join 후 필터 (Prisma 한계)
    const workerNameFilter = nameSearch
      ? { worker: { name: { contains: nameSearch } } }
      : {}

    const where = {
      ...siteScopeFilter,
      ...(Object.keys(workDateFilter).length > 0 ? { workDate: workDateFilter } : {}),
      ...(workerId ? { workerId } : {}),
      ...(status ? { status: status as AttendanceStatus } : {}),
      ...workerNameFilter,
    }

    const [total, logs] = await Promise.all([
      prisma.attendanceLog.count({ where }),
      prisma.attendanceLog.findMany({
        where,
        include: {
          worker: { select: { name: true, phone: true, jobTitle: true } },
          checkInSite:  { select: { id: true, name: true } },
          checkOutSite: { select: { id: true, name: true } },
          events: {
            where: { eventType: 'MOVE' },
            orderBy: { occurredAt: 'asc' },
            include: { site: { select: { name: true } } },
          },
        },
        orderBy: [{ checkInAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    // ── 사진 보유 여부 일괄 조회 ─────────────────────────────────────────────
    const logIds = logs.map(l => l.id)
    const photoGroups = logIds.length > 0
      ? await prisma.attendancePhotoEvidence.groupBy({
          by: ['attendanceLogId', 'photoType'],
          where: { attendanceLogId: { in: logIds } },
          _count: true,
        })
      : []
    const hasCheckInPhotoSet  = new Set(photoGroups.filter(p => p.photoType === 'CHECK_IN'  && (p.attendanceLogId ?? '')).map(p => p.attendanceLogId!))
    const hasCheckOutPhotoSet = new Set(photoGroups.filter(p => p.photoType === 'CHECK_OUT' && (p.attendanceLogId ?? '')).map(p => p.attendanceLogId!))

    // ── AttendanceDay 일괄 조회 ─────────────────────────────────────────────
    const attendanceDays = await prisma.attendanceDay.findMany({
      where: {
        OR: logs.map((l) => ({
          workerId: l.workerId,
          siteId:   l.siteId,
          workDate: l.workDate.toISOString().slice(0, 10),
        })),
      },
      select: {
        workerId:             true,
        siteId:               true,
        workDate:             true,
        workedMinutesRaw:     true,
        workedMinutesRawFinal:true,
        manualAdjustedYn:     true,
        manualAdjustedReason: true,
      },
    })
    const dayMap = new Map(
      attendanceDays.map((d) => [
        `${d.workerId}__${d.siteId}__${d.workDate}`,
        d,
      ])
    )

    // ── 노임 집계 (MonthlyWorkConfirmation) ─────────────────────────────────
    const workerIds = Array.from(new Set(logs.map(l => l.workerId)))
    const dayWageMap   = new Map<string, number>()
    const monthWageMap = new Map<string, number>()
    const totalWageMap = new Map<string, number>()
    const monthKey = resolvedDate.slice(0, 7)

    if (workerIds.length > 0) {
      const confSiteFilter = siteId ? { siteId } : {}
      const [dw, mw, tw] = await Promise.all([
        prisma.monthlyWorkConfirmation.groupBy({
          by:    ['workerId'],
          where: { workDate: resolvedDate, confirmationStatus: 'CONFIRMED', workerId: { in: workerIds }, ...confSiteFilter },
          _sum:  { confirmedTotalAmount: true },
        }),
        prisma.monthlyWorkConfirmation.groupBy({
          by:    ['workerId'],
          where: { monthKey, confirmationStatus: 'CONFIRMED', workerId: { in: workerIds }, ...confSiteFilter },
          _sum:  { confirmedTotalAmount: true },
        }),
        prisma.monthlyWorkConfirmation.groupBy({
          by:    ['workerId'],
          where: { confirmationStatus: 'CONFIRMED', workerId: { in: workerIds }, ...confSiteFilter },
          _sum:  { confirmedTotalAmount: true },
        }),
      ])
      dw.forEach(r => dayWageMap.set(r.workerId,   r._sum.confirmedTotalAmount ?? 0))
      mw.forEach(r => monthWageMap.set(r.workerId, r._sum.confirmedTotalAmount ?? 0))
      tw.forEach(r => totalWageMap.set(r.workerId, r._sum.confirmedTotalAmount ?? 0))
    }

    // ── 당일 요약 카운트 ────────────────────────────────────────────────────
    const todayDate = kstDateStringToDate(resolvedDate)
    const summaryWhere = { ...siteScopeFilter, workDate: todayDate }
    const [
      todayCheckedIn, todayCompleted, todayMissing, todayException,
      todayTotalWageAgg,
    ] = await Promise.all([
      prisma.attendanceLog.count({ where: { ...summaryWhere, status: 'WORKING' } }),
      prisma.attendanceLog.count({ where: { ...summaryWhere, status: 'COMPLETED' } }),
      prisma.attendanceLog.count({ where: { ...summaryWhere, status: 'MISSING_CHECKOUT' } }),
      prisma.attendanceLog.count({ where: { ...summaryWhere, status: 'EXCEPTION' } }),
      prisma.monthlyWorkConfirmation.aggregate({
        where: {
          workDate: resolvedDate,
          confirmationStatus: 'CONFIRMED',
          ...(siteId ? { siteId } : {}),
        },
        _sum: { confirmedTotalAmount: true },
      }),
    ])

    // ── 현장 목록 (드롭다운) ────────────────────────────────────────────────
    const allSites = await prisma.site.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const summary = {
      total:        todayCheckedIn + todayCompleted + todayMissing + todayException,
      working:      todayCheckedIn,
      completed:    todayCompleted,
      missing:      todayMissing,
      exception:    todayException,
      needsAction:  todayMissing + todayException,
      todayWage:    todayTotalWageAgg._sum.confirmedTotalAmount ?? 0,
    }

    return ok({
      items: logs.map((l) => {
        const key = `${l.workerId}__${l.siteId}__${l.workDate.toISOString().slice(0, 10)}`
        const day = dayMap.get(key)

        const moveEvents = l.events.map(e => ({
          siteId:   e.siteId,
          siteName: e.site?.name ?? '',
          movedAt:  e.occurredAt.toISOString(),
        }))
        const checkInSiteName  = l.checkInSite.name
        const checkOutSiteName = l.checkOutSite?.name ?? null
        const movePath = moveEvents.length > 0
          ? [checkInSiteName, ...moveEvents.map(e => e.siteName)].join(' → ')
          : null

        return {
          id:                   l.id,
          workerId:             l.workerId,
          workerName:           l.worker.name,
          workerPhone:          l.worker.phone,
          company:              l.companyNameSnapshot ?? '',
          jobTitle:             l.worker.jobTitle,
          siteId:               l.siteId,
          siteName:             checkInSiteName,
          checkOutSiteName,
          workDate:             l.workDate.toISOString().slice(0, 10),
          checkInAt:            l.checkInAt?.toISOString()  ?? null,
          checkOutAt:           l.checkOutAt?.toISOString() ?? null,
          status:               l.status,
          checkInDistance:      l.checkInDistance,
          checkOutDistance:     l.checkOutDistance,
          checkInWithinRadius:  l.checkInWithinRadius  ?? null,
          checkOutWithinRadius: l.checkOutWithinRadius ?? null,
          exceptionReason:      l.exceptionReason,
          adminNote:            l.adminNote,
          isAutoCheckout:       l.adminNote?.includes('[AUTO]') ?? false,
          isDirectCheckIn:      l.isDirectCheckIn,
          checkInLat:           l.checkInLat  ?? null,
          checkInLng:           l.checkInLng  ?? null,
          checkOutLat:          l.checkOutLat ?? null,
          checkOutLng:          l.checkOutLng ?? null,
          hasCheckInPhoto:      hasCheckInPhotoSet.has(l.id),
          hasCheckOutPhoto:     hasCheckOutPhotoSet.has(l.id),
          hasSiteMove:          moveEvents.length > 0,
          moveCount:            moveEvents.length,
          movePath,
          moveEvents,
          workedMinutesRaw:     day?.workedMinutesRaw     ?? null,
          workedMinutesFinal:   day?.workedMinutesRawFinal ?? null,
          manualAdjustedYn:     day?.manualAdjustedYn     ?? false,
          manualAdjustedReason: day?.manualAdjustedReason ?? null,
          dayWage:              dayWageMap.get(l.workerId)   ?? 0,
          monthWage:            monthWageMap.get(l.workerId) ?? 0,
          totalWage:            totalWageMap.get(l.workerId) ?? 0,
        }
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary,
      siteOptions: allSites.map(s => ({ id: s.id, name: s.name })),
    })
  } catch (err) {
    console.error('[admin/attendance GET]', err)
    return internalError()
  }
}
