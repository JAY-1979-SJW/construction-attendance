'use client'

import { useState } from 'react'
import type { LaborFaqRecord, FaqCategory } from '@/lib/labor-faq/types'
import { FAQ_CATEGORIES } from '@/lib/labor-faq/types'

interface Props {
  faq: LaborFaqRecord | (Omit<LaborFaqRecord, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string })
  /** 클릭 시 상세 확장 여부 (기본 true) */
  expandable?: boolean
  /** 강조 표시 (트리거 자동 노출 시) */
  highlighted?: boolean
}

const CATEGORY_COLORS: Record<FaqCategory, string> = {
  CONTRACT_TYPE:      'bg-blue-100 text-blue-700',
  DAILY_WORKER:       'bg-orange-100 text-orange-700',
  REGULAR_EMPLOYMENT: 'bg-purple-100 text-purple-700',
  FIXED_TERM:         'bg-cyan-100 text-cyan-700',
  REPEATED_CONTRACT:  'bg-amber-100 text-amber-700',
  OUTSOURCING:        'bg-green-100 text-green-700',
  DOCUMENT_SELECTION: 'bg-indigo-100 text-indigo-700',
  LEGAL_WARNING:      'bg-red-100 text-red-700',
}

export default function FaqCard({ faq, expandable = true, highlighted = false }: Props) {
  const [expanded, setExpanded] = useState(false)

  const catColor = CATEGORY_COLORS[faq.category as FaqCategory] ?? 'bg-gray-100 text-gray-600'
  const catLabel = FAQ_CATEGORIES[faq.category as FaqCategory] ?? faq.category

  return (
    <div
      className={`rounded-lg border p-4 space-y-2 transition-all ${
        highlighted ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      {/* 상단 헤더 */}
      <div className="flex items-start gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${catColor}`}>
          {catLabel}
        </span>
        <button
          className="text-sm font-semibold text-gray-800 text-left flex-1 leading-snug hover:text-blue-700"
          onClick={() => expandable && setExpanded(v => !v)}
        >
          {faq.question}
        </button>
        {expandable && (
          <span className="text-gray-400 text-xs shrink-0 mt-0.5">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {/* 짧은 답변 */}
      <p className="text-sm text-gray-700 leading-relaxed pl-0">{faq.shortAnswer}</p>

      {/* 앱 적용 규칙 요약 */}
      {faq.appRule && (
        <div className="flex items-start gap-1.5 bg-blue-50 border border-blue-200 rounded p-2">
          <span className="text-blue-500 text-xs shrink-0 mt-0.5">📋</span>
          <p className="text-xs text-blue-800">{faq.appRule}</p>
        </div>
      )}

      {/* 주의사항 요약 */}
      {faq.caution && (
        <div className="flex items-start gap-1.5 bg-red-50 border border-red-200 rounded p-2">
          <span className="text-red-500 text-xs shrink-0 mt-0.5">⚠️</span>
          <p className="text-xs text-red-800">{faq.caution}</p>
        </div>
      )}

      {/* 확장 상세 */}
      {expandable && expanded && (
        <div className="pt-2 border-t border-gray-100 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">상세 설명</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{faq.fullAnswer}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>출처: {faq.sourceTitle ?? faq.sourceOrg}</span>
            <span>·</span>
            <span>기준일: {faq.effectiveDate}</span>
            {faq.sourceUrl && (
              <>
                <span>·</span>
                <a
                  href={faq.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
                  원문 보기
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
