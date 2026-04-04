/**
 * GET  /api/admin/admin-users  — 관리자 계정 전체 목록
 * POST /api/admin/admin-users  — 관리자 계정 생성 (COMPANY_ADMIN, SITE_ADMIN 포함)
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY, unauthorized } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const createSchema = z.object({
  name:      z.string().min(1).max(50),
  email:     z.string().email(),
  password:  z.string().min(8).max(100),
  role:      z.enum(['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER', 'COMPANY_ADMIN', 'SITE_ADMIN', 'EXTERNAL_SITE_ADMIN']),
  companyId: z.string().nullable().optional(),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const { searchParams } = new URL(req.url)
    const role     = searchParams.get('role')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '200'), 500)

    const users = await prisma.adminUser.findMany({
      where: {
        ...(role ? { role: role as never } : {}),
      },
      include: {
        company: { select: { companyName: true, externalVerificationStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
    })

    return ok({
      items: users.map((u) => ({
        id:                          u.id,
        name:                        u.name,
        email:                       u.email,
        role:                        u.role,
        companyId:                   u.companyId,
        companyName:                 u.company?.companyName ?? null,
        companyVerificationStatus:   u.company?.externalVerificationStatus ?? null,
        isActive:                    u.isActive,
        lastLoginAt:                 u.lastLoginAt?.toISOString() ?? null,
        createdAt:                   u.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[admin-users GET]', err)
    return internalError()
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { name, email, password, role, companyId } = parsed.data

    // COMPANY_ADMIN, EXTERNAL_SITE_ADMIN은 companyId 필수
    if (['COMPANY_ADMIN', 'EXTERNAL_SITE_ADMIN'].includes(role) && !companyId) {
      return badRequest(`${role} 역할은 소속 회사(companyId)가 필요합니다.`)
    }
    // 신규 관리자는 HQ_ADMIN 사용 권장 (ADMIN은 레거시)
    // 기존 호환을 위해 ADMIN도 허용하지만 생성 시 HQ_ADMIN 권장

    // 이메일 중복 체크
    const exists = await prisma.adminUser.findUnique({ where: { email } })
    if (exists) return badRequest('이미 사용 중인 이메일입니다.')

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.adminUser.create({
      data: {
        name,
        email,
        passwordHash,
        role:      role as never,
        companyId: ['COMPANY_ADMIN', 'EXTERNAL_SITE_ADMIN'].includes(role) ? (companyId ?? null) : null,
        isActive:  true,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actionType:  'CREATE_ADMIN_USER',
      targetType:  'AdminUser',
      targetId:    user.id,
      summary:     `관리자 계정 생성: ${name} (${role})`,
      metadataJson: { email, role, companyId: companyId ?? null },
    })

    return created(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      '계정이 생성되었습니다.'
    )
  } catch (err) {
    console.error('[admin-users POST]', err)
    return internalError()
  }
}
