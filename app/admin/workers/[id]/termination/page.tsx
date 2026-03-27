'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

/**
 * 관리자 종료 처리 체크리스트
 *
 * 6단계 강제 플로우:
 *  1 → 기본정보 입력 (종료유형·종료일·사유)
 *  2 → 자동점검 결과 확인 (11개 항목)
 *  3 → 누락항목 보완 액션
 *  4 → 최종 확인 체크박스 5개
 *  5 → 종료 확정 (스냅샷+감사로그)
 *
 * 종료 버튼 클릭 → 즉시 종료 불가, 반드시 이 플로우를 거쳐야 함.
 * 치명 리스크는 빨간 경고 박스로 강하게 표시, 확정 버튼 근처 반복 표시.
 */

type Step = 1 | 2 | 3 | 4 | 5

interface CheckItem {
  key:      string
  label:    string
  passed:   boolean
  severity: 'OK' | 'WARN' | 'DANGER' | 'CRITICAL'
  action?:  string
}

interface Review {
  id:                     string
  status:                 string
  terminationReason:      string | null
  terminationDate:        string | null
  reasonCategory:         string | null
  detailReason:           string | null
  autoCheckResultJson:    CheckItem[] | null
  confirmCheckedReason:   boolean
  confirmCheckedDocuments:boolean
  confirmCheckedDelivery: boolean
  confirmCheckedWage:     boolean
  confirmCheckedDispute:  boolean
}

const TERMINATION_REASONS: { value: string; label: string }[] = [
  { value: 'CONTRACT_EXPIRY',     label: '계약기간 만료' },
  { value: 'VOLUNTARY_RESIGN',    label: '자진 퇴사' },
  { value: 'MUTUAL_AGREEMENT',    label: '합의 종료' },
  { value: 'DISCIPLINARY',        label: '징계성 종료' },
  { value: 'ABSENCE',             label: '무단결근 후 종료' },
  { value: 'PERFORMANCE',         label: '업무 부적합' },
  { value: 'SITE_CLOSURE',        label: '현장 종료' },
  { value: 'REPEATED_ABSENCE',    label: '반복 미출근' },
  { value: 'INSTRUCTION_REFUSAL', label: '지시 불이행' },
  { value: 'OTHER',               label: '기타' },
]

const SEVERITY_CONFIG = {
  OK:       { color: '#2e7d32', bg: '#e8f5e9', border: '#a5d6a7', icon: '✅', label: '정상' },
  WARN:     { color: '#f57f17', bg: '#fff8e1', border: '#ffe082', icon: '⚠️', label: '주의' },
  DANGER:   { color: '#e65100', bg: '#fff3e0', border: '#ffcc80', icon: '🔶', label: '위험' },
  CRITICAL: { color: '#c62828', bg: '#ffebee', border: '#ef9a9a', icon: '🚨', label: '치명' },
}

const ACTION_LABEL: Record<string, string> = {
  CREATE_CONTRACT:   '계약서 생성',
  REQUEST_SIGNATURE: '서명 요청',
  REDELIVER_DOCUMENT:'문서 재교부',
  CREATE_NOTICE:     '종료통지서 생성',
  ADD_WARNING:       '경고장 추가',
}

const CONFIRM_CHECKS: { field: keyof Review; label: string }[] = [
  { field: 'confirmCheckedReason',    label: '종료 사유를 확인했습니다.' },
  { field: 'confirmCheckedDocuments', label: '관련 문서를 확인했습니다.' },
  { field: 'confirmCheckedDelivery',  label: '교부·통지 상태를 확인했습니다.' },
  { field: 'confirmCheckedWage',      label: '미정산 여부를 확인했습니다.' },
  { field: 'confirmCheckedDispute',   label: '종료 후 분쟁 가능성을 검토했습니다.' },
]

