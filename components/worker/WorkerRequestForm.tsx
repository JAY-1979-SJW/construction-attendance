'use client'

import { useState } from 'react'

/**
 * WorkerRequestForm
 *
 * 근로자용 제한형 요청서.
 * - 카테고리는 사전 정의된 선택지만 허용 (자유 문의 불가)
 * - 내용은 200자 이내로 제한
 * - AI 챗봇 없음 / 자유 법률 질의 없음
 */

const CATEGORIES = [
  { value: 'MISSING_CHECKIN',   label: '출근 누락 신고' },
  { value: 'MISSING_CHECKOUT',  label: '퇴근 누락 신고' },
  { value: 'CONTACT_CHANGE',    label: '연락처 변경 요청' },
  { value: 'CONTRACT_REVIEW',   label: '계약서 재열람 요청' },
  { value: 'DOCUMENT_REQUEST',  label: '서류 발급 요청' },
  { value: 'DEVICE_CHANGE',     label: '기기 변경 요청' },
  { value: 'OTHER',             label: '기타 업무 문의' },
] as const

type Category = typeof CATEGORIES[number]['value']

const MAX_CONTENT = 200

interface SubmitResult {
  success: boolean
  message: string
}

export default function WorkerRequestForm() {
  const [category, setCategory] = useState<Category | ''>('')
  const [content,  setContent]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<SubmitResult | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category || !content.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res  = await fetch('/api/worker/requests', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ category, content: content.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ success: true, message: '요청이 접수되었습니다. 관리자가 확인 후 연락드립니다.' })
        setCategory('')
        setContent('')
      } else {
        setResult({ success: false, message: data.error ?? '요청 접수에 실패했습니다.' })
      }
    } catch {
      setResult({ success: false, message: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
      {/* 안내 문구 */}
      <div style={{
        background: 'rgba(244,121,32,0.1)',
        border: '1px solid rgba(244,121,32,0.3)',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '12px',
        color: '#E8A870',
        marginBottom: '20px',
        lineHeight: '1.6',
      }}>
        임금·계약·인사 관련 분쟁·이의 사항은 이 양식으로 처리되지 않습니다.
        소속 관리자 또는 고용노동부(1350)에 직접 문의하시기 바랍니다.
      </div>

      {/* 카테고리 선택 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#A0AEC0' }}>
          요청 유형 <span style={{ color: '#e53935' }}>*</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CATEGORIES.map((cat) => (
            <label
              key={cat.value}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '10px',
                padding:    '10px 14px',
                border:     `1px solid ${category === cat.value ? '#F47920' : 'rgba(91,164,217,0.2)'}`,
                borderRadius: '8px',
                background:   category === cat.value ? 'rgba(244,121,32,0.12)' : '#243144',
                cursor:       'pointer',
                fontSize:     '14px',
                color:        category === cat.value ? '#ffffff' : '#A0AEC0',
              }}
            >
              <input
                type="radio"
                name="category"
                value={cat.value}
                checked={category === cat.value}
                onChange={() => setCategory(cat.value)}
                style={{ accentColor: '#F47920' }}
              />
              {cat.label}
            </label>
          ))}
        </div>
      </div>

      {/* 내용 입력 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#A0AEC0' }}>
          요청 내용 <span style={{ color: '#e53935' }}>*</span>
          <span style={{ fontWeight: 400, color: '#718096', marginLeft: '8px' }}>(최대 {MAX_CONTENT}자)</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
          placeholder="구체적인 상황을 간략히 입력해 주세요."
          rows={4}
          style={{
            width:        '100%',
            border:       '1px solid rgba(91,164,217,0.25)',
            borderRadius: '8px',
            padding:      '10px 12px',
            fontSize:     '14px',
            resize:       'vertical',
            outline:      'none',
            boxSizing:    'border-box',
            background:   'rgba(255,255,255,0.06)',
            color:        '#ffffff',
          }}
        />
        <div style={{ textAlign: 'right', fontSize: '11px', color: content.length >= MAX_CONTENT ? '#e53935' : '#718096', marginTop: '4px' }}>
          {content.length} / {MAX_CONTENT}
        </div>
      </div>

      {/* 결과 메시지 */}
      {result && (
        <div style={{
          padding:      '10px 14px',
          borderRadius: '8px',
          marginBottom: '14px',
          fontSize:     '13px',
          background:   result.success ? 'rgba(46,125,50,0.15)' : 'rgba(198,40,40,0.12)',
          color:        result.success ? '#81c784' : '#ef9a9a',
          border:       `1px solid ${result.success ? 'rgba(46,125,50,0.4)' : 'rgba(198,40,40,0.35)'}`,
        }}>
          {result.message}
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={!category || !content.trim() || loading}
        style={{
          width:        '100%',
          padding:      '14px',
          background:   (!category || !content.trim() || loading) ? 'rgba(255,255,255,0.1)' : '#F47920',
          color:        (!category || !content.trim() || loading) ? '#718096' : '#ffffff',
          border:       'none',
          borderRadius: '8px',
          fontSize:     '15px',
          fontWeight:   700,
          cursor:       (!category || !content.trim() || loading) ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '접수 중...' : '요청 접수하기'}
      </button>
    </form>
  )
}
