import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, badRequest } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

/**
 * GET /api/admin/workers/[id]/termination-review
 * 진행 중인 종료 검토 조회 (가장 최근 DRAFT/IN_PROGRESS)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id: workerId } = await params

    const review = await prisma.workerTerminationReview.findFirst({
      where:   { workerId, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ review })
  } catch (err) {
    console.error('[GET /termination-review]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/workers/[id]/termination-review
 * 종료 검토 시작 + 자동점검 11개 항목 수행
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { id: workerId } = await params

    // 이미 진행 중인 검토가 있으면 반환
    const existing = await prisma.workerTerminationReview.findFirst({
      where: { workerId, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
    })
    if (existing) {
      return NextResponse.json({ review: existing })
    }

    const worker = await prisma.worker.findUnique({
      where:  { id: workerId },
      select: { companyAssignments: { where: { validTo: null }, select: { companyId: true }, take: 1 } },
    })
    if (!worker) return notFound()

    const companyId = worker.companyAssignments[0]?.companyId ?? ''

    // 자동점검 수행
    const autoCheckResult = await runAutoCheck(workerId, companyId)

    const review = await prisma.workerTerminationReview.create({
      data: {
        workerId,
        companyId,
        initiatedBy:        session.sub,
        status:             'IN_PROGRESS',
        autoCheckResultJson: autoCheckResult,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      companyId,
      actionType:  'TERMINATION_REVIEW_STARTED',
      targetType:  'WORKER',
      targetId:    workerId,
      summary:     '종료 처리 검토 시작',
    })

    return NextResponse.json({ review }, { status: 201 })
  } catch (err) {
    console.error('[POST /termination-review]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── 자동점검 11개 항목 ────────────────────────────────────────────────────────

type Severity = 'OK' | 'WARN' | 'DANGER' | 'CRITICAL'

interface CheckItem {
  key:      string
  label:    string
  passed:   boolean
  severity: Severity
  action?:  string  // 보완 액션 코드
}

async function runAutoCheck(workerId: string, companyId: string): Promise<CheckItem[]> {
  const [
    contracts,
    deliveryLogs,
    attendanceLogs,
    warnings,
    notices,
    adjustments,
  ] = await Promise.all([
    prisma.workerContract.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, contractStatus: true, startDate: true, endDate: true, signedAt: true },
    }),
    prisma.documentDeliveryLog.findMany({
      where: { workerId },
      select: { documentType: true, status: true },
    }),
    prisma.attendanceLog.findMany({
      where: { workerId },
      take:  1,
      select: { id: true },
    }),
    prisma.workerWarningRecord.findMany({ where: { workerId }, take: 1 }),
    prisma.workerNoticeRecord.findMany({
      where: { workerId, noticeType: { in: ['TERMINATION', 'CONTRACT_END'] } },
      take:  1,
    }),
    prisma.attendanceAdjustmentLog.findMany({ where: { workerId }, take: 1 }),
  ])

  const latestContract = contracts[0]
  const deliveredTypes = new Set(deliveryLogs.filter(d => d.status === 'DELIVERED').map(d => d.documentType))

  const checks: CheckItem[] = [
    {
      key:    'contract_exists',
      label:  '계약서 존재 여부',
      passed: contracts.length > 0,
      severity: contracts.length > 0 ? 'OK' : 'CRITICAL',
      action: contracts.length > 0 ? undefined : 'CREATE_CONTRACT',
    },
    {
      key:    'contract_signed',
      label:  '계약서 서명 여부',
      passed: !!latestContract?.signedAt,
      severity: latestContract?.signedAt ? 'OK' : 'DANGER',
      action: latestContract && !latestContract.signedAt ? 'REQUEST_SIGNATURE' : undefined,
    },
    {
      key:    'contract_delivered',
      label:  '계약서 교부 여부',
      passed: deliveredTypes.has('CONTRACT') || deliveredTypes.has('DAILY_CONTRACT'),
      severity: (deliveredTypes.has('CONTRACT') || deliveredTypes.has('DAILY_CONTRACT')) ? 'OK' : 'DANGER',
      action: 'REDELIVER_DOCUMENT',
    },
    {
      key:    'contract_period',
      label:  '계약기간 기재 여부',
      passed: !!(latestContract?.startDate),
      severity: latestContract?.startDate ? 'OK' : 'WARN',
      action: undefined,
    },
    {
      key:    'attendance_records',
      label:  '출퇴근 원본기록 존재 여부',
      passed: attendanceLogs.length > 0,
      severity: attendanceLogs.length > 0 ? 'OK' : 'CRITICAL',
      action: undefined,
    },
    {
      key:    'adjustment_reason',
      label:  '공수 수정 사유 기록 여부',
      passed: adjustments.length === 0,  // 수정이 없으면 OK, 있으면 사유 확인 필요
      severity: adjustments.length === 0 ? 'OK' : 'WARN',
      action: undefined,
    },
    {
      key:    'privacy_consent',
      label:  '개인정보 동의서 교부 여부',
      passed: deliveredTypes.has('PRIVACY_CONSENT'),
      severity: deliveredTypes.has('PRIVACY_CONSENT') ? 'OK' : 'WARN',
      action: 'REDELIVER_DOCUMENT',
    },
    {
      key:    'work_conditions',
      label:  '근로조건 설명 확인서 교부 여부',
      passed: deliveredTypes.has('WORK_CONDITIONS_RECEIPT'),
      severity: deliveredTypes.has('WORK_CONDITIONS_RECEIPT') ? 'OK' : 'WARN',
      action: 'REDELIVER_DOCUMENT',
    },
    {
      key:    'warning_records',
      label:  '경고/소명 기록 여부 (해당 시)',
      passed: true,  // 경고 없어도 OK — 체크 정보 제공용
      severity: warnings.length > 0 ? 'OK' : 'OK',
      action: warnings.length === 0 ? 'ADD_WARNING' : undefined,
    },
    {
      key:    'termination_notice',
      label:  '종료통지서 존재 여부',
      passed: notices.length > 0,
      severity: notices.length > 0 ? 'OK' : 'DANGER',
      action: notices.length === 0 ? 'CREATE_NOTICE' : undefined,
    },
    {
      key:    'unsigned_docs',
      label:  '미서명 문서 여부',
      passed: deliveryLogs.filter(d => d.status === 'PENDING').length === 0,
      severity: deliveryLogs.filter(d => d.status === 'PENDING').length === 0 ? 'OK' : 'WARN',
      action: 'REQUEST_SIGNATURE',
    },
  ]

  return checks
}
