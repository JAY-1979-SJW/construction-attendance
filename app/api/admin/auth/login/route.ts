import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'
import { badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import bcrypt from 'bcryptjs'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { email, password } = parsed.data

    const admin = await prisma.adminUser.findUnique({ where: { email }, select: { id: true, name: true, email: true, passwordHash: true, role: true, isActive: true, companyId: true } })
    if (!admin || !admin.isActive) return unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.')

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) return unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.')

    const token = await signToken({
      sub: admin.id,
      type: 'admin',
      role: admin.role,
      companyId: admin.companyId ?? undefined,
    })

    await writeAuditLog({
      adminId: admin.id,
      actionType: 'ADMIN_LOGIN',
      targetType: 'AdminUser',
      targetId: admin.id,
      description: `관리자 로그인: ${admin.name} (${admin.email})`,
    })

    // 역할에 따라 리다이렉트 경로 결정
    const portal = admin.role === 'COMPANY_ADMIN' ? '/company' : '/admin'

    const response = NextResponse.json({
      success: true,
      data: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, companyId: admin.companyId },
      portal,
    })
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[admin/auth/login]', err)
    return internalError()
  }
}
