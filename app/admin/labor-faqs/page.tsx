'use client'

import { useEffect, useState, useCallback } from 'react'
import FaqCategoryTabs from '@/components/labor-faq/FaqCategoryTabs'
import FaqSearchBox from '@/components/labor-faq/FaqSearchBox'
import FaqCard from '@/components/labor-faq/FaqCard'
import FaqChatWidget from '@/components/labor-faq/FaqChatWidget'
import type { FaqCategory } from '@/lib/labor-faq/types'
import { FAQ_CATEGORIES } from '@/lib/labor-faq/types'

interface FaqItem {
  id: string
  category: string
  question: string
  shortAnswer: string
  fullAnswer: string
  appRule?: string | null
  caution?: string | null
  sourceOrg: string
  sourceTitle: string
  sourceUrl?: string | null
  effectiveDate: string
  priority: number
  status: string
  isActive: boolean
  viewCount: number
  questionAliases: string[]
  relatedContractTypes: string[]
  triggerConditions: unknown[]
  createdAt: string
  updatedAt: string
}

export default function LaborFaqsPage() {
  const [faqs, setFaqs]           = useState<FaqItem[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(false)
  const [category, setCategory]   = useState<FaqCategory | 'ALL'>('ALL')
  const [query, setQuery]         = useState('')
  const [showChat, setShowChat]   = useState(false)

  const fetchFaqs = useCallback(async (q: string, cat: FaqCategory | 'ALL') => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50', offset: '0' })
    if (q) params.set('q', q)
    if (cat !== 'ALL') params.set('category', cat)
    try {
      const res  = await fetch(`/api/admin/labor-faqs?${params}`)
      const data = await res.json()
      setFaqs(data.faqs ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFaqs(query, category)
  }, [fetchFaqs, query, category])

  function handleSearch(q: string) {
    setQuery(q)
  }

  // 카테고리별 카운트
  const counts: Partial<Record<FaqCategory | 'ALL', number>> = { ALL: total }
  for (const faq of faqs) {
    const cat = faq.category as FaqCategory
    counts[cat] = (counts[cat] ?? 0) + 1
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">노동법 FAQ</h1>
          <p className="text-sm text-gray-500 mt-0.5">승인된 FAQ 기준 · AI 분류만 사용</p>
        </div>
        <button
          onClick={() => setShowChat(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span>⚖️</span>
          FAQ 도우미 {showChat ? '닫기' : '열기'}
        </button>
      </div>

      {/* 메인 레이아웃: 목록 + 위젯 */}
      <div className={`flex gap-6 items-start ${showChat ? '' : ''}`}>

        {/* 좌측: 검색/목록 */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* 검색창 */}
          <FaqSearchBox onSearch={handleSearch} loading={loading} />

          {/* 카테고리 탭 */}
          <FaqCategoryTabs
            selected={category}
            onChange={setCategory}
            counts={counts}
          />

          {/* 상태 표시 */}
          {query && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                "{query}" 검색 결과 {faqs.length}건
              </span>
              <button
                onClick={() => setQuery('')}
                className="text-xs text-blue-600 hover:underline"
              >
                초기화
              </button>
            </div>
          )}

          {/* FAQ 목록 */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-lg border border-gray-200 p-4 animate-pulse bg-gray-50 h-24" />
              ))}
            </div>
          ) : faqs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-1">😕</p>
              <p className="text-sm">
                {query
                  ? `"${query}"에 대한 FAQ가 없습니다.`
                  : `${category !== 'ALL' ? FAQ_CATEGORIES[category] + ' 카테고리에 ' : ''}FAQ가 없습니다.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {faqs.map(faq => (
                <FaqCard
                  key={faq.id}
                  faq={faq as never}
                />
              ))}
            </div>
          )}
        </div>

        {/* 우측: FAQ 챗 위젯 */}
        {showChat && (
          <div className="w-96 shrink-0 sticky top-6 h-[600px]">
            <FaqChatWidget
              page="labor-faqs"
              onClose={() => setShowChat(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
