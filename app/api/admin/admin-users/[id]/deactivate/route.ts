import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { SUPER_ADMIN_ONLY_ROLES } from '@/lib/policies/security-policy'
import { revokeUserTokens } from '@/lib/auth/user-revocation'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const deny = requireRole(session, SUPER_ADMIN_ONLY_ROLES)
  if (deny) return deny

  const { id } = await params

  const user = await prisma.adminUser.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })

  await prisma.adminUser.update({ where: { id }, data: { isActive: false } })

  // 비활성화된 사용자의 기존 토큰 즉시 무효화
  revokeUserTokens(id)

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'ADMIN_USER_DEACTIVATE',
    targetType: 'AdminUser',
    targetId: id,
    summary: `관리자 비활성화: ${user.name} (${user.role})`,
    metadataJson: { companyId: user.companyId },
  })

  return NextResponse.json({ success: true })
}
