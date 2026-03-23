/**
 * GET /api/admin/workers/[id]/termination-review/[reviewId]/evidence
 * 종료 증빙 패키지 JSON 조회 — WorkerTerminationSnapshot 기준
 *
 * 권한: ADMIN 이상 (VIEWER, WORKER 차단)
 * 데이터 원칙: snapshot 최우선, 감사로그는 보조
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { unauthorized, notFound } from '@/lib/utils/response'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> },
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { id: workerId, reviewId } = await params

    // 1. 종료 검토 조회
    const review = await prisma.workerTerminationReview.findFirst({
      where: { id: reviewId, workerId },
    })
    if (!review) return notFound('종료 검토를 찾을 수 없습니다.')
    if (review.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: '종료가 확정된 건만 증빙 패키지를 생성할 수 있습니다.', reviewStatus: review.status },
        { status: 400 },
      )
    }

    // 2. 스냅샷 조회 (최우선 데이터 원천)
    const snapshot = await prisma.workerTerminationSnapshot.findFirst({
      where: { reviewId },
    })
    if (!snapshot) {
      return NextResponse.json(
        { error: '종료 스냅샷이 없어 증빙 패키지를 생성할 수 없습니다.' },
        { status: 404 },
      )
    }

    // 3. 감사로그 — 종료 관련 이벤트 보조 조회
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        targetId: workerId,
        actionType: {
          in: [
            'TERMINATION_REVIEW_STARTED',
            'WORKER_TERMINATED',
            'WORKER_FORCE_DEACTIVATED',
            'WORKER_WARNING_ISSUED',
            'WORKER_EXPLANATION_REQUESTED',
            'WORKER_NOTICE_ISSUED',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id:         true,
        actionType: true,
        actorUserId:true,
        actorRole:  true,
        summary:    true,
        createdAt:  true,
      },
    })

    // 4. 출력 관리자명 조회
    const confirmedByAdmin = review.confirmedBy
      ? await prisma.adminUser.findUnique({
          where:  { id: review.confirmedBy },
          select: { name: true, email: true },
        })
      : null

    // 5. 스냅샷에서 각 섹션 데이터 파싱
    const workerData    = (snapshot.workerJson    as Record<string, unknown>) ?? {}
    const contracts     = (snapshot.contractsJson as unknown[])               ?? []
    const attendanceSummary = (snapshot.attendanceSummaryJson as Record<string, unknown>) ?? {}
    const documents     = (snapshot.documentsJson     as unknown[])           ?? []
    const warnings      = (snapshot.warningsJson      as unknown[])           ?? []
    const explanations  = (snapshot.explanationsJson  as unknown[])           ?? []
    const notices       = (snapshot.noticesJson       as unknown[])           ?? []
    const checklist     = (snapshot.checklistJson     as CheckItem[])         ?? []

    // 6. 현장명 보조 조회 (스냅샷 미포함 시 현재 데이터 참조 — 표기에 "(현재기준)" 명시)
    let siteName = '기록 없음'
    let siteNote = ''
    const assignment = await prisma.workerSiteAssignment.findFirst({
      where:   { workerId, isActive: true },
      select:  { site: { select: { name: true } } },
      orderBy: { assignedFrom: 'desc' },
    })
    if (assignment?.site?.name) {
      siteName = assignment.site.name
      siteNote = '(현재기준)'
    }

    // ─── 패키지 조합 ──────────────────────────────────────────────────────────

    const pkg: EvidencePackage = {
      meta: {
        generatedAt:    new Date().toISOString(),
        generatedBy:    session.sub,
        generatedByName: (await prisma.adminUser.findUnique({
          where:  { id: session.sub },
          select: { name: true },
        }))?.name ?? '알 수 없음',
        reviewId,
        workerId,
      },
      // 3-1 표지
      cover: {
        documentTitle:   '종료 증빙 패키지',
        workerName:      String(workerData.name      ?? '기록 없음'),
        workerPhone:     String(workerData.phone     ?? '기록 없음'),
        companyName:     String(workerData.companyName ?? '기록 없음'),
        siteName:        `${siteName}${siteNote}`,
        terminationDate: review.terminationDate ?? '기록 없음',
        terminationType: review.terminationReason ?? '기록 없음',
        printedAt:       new Date().toISOString(),
        printedByName:   confirmedByAdmin?.name ?? '기록 없음',
      },
      // 3-2 종료 검토 요약
      reviewSummary: {
        reviewId,
        initiatedAt:     review.createdAt.toISOString(),
        confirmedAt:     review.confirmedAt?.toISOString() ?? '미확정',
        terminationReason: review.terminationReason ?? '기록 없음',
        reasonCategory:  review.reasonCategory ?? '기록 없음',
        detailReason:    review.detailReason    ?? '기록 없음',
        status:          review.status,
        finalChecks: {
          confirmCheckedReason:    review.confirmCheckedReason    ?? false,
          confirmCheckedDocuments: review.confirmCheckedDocuments ?? false,
          confirmCheckedDelivery:  review.confirmCheckedDelivery  ?? false,
          confirmCheckedWage:      review.confirmCheckedWage      ?? false,
          confirmCheckedDispute:   review.confirmCheckedDispute   ?? false,
        },
      },
      // 3-3 자동점검 결과
      autoCheckItems: checklist.map((item) => ({
        key:      item.key,
        label:    item.label,
        passed:   item.passed,
        severity: item.severity,
        action:   item.action ?? null,
      })),
      // 3-4 계약/문서 현황
      contractsAndDocs: {
        contracts: (contracts as ContractSnapshot[]).map((c) => ({
          contractType:   c.contractType   ?? '기록 없음',
          contractStatus: c.contractStatus ?? '기록 없음',
          startDate:      c.startDate      ?? '기록 없음',
          endDate:        c.endDate        ?? '기록 없음',
          createdAt:      c.createdAt      ?? '기록 없음',
        })),
        deliveryLogs: (documents as DeliverySnapshot[]).map((d) => ({
          documentType:   d.documentType   ?? '기록 없음',
          deliveryMethod: d.deliveryMethod ?? '기록 없음',
          status:         d.status         ?? '기록 없음',
          deliveredAt:    d.deliveredAt    ?? '기록 없음',
        })),
      },
      // 3-5 출퇴근/공수 요약
      attendanceSummary: {
        totalDays:           Number(attendanceSummary.totalDays ?? 0),
        missingCheckin:      Number(attendanceSummary.missingCheckin  ?? 0),
        missingCheckout:     Number(attendanceSummary.missingCheckout ?? 0),
        manualAdjustments:   Number(attendanceSummary.manualAdjustments ?? 0),
        adjustmentNoReason:  Number(attendanceSummary.adjustmentNoReason ?? 0),
      },
      // 3-6 경고/소명/통지
      hrActions: {
        warnings:    (warnings     as WarningSnapshot[]).map((w) => ({
          warningLevel: w.warningLevel ?? '기록 없음',
          reason:       w.reason       ?? '기록 없음',
          issuedAt:     w.createdAt    ?? '기록 없음',
        })),
        explanations: (explanations as ExplanationSnapshot[]).map((e) => ({
          subject:     e.subject  ?? '기록 없음',
          status:      e.status   ?? '기록 없음',
          requestedAt: e.createdAt ?? '기록 없음',
        })),
        notices: (notices as NoticeSnapshot[]).map((n) => ({
          noticeType:  n.noticeType  ?? '기록 없음',
          title:       n.title       ?? '기록 없음',
          deliveryMethod: n.deliveryMethod ?? '기록 없음',
          issuedAt:    n.createdAt   ?? '기록 없음',
        })),
      },
      // 3-7 종료 전 보완조치 (자동점검 FAIL 항목 기준)
      remedialActions: checklist
        .filter((item) => !item.passed && item.action)
        .map((item) => ({
          checkKey:   item.key,
          label:      item.label,
          action:     item.action!,
          severity:   item.severity,
        })),
      // 3-8 감사로그 요약
      auditLogSummary: auditLogs.map((log) => ({
        actionType:  log.actionType,
        actorUserId: log.actorUserId ?? '알 수 없음',
        actorRole:   log.actorRole   ?? '알 수 없음',
        summary:     log.summary     ?? '',
        occurredAt:  log.createdAt.toISOString(),
      })),
      // 3-9 하단 고정 문구
      disclaimer: [
        '본 문서는 종료 처리 당시 시스템에 기록된 정보를 기준으로 생성됨',
        '일부 첨부 문서는 별도 원본 저장소에 보관될 수 있음',
        '본 문서는 사실관계 확인용 운영 자료이며 법률 판단 문서가 아님',
      ],
    }

    return NextResponse.json({ success: true, package: pkg })
  } catch (err) {
    console.error('[GET /evidence]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

interface CheckItem {
  key:      string
  label:    string
  passed:   boolean
  severity: string
  action?:  string
}

interface ContractSnapshot {
  contractType?:   string
  contractStatus?: string
  startDate?:      string
  endDate?:        string
  createdAt?:      string
}

interface DeliverySnapshot {
  documentType?:   string
  deliveryMethod?: string
  status?:         string
  deliveredAt?:    string
}

interface WarningSnapshot {
  warningLevel?: string
  reason?:       string
  createdAt?:    string
}

interface ExplanationSnapshot {
  subject?:   string
  status?:    string
  createdAt?: string
}

interface NoticeSnapshot {
  noticeType?:     string
  title?:          string
  deliveryMethod?: string
  createdAt?:      string
}

interface EvidencePackage {
  meta:              Record<string, unknown>
  cover:             Record<string, unknown>
  reviewSummary:     Record<string, unknown>
  autoCheckItems:    unknown[]
  contractsAndDocs:  Record<string, unknown>
  attendanceSummary: Record<string, unknown>
  hrActions:         Record<string, unknown>
  remedialActions:   unknown[]
  auditLogSummary:   unknown[]
  disclaimer:        string[]
}
