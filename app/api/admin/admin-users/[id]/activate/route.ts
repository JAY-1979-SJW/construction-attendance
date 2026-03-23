import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// POST /api/admin/admin-users/[id]/activate
// 외부 관리자 활성화 (조건부)
// 조건: 소속 회사 VERIFIED + 현장 배정 있음
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const user = await prisma.adminUser.findUnique({
    where: { id },
    include: {
      company: {
        select: { companyName: true, externalVerificationStatus: true },
      },
    },
  })
  if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })

  const conditions: { key: string; label: string; met: boolean }[] = []

  // 조건 1: 회사 인증 (EXTERNAL_SITE_ADMIN만 적용)
  if (user.role === 'EXTERNAL_SITE_ADMIN') {
    const vs = user.company?.externalVerificationStatus
    conditions.push({
      key: 'company_verified',
      label: '소속 회사 사업자 인증 완료',
      met: vs === 'VERIFIED',
    })
  }

  // 조건 2: 현장 배정 있음 (SITE_ADMIN, EXTERNAL_SITE_ADMIN)
  if (['SITE_ADMIN', 'EXTERNAL_SITE_ADMIN'].includes(user.role)) {
    const assignmentCount = await prisma.siteAdminAssignment.count({
      where: { userId: id, isActive: true },
    })
    conditions.push({
      key: 'site_assigned',
      label: '담당 현장 배정 완료',
      met: assignmentCount > 0,
    })
  }

  const unmetConditions = conditions.filter((c) => !c.met)

  if (unmetConditions.length > 0) {
    return NextResponse.json({
      success: false,
      error: '활성화 조건을 충족하지 않았습니다.',
      code: 'ACTIVATION_CONDITIONS_NOT_MET',
      conditions,
      unmet: unmetConditions.map((c) => c.label),
    }, { status: 422 })
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data: { isActive: true },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'ADMIN_USER_ACTIVATE',
    targetType: 'AdminUser',
    targetId: id,
    summary: `관리자 활성화: ${user.name} (${user.role})`,
    metadataJson: { companyId: user.companyId, conditions },
  })

  return NextResponse.json({
    success: true,
    data: { id: updated.id, isActive: updated.isActive },
    conditions,
  })
}
