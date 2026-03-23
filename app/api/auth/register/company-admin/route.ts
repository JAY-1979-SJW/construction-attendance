import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { badRequest, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { sendEmail } from '@/lib/email/send-email'
import { companyAdminRequestedEmail } from '@/lib/email/templates'

// 사업자등록번호 형식: 숫자·하이픈 허용, 정규화 후 10자리
const businessNumberSchema = z
  .string()
  .transform(v => v.replace(/[^0-9]/g, ''))
  .refine(v => v.length === 10, '사업자등록번호는 10자리 숫자로 입력하세요.')

const schema = z.object({
  applicantName:      z.string().min(2, '담당자명을 입력하세요.').max(30),
  phone:              z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력하세요.'),
  email:              z.string().email('올바른 이메일을 입력하세요.').optional(),
  companyName:        z.string().min(1, '업체명을 입력하세요.').max(100),
  businessNumber:     businessNumberSchema,
  representativeName: z.string().max(30).optional(),
  contactPhone:       z.string().max(20).optional(),
  jobTitle:           z.string().max(30).optional(),
})

/**
 * POST /api/auth/register/company-admin
 * 업체 관리자 신청.
 *
 * 응답 status:
 *   DUPLICATE_BUSINESS_NUMBER — 이미 등록된 사업자번호
 *   REQUESTED                 — 신청 접수 완료 (관리자 검토 대기)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0].message)
    }

    const { applicantName, phone, email, companyName, businessNumber,
            representativeName, contactPhone, jobTitle } = parsed.data

    // 사업자번호 중복 확인 (기존 Company + 대기 중인 신청 모두)
    const [existingCompany, existingRequest] = await Promise.all([
      prisma.company.findUnique({ where: { businessNumber } }),
      prisma.companyAdminRequest.findFirst({
        where: { businessNumber, status: 'PENDING' },
      }),
    ])

    if (existingCompany || existingRequest) {
      return NextResponse.json({
        success: false,
        status: 'DUPLICATE_BUSINESS_NUMBER',
        message: '이미 등록되었거나 검토 중인 사업자등록번호입니다.',
      })
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null

    const req = await prisma.companyAdminRequest.create({
      data: {
        applicantName,
        phone,
        email: email ?? null,
        companyName,
        businessNumber,
        representativeName: representativeName ?? null,
        contactPhone: contactPhone ?? null,
        jobTitle: jobTitle ?? null,
        status: 'PENDING',
      },
    })

    await writeAuditLog({
      actorType: 'SYSTEM',
      actionType: 'COMPANY_ADMIN_REQUESTED',
      targetType: 'CompanyAdminRequest',
      targetId: req.id,
      summary: `업체 관리자 신청 — ${companyName} (${businessNumber}) by ${applicantName}`,
      metadataJson: { companyName, businessNumber, applicantName, phone },
      ipAddress: ipAddress ?? undefined,
    })

    // 접수 확인 이메일 (이메일 있는 경우)
    if (email) {
      const tpl = companyAdminRequestedEmail({ applicantName, companyName })
      await sendEmail({ to: email, ...tpl })
    }

    return NextResponse.json({
      success: true,
      status: 'REQUESTED',
      data: { requestId: req.id },
      message: '업체 관리자 신청이 접수되었습니다. 검토 후 연락드리겠습니다.',
    })
  } catch (err) {
    console.error('[auth/register/company-admin]', err)
    return internalError()
  }
}
