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

const SAFETY_DOC_LABELS: Record<string, string> = {
  SAFETY_EDUCATION_NEW_HIRE: '신규채용 안전교육',
  SAFETY_EDUCATION_TASK_CHANGE: '작업변경 교육',
  PPE_PROVISION: '보호구 지급',
  SAFETY_PLEDGE: '안전수칙 서약',
  WORK_CONDITIONS_RECEIPT: '근로조건 수령확인',
  PRIVACY_CONSENT: '개인정보 동의',
  BASIC_SAFETY_EDU_CONFIRM: '기초안전교육 확인',
  SITE_SAFETY_RULES_CONFIRM: '현장 안전수칙 확인',
  HEALTH_DECLARATION: '건강 이상 없음 각서',
  HEALTH_CERTIFICATE: '건강 증명서',
}

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
    include: { worker: { select: { id: true, name: true } } },
  })
  if (!doc) return NextResponse.json({ success: false, message: '문서 없음' }, { status: 404 })

  if (action === 'APPROVE' && doc.status === 'APPROVED') {
    return NextResponse.json({ success: false, message: '이미 승인된 문서입니다.' }, { status: 409 })
  }

  const now = new Date()
  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
  const docLabel = SAFETY_DOC_LABELS[doc.documentType] ?? doc.documentType

  await prisma.safetyDocument.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      reviewedAt: now,
      reviewedBy: session.sub,
      rejectReason: action === 'REJECT' ? rejectReason!.trim() : null,
    },
  })

  // ── 근로자 알림 생성 ─────────────────────────────────────
  await prisma.workerNotification.create({
    data: {
      workerId: doc.worker.id,
      type: action === 'APPROVE' ? 'DOC_APPROVED' : 'DOC_REJECTED',
      title: action === 'APPROVE'
        ? `${docLabel} 승인`
        : `${docLabel} 반려`,
      body: action === 'APPROVE'
        ? `${docLabel} 서류가 승인되었습니다.`
        : `${docLabel} 서류가 반려되었습니다. 사유: ${rejectReason!.trim()}`,
      linkUrl: `/my/documents/${params.id}`,
      referenceId: params.id,
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
