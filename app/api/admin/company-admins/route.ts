import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

const createSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  companyId: z.string().min(1),
})

/**
 * GET /api/admin/company-admins
 * 업체 관리자 계정 목록 (SUPER_ADMIN 전용)
 */
export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const admins = await prisma.adminUser.findMany({
      where: { role: 'COMPANY_ADMIN' },
      include: { company: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return ok(admins.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      companyId: a.companyId,
      companyName: a.company?.companyName ?? '-',
      isActive: a.isActive,
      lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })))
  } catch (err) {
    console.error('[company-admins GET]', err)
    return internalError()
  }
}

/**
 * POST /api/admin/company-admins
 * 업체 관리자 계정 생성 (SUPER_ADMIN 전용)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { name, email, password, companyId } = parsed.data

    // 업체 존재 확인
    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) return badRequest('존재하지 않는 업체입니다.')

    // 이메일 중복 확인
    const exists = await prisma.adminUser.findUnique({ where: { email } })
    if (exists) return badRequest('이미 사용 중인 이메일입니다.')

    const passwordHash = await bcrypt.hash(password, 12)

    const admin = await prisma.adminUser.create({
      data: { name, email, passwordHash, role: 'COMPANY_ADMIN', companyId, isActive: true },
    })

    return ok({ id: admin.id, name: admin.name, email: admin.email, companyId: admin.companyId }, '업체 관리자 계정이 생성되었습니다.', 201)
  } catch (err) {
    console.error('[company-admins POST]', err)
    return internalError()
  }
}
