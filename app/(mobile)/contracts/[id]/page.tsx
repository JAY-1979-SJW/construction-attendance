'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ─── 타입 ──────────────────────────────────────────────────────
interface WorkerConfirmationGuide {
  code:          string
  title:         string
  description:   string
  checkPoints:   string[]
  checkboxes:    string[]
  finalCheckText: string
}

interface ContractSummary {
  id:              string
  contractStatus:  string
  startDate:       string
  endDate:         string | null
  companyName:     string
  companyRepName:  string
  workerName:      string
  siteName:        string | null
  wage:            string
  guide:           WorkerConfirmationGuide | null
  viewConfirmed:   boolean
  presignConfirmed: boolean
}

// ─── 색상 맵 ───────────────────────────────────────────────────
const CODE_COLOR: Record<string, string> = {
  DAILY_CONSTRUCTION: '#1565C0',
  REGULAR:            '#2E7D32',
  FIXED_TERM:         '#E65100',
  SUBCONTRACTOR:      '#6A1B9A',
}

function accentOf(code: string | undefined) {
  return code ? (CODE_COLOR[code] ?? '#1976d2') : '#1976d2'
}

// ─── 페이지 ────────────────────────────────────────────────────
export default function WorkerContractConfirmPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [contract, setContract] = useState<ContractSummary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // step: 'view' → 열람 확인 단계 | 'presign' → 서명 전 최종 확인 | 'done' → 완료
  const [step, setStep] = useState<'view' | 'presign' | 'done'>('view')

  // 체크박스 상태 (단계별로 구분)
  const [viewChecks,    setViewChecks]    = useState<boolean[]>([])
  const [presignChecked, setPresignChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/worker/contracts/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const c: ContractSummary = json.data
          setContract(c)
          setViewChecks(new Array(c.guide?.checkboxes.length ?? 0).fill(false))
          // 이미 열람 확인한 경우 presign 단계로
          if (c.viewConfirmed && !c.presignConfirmed) setStep('presign')
          else if (c.viewConfirmed && c.presignConfirmed) setStep('done')
        } else {
          setError(json.message || '계약 정보를 불러올 수 없습니다.')
        }
      })
      .catch(() => setError('네트워크 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleConfirm(stage: 'VIEW' | 'PRESIGN') {
    setSubmitting(true)
    try {
      const res  = await fetch(`/api/worker/contracts/${id}/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stage }),
      })
      const json = await res.json()
      if (json.success) {
        if (stage === 'VIEW')    setStep('presign')
        if (stage === 'PRESIGN') setStep('done')
      } else {
        setError(json.message || '처리 중 오류가 발생했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 로딩 / 에러 ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand">
        <p className="text-muted-brand text-[14px]">계약 정보를 불러오는 중...</p>
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand gap-3 px-6">
        <p className="text-[#c62828] text-[14px] text-center">{error || '계약 정보를 찾을 수 없습니다.'}</p>
        <button onClick={() => router.back()} className="px-5 py-2 bg-[#F47920] text-white border-none rounded-lg text-[13px] cursor-pointer">
          돌아가기
        </button>
      </div>
    )
  }

  const guide   = contract.guide
  const accent  = accentOf(guide?.code)
  const allViewChecked = viewChecks.every(Boolean)

  // ── 완료 화면 ──────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-brand flex flex-col items-center justify-center p-6 gap-4">
        <div className="bg-card rounded-2xl py-8 px-6 max-w-[440px] w-full text-center shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <div className="text-[48px] mb-3">✅</div>
          <h2 className="text-[18px] font-bold text-[#1b5e20] mb-2">확인 완료</h2>
          <p className="text-[13px] text-muted-brand leading-[1.6]">
            계약 내용 확인 절차가 완료되었습니다.<br />
            관리자가 다음 단계를 안내해 드릴 것입니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand pb-10">
      {/* 헤더 — background depends on dynamic accent, keep as inline */}
      <div style={{ background: accent }} className="text-white px-5 pt-5 pb-4 sticky top-0 z-10">
        <p className="text-[11px] opacity-80 mb-1">
          {step === 'view' ? '1단계 / 2단계' : '2단계 / 2단계'}
        </p>
        <h1 className="text-[17px] font-bold m-0">
          {step === 'view' ? '계약 내용 확인' : '서명 전 최종 확인'}
        </h1>
      </div>

      <div className="px-4 max-w-[540px] mx-auto flex flex-col gap-[14px] pt-4">

        {/* 계약 요약 카드 */}
        <div className="bg-card rounded-xl p-[18px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
          <div className="flex items-center gap-2 mb-3">
            {/* color and background depend on dynamic accent */}
            <span style={{ color: accent, background: accent + '15' }} className="text-[13px] font-bold rounded-md px-[10px] py-[3px]">
              {guide?.title ?? '계약 정보'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[13px]">
            {[
              { label: '이름',   value: contract.workerName },
              { label: '회사',   value: contract.companyName || '-' },
              { label: '현장',   value: contract.siteName || '-' },
              { label: '임금',   value: contract.wage },
              { label: '시작일', value: contract.startDate },
              { label: '종료일', value: contract.endDate || '별도 없음' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[11px] text-muted-brand mb-[2px]">{label}</div>
                <div className="font-semibold text-[#222]">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 1단계: 열람 확인 ─────────────────────────────── */}
        {step === 'view' && guide && (
          <>
            {/* 유형 설명 */}
            <div className="bg-card rounded-xl p-[18px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
              <h3 className="text-[14px] font-bold text-[#222] mb-2">근로유형 안내</h3>
              <p className="text-[13px] text-muted-brand leading-[1.7] mb-3">{guide.description}</p>
              <div className="bg-[#f8f8f8] rounded-lg p-3">
                <div className="text-[12px] font-semibold text-[#444] mb-[6px]">확인사항</div>
                {guide.checkPoints.map((pt, i) => (
                  <div key={i} className="text-[12px] text-muted-brand mb-1">• {pt}</div>
                ))}
              </div>
            </div>

            {/* 체크박스 동의 */}
            <div className="bg-card rounded-xl p-[18px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
              <h3 className="text-[14px] font-bold text-[#222] mb-3">내용 확인</h3>
              {guide.checkboxes.map((label, i) => (
                <label key={i} className="flex items-start gap-[10px] mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={viewChecks[i] ?? false}
                    onChange={e => {
                      const next = [...viewChecks]
                      next[i] = e.target.checked
                      setViewChecks(next)
                    }}
                    className="w-[18px] h-[18px] mt-px shrink-0"
                    style={{ accentColor: accent }}
                  />
                  <span className="text-[13px] text-[#CBD5E0] leading-[1.5]">{label}</span>
                </label>
              ))}
            </div>

            {error && <div className="bg-[#ffeef0] border border-[#f5c2c7] rounded-lg px-[14px] py-[10px] text-[13px] text-[#c62828]">{error}</div>}

            <button
              disabled={!allViewChecked || submitting}
              onClick={() => handleConfirm('VIEW')}
              className="w-full py-[15px] rounded-[10px] text-[15px] font-bold text-white border-none transition-[background] duration-200"
              style={{
                cursor: allViewChecked && !submitting ? 'pointer' : 'not-allowed',
                background: allViewChecked ? accent : '#ccc',
                opacity: allViewChecked ? 1 : 0.6,
              }}
            >
              {submitting ? '처리 중...' : '확인 완료 — 다음 단계로'}
            </button>
          </>
        )}

        {/* ── 2단계: 서명 전 최종 확인 ──────────────────────── */}
        {step === 'presign' && guide && (
          <>
            <div className="bg-[#fff8e1] border border-[#ffe082] rounded-xl p-4">
              <div className="text-[13px] font-bold text-[#e65100] mb-[6px]">⚠ 서명 전 최종 확인</div>
              <p className="text-[13px] text-[#5d4037] leading-[1.6] m-0">
                아래 내용을 확인하고 동의하셔야 계약 처리가 진행됩니다.
                동의 후에는 내용 변경이 어려울 수 있으니 신중하게 확인하세요.
              </p>
            </div>

            <div className="bg-card rounded-xl p-[18px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
              <h3 className="text-[14px] font-bold text-[#222] mb-[14px]">최종 동의</h3>
              <label className="flex items-start gap-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={presignChecked}
                  onChange={e => setPresignChecked(e.target.checked)}
                  className="w-[18px] h-[18px] mt-[2px] shrink-0"
                  style={{ accentColor: accent }}
                />
                <span className="text-[13px] text-[#CBD5E0] leading-[1.6]">{guide.finalCheckText}</span>
              </label>
            </div>

            {error && <div className="bg-[#ffeef0] border border-[#f5c2c7] rounded-lg px-[14px] py-[10px] text-[13px] text-[#c62828]">{error}</div>}

            <button
              disabled={!presignChecked || submitting}
              onClick={() => handleConfirm('PRESIGN')}
              className="w-full py-[15px] rounded-[10px] text-[15px] font-bold text-white border-none transition-[background] duration-200"
              style={{
                cursor: presignChecked && !submitting ? 'pointer' : 'not-allowed',
                background: presignChecked ? accent : '#ccc',
                opacity: presignChecked ? 1 : 0.6,
              }}
            >
              {submitting ? '처리 중...' : '최종 동의 완료'}
            </button>
          </>
        )}

      </div>
    </div>
  )
}
