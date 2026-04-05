import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'
import { badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit'
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

    // Rate limiting: IP + email 기준 각각 5회/1분
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const ipCheck = checkRateLimit(`login:ip:${ip}`, { maxAttempts: 10, windowMs: 60_000 })
    const emailCheck = checkRateLimit(`login:email:${email}`, { maxAttempts: 5, windowMs: 60_000 })

    if (!ipCheck.allowed || !emailCheck.allowed) {
      const retryMs = Math.max(ipCheck.retryAfterMs, emailCheck.retryAfterMs)
      const retrySec = Math.ceil(retryMs / 1000)
      writeAuditLog({
        actionType: 'ADMIN_LOGIN_RATE_LIMITED',
        actorType: 'SYSTEM',
        summary: `Rate limit 초과: ${email} (IP: ${ip})`,
        metadataJson: { email, ip },
        ipAddress: ip,
      })
      return NextResponse.json(
        { success: false, message: `로그인 시도가 너무 많습니다. ${retrySec}초 후 다시 시도해주세요.` },
        { status: 429 }
      )
    }

    const admin = await prisma.adminUser.findUnique({ where: { email }, select: { id: true, name: true, email: true, passwordHash: true, role: true, isActive: true, companyId: true } })

    // 계정 없음 → 승인대기 신청 여부 확인
    if (!admin) {
      const pendingRequest = await prisma.companyAdminRequest.findFirst({
        where: { email, status: 'PENDING' },
        select: { id: true },
      })
      writeAuditLog({
        actionType: 'ADMIN_LOGIN_FAILED',
        actorType: 'SYSTEM',
        summary: `로그인 실패 (계정 미존재): ${email}`,
        metadataJson: { email, reason: 'NOT_FOUND', hasPendingRequest: !!pendingRequest },
        ipAddress: ip,
      })
      if (pendingRequest) {
        return NextResponse.json(
          { success: false, message: '승인 대기 중인 계정입니다.' },
          { status: 403 }
        )
      }
      return unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.')
    }

    // 비활성 계정
    if (!admin.isActive) {
      writeAuditLog({
        actionType: 'ADMIN_LOGIN_FAILED',
        actorType: 'SYSTEM',
        summary: `로그인 실패 (비활성 계정): ${email}`,
        metadataJson: { email, reason: 'INACTIVE' },
        ipAddress: ip,
      })
      return NextResponse.json(
        { success: false, message: '비활성 처리된 계정입니다. 관리자에게 문의하세요.' },
        { status: 403 }
      )
    }

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) {
      writeAuditLog({
        actionType: 'ADMIN_LOGIN_FAILED',
        actorType: 'ADMIN',
        actorUserId: admin.id,
        summary: `로그인 실패 (비밀번호 불일치): ${admin.name} (${email})`,
        metadataJson: { email },
        ipAddress: ip,
      })
      return unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.')
    }

    // 로그인 성공 → rate limit 초기화
    resetRateLimit(`login:ip:${ip}`)
    resetRateLimit(`login:email:${email}`)

    const token = await signToken({
      sub: admin.id,
      type: 'admin',
      role: admin.role,
      name: admin.name,
      companyId: admin.companyId ?? undefined,
      teamName: (admin as typeof admin & { teamName?: string | null }).teamName ?? undefined,
    })

    await writeAuditLog({
      adminId: admin.id,
      actionType: 'ADMIN_LOGIN',
      targetType: 'AdminUser',
      targetId: admin.id,
      actorRole: admin.role,
      description: `관리자 로그인: ${admin.name} (${admin.email})`,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    // 모든 관리자 역할은 /admin 포털 사용
    const portal = '/admin'

    const response = NextResponse.json({
      success: true,
      data: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, companyId: admin.companyId },
      portal,
    })
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[admin/auth/login]', err)
    return internalError()
  }
}
