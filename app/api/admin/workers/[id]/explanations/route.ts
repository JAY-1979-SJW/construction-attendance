import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, badRequest } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

/**
 * GET /api/admin/workers/[id]/explanations
 * 소명 요청 목록 조회
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { id: workerId } = await params

    const explanations = await prisma.workerExplanationRequest.findMany({
      where:   { workerId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ explanations })
  } catch (err) {
    console.error('[GET /explanations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/workers/[id]/explanations
 * 소명 요청 생성
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { id: workerId } = await params
    const body = await req.json()
    const { subject, reason, deadline, relatedWarningId } = body as {
      subject:          string
      reason:           string
      deadline?:        string
      relatedWarningId?: string
    }

    if (!subject?.trim()) return badRequest('subject는 필수입니다.')
    if (!reason?.trim())  return badRequest('reason은 필수입니다.')

    const worker = await prisma.worker.findUnique({
      where:  { id: workerId },
      select: { companyAssignments: { where: { validTo: null }, select: { companyId: true }, take: 1 } },
    })
    if (!worker) return notFound()

    const companyId = worker.companyAssignments[0]?.companyId ?? ''

    const explanation = await prisma.workerExplanationRequest.create({
      data: {
        workerId,
        companyId,
        requestedBy:     session.sub,
        subject:         subject.trim(),
        reason:          reason.trim(),
        deadline:        deadline ? new Date(deadline) : null,
        relatedWarningId,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      companyId,
      actionType:  'WORKER_EXPLANATION_REQUESTED',
      targetType:  'WORKER',
      targetId:    workerId,
      summary:     `소명 요청: ${subject.slice(0, 80)}`,
    })

    return NextResponse.json({ success: true, explanation }, { status: 201 })
  } catch (err) {
    console.error('[POST /explanations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
