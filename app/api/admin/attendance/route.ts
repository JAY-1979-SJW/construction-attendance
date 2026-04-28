import { NextRequest } from 'next/server'
import { AttendanceStatus } from '@prisma/client'
import { z } from 'zod'
import { getAdminSession, buildAttendanceScopeWhere, buildSiteScopeWhere, canAccessSite, siteAccessDeniedWithLog, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { ok, created, unauthorized, badRequest, conflict, internalError } from '@/lib/utils/response'
import { parsePagination } from '@/lib/utils/pagination'
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
    const { page, pageSize } = parsePagination(searchParams, { page: 1, pageSize: 200 })

    // 날짜 범위 결정
    const resolvedDate = dateParam ?? toKSTDateString()
    const resolvedFrom = dateParam ? dateParam : dateFrom
    const resolvedTo   = dateParam ? dateParam : dateTo

    // ── 출근 기록 scope 강제 (TEAM_LEADER/FOREMAN는 worker 기준) ────────────────
    let siteScopeFilter: Record<string, unknown> = {}
    const role = session.role ?? ''
    if (siteId && !['TEAM_LEADER', 'FOREMAN'].includes(role)) {
      if (!await canAccessSite(session, siteId)) return siteAccessDeniedWithLog(session, siteId)
      siteScopeFilter = { siteId }
    } else if (['TEAM_LEADER', 'FOREMAN'].includes(role)) {
      // 팀장/반장: siteId 파라미터 무시, worker 기준 scope 강제
      const scope = await buildAttendanceScopeWhere(session)
      if (scope === false) return ok({ items: [], total: 0, page: 1, pageSize, totalPages: 0, summary: null, siteOptions: [] })
      siteScopeFilter = scope
    } else {
      const scope = await buildAttendanceScopeWhere(session)
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
          worker: { select: { name: true, phone: true, jobTitle: true, teamName: true, foremanName: true } },
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
          workerTeamName:       l.worker.teamName   ?? null,
          workerForemanName:    l.worker.foremanName ?? null,
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

// ── POST /api/admin/attendance ─ 관리자 대리 출근 등록 ──────────────────────

const postSchema = z.object({
  workerId:   z.string().min(1, '근로자를 선택해주세요.'),
  siteId:     z.string().min(1, '현장을 선택해주세요.'),
  workDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD'),
  checkInAt:  z.string().regex(/^\d{2}:\d{2}$/, '출근시간 형식: HH:MM'),
  checkOutAt: z.string().regex(/^\d{2}:\d{2}$/, '퇴근시간 형식: HH:MM').optional(),
  reason:     z.string().min(1, '사유를 입력해주세요.').max(200),
  adminNote:  z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { workerId, siteId, workDate, checkInAt, checkOutAt, reason, adminNote } = parsed.data

    // 현장 접근 권한 검증
    if (!await canAccessSite(session, siteId)) {
      return siteAccessDeniedWithLog(session, siteId)
    }

    // 근로자 존재 확인
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true, name: true,
        companyAssignments: {
          where: { isPrimary: true },
          select: { companyId: true, company: { select: { companyName: true } } },
          take: 1,
        },
      },
    })
    if (!worker) return badRequest('존재하지 않는 근로자입니다.')
    const primaryCompany = worker.companyAssignments[0] ?? null

    // 현장 존재 확인
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true },
    })
    if (!site) return badRequest('존재하지 않는 현장입니다.')

    // 중복 확인 (동일 근로자+현장+날짜)
    const dbWorkDate = kstDateStringToDate(workDate)
    const existing = await prisma.attendanceLog.findUnique({
      where: { workerId_siteId_workDate: { workerId, siteId, workDate: dbWorkDate } },
    })
    if (existing) return conflict('해당 날짜에 이미 출퇴근 기록이 존재합니다.')

    // 시간 파싱
    const checkInDateTime = new Date(`${workDate}T${checkInAt}:00+09:00`)
    const checkOutDateTime = checkOutAt ? new Date(`${workDate}T${checkOutAt}:00+09:00`) : null
    const status: AttendanceStatus = checkOutDateTime ? 'ADMIN_MANUAL' : 'ADMIN_MANUAL'

    // AttendanceLog 생성
    const log = await prisma.attendanceLog.create({
      data: {
        workerId,
        siteId,
        workDate: dbWorkDate,
        checkInAt: checkInDateTime,
        checkOutAt: checkOutDateTime,
        status,
        isDirectCheckIn: false,
        adminNote: `[대리등록] ${reason}${adminNote ? ` | ${adminNote}` : ''}`,
        companyId: primaryCompany?.companyId ?? null,
        companyNameSnapshot: primaryCompany?.company.companyName ?? null,
      },
      include: {
        worker: { select: { name: true } },
        checkInSite: { select: { name: true } },
      },
    })

    // AttendanceDay 동기화
    let workedMinutes: number | null = null
    if (checkOutDateTime) {
      workedMinutes = Math.max(0, Math.floor((checkOutDateTime.getTime() - checkInDateTime.getTime()) / 60000))
    }
    await prisma.attendanceDay.upsert({
      where: { workerId_siteId_workDate: { workerId, siteId, workDate } },
      create: {
        workerId,
        siteId,
        workDate,
        firstCheckInAt: checkInDateTime,
        lastCheckOutAt: checkOutDateTime,
        workedMinutesRaw: workedMinutes,
        workedMinutesAuto: workedMinutes,
        workedMinutesRawFinal: workedMinutes,
        presenceStatus: 'NORMAL',
        manualAdjustedYn: true,
        manualAdjustedReason: `관리자 대리등록: ${reason}`,
        manualAdjustedByUserId: session.sub,
        manualAdjustedAt: new Date(),
      },
      update: {
        firstCheckInAt: checkInDateTime,
        lastCheckOutAt: checkOutDateTime,
        workedMinutesRaw: workedMinutes,
        workedMinutesAuto: workedMinutes,
        workedMinutesRawFinal: workedMinutes,
        manualAdjustedYn: true,
        manualAdjustedReason: `관리자 대리등록: ${reason}`,
        manualAdjustedByUserId: session.sub,
        manualAdjustedAt: new Date(),
      },
    })

    // 감사 로그
    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'ADMIN_MANUAL_ATTENDANCE',
      targetType: 'AttendanceLog',
      targetId: log.id,
      summary: `대리 출근 등록: ${worker.name} / ${site.name} / ${workDate} / ${checkInAt}~${checkOutAt ?? '미퇴근'}`,
      reason,
      afterJson: {
        workerId,
        siteId,
        workDate,
        checkInAt,
        checkOutAt: checkOutAt ?? null,
        workedMinutes,
      },
    })

    return created({
      id: log.id,
      workerName: log.worker.name,
      siteName: log.checkInSite.name,
      workDate,
      status: log.status,
      checkInAt: log.checkInAt?.toISOString() ?? null,
      checkOutAt: log.checkOutAt?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('[admin/attendance POST]', err)
    return internalError()
  }
}
