import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, badRequest, forbidden, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { sendEmail } from '@/lib/email/send-email'
import { companyAdminApprovedEmail, companyAdminRejectedEmail } from '@/lib/email/templates'
import bcrypt from 'bcryptjs'

/**
 * POST /api/admin/company-admin-requests/bulk
 * Body:
 *   { action: 'approve', ids: string[] }
 *   { action: 'reject',  ids: string[], rejectReason: string }
 * Response: { succeeded: number, failed: number, failedItems: { id, reason }[] }
 *
 * SUPER_ADMIN 전용. PENDING 상태인 항목만 처리.
 */

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    ids: z.array(z.string()).min(1, 'ids가 필요합니다').max(100, '최대 100건까지 처리 가능합니다'),
  }),
  z.object({
    action: z.literal('reject'),
    ids: z.array(z.string()).min(1, 'ids가 필요합니다').max(100, '최대 100건까지 처리 가능합니다'),
    rejectReason: z.string().min(1, '반려 사유를 입력하세요.').max(200),
  }),
])

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (session.role !== 'SUPER_ADMIN') return forbidden('슈퍼관리자 전용입니다.')

    const body = await req.json().catch(() => null)
    if (!body) return badRequest('요청 본문이 필요합니다')

    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { action, ids } = parsed.data

    // FK 선조회 원칙
    const reqs = await prisma.companyAdminRequest.findMany({
      where: { id: { in: ids } },
    })
    const reqMap = new Map(reqs.map((r) => [r.id, r]))

    const succeeded: string[] = []
    const failedItems: { id: string; reason: string }[] = []

    if (action === 'approve') {
      for (const id of ids) {
        const car = reqMap.get(id)
        if (!car) { failedItems.push({ id, reason: 'NOT_FOUND' }); continue }
        if (car.status !== 'PENDING') { failedItems.push({ id, reason: 'NOT_PENDING' }); continue }

        try {
          const rawPassword = Math.random().toString(36).slice(-10) + 'A1!'
          const passwordHash = await bcrypt.hash(rawPassword, 10)

          const { adminUser, company } = await prisma.$transaction(async (tx) => {
            let co = await tx.company.findUnique({ where: { businessNumber: car.businessNumber } })
            if (!co) {
              co = await tx.company.create({
                data: {
                  companyName: car.companyName,
                  businessNumber: car.businessNumber,
                  representativeName: car.representativeName ?? null,
                  contactPhone: car.contactPhone ?? null,
                  companyType: 'OTHER',
                  status: 'ACTIVE',
                },
              })
            }
            const au = await tx.adminUser.create({
              data: {
                name: car.applicantName,
                email: car.email ?? `${car.phone}@company.local`,
                passwordHash,
                role: 'COMPANY_ADMIN',
                companyId: co.id,
                isActive: true,
              },
            })
            await tx.companyAdminRequest.update({
              where: { id },
              data: {
                status: 'APPROVED',
                reviewedAt: new Date(),
                reviewedBy: session.sub,
                createdAdminUserId: au.id,
              },
            })
            return { adminUser: au, company: co }
          })

          await writeAuditLog({
            actorUserId: session.sub,
            actorType: 'ADMIN',
            actorRole: session.role,
            actionType: 'COMPANY_ADMIN_APPROVED',
            targetType: 'CompanyAdminRequest',
            targetId: id,
            companyId: company.id,
            summary: `[대량] 업체 관리자 승인 — ${car.companyName} / ${car.applicantName}`,
            metadataJson: { bulk: true, companyId: company.id, adminUserId: adminUser.id },
          })

          if (car.email) {
            try {
              const tpl = companyAdminApprovedEmail({
                applicantName: car.applicantName,
                companyName: car.companyName,
                temporaryPassword: rawPassword,
              })
              await sendEmail({ to: car.email, ...tpl })
            } catch (emailErr) {
              console.error(`[company-admin-bulk/approve] 이메일 발송 실패 id=${id}`, emailErr)
            }
          }

          succeeded.push(id)
        } catch (err) {
          console.error(`[company-admin-bulk/approve] id=${id}`, err)
          failedItems.push({ id, reason: 'INTERNAL_ERROR' })
        }
      }
    } else {
      // action === 'reject'
      const { rejectReason } = parsed.data as { action: 'reject'; ids: string[]; rejectReason: string }

      for (const id of ids) {
        const car = reqMap.get(id)
        if (!car) { failedItems.push({ id, reason: 'NOT_FOUND' }); continue }
        if (car.status !== 'PENDING') { failedItems.push({ id, reason: 'NOT_PENDING' }); continue }

        try {
          await prisma.companyAdminRequest.update({
            where: { id },
            data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: session.sub, rejectReason },
          })

          await writeAuditLog({
            actorUserId: session.sub,
            actorType: 'ADMIN',
            actorRole: session.role,
            actionType: 'COMPANY_ADMIN_REJECTED',
            targetType: 'CompanyAdminRequest',
            targetId: id,
            summary: `[대량] 업체 관리자 신청 반려 — ${car.companyName} / ${car.applicantName}: ${rejectReason}`,
            reason: rejectReason,
            metadataJson: { bulk: true },
          })

          if (car.email) {
            try {
              const tpl = companyAdminRejectedEmail({
                applicantName: car.applicantName,
                companyName: car.companyName,
                rejectReason,
              })
              await sendEmail({ to: car.email, ...tpl })
            } catch (emailErr) {
              console.error(`[company-admin-bulk/reject] 이메일 발송 실패 id=${id}`, emailErr)
            }
          }

          succeeded.push(id)
        } catch (err) {
          console.error(`[company-admin-bulk/reject] id=${id}`, err)
          failedItems.push({ id, reason: 'INTERNAL_ERROR' })
        }
      }
    }

    return ok({ succeeded: succeeded.length, failed: failedItems.length, failedItems })
  } catch (err) {
    console.error('[admin/company-admin-requests/bulk]', err)
    return internalError()
  }
}
