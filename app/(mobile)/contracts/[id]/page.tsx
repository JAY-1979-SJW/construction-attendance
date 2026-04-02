'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SignatureCanvas from '@/components/common/SignatureCanvas'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'

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

interface ContractSection {
  title:   string
  content: string
}

interface RenderedContract {
  templateType:   string
  title:          string
  subtitle:       string
  legalBasis:     string
  sections:       ContractSection[]
  signatureBlock: string
}

interface DocumentData {
  contractId:          string
  contractStatus:      string
  contractTemplateType: string | null
  signedAt:            string | null
  hasWorkerSignature:  boolean
  document: {
    id:          string
    contentJson: RenderedContract
    contentText: string | null
    status:      string
    generatedAt: string
  } | null
}

// ─── 색상 맵 ───────────────────────────────────────────────────
const CODE_COLOR: Record<string, string> = {
  DAILY_CONSTRUCTION: '#1565C0',
  REGULAR:            '#2E7D32',
  FIXED_TERM:         '#E65100',
  CONTINUOUS_SITE:    '#6A1B9A',
  SUBCONTRACTOR:      '#F57F17',
}

function accentOf(code: string | undefined) {
  return code ? (CODE_COLOR[code] ?? '#1976d2') : '#1976d2'
}

// ─── 페이지 ────────────────────────────────────────────────────
export default function WorkerContractConfirmPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [contract, setContract] = useState<ContractSummary | null>(null)
  const [docData, setDocData]   = useState<DocumentData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // step: 'view' → 열람 확인 | 'body' → 본문 열람 | 'sign' → 서명 | 'done' → 완료
  const [step, setStep] = useState<'view' | 'body' | 'sign' | 'done'>('view')

  const [viewChecks,     setViewChecks]     = useState<boolean[]>([])
  const [presignChecked, setPresignChecked] = useState(false)
  const [submitting, setSubmitting]         = useState(false)

  // 계약 요약 + 본문 동시 로드
  useEffect(() => {
    Promise.all([
      fetch(`/api/worker/contracts/${id}`).then(r => r.json()),
      fetch(`/api/worker/contracts/${id}/document`).then(r => r.json()),
    ])
      .then(([summaryJson, docJson]) => {
        if (summaryJson.success) {
          const c: ContractSummary = summaryJson.data
          setContract(c)
          setViewChecks(new Array(c.guide?.checkboxes.length ?? 0).fill(false))
          if (c.viewConfirmed && c.presignConfirmed) setStep('done')
          else if (c.viewConfirmed) setStep('body')
        } else {
          setError(summaryJson.message || '계약 정보를 불러올 수 없습니다.')
        }
        if (docJson.success) {
          setDocData(docJson.data)
          if (docJson.data?.hasWorkerSignature) setStep('done')
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
        if (stage === 'VIEW')    setStep('body')
        if (stage === 'PRESIGN') setStep('sign')
      } else {
        setError(json.message || '처리 중 오류가 발생했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSign(signatureData: string) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/worker/contracts/${id}/sign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ signatureData }),
      })
      const json = await res.json()
      if (json.success) {
        setStep('done')
      } else {
        setError(json.message || '서명 처리 중 오류가 발생했습니다.')
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

  if (error && !contract) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand gap-3 px-6">
        <p className="text-[#c62828] text-[14px] text-center">{error || '계약 정보를 찾을 수 없습니다.'}</p>
        <button onClick={() => router.back()} className="px-5 py-2 bg-brand-accent text-white border-none rounded-lg text-[13px] cursor-pointer">
          돌아가기
        </button>
      </div>
    )
  }

  if (!contract) return null

  const guide   = contract.guide
  const accent  = accentOf(guide?.code)
  const allViewChecked = viewChecks.every(Boolean)
  const renderedDoc = docData?.document?.contentJson as RenderedContract | undefined

  const stepLabels: Record<string, string> = {
    view: '1단계: 계약 내용 확인',
    body: '2단계: 계약서 본문 열람',
    sign: '3단계: 전자서명',
    done: '서명 완료',
  }

  // ── 완료 화면 ──────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-brand flex flex-col items-center justify-center p-6 gap-4">
        <div className="bg-card rounded-2xl py-8 px-6 max-w-[440px] w-full text-center shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <div className="text-[48px] mb-3">✅</div>
          <h2 className="text-[18px] font-bold text-[#1b5e20] mb-2">서명 완료</h2>
          <p className="text-[13px] text-muted-brand leading-[1.6]">
            계약서 확인 및 전자서명이 완료되었습니다.<br />
            관리자 검토 후 계약이 확정됩니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand pb-24">
      {/* 헤더 */}
      <div style={{ background: accent }} className="text-white px-5 pt-5 pb-4 sticky top-0 z-10">
        <p className="text-[13px] opacity-80 mb-1">
          {step === 'view' ? '1 / 3단계' : step === 'body' ? '2 / 3단계' : '3 / 3단계'}
        </p>
        <h1 className="text-[17px] font-bold m-0">
          {stepLabels[step]}
        </h1>
      </div>

      <div className="px-4 max-w-[540px] mx-auto flex flex-col gap-[14px] pt-4">

        {/* 계약 요약 카드 — 모든 단계에서 표시 */}
        <div className="bg-card rounded-xl p-[18px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: accent, background: accent + '15' }} className="text-[13px] font-bold rounded-md px-[10px] py-[3px]">
              {guide?.title ?? '계약 정보'}
            </span>
          </div>
          <div className="space-y-0">
            {[
              { label: '이름',   value: contract.workerName },
              { label: '회사',   value: contract.companyName || '-' },
              { label: '현장',   value: contract.siteName || '-' },
              { label: '임금',   value: contract.wage },
              { label: '시작일', value: contract.startDate },
              { label: '종료일', value: contract.endDate || '별도 없음' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-3 py-[7px] border-b border-[#F3F4F6] last:border-b-0">
                <span className="text-[13px] text-muted-brand shrink-0">{label}</span>
                <span className="text-[13px] font-semibold text-[#222] text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 1단계: 열람 확인 ─────────────────────────────── */}
        {step === 'view' && guide && (
          <>
            <div className="bg-card rounded-xl p-[18px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
              <h3 className="text-[14px] font-bold text-[#222] mb-2">근로유형 안내</h3>
              <p className="text-[13px] text-muted-brand leading-[1.7] mb-3">{guide.description}</p>
              <div className="bg-[#f8f8f8] rounded-lg p-3">
                <div className="text-[13px] font-semibold text-[#444] mb-[6px]">확인사항</div>
                {guide.checkPoints.map((pt, i) => (
                  <div key={i} className="text-[13px] text-muted-brand mb-1">• {pt}</div>
                ))}
              </div>
            </div>

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
                  <span className="text-[13px] text-dim-brand leading-[1.5]">{label}</span>
                </label>
              ))}
            </div>

            {error && <ErrorBanner message={error} />}

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

        {/* ── 2단계: 계약서 본문 열람 ──────────────────────── */}
        {step === 'body' && (
          <>
            {renderedDoc ? (
              <div className="bg-card rounded-xl shadow-[0_1px_6px_rgba(0,0,0,0.07)] overflow-hidden">
                {/* 문서 제목 */}
                <div className="px-[18px] pt-[18px] pb-2">
                  <h2 className="text-[16px] font-bold text-[#222] mb-1">{renderedDoc.title}</h2>
                  <p className="text-[13px] text-muted-brand">{renderedDoc.subtitle}</p>
                  <div className="mt-2 px-3 py-[6px] bg-[#f0f4f8] rounded text-[13px] text-[#555]">
                    법적 근거: {renderedDoc.legalBasis}
                  </div>
                </div>

                {/* 조항 목록 */}
                <div className="px-[18px] pb-[18px] max-h-[60vh] overflow-y-auto">
                  {renderedDoc.sections.map((section, i) => (
                    <div key={i} className="mt-4">
                      <h4 className="text-[13px] font-bold text-[#333] mb-[6px]">{section.title}</h4>
                      <div className="text-[13px] text-[#555] leading-[1.8] whitespace-pre-wrap">
                        {section.content}
                      </div>
                    </div>
                  ))}

                  {/* 서명란 */}
                  {renderedDoc.signatureBlock && (
                    <div className="mt-6 pt-4 border-t border-brand">
                      <div className="text-[13px] text-[#555] leading-[1.8] whitespace-pre-wrap">
                        {renderedDoc.signatureBlock}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#fff8e1] border border-[#ffe082] rounded-xl p-4 text-center">
                <p className="text-[13px] text-[#5d4037]">
                  계약서 본문이 아직 생성되지 않았습니다.<br />
                  관리자에게 문의하세요.
                </p>
              </div>
            )}

            {/* 최종 확인 */}
            <div className="bg-card rounded-xl p-[18px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
              <div className="bg-[#fff8e1] border border-[#ffe082] rounded-lg p-3 mb-3">
                <div className="text-[13px] font-bold text-accent-hover mb-[6px]">서명 전 최종 확인</div>
                <p className="text-[13px] text-[#5d4037] leading-[1.6] m-0">
                  위 계약서 내용을 모두 읽고 확인하였으며, 동의 후에는 내용 변경이 어려울 수 있습니다.
                </p>
              </div>
              <label className="flex items-start gap-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={presignChecked}
                  onChange={e => setPresignChecked(e.target.checked)}
                  className="w-[18px] h-[18px] mt-[2px] shrink-0"
                  style={{ accentColor: accent }}
                />
                <span className="text-[13px] text-dim-brand leading-[1.6]">
                  {guide?.finalCheckText ?? '위 계약서 내용을 모두 확인하였으며, 이에 동의합니다.'}
                </span>
              </label>
            </div>

            {error && <ErrorBanner message={error} />}

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
              {submitting ? '처리 중...' : '동의 완료 — 전자서명으로'}
            </button>
          </>
        )}

        {/* ── 3단계: 전자서명 ──────────────────────────────── */}
        {step === 'sign' && (
          <>
            <div className="bg-green-light border border-[#a5d6a7] rounded-xl p-4">
              <div className="text-[13px] font-bold text-[#2e7d32] mb-[6px]">전자서명 안내</div>
              <p className="text-[13px] text-[#33691e] leading-[1.6] m-0">
                아래 서명란에 본인의 서명을 입력해 주세요.<br />
                서명이 완료되면 관리자에게 검토 요청이 전송됩니다.
              </p>
            </div>

            <div className="bg-card rounded-xl p-[18px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
              <SignatureCanvas
                onSave={handleSign}
                accentColor={accent}
                disabled={submitting}
              />
            </div>

            {error && <ErrorBanner message={error} />}

            {submitting && (
              <div className="text-center text-[13px] text-muted-brand py-2">
                서명을 저장하는 중...
              </div>
            )}
          </>
        )}

      </div>
      <WorkerBottomNav />
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-[#ffeef0] border border-[#f5c2c7] rounded-lg px-[14px] py-[10px] text-[13px] text-[#c62828]">
      {message}
    </div>
  )
}
