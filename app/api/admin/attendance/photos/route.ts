import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, buildSiteScopeWhere, buildWorkerScopeWhere, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, internalError, badRequest } from '@/lib/utils/response'
import { parsePage } from '@/lib/utils/pagination'

/**
 * GET /api/admin/attendance/photos
 * 출퇴근 증빙 사진 목록
 * query: attendanceLogId?, workerId?, siteId?, photoType?, page?
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const attendanceLogId = searchParams.get('attendanceLogId') ?? undefined
    const workerId = searchParams.get('workerId') ?? undefined
    const siteId = searchParams.get('siteId') ?? undefined
    const photoTypeRaw = searchParams.get('photoType')
    const ALLOWED_PHOTO_TYPES = ['CHECK_IN', 'CHECK_OUT'] as const
    type PhotoType = typeof ALLOWED_PHOTO_TYPES[number]
    if (photoTypeRaw !== null && !(ALLOWED_PHOTO_TYPES as readonly string[]).includes(photoTypeRaw)) {
      return badRequest('photoType은 CHECK_IN 또는 CHECK_OUT만 허용됩니다.')
    }
    const photoType = photoTypeRaw as PhotoType | undefined ?? undefined
    const page = parsePage(searchParams.get('page'))
    const pageSize = 20

    // site scope 검증 — 요청된 siteId 포함 범위 제한
    const siteScope = await buildSiteScopeWhere(session, siteId)
    if (siteScope === false) return siteAccessDenied()

    // workerId scope 검증 — 요청된 workerId가 접근 가능 범위 안에 있는지 확인
    if (workerId) {
      const workerScope = await buildWorkerScopeWhere(session)
      if (workerScope === false) return siteAccessDenied()
      if (workerScope && typeof workerScope === 'object') {
        const allowed = await prisma.worker.findFirst({
          where: { id: workerId, ...workerScope },
          select: { id: true },
        })
        if (!allowed) return siteAccessDenied()
      }
    }

    // attendanceLogId scope 검증 — log가 속한 siteId가 siteScope 안에 있는지 확인
    if (attendanceLogId && siteScope && typeof siteScope === 'object' && 'siteId' in siteScope) {
      const log = await prisma.attendanceLog.findFirst({
        where: { id: attendanceLogId, ...siteScope },
        select: { id: true },
      })
      if (!log) return siteAccessDenied()
    }

    const where = {
      ...siteScope,
      ...(attendanceLogId ? { attendanceLogId } : {}),
      ...(workerId ? { workerId } : {}),
      ...(photoType ? { photoType } : {}),
    }

    const [total, photos] = await Promise.all([
      prisma.attendancePhotoEvidence.count({ where }),
      prisma.attendancePhotoEvidence.findMany({
        where,
        include: {
          worker: { select: { name: true, phone: true } },
        },
        orderBy: { capturedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: photos.map(p => ({
          id: p.id,
          attendanceLogId: p.attendanceLogId,
          workerId: p.workerId,
          workerName: p.worker.name,
          workerPhone: p.worker.phone,
          siteId: p.siteId,
          photoType: p.photoType,
          filePath: p.filePath,
          fileSizeBytes: p.fileSizeBytes,
          capturedAt: p.capturedAt,
          latitude: p.latitude,
          longitude: p.longitude,
          uploadedAt: p.uploadedAt,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (err) {
    console.error('[admin/attendance/photos GET]', err)
    return internalError()
  }
}
