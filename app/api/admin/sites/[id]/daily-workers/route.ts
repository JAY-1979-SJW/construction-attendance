/**
 * GET   /api/admin/sites/[id]/daily-workers  — 출근자 상세 목록 (관리자 전용)
 * POST  /api/admin/sites/[id]/daily-workers  — 인원 상태 등록/수정 (upsert)
 *
 * 일반 근로자 화면에 이 API를 절대 재사용하지 말 것.
 * 출근자 실명, TBM 미참석, 안전확인 누락 정보는 이 API에서만 조회.
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import {
  SiteWorkerAttendanceStatus,
  SiteTbmParticipationStatus,
  SiteSafetyCheckStatus,
  SiteWorkAssignedStatus,
} from '@prisma/client'

const upsertSchema = z.object({
  workDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workerId:           z.string(),
  companyId:          z.string().nullable().optional(),
  teamLabel:          z.string().max(100).nullable().optional(),
  attendanceLogId:    z.string().nullable().optional(),
  attendanceStatus:   z.nativeEnum(SiteWorkerAttendanceStatus).optional(),
  checkInAt:          z.string().datetime().nullable().optional(),
  checkOutAt:         z.string().datetime().nullable().optional(),
  tbmStatus:          z.nativeEnum(SiteTbmParticipationStatus).optional(),
  tbmCheckedAt:       z.string().datetime().nullable().optional(),
  safetyCheckStatus:  z.nativeEnum(SiteSafetyCheckStatus).optional(),
  safetyCheckedAt:    z.string().datetime().nullable().optional(),
  workAssignedStatus: z.nativeEnum(SiteWorkAssignedStatus).optional(),
  remarks:            z.string().max(500).nullable().optional(),
})

const bulkUpsertSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workers:  z.array(upsertSchema.omit({ workDate: true })),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params
    if (!await canAccessSite(session, id)) return siteAccessDenied()

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const { searchParams } = req.nextUrl
    const date        = searchParams.get('date')        // 필수: YYYY-MM-DD
    const teamLabel   = searchParams.get('teamLabel')
    const companyId   = searchParams.get('companyId')
    const attStatus   = searchParams.get('attendanceStatus')   as SiteWorkerAttendanceStatus | null
    const tbmStatus   = searchParams.get('tbmStatus')          as SiteTbmParticipationStatus | null
    const safetyStatus = searchParams.get('safetyCheckStatus') as SiteSafetyCheckStatus | null

    if (!date) return badRequest('date(YYYY-MM-DD) 파라미터가 필요합니다.')

    const statuses = await prisma.siteDailyWorkerStatus.findMany({
      where: {
        siteId:   id,
        workDate: new Date(date),
        ...(teamLabel    ? { teamLabel }                    : {}),
        ...(companyId    ? { companyId }                    : {}),
        ...(attStatus    ? { attendanceStatus:  attStatus } : {}),
        ...(tbmStatus    ? { tbmStatus }                    : {}),
        ...(safetyStatus ? { safetyCheckStatus: safetyStatus } : {}),
      },
      include: {
        worker: {
          select: {
            id:   true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: [{ teamLabel: 'asc' }, { checkInAt: 'asc' }],
    })

    return ok({ statuses, total: statuses.length })
  } catch (err) {
    console.error('[sites/[id]/daily-workers GET]', err)
    return internalError()
  }
}

// ─── POST (upsert single or bulk) ────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const { id } = await params
    if (!await canAccessSite(session, id)) return siteAccessDenied()

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const body = await req.json()

    // 배열 형태(bulk) vs 단건 자동 판별
    if (Array.isArray(body.workers)) {
      const parsed = bulkUpsertSchema.safeParse(body)
      if (!parsed.success) return badRequest(parsed.error.errors[0].message)

      const { workDate, workers } = parsed.data
      const wDate = new Date(workDate)

      const results = await Promise.all(
        workers.map((w) =>
          prisma.siteDailyWorkerStatus.upsert({
            where:  { siteId_workDate_workerId: { siteId: id, workDate: wDate, workerId: w.workerId } },
            create: buildCreateData(id, wDate, w),
            update: buildUpdateData(w),
          })
        )
      )

      return ok({ count: results.length }, `${results.length}명 인원 상태가 저장되었습니다.`)
    }

    // 단건
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data
    const wDate = new Date(d.workDate)

    const status = await prisma.siteDailyWorkerStatus.upsert({
      where:  { siteId_workDate_workerId: { siteId: id, workDate: wDate, workerId: d.workerId } },
      create: buildCreateData(id, wDate, d),
      update: buildUpdateData(d),
      include: { worker: { select: { id: true, name: true } } },
    })

    return ok({ status }, '인원 상태가 저장되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/daily-workers POST]', err)
    return internalError()
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type WorkerInput = z.infer<typeof upsertSchema>

function buildCreateData(siteId: string, workDate: Date, d: Partial<WorkerInput> & { workerId: string }) {
  return {
    siteId,
    workDate,
    workerId:           d.workerId,
    companyId:          d.companyId          ?? null,
    teamLabel:          d.teamLabel           ?? null,
    attendanceLogId:    d.attendanceLogId    ?? null,
    attendanceStatus:   d.attendanceStatus   ?? 'UNKNOWN' as SiteWorkerAttendanceStatus,
    checkInAt:          d.checkInAt          ? new Date(d.checkInAt)   : null,
    checkOutAt:         d.checkOutAt         ? new Date(d.checkOutAt)  : null,
    tbmStatus:          d.tbmStatus          ?? 'UNKNOWN' as SiteTbmParticipationStatus,
    tbmCheckedAt:       d.tbmCheckedAt       ? new Date(d.tbmCheckedAt) : null,
    safetyCheckStatus:  d.safetyCheckStatus  ?? 'UNKNOWN' as SiteSafetyCheckStatus,
    safetyCheckedAt:    d.safetyCheckedAt    ? new Date(d.safetyCheckedAt) : null,
    workAssignedStatus: d.workAssignedStatus ?? 'UNKNOWN' as SiteWorkAssignedStatus,
    remarks:            d.remarks            ?? null,
  }
}

function buildUpdateData(d: Partial<WorkerInput>) {
  return {
    ...(d.companyId          !== undefined ? { companyId:          d.companyId }          : {}),
    ...(d.teamLabel           !== undefined ? { teamLabel:           d.teamLabel }           : {}),
    ...(d.attendanceLogId    !== undefined ? { attendanceLogId:    d.attendanceLogId }    : {}),
    ...(d.attendanceStatus   !== undefined ? { attendanceStatus:   d.attendanceStatus }   : {}),
    ...(d.checkInAt          !== undefined ? { checkInAt:          d.checkInAt ? new Date(d.checkInAt)  : null } : {}),
    ...(d.checkOutAt         !== undefined ? { checkOutAt:         d.checkOutAt ? new Date(d.checkOutAt) : null } : {}),
    ...(d.tbmStatus          !== undefined ? { tbmStatus:          d.tbmStatus }          : {}),
    ...(d.tbmCheckedAt       !== undefined ? { tbmCheckedAt:       d.tbmCheckedAt ? new Date(d.tbmCheckedAt) : null } : {}),
    ...(d.safetyCheckStatus  !== undefined ? { safetyCheckStatus:  d.safetyCheckStatus }  : {}),
    ...(d.safetyCheckedAt    !== undefined ? { safetyCheckedAt:    d.safetyCheckedAt ? new Date(d.safetyCheckedAt) : null } : {}),
    ...(d.workAssignedStatus !== undefined ? { workAssignedStatus: d.workAssignedStatus } : {}),
    ...(d.remarks            !== undefined ? { remarks:            d.remarks }            : {}),
  }
}