export default function TerminationPage() {
  const { id: workerId } = useParams<{ id: string }>()
  const router = useRouter()

  const [step,     setStep]     = useState<Step>(1)
  const [review,   setReview]   = useState<Review | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)

  // Step 1 form state
  const [form, setForm] = useState({
    terminationReason: '',
    terminationDate:   '',
    reasonCategory:    '',
    detailReason:      '',
  })

  const loadReview = useCallback(async () => {
    const res  = await fetch(`/api/admin/workers/${workerId}/termination-review`)
    const data = await res.json()
    if (data.review) {
      setReview(data.review)
      setForm({
        terminationReason: data.review.terminationReason ?? '',
        terminationDate:   data.review.terminationDate ?? '',
        reasonCategory:    data.review.reasonCategory ?? '',
        detailReason:      data.review.detailReason ?? '',
      })
      if (data.review.status === 'CONFIRMED') setDone(true)
    }
  }, [workerId])

  useEffect(() => { loadReview() }, [loadReview])

  // Step 1 → 2: Start review
  async function handleStartReview() {
    if (!form.terminationReason || !form.terminationDate || !form.detailReason.trim()) {
      setError('종료 사유, 종료일, 상세 사유는 필수입니다.')
      return
    }
    setError('')
    setLoading(true)
    try {
      // 검토 시작 (자동점검 포함)
      let reviewId = review?.id
      if (!reviewId) {
        const startRes  = await fetch(`/api/admin/workers/${workerId}/termination-review`, { method: 'POST' })
        const startData = await startRes.json()
        reviewId = startData.review?.id
        setReview(startData.review)
      }
      if (!reviewId) { setError('검토를 시작할 수 없습니다.'); return }

      // 기본정보 저장
      await fetch(`/api/admin/workers/${workerId}/termination-review/${reviewId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      await loadReview()
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  // Step 2 → 3 또는 4 (누락 있으면 3, 없으면 4)
  function handleCheckReviewed() {
    const checks = review?.autoCheckResultJson ?? []
    const hasMissing = checks.some(c => !c.passed && ['DANGER', 'CRITICAL'].includes(c.severity))
    setStep(hasMissing ? 3 : 4)
  }

  // Step 3 → 4: 보완 완료 후 재점검
  async function handleRecheck() {
    setLoading(true)
    if (review?.id) {
      // 재점검: 검토 재시작해서 최신 상태 반영
      await fetch(`/api/admin/workers/${workerId}/termination-review`, { method: 'POST' })
      await loadReview()
    }
    setLoading(false)
    setStep(4)
  }

  // Step 4: 체크박스 토글
  async function toggleConfirm(field: keyof Review) {
    if (!review?.id) return
    const current = review[field] as boolean
    await fetch(`/api/admin/workers/${workerId}/termination-review/${review.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ [field]: !current }),
    })
    await loadReview()
  }

  // Step 4 → 5: 종료 확정
  async function handleConfirm() {
    if (!review?.id) return
    setSaving(true)
    setError('')
    try {
      const res  = await fetch(`/api/admin/workers/${workerId}/termination-review/${review.id}/confirm`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setDone(true)
        setStep(5)
      } else {
        setError(data.error ?? '종료 확정에 실패했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  const allChecked = review
    ? (review.confirmCheckedReason && review.confirmCheckedDocuments &&
       review.confirmCheckedDelivery && review.confirmCheckedWage && review.confirmCheckedDispute)
    : false

  const checks       = review?.autoCheckResultJson ?? []
  const criticals    = checks.filter(c => c.severity === 'CRITICAL' && !c.passed)
  const dangers      = checks.filter(c => c.severity === 'DANGER'   && !c.passed)
  const hasCritical  = criticals.length > 0

  return (
    <div className="max-w-[720px] mx-auto px-4 py-6 font-[system-ui,sans-serif]">
      {/* 뒤로가기 */}
      <div className="mb-4">
        <Link href={`/admin/workers/${workerId}`} className="text-[#4A93C8] text-[14px] no-underline">
          ← 근로자 상세로 돌아가기
        </Link>
      </div>

      {/* 헤더 */}
      <div className="rounded-xl p-5 mb-5"
        style={{
          background: done ? '#e8f5e9' : '#fff3e0',
          border: `1px solid ${done ? '#a5d6a7' : '#ffcc80'}`,
        }}>
        <h1 className="m-0 mb-1.5 text-[22px] font-black" style={{ color: done ? '#2e7d32' : '#e65100' }}>
          {done ? '✅ 종료 처리 완료' : '⚠️ 종료 처리 체크리스트'}
        </h1>
        <p className="m-0 text-[13px] text-muted-brand">
          {done
            ? '종료 확정 및 스냅샷이 저장되었습니다. 분쟁방어 패널에서 확인할 수 있습니다.'
            : '단순 상태 변경은 금지됩니다. 아래 절차를 완료해야 종료 처리됩니다.'}
        </p>
      </div>

      {/* 단계 표시 */}
      {!done && (
        <div className="flex gap-0 mb-6">
          {(['기본정보', '자동점검', '보완액션', '최종확인', '완료'] as const).map((label, i) => {
            const n = (i + 1) as Step
            const active  = step === n
            const passed  = step > n
            return (
              <div key={n} className="flex-1 text-center">
                <div className="w-7 h-7 rounded-full mx-auto mb-1 flex items-center justify-center text-[13px] font-bold"
                  style={{
                    background: passed ? '#2e7d32' : active ? '#1565c0' : '#e0e0e0',
                    color: (passed || active) ? '#fff' : '#999',
                  }}>
                  {passed ? '✓' : n}
                </div>
                <div className="text-[11px]"
                  style={{ color: active ? '#1565c0' : passed ? '#2e7d32' : '#999', fontWeight: active ? 700 : 400 }}>
                  {label}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="bg-[#ffebee] border border-[#ef9a9a] rounded-lg px-4 py-3 mb-4 text-[#c62828] text-[14px]">
          {error}
        </div>
      )}

      {/* ── Step 1: 기본정보 ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white border border-white/[0.12] rounded-xl p-6">
          <h2 className="m-0 mb-5 text-[16px] font-bold">Step 1 — 종료 기본정보 입력</h2>

          <Field label="종료 유형" required>
            <select
              value={form.terminationReason}
              onChange={e => setForm(f => ({ ...f, terminationReason: e.target.value }))}
              className="w-full px-3 py-2.5 border border-white/[0.12] rounded-lg text-[14px] outline-none box-border bg-white"
            >
              <option value="">선택하세요</option>
              {TERMINATION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>

          <Field label="종료일 (또는 종료 예정일)" required>
            <input
              type="date"
              value={form.terminationDate}
              onChange={e => setForm(f => ({ ...f, terminationDate: e.target.value }))}
              className="w-full px-3 py-2.5 border border-white/[0.12] rounded-lg text-[14px] outline-none box-border"
            />
          </Field>

          <Field label="사유 카테고리 (선택)">
            <input
              value={form.reasonCategory}
              onChange={e => setForm(f => ({ ...f, reasonCategory: e.target.value }))}
              placeholder="예: 계약만료, 현장종료, 자진퇴사"
              className="w-full px-3 py-2.5 border border-white/[0.12] rounded-lg text-[14px] outline-none box-border"
            />
          </Field>

          <Field label="상세 사유" required>
            <textarea
              value={form.detailReason}
              onChange={e => setForm(f => ({ ...f, detailReason: e.target.value }))}
              placeholder="구체적인 종료 경위와 사유를 입력하세요."
              rows={4}
              className="w-full px-3 py-2.5 border border-white/[0.12] rounded-lg text-[14px] outline-none box-border resize-y"
            />
          </Field>

          <button
            onClick={handleStartReview}
            disabled={loading || !form.terminationReason || !form.terminationDate || !form.detailReason.trim()}
            className="flex-1 w-full py-3.5 border-none rounded-lg text-white text-[14px] font-bold"
            style={{
              background: (loading || !form.terminationReason || !form.terminationDate || !form.detailReason.trim()) ? '#bdbdbd' : '#1565c0',
              cursor: (loading || !form.terminationReason || !form.terminationDate || !form.detailReason.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '자동점검 실행 중...' : '자동점검 시작 →'}
          </button>
        </div>
      )}

      {/* ── Step 2: 자동점검 결과 ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white border border-white/[0.12] rounded-xl p-6">
          <h2 className="m-0 mb-5 text-[16px] font-bold">Step 2 — 자동점검 결과</h2>

          {hasCritical && (
            <div className="bg-[#ffebee] border-2 border-[#e53935] rounded-[10px] px-4 py-3.5 mb-5">
              <div className="text-[15px] font-black text-[#c62828] mb-2">
                🚨 치명 리스크 {criticals.length}건 — 즉시 보완이 필요합니다
              </div>
              {criticals.map(c => (
                <div key={c.key} className="text-[13px] text-[#c62828] mb-1">· {c.label}</div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 mb-5">
            {checks.map(c => {
              const cfg = SEVERITY_CONFIG[c.severity]
              return (
                <div key={c.key} className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg"
                  style={{
                    background: c.passed ? '#fafafa' : cfg.bg,
                    border: `1px solid ${c.passed ? '#e0e0e0' : cfg.border}`,
                  }}>
                  <span className="text-[16px] w-5 shrink-0">{c.passed ? '✅' : cfg.icon}</span>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold" style={{ color: c.passed ? '#333' : cfg.color }}>{c.label}</div>
                    {!c.passed && (
                      <div className="text-[11px] mt-0.5" style={{ color: cfg.color }}>{cfg.label} — {c.action ? ACTION_LABEL[c.action] ?? c.action : '관리자 확인 필요'}</div>
                    )}
                  </div>
                  {!c.passed && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {cfg.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-2.5">
            <button onClick={() => setStep(1)} className="px-5 py-3.5 border border-white/[0.12] rounded-lg bg-white cursor-pointer text-[14px] text-muted-brand">← 수정</button>
            <button onClick={handleCheckReviewed} className="flex-1 py-3.5 border-none rounded-lg bg-[#1565c0] text-white text-[14px] font-bold cursor-pointer">
              {(criticals.length + dangers.length) > 0 ? '누락항목 보완하기 →' : '최종 확인으로 →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: 누락항목 보완 ────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white border border-white/[0.12] rounded-xl p-6">
          <h2 className="m-0 mb-4 text-[16px] font-bold">Step 3 — 누락항목 보완</h2>
          <p className="m-0 mb-5 text-[13px] text-muted-brand">
            아래 항목들을 보완한 후 재점검을 실행하세요. 치명 항목은 반드시 처리해 주세요.
          </p>

          {[...criticals, ...dangers].map(c => {
            const cfg = SEVERITY_CONFIG[c.severity]
            return (
              <div key={c.key} className="rounded-[10px] px-4 py-3.5 mb-3"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <div className="text-[13px] font-bold mb-2" style={{ color: cfg.color }}>
                  {cfg.icon} {c.label}
                </div>
                {c.action && (
                  <Link
                    href={getActionHref(c.action, workerId)}
                    className="inline-block px-4 py-1.5 text-white rounded-md text-[13px] font-bold no-underline"
                    style={{ background: cfg.color }}
                  >
                    {ACTION_LABEL[c.action] ?? c.action} →
                  </Link>
                )}
              </div>
            )
          })}

          <div className="flex gap-2.5 mt-2">
            <button onClick={() => setStep(2)} className="px-5 py-3.5 border border-white/[0.12] rounded-lg bg-white cursor-pointer text-[14px] text-muted-brand">← 점검결과 보기</button>
            <button onClick={handleRecheck} disabled={loading}
              className="flex-1 py-3.5 border-none rounded-lg text-white text-[14px] font-bold"
              style={{ background: loading ? '#bdbdbd' : '#1565c0', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? '재점검 중...' : '재점검 후 계속 →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: 최종 확인 ────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="bg-white border border-white/[0.12] rounded-xl p-6">
          <h2 className="m-0 mb-1.5 text-[16px] font-bold">Step 4 — 관리자 최종 확인</h2>
          <p className="m-0 mb-5 text-[13px] text-muted-brand">
            아래 항목을 모두 확인한 후 종료를 확정할 수 있습니다.
          </p>

          {hasCritical && (
            <div className="bg-[#ffebee] border-2 border-[#e53935] rounded-[10px] px-4 py-3 mb-4 text-[13px] text-[#c62828] font-bold">
              🚨 치명 리스크 {criticals.length}건이 미해결 상태입니다. 확정 전 반드시 보완하세요.
            </div>
          )}

          <div className="flex flex-col gap-2.5 mb-6">
            {CONFIRM_CHECKS.map(({ field, label }) => (
              <label
                key={field}
                onClick={() => toggleConfirm(field)}
                className="flex items-center gap-3 p-3.5 rounded-[10px] cursor-pointer"
                style={{
                  background: review?.[field] ? '#e8f5e9' : '#fafafa',
                  border: `1px solid ${review?.[field] ? '#a5d6a7' : '#e0e0e0'}`,
                }}
              >
                <div className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-white text-[13px] font-bold"
                  style={{
                    background: review?.[field] ? '#2e7d32' : '#fff',
                    border: `2px solid ${review?.[field] ? '#2e7d32' : '#ccc'}`,
                  }}>
                  {review?.[field] ? '✓' : ''}
                </div>
                <span className="text-[14px]" style={{ color: review?.[field] ? '#2e7d32' : '#333', fontWeight: review?.[field] ? 700 : 400 }}>
                  {label}
                </span>
              </label>
            ))}
          </div>

          {/* 종료정보 요약 */}
          <div className="bg-brand rounded-[10px] px-4 py-3.5 mb-5 text-[13px] text-muted-brand">
            <div className="font-bold mb-2 text-[#CBD5E0]">종료 처리 요약</div>
            <div>사유: <strong>{TERMINATION_REASONS.find(r => r.value === form.terminationReason)?.label}</strong></div>
            <div>종료일: <strong>{form.terminationDate}</strong></div>
            <div className="mt-1 text-[#777]">{form.detailReason}</div>
          </div>

          {/* 치명 경고 반복 표시 (확정 버튼 근처) */}
          {hasCritical && (
            <div className="bg-[#ffebee] border-2 border-[#e53935] rounded-[10px] px-4 py-3 mb-4 text-[13px] text-[#c62828]">
              🚨 <strong>치명 리스크 미해결 — 종료 후 분쟁 발생 시 불리할 수 있습니다.</strong>
            </div>
          )}

          <div className="flex gap-2.5">
            <button onClick={() => setStep(3)} className="px-5 py-3.5 border border-white/[0.12] rounded-lg bg-white cursor-pointer text-[14px] text-muted-brand">← 보완 액션으로</button>
            <button
              onClick={handleConfirm}
              disabled={!allChecked || saving}
              className="flex-1 py-3.5 border-none rounded-lg text-white text-[14px] font-bold"
              style={{
                background: (!allChecked || saving) ? '#bdbdbd' : '#c62828',
                cursor: (!allChecked || saving) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '처리 중...' : allChecked ? '종료 확정' : `확인 항목 ${CONFIRM_CHECKS.filter(c => !review?.[c.field]).length}개 남음`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: 완료 ─────────────────────────────────────────────────────── */}
      {(step === 5 || done) && (
        <div className="bg-[#e8f5e9] border border-[#a5d6a7] rounded-xl p-8 text-center">
          <div className="text-[48px] mb-3">✅</div>
          <h2 className="m-0 mb-2 text-[20px] font-black text-[#2e7d32]">종료 처리 완료</h2>
          <p className="m-0 mb-6 text-[14px] text-muted-brand">
            종료 스냅샷이 저장되었으며 감사로그가 기록되었습니다.
          </p>
          <div className="flex gap-2.5 justify-center flex-wrap">
            <Link href={`/admin/workers/${workerId}`}
              className="inline-block px-5 py-3 rounded-lg text-white text-[14px] font-bold no-underline bg-[#1565c0]">
              근로자 상세 보기
            </Link>
            <Link href={`/admin/workers/${workerId}/dispute-panel`}
              className="inline-block px-5 py-3 rounded-lg text-white text-[14px] font-bold no-underline bg-[#e53935]">
              분쟁방어 패널 →
            </Link>
            {review?.id && (
              <Link
                href={`/admin/workers/${workerId}/termination/evidence?reviewId=${review.id}`}
                className="inline-block px-5 py-3 rounded-lg text-white text-[14px] font-bold no-underline bg-[#37474f]"
              >
                종료 증빙 패키지 보기
              </Link>
            )}
            {review?.id && (
              <a
                href={`/api/admin/workers/${workerId}/termination-review/${review.id}/evidence/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-block px-5 py-3 rounded-lg text-white text-[14px] font-bold no-underline bg-[#4a148c]"
              >
                PDF 다운로드
              </a>
            )}
            <button onClick={() => router.push('/admin/workers')}
              className="flex-1 py-3.5 border-none rounded-lg text-white text-[14px] font-bold cursor-pointer bg-[#757575]">
              목록으로
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[13px] font-bold mb-1.5 text-[#CBD5E0]">
        {label} {required && <span className="text-[#e53935]">*</span>}
      </label>
      {children}
    </div>
  )
}

function getActionHref(action: string, workerId: string): string {
  switch (action) {
    case 'CREATE_CONTRACT':    return `/admin/contracts/new?workerId=${workerId}`
    case 'CREATE_NOTICE':      return `/admin/workers/${workerId}?tab=hrActions&action=notice`
    case 'ADD_WARNING':        return `/admin/workers/${workerId}?tab=hrActions&action=warning`
    case 'REQUEST_SIGNATURE':
    case 'REDELIVER_DOCUMENT': return `/admin/workers/${workerId}?tab=docs`
    default:                   return `/admin/workers/${workerId}`
  }
}
