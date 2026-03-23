'use client'

import FaqCard from './FaqCard'
import type { LaborFaqRecord } from '@/lib/labor-faq/types'

interface Props {
  faqs: (LaborFaqRecord | (Omit<LaborFaqRecord, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }))[]
  source?: 'AI' | 'KEYWORD' | 'CATEGORY_FALLBACK'
  loading?: boolean
  highlighted?: boolean
  title?: string
  emptyMessage?: string
}

const SOURCE_LABELS: Record<string, string> = {
  AI:               'AI 추천',
  KEYWORD:          '키워드 검색',
  CATEGORY_FALLBACK: '카테고리 기본',
}

export default function FaqRecommendedList({
  faqs,
  source,
  loading = false,
  highlighted = false,
  title,
  emptyMessage = '관련 FAQ가 없습니다.',
}: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-gray-200 p-4 animate-pulse bg-gray-50 h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      {(title || source) && (
        <div className="flex items-center justify-between">
          {title && <p className="text-sm font-semibold text-gray-700">{title}</p>}
          {source && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {SOURCE_LABELS[source] ?? source}
            </span>
          )}
        </div>
      )}

      {/* FAQ 카드 목록 */}
      {faqs.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">{emptyMessage}</p>
      ) : (
        faqs.map(faq => (
          <FaqCard key={faq.id} faq={faq} highlighted={highlighted} />
        ))
      )}
    </div>
  )
}
