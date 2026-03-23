'use client'

import { FAQ_CATEGORIES } from '@/lib/labor-faq/types'
import type { FaqCategory } from '@/lib/labor-faq/types'

interface Props {
  selected: FaqCategory | 'ALL'
  onChange: (cat: FaqCategory | 'ALL') => void
  counts?: Partial<Record<FaqCategory | 'ALL', number>>
}

const ALL_TABS: { value: FaqCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체' },
  ...Object.entries(FAQ_CATEGORIES).map(([k, v]) => ({
    value: k as FaqCategory,
    label: v,
  })),
]

export default function FaqCategoryTabs({ selected, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_TABS.map(tab => {
        const active = tab.value === selected
        const count  = counts?.[tab.value]
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {count !== undefined && (
              <span className={`ml-1 ${active ? 'text-blue-100' : 'text-gray-400'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
