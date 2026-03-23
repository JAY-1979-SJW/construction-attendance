import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  conflict,
  internalError,
} from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// ─── GET /api/admin/workers/[id] — 근로자 상세 조회 ────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params

    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        _count: { select: { devices: { where: { isActive: true } }, attendanceLogs: true } },
        companyAssignments: {
          include: { company: { select: { id: true, companyName: true, companyType: true, businessNumber: true } } },
          orderBy: [{ isPrimary: 'desc' }, { validFrom: 'desc' }],
        },
        siteAssignments: {
          include: {
            site: { select: { id: true, name: true, address: true } },
            company: { select: { id: true, companyName: true } },
          },
          orderBy: [{ isActive: 'desc' }, { isPrimary: 'desc' }, { assignedFrom: 'desc' }],
        },
        insuranceStatuses: {
          include: { company: { select: { id: true, companyName: true } } },
          orderBy: { updatedAt: 'desc' },
        },
        // 신규 암호화 계좌 마스킹값 (레거시 bankAccount 대체)
        bankAccountSecure: {
          select: { bankName: true, accountNumberMasked: true },
        },
      },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    // 레거시 bankName / bankAccount 는 응답에서 제거 — 신규 구조(bankAccountSecure)만 반환
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { bankName: _legacyBankName, bankAccount: _legacyBankAccount, ...workerSafe } = worker as typeof worker & { bankName?: string; bankAccount?: string }
    return ok(workerSafe)
  } catch (err) {
    console.error('[admin/workers/[id] GET]', err)
    return internalError()
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호 형식이 아닙니다.').optional(),
  jobTitle: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})

// ─── PUT /api/admin/workers/[id] — 근로자 정보 수정 ─────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id } = await params

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    if (Object.keys(parsed.data).length === 0) {
      return badRequest('수정할 항목이 없습니다.')
    }

    const worker = await prisma.worker.findUnique({ where: { id } })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    // 전화번호 변경 시 중복 검사
    if (parsed.data.phone && parsed.data.phone !== worker.phone) {
      const duplicate = await prisma.worker.findUnique({
        where: { phone: parsed.data.phone },
      })
      if (duplicate) return conflict('이미 사용 중인 휴대폰 번호입니다.')
    }

    const updated = await prisma.worker.update({
      where: { id },
      data: parsed.data,
    })

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'UPDATE_WORKER',
      targetType: 'Worker',
      targetId: id,
      description: `근로자 수정: ${updated.name} (${updated.phone}) | 변경항목: ${Object.keys(parsed.data).join(', ')}`,
    })

    return ok(
      {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        jobTitle: updated.jobTitle,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      },
      '근로자 정보가 수정되었습니다.'
    )
  } catch (err) {
    console.error('[admin/workers/[id] PUT]', err)
    return internalError()
  }
}

// ─── DELETE /api/admin/workers/[id] — 종료 처리 체크리스트 미완료 시 차단 ─────
//
// 직접 isActive=false 변경은 금지.
// 반드시 /termination-review/[reviewId]/confirm 을 통해 종료 처리해야 함.
//
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params

  // SUPER_ADMIN은 긴급 상황용으로 직접 비활성화 허용 (단, 감사로그 기록)
  if (session.role === 'SUPER_ADMIN') {
    const worker = await prisma.worker.findUnique({
      where: { id },
      include: { _count: { select: { attendanceLogs: true } } },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')
    if (!worker.isActive) return badRequest('이미 비활성화된 근로자입니다.')

    await prisma.$transaction([
      prisma.workerDevice.updateMany({ where: { workerId: id, isActive: true }, data: { isActive: false } }),
      prisma.worker.update({ where: { id }, data: { isActive: false, accountStatus: 'SUSPENDED' } }),
    ])

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      actionType:  'WORKER_FORCE_DEACTIVATED',
      targetType:  'Worker',
      targetId:    id,
      summary:     `[SUPER_ADMIN 긴급 비활성화] ${worker.name} — 종료 체크리스트 미완료`,
    })

    return ok({ id }, '[SUPER_ADMIN] 근로자가 긴급 비활성화되었습니다. 종료 체크리스트를 사후 처리해 주세요.')
  }

  // 일반 관리자 — 종료 체크리스트 완료 여부 확인
  const confirmedReview = await prisma.workerTerminationReview.findFirst({
    where: { workerId: id, status: 'CONFIRMED' },
  })

  if (!confirmedReview) {
    return NextResponse.json({
      error: '종료 처리는 체크리스트를 완료해야 합니다.',
      redirect: `/admin/workers/${id}/termination`,
    }, { status: 403 })
  }

  return ok({ id }, '종료 처리는 체크리스트를 통해 완료되었습니다.')
}
