/**
 * POST /api/admin/workers/[id]/sensitive/decrypt
 * 민감정보 원문 복호화 조회 — 별도 엔드포인트
 *
 * 정책:
 *   - SUPER_ADMIN 또는 별도 LABOR_ADMIN 권한 필요 (현재: SUPER_ADMIN만)
 *   - 사유(reason) 필수 입력
 *   - 조회 항목 선택 필수 (fields)
 *   - 감사로그 의무 기록 (RRN_DECRYPT_VIEW 등)
 *   - 원문은 응답에만 포함, 재저장 금지
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { decryptOrNull } from '@/lib/crypto/encrypt'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'

const ALLOWED_FIELDS = ['rrn', 'phone', 'address', 'legalName'] as const
type DecryptField = typeof ALLOWED_FIELDS[number]

const decryptSchema = z.object({
  fields: z.array(z.enum(ALLOWED_FIELDS)).min(1, '조회할 항목을 선택하세요.'),
  reason: z.string().min(5, '복호화 사유를 5자 이상 입력하세요.').max(200),
})

const ACTION_MAP: Record<DecryptField, string> = {
  rrn:      'RRN_DECRYPT_VIEW',
  phone:    'PHONE_DECRYPT_VIEW',
  address:  'ADDRESS_DECRYPT_VIEW',
  legalName: 'LEGAL_NAME_VIEW',
}

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    // 복호화는 SUPER_ADMIN만 허용 (추후 LABOR_ADMIN 권한 추가 시 변경)
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const worker = await prisma.worker.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = decryptSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { fields, reason } = parsed.data

    const profile = await prisma.workerSensitiveProfile.findUnique({
      where: { workerId: params.id },
    })
    if (!profile) return notFound('저장된 민감정보가 없습니다.')

    // 복호화
    const result: Record<string, string | null> = {}
    for (const field of fields) {
      switch (field) {
        case 'rrn':
          result.rrn = decryptOrNull(profile.rrnEncrypted)
          break
        case 'phone':
          result.phone = decryptOrNull(profile.phoneEncrypted)
          break
        case 'address':
          result.address = decryptOrNull(profile.addressEncrypted)
          break
        case 'legalName':
          result.legalName = profile.legalName ?? null
          break
      }
    }

    // 각 항목별 감사로그 기록
    const ipAddress = req.headers.get('x-forwarded-for') ?? undefined
    for (const field of fields) {
      await writeAuditLog({
        actorUserId: session.sub,
        actorType: 'ADMIN',
        actionType: ACTION_MAP[field],
        targetType: 'WorkerSensitiveProfile',
        targetId: profile.id,
        summary: `원문 복호화 조회: ${worker.name} — 항목: ${field} — 사유: ${reason}`,
        reason,
        metadataJson: { workerId: params.id, field },
        ipAddress,
      })
    }

    return NextResponse.json({
      success: true,
      data: result,
      // 응답에 경고 포함
      _warning: '이 데이터는 민감 개인정보입니다. 화면 캡처·공유·재저장을 금지합니다.',
    })
  } catch (err) {
    console.error('[admin/workers/[id]/sensitive/decrypt POST]', err)
    return internalError()
  }
}
