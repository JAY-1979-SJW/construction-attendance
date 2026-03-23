/**
 * POST /api/admin/workers/[id]/bank/decrypt
 * 계좌 원문 복호화 — SUPER_ADMIN 전용, 사유 필수, 감사로그 의무
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { decryptOrNull } from '@/lib/crypto/encrypt'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'

const schema = z.object({
  reason: z.string().min(5, '복호화 사유를 5자 이상 입력하세요.').max(200),
})

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const worker = await prisma.worker.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { reason } = parsed.data

    const bank = await prisma.workerBankAccountSecure.findUnique({ where: { workerId: params.id } })
    if (!bank) return notFound('저장된 계좌정보가 없습니다.')

    const result = {
      bankCode:          bank.bankCode,
      bankName:          bank.bankName,
      accountNumber:     decryptOrNull(bank.accountNumberEncrypted),
      accountHolderName: decryptOrNull(bank.accountHolderNameEncrypted),
    }

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'ACCOUNT_DECRYPT_VIEW',
      targetType: 'WorkerBankAccountSecure',
      targetId: bank.id,
      summary: `계좌 원문 복호화 조회: ${worker.name} — 사유: ${reason}`,
      reason,
      metadataJson: { workerId: params.id },
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({
      success: true,
      data: result,
      _warning: '이 데이터는 민감 개인정보입니다. 화면 캡처·공유·재저장을 금지합니다.',
    })
  } catch (err) {
    console.error('[admin/workers/[id]/bank/decrypt POST]', err)
    return internalError()
  }
}
