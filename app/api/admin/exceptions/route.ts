import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const approveSchema = z.object({
  attendanceLogId: z.string(),
  action: z.enum(['APPROVE', 'REJECT']),
  checkInAt: z.string().optional(),
  checkOutAt: z.string().optional(),
  note: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = 20

    const [total, exceptions] = await Promise.all([
      prisma.attendanceLog.count({ where: { status: 'EXCEPTION' } }),
      prisma.attendanceLog.findMany({
        where: { status: 'EXCEPTION' },
        include: {
          worker: { select: { name: true, phone: true, company: true } },
          site: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return ok({
      items: exceptions.map((e) => ({
        id: e.id,
        workerName: e.worker.name,
        workerPhone: e.worker.phone,
        company: e.worker.company,
        siteName: e.site.name,
        workDate: e.workDate.toISOString().slice(0, 10),
        checkInAt: e.checkInAt?.toISOString() ?? null,
        checkOutAt: e.checkOutAt?.toISOString() ?? null,
        exceptionReason: e.exceptionReason,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('[admin/exceptions GET]', err)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = approveSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { attendanceLogId, action, checkInAt, checkOutAt, note } = parsed.data

    const log = await prisma.attendanceLog.findUnique({ where: { id: attendanceLogId } })
    if (!log) return notFound('출퇴근 기록을 찾을 수 없습니다.')

    if (action === 'APPROVE') {
      await prisma.attendanceLog.update({
        where: { id: attendanceLogId },
        data: {
          status: checkOutAt ? 'COMPLETED' : 'WORKING',
          checkInAt: checkInAt ? new Date(checkInAt) : log.checkInAt,
          checkOutAt: checkOutAt ? new Date(checkOutAt) : log.checkOutAt,
          exceptionReason: note ? `[승인] ${note}` : log.exceptionReason,
        },
      })
    } else {
      await prisma.attendanceLog.update({
        where: { id: attendanceLogId },
        data: {
          exceptionReason: note ? `[반려] ${note}` : '[반려]',
        },
      })
    }

    await writeAuditLog({
      adminId: session.sub,
      actionType: action === 'APPROVE' ? 'APPROVE_EXCEPTION' : 'REJECT_EXCEPTION',
      targetType: 'AttendanceLog',
      targetId: attendanceLogId,
      description: `예외 ${action === 'APPROVE' ? '승인' : '반려'}: ${note ?? ''}`,
    })

    return ok(null, action === 'APPROVE' ? '예외가 승인되었습니다.' : '예외가 반려되었습니다.')
  } catch (err) {
    console.error('[admin/exceptions POST]', err)
    return internalError()
  }
}
