import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, badRequest } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const ALLOWED_LEVELS = ['VERBAL', 'WRITTEN', 'FINAL'] as const

/**
 * GET /api/admin/workers/[id]/warnings
 * 경고 기록 목록 조회
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

    const warnings = await prisma.workerWarningRecord.findMany({
      where:   { workerId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ warnings })
  } catch (err) {
    console.error('[GET /warnings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/workers/[id]/warnings
 * 경고 기록 생성 — ADMIN 이상만 가능
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
    const { warningLevel, reason, detailMemo, relatedAttendanceDate } = body as {
      warningLevel: string
      reason: string
      detailMemo?: string
      relatedAttendanceDate?: string
    }

    if (!ALLOWED_LEVELS.includes(warningLevel as never)) return badRequest('warningLevel 값이 올바르지 않습니다.')
    if (!reason?.trim()) return badRequest('reason은 필수입니다.')

    const worker = await prisma.worker.findUnique({
      where:  { id: workerId },
      select: { companyAssignments: { where: { isActive: true }, select: { companyId: true }, take: 1 } },
    })
    if (!worker) return notFound()

    const companyId = worker.companyAssignments[0]?.companyId ?? ''

    const warning = await prisma.workerWarningRecord.create({
      data: {
        workerId,
        companyId,
        issuedBy:             session.sub,
        warningLevel:         warningLevel as never,
        reason:               reason.trim(),
        detailMemo:           detailMemo?.trim(),
        relatedAttendanceDate,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      companyId,
      actionType:  'WORKER_WARNING_ISSUED',
      targetType:  'WORKER',
      targetId:    workerId,
      summary:     `경고 발행 (${warningLevel}): ${reason.slice(0, 80)}`,
    })

    return NextResponse.json({ success: true, warning }, { status: 201 })
  } catch (err) {
    console.error('[POST /warnings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
