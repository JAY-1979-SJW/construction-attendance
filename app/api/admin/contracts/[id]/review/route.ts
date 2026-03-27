/**
 * POST /api/admin/contracts/[id]/review
 * 관리자가 계약서를 승인(ACTIVE) 또는 반려(REJECTED)
 * body: { action: 'APPROVE' | 'REJECT', rejectReason?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole, MUTATE_ROLES, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'

const CONTRACT_KIND_LABELS: Record<string, string> = {
  EMPLOYMENT: '근로계약서',
  SERVICE: '용역계약서',
  OUTSOURCING: '업무위탁계약서',
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

  const contract = await prisma.workerContract.findUnique({
    where: { id: params.id },
    include: { worker: { select: { id: true, name: true } } },
  })
  if (!contract) return NextResponse.json({ success: false, message: '계약 없음' }, { status: 404 })
  if (contract.siteId && !await canAccessSite(session, contract.siteId)) return siteAccessDenied()

  // REVIEW_REQUESTED 또는 레거시 SIGNED 상태만 검토 가능
  if (contract.contractStatus !== 'REVIEW_REQUESTED' && contract.contractStatus !== 'SIGNED') {
    return NextResponse.json({ success: false, message: '검토 가능한 상태가 아닙니다 (REVIEW_REQUESTED만 가능)' }, { status: 409 })
  }

  const now = new Date()
  const contractLabel = CONTRACT_KIND_LABELS[contract.contractKind] ?? '계약서'

  if (action === 'APPROVE') {
    await prisma.workerContract.update({
      where: { id: params.id },
      data: {
        contractStatus: 'ACTIVE',
        isActive: true,
        notes: contract.notes
          ? `${contract.notes}\n[REVIEW_APPROVED:${now.toISOString()}:${session.sub}]`
          : `[REVIEW_APPROVED:${now.toISOString()}:${session.sub}]`,
      },
    })

    // 이전 ACTIVE 계약 종료 처리
    const prevActive = await prisma.workerContract.findFirst({
      where: {
        workerId: contract.workerId,
        contractStatus: 'ACTIVE',
        id: { not: params.id },
      },
    })
    if (prevActive) {
      await prisma.workerContract.update({
        where: { id: prevActive.id },
        data: { contractStatus: 'ENDED', isActive: false, endDate: now.toISOString().slice(0, 10) },
      })
    }

    // 근로자 알림
    await prisma.workerNotification.create({
      data: {
        workerId: contract.worker.id,
        type: 'CONTRACT_APPROVED',
        title: `${contractLabel} 승인`,
        body: `${contractLabel}이(가) 승인되었습니다.`,
        linkUrl: `/contracts/${params.id}`,
        referenceId: params.id,
      },
    })
  } else {
    await prisma.workerContract.update({
      where: { id: params.id },
      data: {
        contractStatus: 'REJECTED',
        isActive: false,
        notes: contract.notes
          ? `${contract.notes}\n[REVIEW_REJECTED:${now.toISOString()}:${session.sub}:${rejectReason!.trim()}]`
          : `[REVIEW_REJECTED:${now.toISOString()}:${session.sub}:${rejectReason!.trim()}]`,
      },
    })

    // 근로자 알림
    await prisma.workerNotification.create({
      data: {
        workerId: contract.worker.id,
        type: 'CONTRACT_REJECTED',
        title: `${contractLabel} 반려`,
        body: `${contractLabel}이(가) 반려되었습니다. 사유: ${rejectReason!.trim()}`,
        linkUrl: `/contracts/${params.id}`,
        referenceId: params.id,
      },
    })
  }

  const newStatus = action === 'APPROVE' ? 'ACTIVE' : 'REJECTED'

  await writeAdminAuditLog({
    adminId: session.sub,
    actionType: action === 'APPROVE' ? 'CONTRACT_APPROVED' : 'CONTRACT_REJECTED',
    targetType: 'WorkerContract',
    targetId: params.id,
    description: `계약서 ${action === 'APPROVE' ? '승인' : '반려'}: ${contract.worker.name}${rejectReason ? ` (사유: ${rejectReason})` : ''}`,
  })

  return NextResponse.json({ success: true, data: { contractStatus: newStatus, reviewedAt: now } })
}
