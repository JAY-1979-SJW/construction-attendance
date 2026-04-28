/**
 * GET   /api/admin/admin-users/[id]  — 관리자 계정 상세 조회 (배정 현장 포함)
 * PATCH /api/admin/admin-users/[id]  — 역할·소속 회사 수정 (SUPER_ADMIN 전용)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, notFound, internalError, unauthorized } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { SUPER_ADMIN_ONLY_ROLES } from '@/lib/policies/security-policy'
import { revokeUserTokens } from '@/lib/auth/user-revocation'

const patchSchema = z.object({
  role:      z.enum(['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER', 'COMPANY_ADMIN', 'SITE_ADMIN', 'EXTERNAL_SITE_ADMIN']).optional(),
  companyId: z.string().nullable().optional(),
  name:      z.string().min(1).max(50).optional(),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY_ROLES)
    if (deny) return deny

    const { id } = await params
    const user = await prisma.adminUser.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, companyName: true } },
        siteAdminAssignments: {
          where: { isActive: true },
          include: {
            site:    { select: { id: true, name: true, address: true } },
            company: { select: { id: true, companyName: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    })
    if (!user) return notFound('관리자를 찾을 수 없습니다.')

    return ok({
      id:            user.id,
      name:          user.name,
      email:         user.email,
      role:          user.role,
      companyId:     user.companyId,
      companyName:   user.company?.companyName ?? null,
      isActive:      user.isActive,
      lastLoginAt:   user.lastLoginAt?.toISOString() ?? null,
      createdAt:     user.createdAt.toISOString(),
      siteAssignments: user.siteAdminAssignments.map((a) => ({
        id:          a.id,
        siteId:      a.siteId,
        siteName:    a.site.name,
        siteAddress: a.site.address,
        companyId:   a.companyId,
        companyName: a.company.companyName,
        assignedAt:  a.assignedAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[admin-users GET id]', err)
    return internalError()
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY_ROLES)
    if (deny) return deny

    const { id } = await params
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { role, companyId, name } = parsed.data

    const current = await prisma.adminUser.findUnique({ where: { id } })
    if (!current) return notFound('관리자를 찾을 수 없습니다.')

    // 자기 자신의 역할 변경 금지
    if (id === session.sub && role && role !== current.role) {
      return NextResponse.json(
        { success: false, message: '자기 자신의 역할은 변경할 수 없습니다.' },
        { status: 403 }
      )
    }

    // COMPANY_ADMIN, EXTERNAL_SITE_ADMIN 변경 시 companyId 필수
    const newRole = role ?? current.role
    if (['COMPANY_ADMIN', 'EXTERNAL_SITE_ADMIN'].includes(newRole)) {
      const newCompanyId = companyId !== undefined ? companyId : current.companyId
      if (!newCompanyId) {
        return badRequest(`${newRole} 역할은 소속 회사(companyId)가 필요합니다.`)
      }
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(role      !== undefined ? { role: role as never } : {}),
        ...(companyId !== undefined ? { companyId: ['COMPANY_ADMIN', 'EXTERNAL_SITE_ADMIN'].includes(newRole) ? companyId : null } : {}),
        ...(name      !== undefined ? { name } : {}),
      },
    })

    // 역할 변경 시 기존 세션 무효화 (다음 요청 시 재로그인 필요)
    if (role && role !== current.role) {
      revokeUserTokens(id)
    }

    await writeAuditLog({
      actorUserId:  session.sub,
      actorType:    'ADMIN',
      actionType:   'UPDATE_ADMIN_USER',
      targetType:   'AdminUser',
      targetId:     id,
      summary:      `관리자 정보 수정: ${updated.name} (${current.role} → ${updated.role})`,
      metadataJson: {
        before: { role: current.role, companyId: current.companyId, name: current.name },
        after:  { role: updated.role, companyId: updated.companyId, name: updated.name },
      },
    })

    return ok({
      id:        updated.id,
      name:      updated.name,
      role:      updated.role,
      companyId: updated.companyId,
    }, '수정되었습니다.')
  } catch (err) {
    console.error('[admin-users PATCH id]', err)
    return internalError()
  }
}
