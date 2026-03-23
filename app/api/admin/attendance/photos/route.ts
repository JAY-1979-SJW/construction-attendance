import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, internalError } from '@/lib/utils/response'

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
    const photoType = searchParams.get('photoType') ?? undefined
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = 20

    const where = {
      ...(attendanceLogId ? { attendanceLogId } : {}),
      ...(workerId ? { workerId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(photoType ? { photoType: photoType as 'CHECK_IN' | 'CHECK_OUT' } : {}),
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
