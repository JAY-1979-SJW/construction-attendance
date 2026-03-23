import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// PATCH /api/admin/sites/[id]/company-assignments/[assignmentId]
// participationStatus 변경: PLANNED → ACTIVE / ACTIVE → STOPPED / STOPPED → ACTIVE
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: siteId, assignmentId } = await params
  const body = await req.json().catch(() => ({}))
  const { participationStatus } = body

  if (!participationStatus || !['PLANNED', 'ACTIVE', 'STOPPED'].includes(participationStatus)) {
    return NextResponse.json({ error: 'participationStatus는 PLANNED/ACTIVE/STOPPED 중 하나여야 합니다.' }, { status: 400 })
  }

  const assignment = await prisma.siteCompanyAssignment.findFirst({
    where: { id: assignmentId, siteId },
    include: {
      company: { select: { companyName: true, externalVerificationStatus: true } },
    },
  })
  if (!assignment) return NextResponse.json({ error: '배정 내역을 찾을 수 없습니다.' }, { status: 404 })

  // ACTIVE 전환 조건 검증: 외부회사는 VERIFIED 상태여야 함
  if (participationStatus === 'ACTIVE') {
    const vs = assignment.company.externalVerificationStatus
    // externalVerificationStatus가 있으면 (외부회사면) VERIFIED여야 함
    if (vs !== null && vs !== 'VERIFIED') {
      return NextResponse.json({
        error: '외부회사 사업자 인증이 완료되어야 운영 활성화할 수 있습니다.',
        code: 'COMPANY_VERIFICATION_REQUIRED',
        currentStatus: vs,
      }, { status: 422 })
    }
  }

  const updated = await prisma.siteCompanyAssignment.update({
    where: { id: assignmentId },
    data: { participationStatus: participationStatus as never },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'SITE_COMPANY_STATUS_CHANGE',
    targetType: 'SiteCompanyAssignment',
    targetId: assignmentId,
    summary: `참여회사 상태 변경: ${assignment.company.companyName} → ${participationStatus}`,
    metadataJson: { siteId, previous: assignment.participationStatus, next: participationStatus },
  })

  return NextResponse.json({ success: true, data: updated })
}
