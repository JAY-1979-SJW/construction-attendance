'use client'

/**
 * FaqChatWidget
 *
 * 챗봇처럼 보이지만 실제 구조:
 *   질문 입력 → '분석 중' → AI 분류 or 키워드 검색 → 추천 FAQ 카드 표시
 *
 * AI 는 절대 자유 문장 답변을 반환하지 않는다.
 * 모든 답변은 DB 등록 FAQ 에서 FaqCard 형태로만 출력한다.
 */

import { useState, useRef, useEffect } from 'react'
import FaqCard from './FaqCard'
import type { LaborFaqRecord } from '@/lib/labor-faq/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  text?: string
  faqs?: (LaborFaqRecord | Record<string, unknown>)[]
  source?: 'AI' | 'KEYWORD' | 'CATEGORY_FALLBACK'
  loading?: boolean
}

interface Props {
  /** 현재 화면 컨텍스트 (선택) */
  contractType?: string
  page?: string
  formContext?: {
    hasEndDate?: boolean
    isRepeatedRegistration?: boolean
    expectedDurationDays?: number
  }
  /** 위젯을 overlay 형태로 열 때 닫기 콜백 */
  onClose?: () => void
}

export default function FaqChatWidget({ contractType, page, formContext, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: '안녕하세요. 건설현장 노동법 FAQ 도우미입니다.\n궁금한 점을 입력하면 관련 FAQ를 찾아드립니다.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const q = input.trim()
    if (!q || loading) return

    setInput('')

    // 사용자 메시지 추가
    const userMsg: ChatMessage = { role: 'user', text: q }
    // 로딩 플레이스홀더
    const loadingMsg: ChatMessage = { role: 'assistant', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/admin/labor-faqs/recommend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          contractType,
          page,
          formContext,
        }),
      })
      const data = await res.json()

      const assistantMsg: ChatMessage = {
        role:   'assistant',
        faqs:   data.faqs ?? [],
        source: data.source,
        text:   data.faqs?.length === 0 ? '관련 FAQ를 찾지 못했습니다. 다른 표현으로 다시 질문해보세요.' : undefined,
      }

      setMessages(prev => {
        // 마지막 loading 메시지를 결과로 교체
        const withoutLoading = prev.slice(0, -1)
        return [...withoutLoading, assistantMsg]
      })
    } catch {
      setMessages(prev => {
        const withoutLoading = prev.slice(0, -1)
        return [
          ...withoutLoading,
          { role: 'assistant', text: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚖️</span>
          <div>
            <p className="text-sm font-bold leading-tight">노동법 FAQ 도우미</p>
            <p className="text-xs text-blue-200 leading-tight">등록된 FAQ에서만 답변합니다</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'user' ? (
              <div className="max-w-[75%] bg-blue-600 text-white text-sm px-3 py-2 rounded-2xl rounded-tr-sm shadow-sm">
                {msg.text}
              </div>
            ) : (
              <div className="max-w-[90%] space-y-2">
                {/* 로딩 */}
                {msg.loading && (
                  <div className="flex items-center gap-2 bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-gray-200">
                    <span className="text-xs text-gray-500">질문 분석 중</span>
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </div>
                )}

                {/* 텍스트 메시지 */}
                {msg.text && !msg.loading && (
                  <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                )}

                {/* FAQ 카드 목록 */}
                {msg.faqs && msg.faqs.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500">관련 FAQ {msg.faqs.length}건</p>
                      {msg.source && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {msg.source === 'AI' ? 'AI 추천' : msg.source === 'KEYWORD' ? '키워드' : '카테고리'}
                        </span>
                      )}
                    </div>
                    {msg.faqs.map((faq, fi) => (
                      <FaqCard
                        key={fi}
                        faq={faq as LaborFaqRecord}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <div className="px-3 py-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="질문을 입력하세요… (Enter 전송)"
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-28 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            전송
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          AI는 분류만 수행 · 모든 답변은 승인된 FAQ 기준
        </p>
      </div>
    </div>
  )
}
