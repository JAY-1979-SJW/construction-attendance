'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface CheckItem { key: string; label: string; passed: boolean; severity: string; action?: string }
interface AuditEntry { actionType: string; actorRole: string; summary: string; occurredAt: string }
interface ContractItem { contractType: string; contractStatus: string; startDate: string; endDate: string; createdAt: string }
interface DocItem { documentType: string; deliveryMethod: string; status: string; deliveredAt: string }
interface WarningItem { warningLevel: string; reason: string; issuedAt: string }
interface ExplanationItem { subject: string; status: string; requestedAt: string }
interface NoticeItem { noticeType: string; title: string; deliveryMethod: string; issuedAt: string }

interface EvidencePackage {
  meta:             { generatedAt: string; generatedByName: string; reviewId: string }
  cover:            { workerName: string; companyName: string; siteName: string; terminationDate: string; terminationType: string; printedByName: string }
  reviewSummary:    { reviewId: string; initiatedAt: string; confirmedAt: string; terminationReason: string; reasonCategory: string; detailReason: string; status: string; finalChecks: Record<string, boolean> }
  autoCheckItems:   CheckItem[]
  contractsAndDocs: { contracts: ContractItem[]; deliveryLogs: DocItem[] }
  attendanceSummary:{ totalDays: number; missingCheckin: number; missingCheckout: number; manualAdjustments: number; adjustmentNoReason: number }
  hrActions:        { warnings: WarningItem[]; explanations: ExplanationItem[]; notices: NoticeItem[] }
  remedialActions:  { checkKey: string; label: string; action: string; severity: string }[]
  auditLogSummary:  AuditEntry[]
  disclaimer:       string[]
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<string, string> = { OK: '적정', WARN: '주의', WARNING: '주의', DANGER: '미비', FAIL: '미비', CRITICAL: '치명' }
const SEVERITY_COLOR: Record<string, string> = {
  OK:       'bg-card text-white border border-[rgba(91,164,217,0.25)]',
  WARN:     'bg-yellow-50 text-yellow-800 border border-yellow-400',
  WARNING:  'bg-yellow-50 text-yellow-800 border border-yellow-400',
  DANGER:   'bg-orange-50 text-orange-800 border border-orange-500',
  FAIL:     'bg-orange-50 text-orange-800 border border-orange-500',
  CRITICAL: 'bg-red-50 text-red-900 border border-red-600 font-bold',
}

const CHECK_LABELS: Record<string, string> = {
  confirmCheckedReason:    '종료 사유 확인',
  confirmCheckedDocuments: '문서 확인',
  confirmCheckedDelivery:  '문서 교부 확인',
  confirmCheckedWage:      '미지급 임금 확인',
  confirmCheckedDispute:   '분쟁 사항 확인',
}

const TERMINATION_REASON_LABEL: Record<string, string> = {
  CONTRACT_EXPIRY: '계약 만료', VOLUNTARY_RESIGN: '자진 퇴직', MUTUAL_AGREEMENT: '합의 종료',
  DISCIPLINARY: '징계 처분', ABSENCE: '무단 결근', PERFORMANCE: '업무 성과',
  SITE_CLOSURE: '현장 폐쇄', REPEATED_ABSENCE: '반복 결근', INSTRUCTION_REFUSAL: '업무 지시 거부', OTHER: '기타',
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-3 pb-2 border-b-2 border-white">
      <span className="bg-white text-[#111827] text-sm font-bold px-3 py-1 rounded">{n}</span>
      <h2 className="text-lg font-bold">{title}</h2>
    </div>
  )
}

