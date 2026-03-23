/**
 * GET  /api/admin/workers/[id]/sensitive  — 마스킹값 조회 (일반 관리자)
 * POST /api/admin/workers/[id]/sensitive  — 민감정보 입력/수정 (노무 담당자 이상)
 *
 * 원문 복호화는 /sensitive/decrypt (별도 엔드포인트)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { encryptOrNull } from '@/lib/crypto/encrypt'
import { hmacHashOrNull } from '@/lib/crypto/hash'
import { maskRrn, maskPhone, maskAddress, maskName } from '@/lib/crypto/mask'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'

const sensitiveSchema = z.object({
  legalName:            z.string().min(2).max(50).optional(),
  rrn:                  z.string().regex(/^\d{13}$/, '주민등록번호는 숫자 13자리로 입력하세요.').optional(),
  phone:                z.string().regex(/^\d{10,11}$/, '전화번호는 숫자 10-11자리로 입력하세요.').optional(),
  address:              z.string().max(200).optional(),
  idVerified:           z.boolean().optional(),
  idDocumentType:       z.string().optional(),
  idVerificationMethod: z.enum(['IN_PERSON', 'SECURE_DOCUMENT', 'ADMIN_MANUAL']).optional(),
  idVerificationNote:   z.string().max(500).optional(),
})

type Params = { params: { id: string } }

/**
 * GET — 마스킹값 + 확인 결과만 반환 (원문 없음)
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const worker = await prisma.worker.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const profile = await prisma.workerSensitiveProfile.findUnique({
      where: { workerId: params.id },
      select: {
        id: true,
        legalName: true,
        rrnMasked: true,
        phoneMasked: true,
        addressMasked: true,
        idVerified: true,
        idDocumentType: true,
        idVerificationMethod: true,
        idVerifiedBy: true,
        idVerifiedAt: true,
        idVerificationNote: true,
        collectedBy: true,
        collectedAt: true,
        updatedAt: true,
        // 암호화 원문 제외 (rrnEncrypted, phoneEncrypted 등)
      },
    })

    return NextResponse.json({
      success: true,
      data: profile ?? null,
      hasData: profile !== null,
    })
  } catch (err) {
    console.error('[admin/workers/[id]/sensitive GET]', err)
    return internalError()
  }
}

/**
 * POST — 민감정보 입력/수정 (MUTATE_ROLES 이상)
 * 원문 수신 → 암호화 저장 → 마스킹값 저장 → HMAC 해시 저장
 * 원문은 응답에 포함하지 않음
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const worker = await prisma.worker.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = sensitiveSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const {
      legalName, rrn, phone, address,
      idVerified, idDocumentType, idVerificationMethod, idVerificationNote,
    } = parsed.data

    const now = new Date()

    // RRN 중복검사 (다른 근로자가 이미 등록한 경우)
    if (rrn) {
      const rrnHash = hmacHashOrNull(rrn)
      const dup = await prisma.workerSensitiveProfile.findFirst({
        where: { rrnHash, workerId: { not: params.id } },
        select: { workerId: true },
      })
      if (dup) return badRequest('이미 등록된 주민등록번호입니다.')
    }

    const upsertData = {
      ...(legalName !== undefined ? { legalName } : {}),
      ...(rrn !== undefined ? {
        rrnEncrypted: encryptOrNull(rrn),
        rrnMasked:    maskRrn(rrn),
        rrnHash:      hmacHashOrNull(rrn),
      } : {}),
      ...(phone !== undefined ? {
        phoneEncrypted: encryptOrNull(phone),
        phoneMasked:    maskPhone(phone),
        phoneHash:      hmacHashOrNull(phone),
      } : {}),
      ...(address !== undefined ? {
        addressEncrypted: encryptOrNull(address),
        addressMasked:    maskAddress(address),
      } : {}),
      ...(idVerified !== undefined ? { idVerified } : {}),
      ...(idDocumentType !== undefined ? { idDocumentType } : {}),
      ...(idVerificationMethod !== undefined ? { idVerificationMethod } : {}),
      ...(idVerificationNote !== undefined ? { idVerificationNote } : {}),
      ...(idVerified ? { idVerifiedBy: session.sub, idVerifiedAt: now } : {}),
      collectedBy: session.sub,
      collectedAt: now,
    }

    const profile = await prisma.workerSensitiveProfile.upsert({
      where: { workerId: params.id },
      create: { workerId: params.id, ...upsertData },
      update: upsertData,
      select: {
        id: true,
        legalName: true,
        rrnMasked: true,
        phoneMasked: true,
        addressMasked: true,
        idVerified: true,
        updatedAt: true,
      },
    })

    // 수집 항목 목록 (감사로그용)
    const collectedFields = [
      rrn && 'RRN',
      phone && 'Phone',
      address && 'Address',
      legalName && 'LegalName',
      idVerified && 'IdVerified',
    ].filter(Boolean)

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'SENSITIVE_PROFILE_UPDATED',
      targetType: 'WorkerSensitiveProfile',
      targetId: profile.id,
      summary: `민감정보 입력/수정: ${worker.name} — 항목: ${collectedFields.join(', ')}`,
      metadataJson: { workerId: params.id, collectedFields },
    })

    // 컴플라이언스 상태 자동 갱신
    await prisma.workerComplianceStatus.upsert({
      where: { workerId: params.id },
      create: {
        workerId: params.id,
        basicIdentityChecked: idVerified ?? false,
        rrnCollected: !!rrn,
        addressCollected: !!address,
        updatedBy: session.sub,
      },
      update: {
        ...(idVerified !== undefined ? { basicIdentityChecked: idVerified } : {}),
        ...(rrn ? { rrnCollected: true } : {}),
        ...(address ? { addressCollected: true } : {}),
        updatedBy: session.sub,
      },
    })

    return NextResponse.json({
      success: true,
      message: '민감정보가 저장되었습니다.',
      data: profile,  // 마스킹값만 반환
    })
  } catch (err) {
    console.error('[admin/workers/[id]/sensitive POST]', err)
    return internalError()
  }
}
