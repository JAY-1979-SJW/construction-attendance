import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { revokeUserTokens } from '@/lib/auth/user-revocation'

// GET /api/admin/auth/me — 현재 관리자 정보 조회
export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const admin = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    if (!admin) return unauthorized()

    return ok(admin)
  } catch (err) {
    console.error('[admin/auth/me GET]', err)
    return internalError()
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email('유효한 이메일을 입력하세요.').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다.').optional(),
}).refine(
  (d) => !d.newPassword || d.currentPassword,
  { message: '새 비밀번호를 변경하려면 현재 비밀번호를 입력하세요.', path: ['currentPassword'] }
)

// PATCH /api/admin/auth/me — 이름/이메일/비밀번호 변경
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { name, email, currentPassword, newPassword } = parsed.data

    const admin = await prisma.adminUser.findUnique({ where: { id: session.sub } })
    if (!admin) return unauthorized()

    // 비밀번호 변경 시 현재 비밀번호 검증
    let passwordHash: string | undefined
    if (newPassword) {
      const valid = await bcrypt.compare(currentPassword!, admin.passwordHash)
      if (!valid) return badRequest('현재 비밀번호가 올바르지 않습니다.')
      passwordHash = await bcrypt.hash(newPassword, 12)
    }

    // 이메일 중복 확인
    if (email && email !== admin.email) {
      const exists = await prisma.adminUser.findUnique({ where: { email } })
      if (exists) return badRequest('이미 사용 중인 이메일입니다.')
    }

    const updated = await prisma.adminUser.update({
      where: { id: session.sub },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(passwordHash && { passwordHash }),
      },
      select: { id: true, name: true, email: true, role: true },
    })

    const changed: string[] = []
    if (name) changed.push('이름')
    if (email) changed.push('이메일')
    if (newPassword) changed.push('비밀번호')

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'UPDATE_ADMIN_PROFILE',
      targetType: 'AdminUser',
      targetId: session.sub,
      description: `관리자 본인 정보 변경: ${updated.name} | 변경항목: ${changed.join(', ')}`,
    })

    // 비밀번호 변경 시 기존 토큰 전부 무효화 (현재 세션 포함)
    if (newPassword) {
      revokeUserTokens(session.sub)
    }

    return ok(updated, '정보가 변경되었습니다.')
  } catch (err) {
    console.error('[admin/auth/me PATCH]', err)
    return internalError()
  }
}
