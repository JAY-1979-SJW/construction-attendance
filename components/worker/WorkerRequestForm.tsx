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

  const isDisabled = !category || !content.trim() || loading

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-[480px] mx-auto">
      {/* 안내 문구 */}
      <div className="bg-[rgba(244,121,32,0.1)] border border-[rgba(244,121,32,0.3)] rounded-lg px-[14px] py-[10px] text-[12px] text-[#E8A870] mb-5 leading-[1.6]">
        임금·계약·인사 관련 분쟁·이의 사항은 이 양식으로 처리되지 않습니다.
        소속 관리자 또는 고용노동부(1350)에 직접 문의하시기 바랍니다.
      </div>

      {/* 카테고리 선택 */}
      <div className="mb-4">
        <label className="block text-[13px] font-bold mb-2 text-muted-brand">
          요청 유형 <span className="text-[#e53935]">*</span>
        </label>
        <div className="flex flex-col gap-[6px]">
          {CATEGORIES.map((cat) => (
            <label
              key={cat.value}
              className="flex items-center gap-[10px] px-[14px] py-[10px] rounded-lg cursor-pointer text-[14px]"
              style={{
                border:     `1px solid ${category === cat.value ? '#F47920' : 'rgba(91,164,217,0.2)'}`,
                background:  category === cat.value ? 'rgba(244,121,32,0.12)' : '#243144',
                color:       category === cat.value ? '#ffffff' : '#A0AEC0',
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
      <div className="mb-4">
        <label className="block text-[13px] font-bold mb-2 text-muted-brand">
          요청 내용 <span className="text-[#e53935]">*</span>
          <span className="font-normal text-[#718096] ml-2">(최대 {MAX_CONTENT}자)</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
          placeholder="구체적인 상황을 간략히 입력해 주세요."
          rows={4}
          className="w-full border border-[rgba(91,164,217,0.25)] rounded-lg px-3 py-[10px] text-base resize-y outline-none box-border bg-[rgba(255,255,255,0.06)] text-white"
        />
        <div
          className="text-right text-[13px] leading-5 mt-1"
          style={{ color: content.length >= MAX_CONTENT ? '#e53935' : '#718096' }}
        >
          {content.length} / {MAX_CONTENT}
        </div>
      </div>

      {/* 결과 메시지 */}
      {result && (
        <div
          className="px-[14px] py-[10px] rounded-lg mb-[14px] text-[13px]"
          style={{
            background: result.success ? 'rgba(46,125,50,0.15)' : 'rgba(198,40,40,0.12)',
            color:      result.success ? '#81c784' : '#ef9a9a',
            border:     `1px solid ${result.success ? 'rgba(46,125,50,0.4)' : 'rgba(198,40,40,0.35)'}`,
          }}
        >
          {result.message}
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={isDisabled}
        className="w-full py-[14px] border-none rounded-lg text-[15px] font-bold"
        style={{
          background: isDisabled ? 'rgba(255,255,255,0.1)' : '#F47920',
          color:      isDisabled ? '#718096' : '#ffffff',
          cursor:     isDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '접수 중...' : '요청 접수하기'}
      </button>
    </form>
  )
}
