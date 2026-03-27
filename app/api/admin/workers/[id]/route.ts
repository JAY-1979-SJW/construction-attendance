import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, buildWorkerScopeWhere } from '@/lib/auth/guards'
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

    // ── site scope 검증 — worker가 접근 가능한 범위에 있는지 확인 ──────────────
    const workerScope = await buildWorkerScopeWhere(session)
    if (workerScope === false) return notFound('근로자를 찾을 수 없습니다.')
    // ────────────────────────────────────────────────────────────────────────

    const worker = await prisma.worker.findFirst({
      where: { id, ...workerScope },
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
        // 투입 가능 판정용 서류/계약 현황
        workerDocuments: {
          where: { documentType: { in: ['CONTRACT', 'SAFETY_CERT'] } },
          select: { documentType: true, status: true },
        },
        safetyDocuments: {
          where: {
            documentType: { in: [
              'BASIC_SAFETY_EDU_CONFIRM', 'SAFETY_EDUCATION_NEW_HIRE',
              'WORK_CONDITIONS_RECEIPT',
              'HEALTH_DECLARATION', 'HEALTH_CERTIFICATE',
              'PRIVACY_CONSENT',
            ] },
          },
          select: { documentType: true, status: true },
        },
        contracts: {
          where: { isActive: true },
          select: { id: true },
          take: 1,
        },
        consents: {
          where: { agreed: true, consentType: { in: ['PRIVACY_POLICY', 'TERMS_OF_SERVICE'] } },
          select: { consentType: true },
        },
      },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    // ── 투입 가능 여부 계산 (APPROVED 기준) ──────────────────────
    type DocStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'REVIEW_REQUESTED' | 'APPROVED' | 'REJECTED'
    function safetyDocStatus(types: string[]): DocStatus {
      const docs = worker.safetyDocuments.filter(d => types.includes(d.documentType))
      if (docs.length === 0) return 'NOT_SUBMITTED'
      if (docs.some(d => d.status === 'APPROVED')) return 'APPROVED'
      if (docs.some(d => d.status === 'REJECTED')) return 'REJECTED'
      if (docs.some(d => d.status === 'REVIEW_REQUESTED')) return 'REVIEW_REQUESTED'
      if (docs.some(d => d.status === 'SIGNED')) return 'REVIEW_REQUESTED' // legacy SIGNED = 검토 대기
      return 'SUBMITTED' // DRAFT or ISSUED
    }

    const contractStatus: DocStatus = (
      worker.workerDocuments.some(d => d.documentType === 'CONTRACT' && d.status === 'APPROVED')
      || worker.contracts.length > 0
    ) ? 'APPROVED'
      : worker.workerDocuments.some(d => d.documentType === 'CONTRACT')
        || worker.safetyDocuments.some(d => d.documentType === 'WORK_CONDITIONS_RECEIPT')
        ? 'SUBMITTED'
        : 'NOT_SUBMITTED'

    const privacyStatus: DocStatus = worker.consents.some(c => c.consentType === 'PRIVACY_POLICY')
      ? 'APPROVED'
      : safetyDocStatus(['PRIVACY_CONSENT'])

    const healthStatus = safetyDocStatus(['HEALTH_DECLARATION', 'HEALTH_CERTIFICATE'])
    const safetyEduStatus = safetyDocStatus(['BASIC_SAFETY_EDU_CONFIRM', 'SAFETY_EDUCATION_NEW_HIRE'])

    type MissingDoc = { key: string; label: string; actionType: string; docType?: string; status: DocStatus }
    const missingDocs: MissingDoc[] = []
    const rejectedDocs: MissingDoc[] = []

    const docChecks: { key: string; label: string; actionType: string; docType?: string; docStatus: DocStatus }[] = [
      { key: 'CONTRACT', label: '근로계약서', actionType: 'CONTRACT_NEW', docStatus: contractStatus },
      { key: 'PRIVACY', label: '개인정보 동의서', actionType: 'SAFETY_DOC', docType: 'PRIVACY_CONSENT', docStatus: privacyStatus },
      { key: 'HEALTH', label: '건강 각서/진단서', actionType: 'SAFETY_DOC', docType: 'HEALTH_DECLARATION', docStatus: healthStatus },
      { key: 'SAFETY_EDU', label: '안전교육 확인서', actionType: 'SAFETY_DOC', docType: 'BASIC_SAFETY_EDU_CONFIRM', docStatus: safetyEduStatus },
    ]

    for (const check of docChecks) {
      const entry = { key: check.key, label: check.label, actionType: check.actionType, docType: check.docType, status: check.docStatus }
      if (check.docStatus === 'REJECTED') {
        rejectedDocs.push(entry)
      } else if (check.docStatus !== 'APPROVED') {
        missingDocs.push(entry)
      }
    }

    const isApproved = worker.accountStatus === 'APPROVED' || worker.accountStatus === 'ACTIVE'
    let assignmentEligibility: string
    let nextAction: string
    if (!isApproved) {
      assignmentEligibility = 'NOT_APPROVED'
      nextAction = '계정 승인이 필요합니다.'
    } else if (rejectedDocs.length > 0) {
      assignmentEligibility = 'NEEDS_REVISION'
      nextAction = `보완 필요: ${rejectedDocs.map(d => d.label).join(', ')}`
    } else if (missingDocs.length > 0) {
      assignmentEligibility = 'NEEDS_DOCS'
      nextAction = `부족 서류: ${missingDocs.map(d => d.label).join(', ')}`
    } else {
      assignmentEligibility = 'READY'
      nextAction = '현장 배정 가능'
    }

    // 레거시 bankName / bankAccount 는 응답에서 제거 — 신규 구조(bankAccountSecure)만 반환
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { bankName: _legacyBankName, bankAccount: _legacyBankAccount, workerDocuments: _wd, safetyDocuments: _sd, contracts: _ct, consents: _cs, ...workerSafe } = worker as typeof worker & { bankName?: string; bankAccount?: string }
    return ok({
      ...workerSafe,
      assignmentEligibility,
      missingDocs,
      rejectedDocs,
      nextAction,
    })
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

    // ── site scope 검증 ──────────────────────────────────────────────────────
    const workerScope = await buildWorkerScopeWhere(session)
    if (workerScope === false) return notFound('근로자를 찾을 수 없습니다.')
    // ────────────────────────────────────────────────────────────────────────

    const worker = await prisma.worker.findFirst({ where: { id, ...workerScope } })
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
