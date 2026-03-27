import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  password: z.string().min(8).max(100).optional(),
  isActive: z.boolean().optional(),
})

/**
 * PATCH /api/admin/company-admins/[id]
 * 업체 관리자 수정 (이름/비밀번호/활성화) — SUPER_ADMIN 전용
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const target = await prisma.adminUser.findUnique({ where: { id: params.id } })
    if (!target || target.role !== 'COMPANY_ADMIN') return notFound('업체 관리자를 찾을 수 없습니다.')

    const data: Record<string, unknown> = {}
    if (parsed.data.name) data.name = parsed.data.name
    if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 12)
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive

    const updated = await prisma.adminUser.update({ where: { id: params.id }, data })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'COMPANY_ADMIN_UPDATE',
      targetType: 'AdminUser',
      targetId: params.id,
      summary: `업체 관리자 수정: ${updated.name} (${updated.email})`,
    })

    return ok({ id: updated.id, name: updated.name, email: updated.email, isActive: updated.isActive })
  } catch (err) {
    console.error('[company-admins PATCH]', err)
    return internalError()
  }
}
