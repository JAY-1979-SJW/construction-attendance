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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1B2838' }}>
        <p style={{ color: '#A0AEC0', fontSize: '14px' }}>계약 정보를 불러오는 중...</p>
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1B2838', gap: '12px', padding: '24px' }}>
        <p style={{ color: '#c62828', fontSize: '14px', textAlign: 'center' }}>{error || '계약 정보를 찾을 수 없습니다.'}</p>
        <button onClick={() => router.back()} style={{ padding: '8px 20px', background: '#F47920', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
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
      <div style={{ minHeight: '100vh', background: '#1B2838', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '32px 24px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1b5e20', marginBottom: '8px' }}>확인 완료</h2>
          <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.6' }}>
            계약 내용 확인 절차가 완료되었습니다.<br />
            관리자가 다음 단계를 안내해 드릴 것입니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', paddingBottom: '40px' }}>
      {/* 헤더 */}
      <div style={{ background: accent, color: 'white', padding: '20px 20px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <p style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>
          {step === 'view' ? '1단계 / 2단계' : '2단계 / 2단계'}
        </p>
        <h1 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
          {step === 'view' ? '계약 내용 확인' : '서명 전 최종 확인'}
        </h1>
      </div>

      <div style={{ padding: '16px', maxWidth: '540px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* 계약 요약 카드 */}
        <div style={{ background: '#243144', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: accent, background: accent + '15', borderRadius: '6px', padding: '3px 10px' }}>
              {guide?.title ?? '계약 정보'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px' }}>
            {[
              { label: '이름',   value: contract.workerName },
              { label: '회사',   value: contract.companyName || '-' },
              { label: '현장',   value: contract.siteName || '-' },
              { label: '임금',   value: contract.wage },
              { label: '시작일', value: contract.startDate },
              { label: '종료일', value: contract.endDate || '별도 없음' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: '11px', color: '#A0AEC0', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontWeight: 600, color: '#222' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 1단계: 열람 확인 ─────────────────────────────── */}
        {step === 'view' && guide && (
          <>
            {/* 유형 설명 */}
            <div style={{ background: '#243144', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#222', marginBottom: '8px' }}>근로유형 안내</h3>
              <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.7', marginBottom: '12px' }}>{guide.description}</p>
              <div style={{ background: '#f8f8f8', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px' }}>확인사항</div>
                {guide.checkPoints.map((pt, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>• {pt}</div>
                ))}
              </div>
            </div>

            {/* 체크박스 동의 */}
            <div style={{ background: '#243144', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#222', marginBottom: '12px' }}>내용 확인</h3>
              {guide.checkboxes.map((label, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={viewChecks[i] ?? false}
                    onChange={e => {
                      const next = [...viewChecks]
                      next[i] = e.target.checked
                      setViewChecks(next)
                    }}
                    style={{ width: '18px', height: '18px', marginTop: '1px', accentColor: accent, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '13px', color: '#CBD5E0', lineHeight: '1.5' }}>{label}</span>
                </label>
              ))}
            </div>

            {error && <div style={{ background: '#ffeef0', border: '1px solid #f5c2c7', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#c62828' }}>{error}</div>}

            <button
              disabled={!allViewChecked || submitting}
              onClick={() => handleConfirm('VIEW')}
              style={{
                width: '100%', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 700,
                border: 'none', cursor: allViewChecked && !submitting ? 'pointer' : 'not-allowed',
                background: allViewChecked ? accent : '#ccc', color: 'white',
                opacity: allViewChecked ? 1 : 0.6, transition: 'background 0.2s',
              }}
            >
              {submitting ? '처리 중...' : '확인 완료 — 다음 단계로'}
            </button>
          </>
        )}

        {/* ── 2단계: 서명 전 최종 확인 ──────────────────────── */}
        {step === 'presign' && guide && (
          <>
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#e65100', marginBottom: '6px' }}>⚠ 서명 전 최종 확인</div>
              <p style={{ fontSize: '13px', color: '#5d4037', lineHeight: '1.6', margin: 0 }}>
                아래 내용을 확인하고 동의하셔야 계약 처리가 진행됩니다.
                동의 후에는 내용 변경이 어려울 수 있으니 신중하게 확인하세요.
              </p>
            </div>

            <div style={{ background: '#243144', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#222', marginBottom: '14px' }}>최종 동의</h3>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={presignChecked}
                  onChange={e => setPresignChecked(e.target.checked)}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: accent, flexShrink: 0 }}
                />
                <span style={{ fontSize: '13px', color: '#CBD5E0', lineHeight: '1.6' }}>{guide.finalCheckText}</span>
              </label>
            </div>

            {error && <div style={{ background: '#ffeef0', border: '1px solid #f5c2c7', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#c62828' }}>{error}</div>}

            <button
              disabled={!presignChecked || submitting}
              onClick={() => handleConfirm('PRESIGN')}
              style={{
                width: '100%', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 700,
                border: 'none', cursor: presignChecked && !submitting ? 'pointer' : 'not-allowed',
                background: presignChecked ? accent : '#ccc', color: 'white',
                opacity: presignChecked ? 1 : 0.6, transition: 'background 0.2s',
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
