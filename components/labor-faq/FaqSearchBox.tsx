'use client'

import { useState, useRef } from 'react'

interface Props {
  onSearch: (q: string) => void
  placeholder?: string
  loading?: boolean
}

const QUICK_QUERIES = [
  '일용직과 상용직 차이',
  '3번 반복 계약하면 정규직?',
  '외주팀 직접고용 계약 가능?',
  '기간제 종료 후 계속 근무',
  '일당 계약 연차 발생?',
]

export default function FaqSearchBox({ onSearch, placeholder = '노동법 궁금한 점을 입력하세요...', loading = false }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const q = value.trim()
    if (q) onSearch(q)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit()
  }

  function quickClick(q: string) {
    setValue(q)
    onSearch(q)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-3">
      {/* 입력창 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {value && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setValue('')}
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={submit}
          disabled={!value.trim() || loading}
          className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '검색 중…' : '검색'}
        </button>
      </div>

      {/* 빠른 질문 */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_QUERIES.map(q => (
          <button
            key={q}
            onClick={() => quickClick(q)}
            className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
