/**
 * GET  /api/admin/workers/[id]/bank  — 계좌 마스킹 조회
 * POST /api/admin/workers/[id]/bank  — 계좌 입력/수정
 * POST /api/admin/workers/[id]/bank/decrypt — 계좌 원문 복호화 (별도 라우트)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { encryptOrNull } from '@/lib/crypto/encrypt'
import { hmacHashOrNull } from '@/lib/crypto/hash'
import { maskAccountNumber, maskName } from '@/lib/crypto/mask'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'

const bankSchema = z.object({
  bankCode:            z.string().max(10).optional(),
  bankName:            z.string().max(50).optional(),
  accountNumber:       z.string().regex(/^\d{10,16}$/, '계좌번호는 숫자 10-16자리로 입력하세요.').optional(),
  accountHolderName:   z.string().min(2).max(50).optional(),
})

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const worker = await prisma.worker.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const bank = await prisma.workerBankAccountSecure.findUnique({
      where: { workerId: params.id },
      select: {
        id: true,
        bankCode: true,
        bankName: true,
        accountNumberMasked: true,
        accountHolderNameMasked: true,
        verifiedBy: true,
        verifiedAt: true,
        updatedAt: true,
        // 암호화 원문 제외
      },
    })

    return NextResponse.json({ success: true, data: bank ?? null })
  } catch (err) {
    console.error('[admin/workers/[id]/bank GET]', err)
    return internalError()
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const worker = await prisma.worker.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = bankSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { bankCode, bankName, accountNumber, accountHolderName } = parsed.data

    const now = new Date()
    const upsertData = {
      ...(bankCode ? { bankCode } : {}),
      ...(bankName ? { bankName } : {}),
      ...(accountNumber ? {
        accountNumberEncrypted: encryptOrNull(accountNumber),
        accountNumberMasked:    maskAccountNumber(accountNumber),
        accountNumberHash:      hmacHashOrNull(accountNumber),
      } : {}),
      ...(accountHolderName ? {
        accountHolderNameEncrypted: encryptOrNull(accountHolderName),
        accountHolderNameMasked:    maskName(accountHolderName),
      } : {}),
      collectedBy: session.sub,
      collectedAt: now,
    }

    const bank = await prisma.workerBankAccountSecure.upsert({
      where: { workerId: params.id },
      create: { workerId: params.id, ...upsertData },
      update: upsertData,
      select: {
        id: true,
        bankCode: true,
        bankName: true,
        accountNumberMasked: true,
        accountHolderNameMasked: true,
        updatedAt: true,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'SENSITIVE_PROFILE_UPDATED',
      targetType: 'WorkerBankAccountSecure',
      targetId: bank.id,
      summary: `계좌정보 입력/수정: ${worker.name} — ${bankName ?? ''}`,
      metadataJson: { workerId: params.id, bankName },
    })

    // 컴플라이언스 상태 갱신
    if (accountNumber) {
      await prisma.workerComplianceStatus.upsert({
        where: { workerId: params.id },
        create: { workerId: params.id, bankInfoCollected: true, updatedBy: session.sub },
        update: { bankInfoCollected: true, updatedBy: session.sub },
      })
    }

    return NextResponse.json({ success: true, message: '계좌정보가 저장되었습니다.', data: bank })
  } catch (err) {
    console.error('[admin/workers/[id]/bank POST]', err)
    return internalError()
  }
}
