import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

/**
 * PATCH /api/admin/worker-requests/[id]
 * 근로자 요청 상태 업데이트 (관리자 처리)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params
    const body = await req.json()
    const { status, adminMemo } = body as { status?: string; adminMemo?: string }

    const allowed = ['REVIEWED', 'RESOLVED', 'REJECTED']
    if (status && !allowed.includes(status)) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 })
    }

    const existing = await prisma.workerRequest.findUnique({ where: { id } })
    if (!existing) return notFound()

    const updated = await prisma.workerRequest.update({
      where: { id },
      data: {
        ...(status    ? { status: status as never, reviewedBy: session.sub, reviewedAt: new Date() } : {}),
        ...(adminMemo !== undefined ? { adminMemo } : {}),
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      actionType:  'WORKER_REQUEST_UPDATE',
      targetType:  'WorkerRequest',
      targetId:    id,
      summary:     `근로자 요청 상태 변경: ${status ?? '(상태 유지)'} / 메모: ${adminMemo ?? ''}`,
      afterJson:   { status, adminMemo },
    })

    return NextResponse.json({ success: true, request: updated })
  } catch (err) {
    console.error('[PATCH /api/admin/worker-requests/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
