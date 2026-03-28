/**
 * POST /api/auth/register/company-admin
 * 업체관리자 가입 신청 → CompanyAdminRequest 생성 (SUPER_ADMIN 승인 대기)
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, conflict, internalError } from '@/lib/utils/response'

const schema = z.object({
  applicantName:     z.string().min(2, '이름은 2자 이상').max(30),
  phone:             z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력하세요'),
  email:             z.string().email('올바른 이메일을 입력하세요').optional(),
  companyName:       z.string().min(1, '회사명을 입력하세요').max(100),
  businessNumber:    z.string().regex(/^\d{10}$/, '사업자등록번호는 숫자 10자리입니다'),
  representativeName: z.string().max(30).optional(),
  contactPhone:      z.string().max(20).optional(),
  jobTitle:          z.string().max(50).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const data = parsed.data

    // 동일 사업자번호 + 동일 전화번호로 중복 신청 방지
    const existing = await prisma.companyAdminRequest.findFirst({
      where: {
        businessNumber: data.businessNumber,
        phone: data.phone,
        status: 'PENDING',
      },
    })
    if (existing) return conflict('이미 동일한 신청이 접수되어 있습니다. 승인을 기다려 주세요.')

    // 동일 이메일 AdminUser 중복 확인
    if (data.email) {
      const emailExists = await prisma.adminUser.findFirst({
        where: { email: data.email },
        select: { id: true },
      })
      if (emailExists) return conflict('이미 등록된 이메일입니다.')
    }

    const request = await prisma.companyAdminRequest.create({
      data: {
        applicantName: data.applicantName,
        phone: data.phone,
        email: data.email ?? null,
        companyName: data.companyName,
        businessNumber: data.businessNumber,
        representativeName: data.representativeName ?? null,
        contactPhone: data.contactPhone ?? null,
        jobTitle: data.jobTitle ?? null,
      },
    })

    return ok(
      { requestId: request.id },
      '업체관리자 가입 신청이 접수되었습니다. 관리자 승인 후 이메일로 안내드립니다.'
    )
  } catch (err) {
    console.error('[register/company-admin]', err)
    return internalError()
  }
}
