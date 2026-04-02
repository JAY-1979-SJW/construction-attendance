'use client'

import { useState, useRef, useEffect } from 'react'

interface FaqItem {
  id: string
  question: string
  shortAnswer: string
  longAnswer?: string | null
  legalBasis?: string | null
  category: string
}

interface ChatMsg {
  role: 'user' | 'assistant'
  text?: string
  faqs?: FaqItem[]
  loading?: boolean
}

export default function PublicChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: '안녕하세요! 건설현장 노동법 관련 질문을 입력하시면 FAQ를 찾아드립니다.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }, { role: 'assistant', loading: true }])
    setLoading(true)

    try {
      const res = await fetch('/api/public/faq-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        faqs: data.faqs ?? [],
        text: data.faqs?.length === 0 ? '관련 FAQ를 찾지 못했습니다. 다른 표현으로 질문해보세요.' : undefined,
      }
      setMessages(prev => [...prev.slice(0, -1), assistantMsg])
    } catch {
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', text: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }])
    } finally {
      setLoading(false)
    }
  }

  const [bubbleVisible, setBubbleVisible] = useState(true)

  // 5초 후 말풍선 자동 숨김
  useEffect(() => {
    if (!open && bubbleVisible) {
      const t = setTimeout(() => setBubbleVisible(false), 5000)
      return () => clearTimeout(t)
    }
  }, [open, bubbleVisible])

  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-end gap-2">
        {/* 말풍선 */}
        {bubbleVisible && (
          <div
            className="relative bg-card text-fore-brand text-[13px] font-medium rounded-xl px-4 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.1)] border border-brand animate-fade-in cursor-pointer"
            onClick={() => { setOpen(true); setBubbleVisible(false) }}
          >
            궁금한 점이 있으신가요?
            {/* 꼬리 */}
            <div className="absolute -right-2 bottom-3 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-card" />
            <div className="absolute -right-[9px] bottom-3 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-brand opacity-30" />
          </div>
        )}
        {/* 버튼 */}
        <button
          onClick={() => { setOpen(true); setBubbleVisible(false) }}
          className="w-14 h-14 rounded-full bg-brand-accent text-white shadow-[0_4px_16px_rgba(244,121,32,0.4)] flex items-center justify-center border-none cursor-pointer hover:scale-110 transition-transform shrink-0"
          aria-label="AI 문의"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-4rem)] flex flex-col bg-card rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-brand overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-brand-accent text-white shrink-0">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <div>
            <p className="text-sm font-bold leading-tight m-0">AI 문의</p>
            <p className="text-[10px] text-white/70 leading-tight m-0">노동법 FAQ 기반 답변</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-lg bg-transparent border-none cursor-pointer p-1">
          ✕
        </button>
      </div>

      {/* 메시지 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-surface">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[80%] bg-brand-accent text-white text-[13px] px-3 py-2 rounded-2xl rounded-tr-sm">{msg.text}</div>
            ) : (
              <div className="max-w-[90%] space-y-2">
                {msg.loading && (
                  <div className="flex items-center gap-2 bg-card rounded-2xl rounded-tl-sm px-3 py-2 border border-brand">
                    <span className="text-[11px] text-muted-brand">질문 분석 중</span>
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                  </div>
                )}
                {msg.text && !msg.loading && (
                  <div className="bg-card rounded-2xl rounded-tl-sm px-3 py-2 border border-brand">
                    <p className="text-[13px] text-fore-brand whitespace-pre-wrap leading-relaxed m-0">{msg.text}</p>
                  </div>
                )}
                {msg.faqs && msg.faqs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-brand m-0">관련 FAQ {msg.faqs.length}건</p>
                    {msg.faqs.map(faq => (
                      <div key={faq.id} className="bg-card rounded-xl border border-brand overflow-hidden">
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                          className="w-full text-left px-3 py-2.5 bg-transparent border-none cursor-pointer hover:bg-surface transition-colors"
                        >
                          <p className="text-[13px] font-semibold text-fore-brand m-0 leading-snug">{faq.question}</p>
                          <p className="text-[11px] text-muted-brand mt-1 m-0 line-clamp-2">{faq.shortAnswer}</p>
                        </button>
                        {expandedFaq === faq.id && (
                          <div className="px-3 pb-3 border-t border-brand pt-2">
                            {faq.longAnswer && <p className="text-[12px] text-body-brand leading-relaxed whitespace-pre-wrap m-0">{faq.longAnswer}</p>}
                            {faq.legalBasis && <p className="text-[11px] text-muted-brand mt-2 m-0">근거: {faq.legalBasis}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력 */}
      <div className="px-3 py-3 border-t border-brand bg-card shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="궁금한 점을 입력하세요..."
            className="flex-1 h-10 px-3 text-[13px] border border-brand rounded-lg bg-card text-fore-brand outline-none focus:border-accent"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-3 h-10 bg-brand-accent text-white text-[13px] font-medium rounded-lg border-none cursor-pointer hover:bg-brand-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            전송
          </button>
        </div>
        <p className="text-[10px] text-muted2-brand mt-1.5 text-center m-0">AI는 분류만 수행 · 등록된 FAQ 기준 답변</p>
      </div>
    </div>
  )
}
