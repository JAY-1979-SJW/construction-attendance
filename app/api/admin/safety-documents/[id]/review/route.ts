/**
 * POST /api/admin/safety-documents/[id]/review
 * 관리자가 안전문서를 승인 또는 반려
 * body: { action: 'APPROVE' | 'REJECT', rejectReason?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'

const schema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectReason: z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ success: false, message: '인증 필요' }, { status: 401 })
  const deny = requireRole(session, MUTATE_ROLES)
  if (deny) return deny

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.errors[0].message }, { status: 400 })
  }

  const { action, rejectReason } = parsed.data

  if (action === 'REJECT' && !rejectReason?.trim()) {
    return NextResponse.json({ success: false, message: '반려 사유를 입력하세요.' }, { status: 400 })
  }

  const doc = await prisma.safetyDocument.findUnique({
    where: { id: params.id },
    include: { worker: { select: { name: true } } },
  })
  if (!doc) return NextResponse.json({ success: false, message: '문서 없음' }, { status: 404 })

  if (action === 'APPROVE' && doc.status === 'APPROVED') {
    return NextResponse.json({ success: false, message: '이미 승인된 문서입니다.' }, { status: 409 })
  }

  const now = new Date()
  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED'

  await prisma.safetyDocument.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      reviewedAt: now,
      reviewedBy: session.sub,
      rejectReason: action === 'REJECT' ? rejectReason!.trim() : null,
    },
  })

  await writeAdminAuditLog({
    adminId: session.sub,
    actionType: action === 'APPROVE' ? 'SAFETY_DOC_APPROVED' : 'SAFETY_DOC_REJECTED',
    targetType: 'SafetyDocument',
    targetId: params.id,
    description: `안전문서 ${action === 'APPROVE' ? '승인' : '반려'}: ${doc.documentType} / ${doc.worker.name}${rejectReason ? ` (사유: ${rejectReason})` : ''}`,
  })

  return NextResponse.json({ success: true, data: { status: newStatus, reviewedAt: now } })
}
