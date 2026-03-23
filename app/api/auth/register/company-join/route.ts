import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { badRequest, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { sendEmail } from '@/lib/email/send-email'
import { companyAdminRequestedEmail } from '@/lib/email/templates'

const schema = z.object({
  companyId:     z.string().min(1, '업체를 선택하세요.'),
  applicantName: z.string().min(2, '담당자명을 입력하세요.').max(30),
  phone:         z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력하세요.'),
  email:         z.string().email('올바른 이메일을 입력하세요.').optional(),
  jobTitle:      z.string().max(30).optional(),
  message:       z.string().max(300).optional(),
})

/**
 * POST /api/auth/register/company-join
 * 기존 업체에 관리자로 합류 신청.
 *
 * 응답 status:
 *   COMPANY_NOT_FOUND   — 해당 업체가 존재하지 않음
 *   DUPLICATE_PENDING   — 동일 업체·연락처로 대기 중인 신청 있음
 *   REQUESTED           — 신청 접수 완료
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { companyId, applicantName, phone, email, jobTitle, message } = parsed.data

    // 업체 존재 확인
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true, status: true },
    })
    if (!company || company.status !== 'ACTIVE') {
      return NextResponse.json({
        success: false,
        status: 'COMPANY_NOT_FOUND',
        message: '해당 업체를 찾을 수 없습니다.',
      })
    }

    // 동일 업체 + 연락처로 대기 중인 신청 확인
    const existingRequest = await prisma.companyJoinRequest.findFirst({
      where: { companyId, phone, status: 'PENDING' },
    })
    if (existingRequest) {
      return NextResponse.json({
        success: false,
        status: 'DUPLICATE_PENDING',
        message: '이미 해당 업체에 대기 중인 신청이 있습니다.',
      })
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null

    const req = await prisma.companyJoinRequest.create({
      data: {
        companyId,
        applicantName,
        phone,
        email: email ?? null,
        jobTitle: jobTitle ?? null,
        message: message ?? null,
        status: 'PENDING',
      },
    })

    await writeAuditLog({
      actorType: 'SYSTEM',
      actionType: 'COMPANY_ADMIN_REQUESTED',
      targetType: 'CompanyJoinRequest',
      targetId: req.id,
      companyId,
      summary: `기존 업체 관리자 합류 신청 — ${company.companyName} by ${applicantName} (${phone})`,
      metadataJson: { companyId, companyName: company.companyName, applicantName, phone },
      ipAddress: ipAddress ?? undefined,
    })

    if (email) {
      const tpl = companyAdminRequestedEmail({ applicantName, companyName: company.companyName })
      await sendEmail({ to: email, ...tpl })
    }

    return NextResponse.json({
      success: true,
      status: 'REQUESTED',
      data: { requestId: req.id },
      message: '합류 신청이 접수되었습니다. 검토 후 연락드리겠습니다.',
    })
  } catch (err) {
    console.error('[auth/register/company-join]', err)
    return internalError()
  }
}
