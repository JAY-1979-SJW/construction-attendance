/**
 * POST /api/admin/safety-documents/[id]/sign
 * 관리자가 안전문서에 서명 → 검토 요청 상태로 전환
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const doc = await prisma.safetyDocument.findUnique({
    where: { id: params.id },
    include: { worker: { select: { name: true } } },
  })
  if (!doc) return NextResponse.json({ error: '문서 없음' }, { status: 404 })
  if (doc.status === 'APPROVED') {
    return NextResponse.json({ error: '이미 승인된 문서입니다' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const { signedBy } = body as { signedBy?: string }

  const now = new Date()

  await prisma.safetyDocument.update({
    where: { id: params.id },
    data: {
      status:   'REVIEW_REQUESTED',
      signedAt: now,
      signedBy: signedBy || doc.worker.name,
    },
  })

  void writeAuditLog({
    actorUserId: session.sub, actorType: 'ADMIN',
    actionType: 'SAFETY_DOC_SIGN',
    targetType: 'SafetyDocument', targetId: params.id,
    summary: `안전문서 서명 (검토요청): ${doc.documentType} / ${doc.worker.name}`,
    afterJson: { status: 'REVIEW_REQUESTED', signedAt: now },
  })

  return NextResponse.json({ success: true, data: { signedAt: now, status: 'REVIEW_REQUESTED' } })
}
