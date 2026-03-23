/**
 * GET /api/admin/workers/[id]/termination-review/[reviewId]/evidence/pdf
 * 종료 증빙 패키지 HTML 반환 (브라우저 print-to-PDF용)
 *
 * - Content-Type: text/html
 * - A4 프린트 CSS 포함
 * - WorkerTerminationSnapshot 기준 (snapshot-first)
 * - 판단형 문구 금지, 사실 중심
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { unauthorized } from '@/lib/utils/response'

const SEVERITY_LABEL: Record<string, string> = {
  OK:       '적정',
  WARN:     '주의',
  WARNING:  '주의',
  DANGER:   '미비',
  FAIL:     '미비',
  CRITICAL: '치명',
}

const TERMINATION_REASON_LABEL: Record<string, string> = {
  CONTRACT_EXPIRY:       '계약 만료',
  VOLUNTARY_RESIGN:      '자진 퇴직',
  MUTUAL_AGREEMENT:      '합의 종료',
  DISCIPLINARY:          '징계 처분',
  ABSENCE:               '무단 결근',
  PERFORMANCE:           '업무 성과',
  SITE_CLOSURE:          '현장 폐쇄',
  REPEATED_ABSENCE:      '반복 결근',
  INSTRUCTION_REFUSAL:   '업무 지시 거부',
  OTHER:                 '기타',
}

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

    const review = await prisma.workerTerminationReview.findFirst({
      where: { id: reviewId, workerId },
    })
    if (!review || review.status !== 'CONFIRMED') {
      return NextResponse.json({ error: '종료 확정 건만 출력 가능합니다.' }, { status: 400 })
    }

    const snapshot = await prisma.workerTerminationSnapshot.findFirst({
      where: { reviewId },
    })
    if (!snapshot) {
      return NextResponse.json({ error: '종료 스냅샷 없음' }, { status: 404 })
    }

    const adminUser = await prisma.adminUser.findUnique({
      where:  { id: session.sub },
      select: { name: true },
    })

    const confirmedByAdmin = review.confirmedBy
      ? await prisma.adminUser.findUnique({
          where:  { id: review.confirmedBy },
          select: { name: true },
        })
      : null

    // 감사로그 보조 조회
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        targetId:   workerId,
        actionType: {
          in: ['TERMINATION_REVIEW_STARTED', 'WORKER_TERMINATED', 'WORKER_FORCE_DEACTIVATED',
               'WORKER_WARNING_ISSUED', 'WORKER_EXPLANATION_REQUESTED', 'WORKER_NOTICE_ISSUED'],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { actionType: true, actorRole: true, summary: true, createdAt: true },
    })

    const workerData   = (snapshot.workerJson    as Record<string, unknown>) ?? {}
    const contracts    = (snapshot.contractsJson as unknown[])               ?? []
    const attendance   = (snapshot.attendanceSummaryJson as Record<string, unknown>) ?? {}
    const documents    = (snapshot.documentsJson     as unknown[])           ?? []
    const warnings     = (snapshot.warningsJson      as unknown[])           ?? []
    const explanations = (snapshot.explanationsJson  as unknown[])           ?? []
    const notices      = (snapshot.noticesJson       as unknown[])           ?? []
    const checklist    = (snapshot.checklistJson     as unknown as CheckItem[]) ?? []

    // 현장명 보조
    const siteAssignment = await prisma.workerSiteAssignment.findFirst({
      where:   { workerId, isActive: true },
      select:  { site: { select: { name: true } } },
      orderBy: { assignedFrom: 'desc' },
    })
    const siteName = siteAssignment?.site?.name ?? '기록 없음'

    // 파일명
    const safeWorker = String(workerData.name ?? 'unknown').replace(/[^가-힣a-zA-Z0-9]/g, '_')
    const safeSite   = siteName.replace(/[^가-힣a-zA-Z0-9]/g, '_')
    const dateStr    = (review.terminationDate ?? new Date().toISOString().slice(0, 10))
    const fileName   = `종료증빙패키지_${safeSite}_${safeWorker}_${dateStr}.html`

    // ─── HTML 렌더링 ──────────────────────────────────────────────────────────

    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>종료 증빙 패키지 — ${String(workerData.name ?? '')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; font-size: 11pt; color: #000; background: #fff; }
  h1 { font-size: 18pt; text-align: center; margin: 16px 0 4px; }
  h2 { font-size: 13pt; border-bottom: 2px solid #000; padding-bottom: 4px; margin: 20px 0 8px; page-break-after: avoid; }
  h3 { font-size: 11pt; font-weight: bold; margin: 12px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10pt; }
  th, td { border: 1px solid #666; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #eee; font-weight: bold; width: 160px; }
  .section { margin-bottom: 24px; page-break-inside: avoid; }
  .cover { text-align: center; padding: 32px 0 20px; border-bottom: 3px double #000; margin-bottom: 24px; }
  .cover-meta { margin: 4px 0; font-size: 11pt; }
  .cover-meta strong { display: inline-block; width: 120px; text-align: right; margin-right: 8px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9pt; font-weight: bold; border: 1px solid #999; }
  .badge-ok       { border-color: #333; }
  .badge-warn     { border-color: #666; font-style: italic; }
  .badge-fail     { border-color: #000; font-weight: bold; }
  .badge-critical { border-color: #000; text-decoration: underline; font-weight: bold; }
  .pass  { color: #000; }
  .fail  { color: #000; font-weight: bold; }
  .check-yes { font-weight: bold; }
  .check-no  { color: #555; }
  .empty-note { color: #555; font-style: italic; }
  .disclaimer { font-size: 9pt; border-top: 1px solid #999; margin-top: 24px; padding-top: 12px; color: #444; }
  .disclaimer li { list-style: none; padding: 2px 0; }
  .disclaimer li::before { content: "※ "; }
  @media print {
    body { font-size: 10pt; }
    .no-print { display: none; }
    h2 { page-break-after: avoid; }
    .section { page-break-inside: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  }
  @page { size: A4; margin: 20mm 15mm; }
</style>
</head>
<body>

<div class="no-print" style="background:#f5f5f5;padding:12px;margin-bottom:16px;border:1px solid #ddd;text-align:center;font-size:10pt;">
  이 문서를 PDF로 저장하려면 브라우저 인쇄 기능(Ctrl+P)을 사용하고, "PDF로 저장"을 선택하세요.
  <button onclick="window.print()" style="margin-left:16px;padding:6px 18px;font-size:10pt;cursor:pointer;">인쇄 / PDF 저장</button>
</div>

<!-- 3-1 표지 -->
<div class="cover">
  <h1>종료 증빙 패키지</h1>
  <p style="font-size:10pt;color:#555;margin-bottom:20px;">Termination Evidence Package</p>
  <div class="cover-meta"><strong>근로자명</strong>${escHtml(String(workerData.name ?? '기록 없음'))}</div>
  <div class="cover-meta"><strong>소속 회사</strong>${escHtml(String(workerData.companyName ?? '기록 없음'))}</div>
  <div class="cover-meta"><strong>소속 현장</strong>${escHtml(siteName)}</div>
  <div class="cover-meta"><strong>종료일</strong>${escHtml(review.terminationDate ?? '기록 없음')}</div>
  <div class="cover-meta"><strong>종료 유형</strong>${escHtml(TERMINATION_REASON_LABEL[review.terminationReason ?? ''] ?? review.terminationReason ?? '기록 없음')}</div>
  <div class="cover-meta" style="margin-top:16px;font-size:9pt;color:#555;"><strong>출력일시</strong>${escHtml(now)}</div>
  <div class="cover-meta" style="font-size:9pt;color:#555;"><strong>출력 관리자</strong>${escHtml(adminUser?.name ?? '알 수 없음')}</div>
</div>

<!-- 3-2 종료 검토 요약 -->
<div class="section">
<h2>1. 종료 검토 요약</h2>
<table>
  <tr><th>종료 검토 ID</th><td>${escHtml(reviewId)}</td></tr>
  <tr><th>종료 요청일</th><td>${escHtml(new Date(review.createdAt).toLocaleDateString('ko-KR'))}</td></tr>
  <tr><th>종료 확정일</th><td>${escHtml(review.confirmedAt ? new Date(review.confirmedAt).toLocaleDateString('ko-KR') : '미확정')}</td></tr>
  <tr><th>종료 확정자</th><td>${escHtml(confirmedByAdmin?.name ?? '기록 없음')}</td></tr>
  <tr><th>종료 사유</th><td>${escHtml(TERMINATION_REASON_LABEL[review.terminationReason ?? ''] ?? review.terminationReason ?? '기록 없음')}</td></tr>
  <tr><th>상세 사유</th><td>${escHtml(review.detailReason ?? '기록 없음')}</td></tr>
  <tr><th>검토 상태</th><td>${escHtml(review.status)}</td></tr>
</table>
<h3>최종 확인 체크 결과</h3>
<table>
  <tr><th>종료 사유 확인</th><td class="${review.confirmCheckedReason ? 'check-yes' : 'check-no'}">${review.confirmCheckedReason ? '✔ 완료' : '미체크'}</td></tr>
  <tr><th>문서 확인</th><td class="${review.confirmCheckedDocuments ? 'check-yes' : 'check-no'}">${review.confirmCheckedDocuments ? '✔ 완료' : '미체크'}</td></tr>
  <tr><th>문서 교부 확인</th><td class="${review.confirmCheckedDelivery ? 'check-yes' : 'check-no'}">${review.confirmCheckedDelivery ? '✔ 완료' : '미체크'}</td></tr>
  <tr><th>미지급 임금 확인</th><td class="${review.confirmCheckedWage ? 'check-yes' : 'check-no'}">${review.confirmCheckedWage ? '✔ 완료' : '미체크'}</td></tr>
  <tr><th>분쟁 사항 확인</th><td class="${review.confirmCheckedDispute ? 'check-yes' : 'check-no'}">${review.confirmCheckedDispute ? '✔ 완료' : '미체크'}</td></tr>
</table>
</div>

<!-- 3-3 자동점검 결과 -->
<div class="section">
<h2>2. 자동점검 결과 (11개 항목)</h2>
${checklist.length === 0
  ? `<p class="empty-note">점검 항목 기록 없음</p>`
  : `<table>
  <thead><tr><th style="width:40%">항목</th><th style="width:15%">결과</th><th>세부 내용</th></tr></thead>
  <tbody>
  ${checklist.map((item) => `
  <tr>
    <td>${escHtml(item.label)}</td>
    <td>
      <span class="badge badge-${item.severity.toLowerCase()}">${SEVERITY_LABEL[item.severity] ?? item.severity}</span>
    </td>
    <td class="${item.passed ? 'pass' : 'fail'}">${item.passed ? '적정' : (item.action ? `미비 — 권장 조치: ${escHtml(item.action)}` : '미비')}</td>
  </tr>`).join('')}
  </tbody>
</table>`}
</div>

<!-- 3-4 계약/문서 현황 -->
<div class="section">
<h2>3. 계약 / 문서 현황</h2>
<h3>계약서 내역</h3>
${(contracts as Record<string, string>[]).length === 0
  ? `<p class="empty-note">계약서 기록 없음</p>`
  : `<table>
  <thead><tr><th>계약 유형</th><th>계약 상태</th><th>시작일</th><th>종료일</th><th>생성일</th></tr></thead>
  <tbody>
  ${(contracts as Record<string, string>[]).map((c) => `
  <tr>
    <td>${escHtml(c.contractType ?? '기록 없음')}</td>
    <td>${escHtml(c.contractStatus ?? '기록 없음')}</td>
    <td>${escHtml(c.startDate ?? '기록 없음')}</td>
    <td>${escHtml(c.endDate ?? '기록 없음')}</td>
    <td>${c.createdAt ? escHtml(new Date(c.createdAt).toLocaleDateString('ko-KR')) : '기록 없음'}</td>
  </tr>`).join('')}
  </tbody>
</table>`}

<h3>문서 교부 이력</h3>
${(documents as Record<string, string>[]).length === 0
  ? `<p class="empty-note">문서 교부 기록 없음</p>`
  : `<table>
  <thead><tr><th>문서 유형</th><th>교부 방법</th><th>교부 상태</th><th>교부일</th></tr></thead>
  <tbody>
  ${(documents as Record<string, string>[]).map((d) => `
  <tr>
    <td>${escHtml(d.documentType ?? '기록 없음')}</td>
    <td>${escHtml(d.deliveryMethod ?? '기록 없음')}</td>
    <td>${escHtml(d.status ?? '기록 없음')}</td>
    <td>${d.deliveredAt ? escHtml(new Date(d.deliveredAt).toLocaleDateString('ko-KR')) : '기록 없음'}</td>
  </tr>`).join('')}
  </tbody>
</table>`}
</div>

<!-- 3-5 출퇴근/공수 요약 -->
<div class="section">
<h2>4. 출퇴근 / 공수 요약</h2>
<table>
  <tr><th>재직 기간 출근일수</th><td>${Number(attendance.totalDays ?? 0)}일</td></tr>
  <tr><th>출근 누락 건수</th><td>${Number(attendance.missingCheckin ?? 0)}건</td></tr>
  <tr><th>퇴근 누락 건수</th><td>${Number(attendance.missingCheckout ?? 0)}건</td></tr>
  <tr><th>수동 수정 건수</th><td>${Number(attendance.manualAdjustments ?? 0)}건</td></tr>
  <tr><th>수정 사유 누락 건수</th><td>${Number(attendance.adjustmentNoReason ?? 0)}건</td></tr>
</table>
</div>

<!-- 3-6 경고/소명/통지 -->
<div class="section">
<h2>5. 경고 / 소명 / 통지 기록</h2>
<h3>경고 발행 이력 (${warnings.length}건)</h3>
${warnings.length === 0
  ? `<p class="empty-note">경고 기록 없음</p>`
  : `<table>
  <thead><tr><th>경고 수위</th><th>사유</th><th>발행일</th></tr></thead>
  <tbody>
  ${(warnings as Record<string, string>[]).map((w) => `
  <tr>
    <td>${escHtml(w.warningLevel ?? '기록 없음')}</td>
    <td>${escHtml(w.reason ?? '기록 없음')}</td>
    <td>${w.createdAt ? escHtml(new Date(w.createdAt).toLocaleDateString('ko-KR')) : '기록 없음'}</td>
  </tr>`).join('')}
  </tbody>
</table>`}

<h3>소명 요청 이력 (${explanations.length}건)</h3>
${explanations.length === 0
  ? `<p class="empty-note">소명 요청 기록 없음</p>`
  : `<table>
  <thead><tr><th>요청 제목</th><th>상태</th><th>요청일</th></tr></thead>
  <tbody>
  ${(explanations as Record<string, string>[]).map((e) => `
  <tr>
    <td>${escHtml(e.subject ?? '기록 없음')}</td>
    <td>${escHtml(e.status ?? '기록 없음')}</td>
    <td>${e.createdAt ? escHtml(new Date(e.createdAt).toLocaleDateString('ko-KR')) : '기록 없음'}</td>
  </tr>`).join('')}
  </tbody>
</table>`}

<h3>통지서 이력 (${notices.length}건)</h3>
${notices.length === 0
  ? `<p class="empty-note">통지서 기록 없음</p>`
  : `<table>
  <thead><tr><th>통지 유형</th><th>제목</th><th>교부 방법</th><th>발행일</th></tr></thead>
  <tbody>
  ${(notices as Record<string, string>[]).map((n) => `
  <tr>
    <td>${escHtml(n.noticeType ?? '기록 없음')}</td>
    <td>${escHtml(n.title ?? '기록 없음')}</td>
    <td>${escHtml(n.deliveryMethod ?? '기록 없음')}</td>
    <td>${n.createdAt ? escHtml(new Date(n.createdAt).toLocaleDateString('ko-KR')) : '기록 없음'}</td>
  </tr>`).join('')}
  </tbody>
</table>`}
</div>

<!-- 3-7 종료 전 보완 조치 -->
<div class="section">
<h2>6. 종료 전 보완조치 필요 항목</h2>
${checklist.filter((i) => !i.passed && i.action).length === 0
  ? `<p class="empty-note">보완조치 필요 항목 없음</p>`
  : `<table>
  <thead><tr><th>점검 항목</th><th>심각도</th><th>권장 조치</th></tr></thead>
  <tbody>
  ${checklist.filter((i) => !i.passed && i.action).map((item) => `
  <tr>
    <td>${escHtml(item.label)}</td>
    <td><span class="badge badge-${item.severity.toLowerCase()}">${SEVERITY_LABEL[item.severity] ?? item.severity}</span></td>
    <td>${escHtml(item.action ?? '기록 없음')}</td>
  </tr>`).join('')}
  </tbody>
</table>`}
</div>

<!-- 3-8 감사로그 -->
<div class="section">
<h2>7. 감사로그 요약</h2>
${auditLogs.length === 0
  ? `<p class="empty-note">감사로그 기록 없음</p>`
  : `<table>
  <thead><tr><th style="width:30%">이벤트</th><th style="width:15%">역할</th><th>요약</th><th style="width:18%">일시</th></tr></thead>
  <tbody>
  ${auditLogs.map((log) => `
  <tr>
    <td>${escHtml(log.actionType)}</td>
    <td>${escHtml(log.actorRole ?? '알 수 없음')}</td>
    <td>${escHtml(log.summary ?? '')}</td>
    <td>${escHtml(new Date(log.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))}</td>
  </tr>`).join('')}
  </tbody>
</table>`}
</div>

<!-- 3-9 하단 고정 문구 -->
<div class="disclaimer">
  <ul>
    <li>본 문서는 종료 처리 당시 시스템에 기록된 정보를 기준으로 생성됨</li>
    <li>일부 첨부 문서는 별도 원본 저장소에 보관될 수 있음</li>
    <li>본 문서는 사실관계 확인용 운영 자료이며 법률 판단 문서가 아님</li>
  </ul>
</div>

</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type':        'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    })
  } catch (err) {
    console.error('[GET /evidence/pdf]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface CheckItem {
  key:      string
  label:    string
  passed:   boolean
  severity: string
  action?:  string
}