function InfoTable({ rows }: { rows: [string, string | React.ReactNode][] }) {
  return (
    <table className="w-full border-collapse text-sm mb-4">
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} className="border border-[rgba(91,164,217,0.25)]">
            <th className="bg-[rgba(255,255,255,0.04)] border-r border-[rgba(91,164,217,0.25)] px-3 py-2 text-left font-semibold w-44 text-[#CBD5E0]">{label}</th>
            <td className="px-3 py-2 text-white">{value || <span className="text-[#718096] italic">기록 없음</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EmptyNote({ text = '기록 없음' }: { text?: string }) {
  return <p className="text-[#718096] italic text-sm py-2">{text}</p>
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

function EvidencePageContent() {
  const params      = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router      = useRouter()
  const reviewId    = searchParams.get('reviewId') ?? ''
  const workerId    = params.id

  const [pkg,     setPkg]     = useState<EvidencePackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!reviewId) { setError('reviewId가 없습니다.'); setLoading(false); return }
    fetch(`/api/admin/workers/${workerId}/termination-review/${reviewId}/evidence`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { setError(data.error ?? '오류'); return }
        setPkg(data.package)
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false))
  }, [workerId, reviewId])

  if (loading) return <div className="p-8 text-center text-[#718096]">종료 증빙 패키지 로딩 중...</div>
  if (error)   return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-400 rounded-[12px] p-5 text-center">
        <p className="text-red-700 font-bold text-lg mb-2">⚠ 증빙 패키지를 생성할 수 없습니다</p>
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 border border-[rgba(91,164,217,0.25)] rounded text-sm">돌아가기</button>
      </div>
    </div>
  )
  if (!pkg) return null

  const { cover, reviewSummary, autoCheckItems, contractsAndDocs, attendanceSummary, hrActions, remedialActions, auditLogSummary, disclaimer } = pkg

  const criticalItems = autoCheckItems.filter(i => i.severity === 'CRITICAL' && !i.passed)

  const pdfUrl = `/api/admin/workers/${workerId}/termination-review/${reviewId}/evidence/pdf`

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16 pt-4">

      {/* 상단 툴바 */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="text-blue-600 text-sm hover:underline">← 종료 처리로 돌아가기</button>
        <div className="flex gap-3">
          <a href={pdfUrl} target="_blank" rel="noreferrer"
             className="px-5 py-2 bg-[rgba(255,255,255,0.08)] text-white text-sm font-semibold rounded hover:bg-[rgba(255,255,255,0.12)]">
            PDF 출력 / 다운로드
          </a>
        </div>
      </div>

      {/* 치명 항목 경고 배너 */}
      {criticalItems.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded p-4 mb-6">
          <p className="text-red-700 font-bold">⚠ 치명 미비 항목 {criticalItems.length}건</p>
          <ul className="mt-1 text-red-600 text-sm list-disc pl-5">
            {criticalItems.map(i => <li key={i.key}>{i.label}</li>)}
          </ul>
        </div>
      )}

      {/* 표지 */}
      <div className="border-2 border-[rgba(91,164,217,0.25)] rounded-[12px] p-5 mb-6 text-center">
        <h1 className="text-2xl font-bold mb-1">종료 증빙 패키지</h1>
        <p className="text-[#718096] text-sm mb-4">Termination Evidence Package</p>
        <div className="grid grid-cols-2 gap-2 text-sm text-left max-w-sm mx-auto">
          <span className="text-[#CBD5E0] font-medium">근로자명</span><span className="font-bold">{cover.workerName}</span>
          <span className="text-[#CBD5E0] font-medium">소속 회사</span><span>{cover.companyName}</span>
          <span className="text-[#CBD5E0] font-medium">소속 현장</span><span>{cover.siteName}</span>
          <span className="text-[#CBD5E0] font-medium">종료일</span><span>{cover.terminationDate}</span>
          <span className="text-[#CBD5E0] font-medium">종료 유형</span><span>{TERMINATION_REASON_LABEL[cover.terminationType] ?? cover.terminationType}</span>
        </div>
        <p className="text-xs text-[#718096] mt-4">출력일시: {new Date(pkg.meta.generatedAt).toLocaleString('ko-KR')} · 출력 관리자: {cover.printedByName}</p>
      </div>

      {/* 1. 종료 검토 요약 */}
      <SectionTitle n={1} title="종료 검토 요약" />
      <InfoTable rows={[
        ['종료 검토 ID',  reviewSummary.reviewId],
        ['종료 요청일',   new Date(reviewSummary.initiatedAt).toLocaleDateString('ko-KR')],
        ['종료 확정일',   reviewSummary.confirmedAt !== '미확정' ? new Date(reviewSummary.confirmedAt).toLocaleDateString('ko-KR') : '미확정'],
        ['종료 사유',     TERMINATION_REASON_LABEL[reviewSummary.terminationReason] ?? reviewSummary.terminationReason],
        ['상세 사유',     reviewSummary.detailReason],
        ['검토 상태',     reviewSummary.status],
      ]} />
      <div className="text-sm font-semibold mb-2">최종 확인 체크 결과</div>
      <table className="w-full border-collapse text-sm mb-4">
        <tbody>
          {Object.entries(reviewSummary.finalChecks).map(([key, val]) => (
            <tr key={key} className="border border-[rgba(91,164,217,0.25)]">
              <th className="bg-[rgba(255,255,255,0.04)] border-r border-[rgba(91,164,217,0.25)] px-3 py-2 text-left font-medium w-44">{CHECK_LABELS[key] ?? key}</th>
              <td className={`px-3 py-2 ${val ? 'text-green-700 font-bold' : 'text-[#718096]'}`}>{val ? '✔ 완료' : '미체크'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 2. 자동점검 결과 */}
      <SectionTitle n={2} title="자동점검 결과 (11개 항목)" />
      {autoCheckItems.length === 0 ? <EmptyNote /> : (
        <table className="w-full border-collapse text-sm mb-4">
          <thead>
            <tr className="bg-[rgba(255,255,255,0.04)]">
              <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2 text-left w-1/2">항목</th>
              <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2 text-left w-24">결과</th>
              <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2 text-left">세부 내용</th>
            </tr>
          </thead>
          <tbody>
            {autoCheckItems.map((item) => (
              <tr key={item.key} className="border-b border-[rgba(91,164,217,0.15)]">
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{item.label}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">
                  <span className={`text-xs px-2 py-1 rounded ${SEVERITY_COLOR[item.severity] ?? ''}`}>
                    {SEVERITY_LABEL[item.severity] ?? item.severity}
                  </span>
                </td>
                <td className={`border border-[rgba(91,164,217,0.25)] px-3 py-2 ${!item.passed ? 'text-orange-700' : 'text-[#CBD5E0]'}`}>
                  {item.passed ? '적정' : (item.action ? `미비 — 권장: ${item.action}` : '미비')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 3. 계약/문서 현황 */}
      <SectionTitle n={3} title="계약 / 문서 현황" />
      <div className="font-semibold text-sm mb-1 text-[#CBD5E0]">계약서 내역</div>
      {contractsAndDocs.contracts.length === 0 ? <EmptyNote text="계약서 기록 없음" /> : (
        <table className="w-full border-collapse text-sm mb-4">
          <thead><tr className="bg-[rgba(255,255,255,0.04)]">
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">계약 유형</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">상태</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">시작일</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">종료일</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">생성일</th>
          </tr></thead>
          <tbody>
            {contractsAndDocs.contracts.map((c, i) => (
              <tr key={i} className="border-b border-[rgba(91,164,217,0.15)]">
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{c.contractType}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{c.contractStatus}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{c.startDate}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{c.endDate || '기록 없음'}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('ko-KR') : '기록 없음'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="font-semibold text-sm mb-1 text-[#CBD5E0]">문서 교부 이력</div>
      {contractsAndDocs.deliveryLogs.length === 0 ? <EmptyNote text="문서 교부 기록 없음" /> : (
        <table className="w-full border-collapse text-sm mb-4">
          <thead><tr className="bg-[rgba(255,255,255,0.04)]">
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">문서 유형</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">교부 방법</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">교부 상태</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">교부일</th>
          </tr></thead>
          <tbody>
            {contractsAndDocs.deliveryLogs.map((d, i) => (
              <tr key={i} className="border-b border-[rgba(91,164,217,0.15)]">
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{d.documentType}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{d.deliveryMethod}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{d.status}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{d.deliveredAt ? new Date(d.deliveredAt).toLocaleDateString('ko-KR') : '기록 없음'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 4. 출퇴근/공수 요약 */}
      <SectionTitle n={4} title="출퇴근 / 공수 요약" />
      <InfoTable rows={[
        ['재직 기간 출근일수',   `${attendanceSummary.totalDays}일`],
        ['출근 누락 건수',       `${attendanceSummary.missingCheckin}건`],
        ['퇴근 누락 건수',       `${attendanceSummary.missingCheckout}건`],
        ['수동 수정 건수',       `${attendanceSummary.manualAdjustments}건`],
        ['수정 사유 누락 건수',  `${attendanceSummary.adjustmentNoReason}건`],
      ]} />

      {/* 5. 경고/소명/통지 */}
      <SectionTitle n={5} title="경고 / 소명 / 통지 기록" />
      <div className="font-semibold text-sm mb-1 text-[#CBD5E0]">경고 발행 이력 ({hrActions.warnings.length}건)</div>
      {hrActions.warnings.length === 0 ? <EmptyNote text="경고 기록 없음" /> : (
        <table className="w-full border-collapse text-sm mb-4">
          <thead><tr className="bg-[rgba(255,255,255,0.04)]">
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">경고 수위</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">사유</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">발행일</th>
          </tr></thead>
          <tbody>
            {hrActions.warnings.map((w, i) => (
              <tr key={i} className="border-b border-[rgba(91,164,217,0.15)]">
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{w.warningLevel}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{w.reason}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{new Date(w.issuedAt).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="font-semibold text-sm mb-1 text-[#CBD5E0]">소명 요청 이력 ({hrActions.explanations.length}건)</div>
      {hrActions.explanations.length === 0 ? <EmptyNote text="소명 요청 기록 없음" /> : (
        <table className="w-full border-collapse text-sm mb-4">
          <thead><tr className="bg-[rgba(255,255,255,0.04)]">
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">요청 제목</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">상태</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">요청일</th>
          </tr></thead>
          <tbody>
            {hrActions.explanations.map((e, i) => (
              <tr key={i} className="border-b border-[rgba(91,164,217,0.15)]">
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{e.subject}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{e.status}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{new Date(e.requestedAt).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="font-semibold text-sm mb-1 text-[#CBD5E0]">통지서 이력 ({hrActions.notices.length}건)</div>
      {hrActions.notices.length === 0 ? <EmptyNote text="통지서 기록 없음" /> : (
        <table className="w-full border-collapse text-sm mb-4">
          <thead><tr className="bg-[rgba(255,255,255,0.04)]">
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">통지 유형</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">제목</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">교부 방법</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">발행일</th>
          </tr></thead>
          <tbody>
            {hrActions.notices.map((n, i) => (
              <tr key={i} className="border-b border-[rgba(91,164,217,0.15)]">
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{n.noticeType}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{n.title}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{n.deliveryMethod}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{new Date(n.issuedAt).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 6. 보완조치 */}
      <SectionTitle n={6} title="종료 전 보완조치 필요 항목" />
      {remedialActions.length === 0 ? <EmptyNote text="보완조치 필요 항목 없음" /> : (
        <table className="w-full border-collapse text-sm mb-4">
          <thead><tr className="bg-[rgba(255,255,255,0.04)]">
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2 w-1/3">점검 항목</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2 w-20">심각도</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">권장 조치</th>
          </tr></thead>
          <tbody>
            {remedialActions.map((r, i) => (
              <tr key={i} className="border-b border-[rgba(91,164,217,0.15)]">
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{r.label}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">
                  <span className={`text-xs px-2 py-1 rounded ${SEVERITY_COLOR[r.severity] ?? ''}`}>{SEVERITY_LABEL[r.severity] ?? r.severity}</span>
                </td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 7. 감사로그 */}
      <SectionTitle n={7} title="감사로그 요약" />
      {auditLogSummary.length === 0 ? <EmptyNote text="감사로그 기록 없음" /> : (
        <table className="w-full border-collapse text-sm mb-4">
          <thead><tr className="bg-[rgba(255,255,255,0.04)]">
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2 w-52">이벤트</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2 w-24">역할</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2">요약</th>
            <th className="border border-[rgba(91,164,217,0.25)] px-3 py-2 w-36">일시</th>
          </tr></thead>
          <tbody>
            {auditLogSummary.map((log, i) => (
              <tr key={i} className="border-b border-[rgba(91,164,217,0.15)]">
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2 font-mono text-xs">{log.actionType}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2 text-xs">{log.actorRole}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2">{log.summary}</td>
                <td className="border border-[rgba(91,164,217,0.25)] px-3 py-2 text-xs">{new Date(log.occurredAt).toLocaleString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 고정 문구 */}
      <div className="mt-8 pt-4 border-t border-[rgba(91,164,217,0.25)] text-xs text-[#718096] space-y-1">
        {disclaimer.map((line, i) => <p key={i}>※ {line}</p>)}
      </div>

      {/* 하단 PDF 버튼 */}
      <div className="mt-8 flex justify-center">
        <a href={pdfUrl} target="_blank" rel="noreferrer"
           className="px-8 py-3 bg-[rgba(255,255,255,0.08)] text-white font-semibold rounded hover:bg-[rgba(255,255,255,0.12)]">
          PDF 출력 / 다운로드
        </a>
      </div>

    </div>
  )
}

export default function EvidencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#718096]">로딩 중...</div>}>
      <EvidencePageContent />
    </Suspense>
  )
}
