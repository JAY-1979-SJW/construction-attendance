'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface MaterialItem {
  id: number
  code: string
  name: string
  spec: string | null
  unit: string | null
  category: string | null
  source: string
  baseDate: string
}

interface MaterialDetail {
  id: number
  code: string
  name: string
  spec: string | null
  unit: string | null
  category: string | null
  source: string
  baseDate: string
  updatedAt: string
  basePrice: number | null
  price_available: boolean
  notice: string
}

interface SyncStatus {
  source: string
  status: string
  baseDate: string | null
  priceIncluded: boolean
}

interface SuggestItem {
  id: number
  code: string
  name: string
  category: string | null
  spec: string | null
}

const PAGE_SIZE = 50

function DetailPanel({
  id,
  onClose,
}: {
  id: number
  onClose: () => void
}) {
  const [detail, setDetail]   = useState<MaterialDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    setDetail(null)
    fetch(`/api/proxy/material-detail?id=${id}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setError(d.message ?? '조회 실패'); return }
        setDetail(d.data)
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false))
  }, [id])

  const rows: [string, string][] = detail
    ? [
        ['ID',        String(detail.id)],
        ['코드',       detail.code],
        ['자재명',     detail.name],
        ['규격',       detail.spec ?? '-'],
        ['단위',       detail.unit ?? '-'],
        ['분류',       detail.category ?? '-'],
        ['출처',       detail.source],
        ['기준일',     detail.baseDate ? detail.baseDate.split('T')[0] : '-'],
        ['수정일',     detail.updatedAt ? detail.updatedAt.split('T')[0] : '-'],
        ['가격 제공',  detail.price_available ? '있음' : '없음 (실수집 보류)'],
      ]
    : []

  return (
    <div
      className="fixed inset-y-0 right-0 w-[360px] bg-card shadow-2xl flex flex-col z-50"
      style={{ borderLeft: '1px solid rgba(91,164,217,0.2)' }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4"
           style={{ borderBottom: '1px solid rgba(91,164,217,0.15)' }}>
        <span className="font-semibold text-sm">자재 상세</span>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded text-muted-brand hover:text-white hover:bg-[rgba(91,164,217,0.15)] transition-colors text-lg leading-none border-0 bg-transparent cursor-pointer"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <div className="py-10 text-center text-muted-brand text-sm">로딩 중...</div>
        )}
        {error && (
          <div className="px-4 py-3 rounded-lg text-sm"
               style={{ background: 'rgba(183,28,28,0.08)', border: '1px solid rgba(183,28,28,0.2)', color: '#ef5350' }}>
            {error}
          </div>
        )}
        {detail && (
          <>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <td className="py-[7px] pr-3 text-[12px] text-muted-brand whitespace-nowrap align-top w-[80px]">
                      {label}
                    </td>
                    <td className="py-[7px] text-[13px] break-all align-top">
                      {label === '코드'
                        ? <span className="font-mono text-[12px]">{value}</span>
                        : value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* notice */}
            <div className="mt-4 px-3 py-2 rounded text-[11px] text-muted-brand"
                 style={{ background: 'rgba(91,164,217,0.06)', border: '1px solid rgba(91,164,217,0.12)' }}>
              {detail.notice}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SuggestDropdown({
  items,
  activeIdx,
  onSelect,
  onMouseEnter,
}: {
  items: SuggestItem[]
  activeIdx: number
  onSelect: (item: SuggestItem) => void
  onMouseEnter: (idx: number) => void
}) {
  if (items.length === 0) return null
  return (
    <ul
      role="listbox"
      className="absolute left-0 top-full mt-1 w-full z-40 rounded-md shadow-lg overflow-hidden"
      style={{
        background: 'var(--color-card, #1e2530)',
        border: '1px solid rgba(91,164,217,0.25)',
        maxHeight: '260px',
        overflowY: 'auto',
      }}
    >
      {items.map((item, idx) => (
        <li
          key={item.id}
          role="option"
          aria-selected={idx === activeIdx}
          onMouseDown={e => { e.preventDefault(); onSelect(item) }}
          onMouseEnter={() => onMouseEnter(idx)}
          className="px-3 py-[9px] cursor-pointer text-sm flex flex-col gap-[2px]"
          style={{
            background: idx === activeIdx ? 'rgba(91,164,217,0.15)' : undefined,
            borderBottom: '1px solid rgba(91,164,217,0.08)',
          }}
        >
          <span className="font-semibold truncate">{item.name}</span>
          <span className="text-[11px] text-muted-brand flex gap-2">
            <span className="font-mono">{item.code}</span>
            {item.category && <span>{item.category}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function MaterialCatalogPage() {
  const [q, setQ]                         = useState('')
  const [category, setCategory]           = useState('')
  const [page, setPage]                   = useState(1)
  const [items, setItems]                 = useState<MaterialItem[]>([])
  const [total, setTotal]                 = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [categories, setCategories]       = useState<string[]>([])
  const [syncStatus, setSyncStatus]       = useState<SyncStatus | null>(null)
  const [searched, setSearched]           = useState(false)
  const [selectedId, setSelectedId]       = useState<number | null>(null)

  // autocomplete state
  const [suggests, setSuggests]           = useState<SuggestItem[]>([])
  const [suggestOpen, setSuggestOpen]     = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [activeIdx, setActiveIdx]         = useState(-1)
  const [suggestError, setSuggestError]   = useState('')

  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/proxy/material-categories')
      .then(r => r.json())
      .then(d => {
        if (d.success) setCategories(d.data.map((c: { category: string }) => c.category))
      })
      .catch(() => {})

    fetch('/api/proxy/material-sync-status')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const nara = d.data.sourceStatus?.find((s: SyncStatus) => s.source === 'nara')
          if (nara) setSyncStatus(nara)
        }
      })
      .catch(() => {})
  }, [])

  const fetchMaterials = useCallback((qVal: string, catVal: string, pageVal: number) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(pageVal), pageSize: String(PAGE_SIZE) })
    if (qVal.trim()) params.set('q', qVal.trim())
    if (catVal) params.set('category', catVal)
    fetch(`/api/proxy/material-catalog?${params}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setError(d.message ?? '조회 실패'); return }
        setItems(d.data.items)
        setTotal(d.data.total)
        setTotalPages(d.data.totalPages)
        setSearched(true)
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false))
  }, [])

  const closeSuggest = () => {
    setSuggestOpen(false)
    setSuggests([])
    setActiveIdx(-1)
    setSuggestError('')
  }

  const fetchSuggests = useCallback((val: string) => {
    if (val.trim().length < 1) {
      closeSuggest()
      return
    }
    setSuggestLoading(true)
    setSuggestError('')
    fetch(`/api/proxy/material-suggest?q=${encodeURIComponent(val.trim())}&limit=10`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) {
          setSuggestError('추천 조회 실패')
          setSuggests([])
        } else {
          const list: SuggestItem[] = d.data ?? []
          setSuggests(list)
          setSuggestOpen(true)
          if (list.length === 0) setSuggestError('검색 결과 없음')
        }
      })
      .catch(() => {
        setSuggestOpen(false)
        setSuggests([])
      })
      .finally(() => setSuggestLoading(false))
  }, [])

  const handleInputChange = (val: string) => {
    setQ(val)
    setActiveIdx(-1)
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (val.trim().length === 0) {
      closeSuggest()
      return
    }
    suggestTimer.current = setTimeout(() => fetchSuggests(val), 200)
  }

  const handleSuggestSelect = (item: SuggestItem) => {
    setQ(item.name)
    closeSuggest()
    setPage(1)
    setSelectedId(null)
    fetchMaterials(item.name, category, 1)
  }

  const handleSearch = () => {
    closeSuggest()
    setPage(1)
    setSelectedId(null)
    fetchMaterials(q, category, 1)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen) {
      if (e.key === 'Enter') handleSearch()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggests.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && suggests[activeIdx]) {
        handleSuggestSelect(suggests[activeIdx])
      } else {
        handleSearch()
      }
    } else if (e.key === 'Escape') {
      closeSuggest()
    }
  }

  const handleCategoryChange = (val: string) => {
    setCategory(val)
    setPage(1)
    setSelectedId(null)
    if (searched) fetchMaterials(q, val, 1)
  }

  const handlePageChange = (next: number) => {
    setPage(next)
    fetchMaterials(q, category, next)
  }

  return (
    <div className="p-6" style={{ marginRight: selectedId !== null ? '360px' : '0', transition: 'margin-right 0.2s' }}>
      {/* 헤더 */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold m-0 mb-1">자재 카탈로그</h1>
        <p className="text-sm text-muted-brand m-0">나라장터 자재 코드 조회 · 내부 테스트</p>
      </div>

      {/* 상태 배너 */}
      {syncStatus && (
        <div className="flex items-center gap-3 px-4 py-3 mb-5 rounded-lg text-sm"
             style={{ background: 'rgba(249,168,37,0.1)', border: '1px solid rgba(249,168,37,0.3)' }}>
          <span className="font-semibold" style={{ color: '#f9a825' }}>수집 보류</span>
          <span className="text-muted-brand">
            nara.status=<strong>{syncStatus.status}</strong> · 기준일 {syncStatus.baseDate ?? '2026-03-24'} · base_price=null (실가격 미제공)
          </span>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-3 items-center flex-wrap mb-4">
        {/* 자동완성 래퍼 */}
        <div className="relative w-64">
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={() => setTimeout(closeSuggest, 150)}
            placeholder="코드 또는 자재명 검색"
            className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-card w-full"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={suggestOpen}
          />
          {/* 로딩 스피너 */}
          {suggestLoading && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-brand">...</span>
          )}
          {/* 드롭다운 */}
          {suggestOpen && (
            suggestError ? (
              <ul
                className="absolute left-0 top-full mt-1 w-full z-40 rounded-md shadow-lg"
                style={{
                  background: 'var(--color-card, #1e2530)',
                  border: '1px solid rgba(91,164,217,0.25)',
                }}
              >
                <li className="px-3 py-3 text-[12px] text-muted-brand">{suggestError}</li>
              </ul>
            ) : (
              <SuggestDropdown
                items={suggests}
                activeIdx={activeIdx}
                onSelect={handleSuggestSelect}
                onMouseEnter={setActiveIdx}
              />
            )
          )}
        </div>

        <select
          value={category}
          onChange={e => handleCategoryChange(e.target.value)}
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-card"
        >
          <option value="">전체 분류</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-5 py-[9px] bg-brand-accent text-white border-0 rounded-md text-sm font-semibold cursor-pointer"
        >
          {loading ? '조회 중...' : '조회'}
        </button>
        {searched && (
          <span className="text-sm text-muted-brand">총 {total.toLocaleString()}건</span>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm"
             style={{ background: 'rgba(183,28,28,0.08)', border: '1px solid rgba(183,28,28,0.2)', color: '#ef5350' }}>
          {error}
        </div>
      )}

      {/* 테이블 */}
      {searched && (
        <div className="bg-card rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {['코드', '자재명', '규격', '단위', '분류', '출처', '기준일'].map(h => (
                    <th key={h} className="text-left px-3 py-[10px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-brand">
                      검색 결과가 없습니다
                    </td>
                  </tr>
                ) : (
                  items.map(item => {
                    const isSelected = item.id === selectedId
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(isSelected ? null : item.id)}
                        className="cursor-pointer transition-colors"
                        style={{
                          background: isSelected ? 'rgba(91,164,217,0.12)' : undefined,
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(91,164,217,0.04)' }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                      >
                        <td className="px-3 py-[9px] border-b border-[rgba(91,164,217,0.1)] font-mono text-[12px] text-muted-brand whitespace-nowrap">
                          {item.code}
                        </td>
                        <td className="px-3 py-[9px] border-b border-[rgba(91,164,217,0.1)] font-semibold max-w-[200px] truncate" title={item.name}>
                          {item.name}
                        </td>
                        <td className="px-3 py-[9px] border-b border-[rgba(91,164,217,0.1)] text-[12px] text-muted-brand max-w-[180px] truncate" title={item.spec ?? ''}>
                          {item.spec ?? '-'}
                        </td>
                        <td className="px-3 py-[9px] border-b border-[rgba(91,164,217,0.1)] whitespace-nowrap">
                          {item.unit ?? '-'}
                        </td>
                        <td className="px-3 py-[9px] border-b border-[rgba(91,164,217,0.1)] text-[12px] max-w-[160px] truncate" title={item.category ?? ''}>
                          {item.category ?? '-'}
                        </td>
                        <td className="px-3 py-[9px] border-b border-[rgba(91,164,217,0.1)] whitespace-nowrap">
                          <span className="text-[11px] px-2 py-[2px] rounded-[10px]"
                                style={{ background: 'rgba(91,164,217,0.12)', color: '#5BA4D9' }}>
                            {item.source}
                          </span>
                        </td>
                        <td className="px-3 py-[9px] border-b border-[rgba(91,164,217,0.1)] text-[12px] text-muted-brand whitespace-nowrap">
                          {item.baseDate ? item.baseDate.split('T')[0] : '-'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex gap-2 justify-center py-4">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1 || loading}
                className="px-[14px] py-[6px] border border-[rgba(91,164,217,0.3)] rounded bg-card cursor-pointer text-[13px] disabled:opacity-40"
              >
                이전
              </button>
              <span className="px-3 py-[6px] text-sm text-muted-brand">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages || loading}
                className="px-[14px] py-[6px] border border-[rgba(91,164,217,0.3)] rounded bg-card cursor-pointer text-[13px] disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}

      {/* 상세패널 */}
      {selectedId !== null && (
        <DetailPanel id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
