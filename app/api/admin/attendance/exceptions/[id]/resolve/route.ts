/**
 * POST /api/admin/attendance/exceptions/[id]/resolve
 * 출퇴근 예외/누락 건 처리
 *
 * 권한: ADMIN 이상
 * 액션:
 *  - SET_CHECKOUT: 퇴근 시간 설정 (MISSING_CHECKOUT → ADJUSTED)
 *  - APPROVE_EXCEPTION: 예외 승인 (EXCEPTION → COMPLETED or ADJUSTED)
 *  - REJECT_EXCEPTION: 예외 거부 (EXCEPTION → MISSING_CHECKOUT)
 *  - MARK_ABSENT: 결근 처리 (MISSING_CHECKOUT/EXCEPTION → ADMIN_MANUAL, checkOut null)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, badRequest } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { id: logId } = await params
    const body = await req.json()
    const { action, checkOutAt, note } = body as {
      action:     'SET_CHECKOUT' | 'APPROVE_EXCEPTION' | 'REJECT_EXCEPTION' | 'MARK_ABSENT'
      checkOutAt?: string  // ISO string (SET_CHECKOUT / APPROVE_EXCEPTION 시)
      note?:      string
    }

    if (!action) return badRequest('action 필드가 필요합니다.')

    const log = await prisma.attendanceLog.findUnique({ where: { id: logId } })
    if (!log) return notFound('출퇴근 기록을 찾을 수 없습니다.')

    // 액션별 처리
    if (action === 'SET_CHECKOUT') {
      if (log.status !== 'MISSING_CHECKOUT') {
        return badRequest('SET_CHECKOUT은 MISSING_CHECKOUT 상태에만 적용 가능합니다.')
      }
      if (!checkOutAt) return badRequest('checkOutAt이 필요합니다.')
      const checkOutDate = new Date(checkOutAt)
      if (isNaN(checkOutDate.getTime())) return badRequest('유효하지 않은 checkOutAt 형식입니다.')

      await prisma.attendanceLog.update({
        where: { id: logId },
        data: {
          checkOutAt: checkOutDate,
          status:     'ADJUSTED',
          adminNote:  note ? `[RESOLVE:SET_CHECKOUT] ${note}` : '[RESOLVE:SET_CHECKOUT]',
        },
      })
    } else if (action === 'APPROVE_EXCEPTION') {
      if (log.status !== 'EXCEPTION') {
        return badRequest('APPROVE_EXCEPTION은 EXCEPTION 상태에만 적용 가능합니다.')
      }
      const newStatus = checkOutAt ? 'ADJUSTED' : 'COMPLETED'
      await prisma.attendanceLog.update({
        where: { id: logId },
        data: {
          checkOutAt: checkOutAt ? new Date(checkOutAt) : log.checkOutAt,
          status:     newStatus,
          adminNote:  note ? `[RESOLVE:APPROVED] ${note}` : '[RESOLVE:APPROVED]',
        },
      })
    } else if (action === 'REJECT_EXCEPTION') {
      if (log.status !== 'EXCEPTION') {
        return badRequest('REJECT_EXCEPTION은 EXCEPTION 상태에만 적용 가능합니다.')
      }
      await prisma.attendanceLog.update({
        where: { id: logId },
        data: {
          status:    'MISSING_CHECKOUT',
          adminNote: note ? `[RESOLVE:REJECTED] ${note}` : '[RESOLVE:REJECTED]',
        },
      })
    } else if (action === 'MARK_ABSENT') {
      await prisma.attendanceLog.update({
        where: { id: logId },
        data: {
          status:    'ADMIN_MANUAL',
          adminNote: note ? `[RESOLVE:ABSENT] ${note}` : '[RESOLVE:ABSENT]',
        },
      })
    } else {
      return badRequest('알 수 없는 action 값입니다.')
    }

    // 감사로그
    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      companyId:   log.companyId ?? undefined,
      actionType:  'ADMIN_ADJUSTMENT',
      targetType:  'ATTENDANCE_LOG',
      targetId:    logId,
      summary:     `출퇴근 ${action}: ${note ?? ''}`,
    })

    return NextResponse.json({ success: true, action, logId })
  } catch (err) {
    console.error('[POST /attendance/exceptions/[id]/resolve]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
