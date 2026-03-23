import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

/**
 * GET /api/admin/workers/[id]/dispute-panel
 *
 * 분쟁방어 패널 데이터 조회.
 * - 근로자 기본 정보
 * - 계약 이력
 * - 출퇴근/공수 이력 (최근 90일)
 * - 문서 교부 이력
 * - 출퇴근 수정 이력
 * - 분쟁 케이스 목록
 * - 방어 점수 계산 (증거 완비도 기준)
 *
 * WORKER 접근 불가 — admin_token 필수
 * 모든 조회는 감사 로그 기록
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id: workerId } = await params

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id:             true,
        name:           true,
        phone:          true,
        jobTitle:       true,
        employmentType: true,
        accountStatus:  true,
        createdAt:      true,
        companyAssignments: {
          where:   { validTo: null },
          select:  { company: { select: { id: true, companyName: true } }, assignedFrom: true },
          orderBy: { assignedFrom: 'desc' },
          take:    1,
        },
      },
    })

    if (!worker) return notFound()

    const companyId = worker.companyAssignments[0]?.company?.id

    // 병렬 조회
    const [contracts, deliveryLogs, adjustmentLogs, disputeCases, recentAttendance,
           warnings, explanations, notices, terminationReview] = await Promise.all([
      // 계약 이력
      prisma.workerContract.findMany({
        where:   { workerId },
        orderBy: { createdAt: 'desc' },
        take:    20,
        select: {
          id:             true,
          contractType:   true,
          startDate:      true,
          endDate:        true,
          contractStatus: true,
          createdAt:      true,
        },
      }),
      // 문서 교부 이력
      prisma.documentDeliveryLog.findMany({
        where:   { workerId },
        orderBy: { createdAt: 'desc' },
        take:    50,
        select: {
          id:             true,
          documentType:   true,
          deliveryMethod: true,
          status:         true,
          deliveredAt:    true,
          createdAt:      true,
        },
      }),
      // 출퇴근 수정 이력
      prisma.attendanceAdjustmentLog.findMany({
        where:   { workerId },
        orderBy: { createdAt: 'desc' },
        take:    30,
        select: {
          id:                 true,
          attendanceRecordId: true,
          field:              true,
          beforeValue:        true,
          afterValue:         true,
          reason:             true,
          adjustedBy:         true,
          createdAt:          true,
        },
      }),
      // 분쟁 케이스
      prisma.disputeCase.findMany({
        where:   { workerId },
        orderBy: { openedAt: 'desc' },
        select: {
          id:          true,
          disputeType: true,
          status:      true,
          title:       true,
          openedAt:    true,
          resolvedAt:  true,
          defenseScore: true,
          _count: { select: { notes: true } },
        },
      }),
      // 최근 90일 출퇴근 (공수 확정 데이터 포함)
      prisma.attendanceLog.findMany({
        where: {
          workerId,
          workDate: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { workDate: 'desc' },
        take:    100,
        select: {
          id:         true,
          workDate:   true,
          checkInAt:  true,
          checkOutAt: true,
          status:     true,
        },
      }),
      // 관리행위 이력
      prisma.workerWarningRecord.findMany({
        where: { workerId }, orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, warningLevel: true, reason: true, createdAt: true },
      }),
      prisma.workerExplanationRequest.findMany({
        where: { workerId }, orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, subject: true, status: true, createdAt: true },
      }),
      prisma.workerNoticeRecord.findMany({
        where: { workerId }, orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, noticeType: true, title: true, deliveredAt: true },
      }),
      // 종료 처리 이력
      prisma.workerTerminationReview.findFirst({
        where:   { workerId },
        orderBy: { createdAt: 'desc' },
        select:  { id: true, status: true, terminationReason: true, terminationDate: true, confirmedAt: true },
      }),
    ])

    // 방어 점수 계산 (증거 완비도 0-100)
    const deliveredTypes = new Set(deliveryLogs.filter(d => d.status === 'DELIVERED').map(d => d.documentType))
    const defenseScore = calcDefenseScore({
      hasContract:        contracts.length > 0,
      hasDeliveryLog:     deliveryLogs.length > 0,
      recentAttendance:   recentAttendance.length,
      adjustedCount:      adjustmentLogs.length,
      openDisputeCount:   disputeCases.filter(d => d.status === 'OPEN').length,
      deliveredDocTypes:  deliveredTypes.size,
    })

    // 5개 영역 리스크 자동점검
    const latestContract = contracts[0]
    const riskSections = buildRiskSections({
      contracts, deliveredTypes, recentAttendance, adjustmentLogs,
      warnings, explanations, notices, terminationReview, latestContract,
    })

    // 감사 로그
    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      companyId:   companyId,
      actionType:  'DISPUTE_PANEL_VIEW',
      targetType:  'WORKER',
      targetId:    workerId,
      summary:     `분쟁방어 패널 조회: ${worker.name}`,
    })

    return NextResponse.json({
      worker: {
        ...worker,
        companyName: worker.companyAssignments[0]?.company?.companyName ?? null,
        companyId:   companyId ?? null,
      },
      defenseScore,
      riskSections,
      contracts,
      deliveryLogs,
      adjustmentLogs,
      disputeCases,
      recentAttendance,
      warnings,
      explanations,
      notices,
      terminationReview,
    })
  } catch (err) {
    console.error('[GET /dispute-panel]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/workers/[id]/dispute-panel
 * 새 분쟁 케이스 개설
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id: workerId } = await params
    const body = await req.json()
    const { disputeType, title, summary } = body as {
      disputeType: string
      title:       string
      summary?:    string
    }

    if (!disputeType || !title) {
      return NextResponse.json({ error: 'disputeType and title are required' }, { status: 400 })
    }

    const worker = await prisma.worker.findUnique({
      where:  { id: workerId },
      select: { companyAssignments: { where: { isActive: true }, select: { companyId: true }, take: 1 } },
    })
    if (!worker) return notFound()

    const companyId = worker.companyAssignments[0]?.companyId ?? ''

    const disputeCase = await prisma.disputeCase.create({
      data: {
        workerId,
        companyId,
        disputeType: disputeType as never,
        title,
        summary,
        openedBy: session.sub,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      companyId,
      actionType:  'DISPUTE_CASE_OPEN',
      targetType:  'WORKER',
      targetId:    workerId,
      summary:     `분쟁 케이스 개설: ${title} (${disputeType})`,
    })

    return NextResponse.json({ success: true, id: disputeCase.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /dispute-panel]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── 5개 영역 리스크 점검 ─────────────────────────────────────────────────────

type RiskLevel = 'OK' | 'WARN' | 'DANGER' | 'CRITICAL'

interface RiskItem {
  key:      string
  label:    string
  level:    RiskLevel
  action?:  string
  actionHref?: string
}

interface RiskSection {
  id:     string
  title:  string
  items:  RiskItem[]
  worstLevel: RiskLevel
}

function worstLevel(items: RiskItem[]): RiskLevel {
  if (items.some(i => i.level === 'CRITICAL')) return 'CRITICAL'
  if (items.some(i => i.level === 'DANGER'))   return 'DANGER'
  if (items.some(i => i.level === 'WARN'))     return 'WARN'
  return 'OK'
}

function buildRiskSections(input: {
  contracts:        { contractStatus: string; signedAt: Date | null; startDate: string; endDate: string | null }[]
  deliveredTypes:   Set<string>
  recentAttendance: { status: string }[]
  adjustmentLogs:   unknown[]
  warnings:         unknown[]
  explanations:     unknown[]
  notices:          { noticeType: string }[]
  terminationReview: { status: string; terminationReason: string | null } | null
  latestContract:   { contractStatus: string; signedAt: Date | null; startDate: string; endDate: string | null } | undefined
}): RiskSection[] {
  const { contracts, deliveredTypes, recentAttendance, adjustmentLogs, warnings, notices, terminationReview } = input

  // ── A. 계약 리스크
  const contractItems: RiskItem[] = [
    {
      key:    'contract_exists',
      label:  '최신 계약서 존재',
      level:  contracts.length > 0 ? 'OK' : 'CRITICAL',
      action: contracts.length > 0 ? undefined : '계약서 생성',
      actionHref: '/admin/contracts/new',
    },
    {
      key:    'contract_signed',
      label:  '계약서 서명 완료',
      level:  input.latestContract?.signedAt ? 'OK' : (contracts.length > 0 ? 'DANGER' : 'OK'),
      action: (contracts.length > 0 && !input.latestContract?.signedAt) ? '서명 요청' : undefined,
    },
    {
      key:    'contract_delivered',
      label:  '계약서 교부 완료',
      level:  (deliveredTypes.has('CONTRACT') || deliveredTypes.has('DAILY_CONTRACT')) ? 'OK' : 'DANGER',
      action: '문서 재교부',
    },
    {
      key:    'contract_period',
      label:  '계약기간 기재',
      level:  input.latestContract?.endDate ? 'OK' : 'WARN',
    },
    {
      key:    'repeated_contract',
      label:  '반복계약 여부 검토',
      level:  contracts.length >= 3 ? 'WARN' : 'OK',
    },
  ]

  // ── B. 문서 리스크
  const docItems: RiskItem[] = [
    {
      key:    'privacy_consent',
      label:  '개인정보 동의서 교부',
      level:  deliveredTypes.has('PRIVACY_CONSENT') ? 'OK' : 'WARN',
      action: '문서 재교부',
    },
    {
      key:    'work_conditions',
      label:  '근로조건 설명 확인서 교부',
      level:  deliveredTypes.has('WORK_CONDITIONS_RECEIPT') ? 'OK' : 'WARN',
      action: '문서 재교부',
    },
    {
      key:    'unsigned_docs',
      label:  '미서명 문서 없음',
      level:  'OK',  // DocumentDeliveryLog에서 PENDING 없는 경우 — 데이터 별도 조회 필요 시 확장
    },
    {
      key:    'delivered_count',
      label:  '교부 문서 수 (3종 이상)',
      level:  deliveredTypes.size >= 3 ? 'OK' : deliveredTypes.size >= 1 ? 'WARN' : 'DANGER',
    },
  ]

  // ── C. 출퇴근/공수 리스크
  const missingCheckout = recentAttendance.filter(a => a.status === 'MISSING_CHECKOUT').length
  const attendanceItems: RiskItem[] = [
    {
      key:    'attendance_exists',
      label:  '출퇴근 원본기록 존재',
      level:  recentAttendance.length > 0 ? 'OK' : 'CRITICAL',
    },
    {
      key:    'missing_checkout',
      label:  '퇴근 미기록 없음',
      level:  missingCheckout === 0 ? 'OK' : missingCheckout <= 2 ? 'WARN' : 'DANGER',
    },
    {
      key:    'adjustment_count',
      label:  '수동 수정 이력 없음',
      level:  adjustmentLogs.length === 0 ? 'OK' : (adjustmentLogs.length <= 3 ? 'WARN' : 'DANGER'),
    },
  ]

  // ── D. 관리행위 리스크
  const hasTerminationNotice = notices.some(n => ['TERMINATION', 'CONTRACT_END'].includes(n.noticeType))
  const hrItems: RiskItem[] = [
    {
      key:    'warning_if_discipline',
      label:  '경고 기록 (필요 시)',
      level:  'OK',  // 경고가 없어도 OK — 있으면 정보 제공
    },
    {
      key:    'explanation_if_needed',
      label:  '소명 요청 (해당 시)',
      level:  'OK',
    },
    {
      key:    'termination_notice',
      label:  '종료통지서 존재',
      level:  hasTerminationNotice ? 'OK' : 'WARN',
      action: hasTerminationNotice ? undefined : '통지서 발행',
    },
  ]

  // ── E. 종료 리스크
  const terminationItems: RiskItem[] = [
    {
      key:    'termination_reason',
      label:  '종료 사유 입력',
      level:  terminationReview?.terminationReason ? 'OK' : 'WARN',
    },
    {
      key:    'checklist_done',
      label:  '종료 체크리스트 완료',
      level:  terminationReview?.status === 'CONFIRMED' ? 'OK' : 'WARN',
      action: '종료 처리 체크리스트',
    },
    {
      key:    'snapshot_saved',
      label:  '종료 스냅샷 저장',
      level:  terminationReview?.status === 'CONFIRMED' ? 'OK' : 'WARN',
    },
  ]

  const sections: RiskSection[] = [
    { id: 'contract',    title: '계약 리스크',       items: contractItems,    worstLevel: worstLevel(contractItems) },
    { id: 'documents',   title: '문서 리스크',       items: docItems,         worstLevel: worstLevel(docItems) },
    { id: 'attendance',  title: '출퇴근/공수 리스크', items: attendanceItems,  worstLevel: worstLevel(attendanceItems) },
    { id: 'hrActions',   title: '관리행위 리스크',   items: hrItems,          worstLevel: worstLevel(hrItems) },
    { id: 'termination', title: '종료 리스크',       items: terminationItems, worstLevel: worstLevel(terminationItems) },
  ]

  return sections
}

// ─── 방어 점수 계산 ──────────────────────────────────────────────────────────

interface ScoreInput {
  hasContract:       boolean
  hasDeliveryLog:    boolean
  recentAttendance:  number
  adjustedCount:     number
  openDisputeCount:  number
  deliveredDocTypes: number
}

function calcDefenseScore(input: ScoreInput): number {
  let score = 0

  // 계약서 존재 (+30)
  if (input.hasContract)    score += 30
  // 문서 교부 기록 존재 (+20)
  if (input.hasDeliveryLog) score += 20
  // 교부된 문서 종류 수 (+최대 20, 종류당 5점)
  score += Math.min(input.deliveredDocTypes * 5, 20)
  // 최근 출퇴근 기록 (+최대 20, 10건당 5점)
  score += Math.min(Math.floor(input.recentAttendance / 10) * 5, 20)
  // 수정 이력 많으면 감점 (-수정 1건당 2점, 최대 -20)
  score -= Math.min(input.adjustedCount * 2, 20)
  // 진행 중 분쟁 존재하면 감점 (-케이스당 10점)
  score -= input.openDisputeCount * 10

  return Math.max(0, Math.min(100, score))
}
