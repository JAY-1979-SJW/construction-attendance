'use client'

import { useState, useEffect, useCallback } from 'react'

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

interface SyncStatus {
  source: string
  status: string
  baseDate: string | null
  priceIncluded: boolean
}

const PAGE_SIZE = 50

export default function MaterialCatalogPage() {
  const [q, setQ]                   = useState('')
  const [category, setCategory]     = useState('')
  const [page, setPage]             = useState(1)
  const [items, setItems]           = useState<MaterialItem[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [searched, setSearched]     = useState(false)

  // categories + sync-status 초기 로드
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

  const handleSearch = () => {
    setPage(1)
    fetchMaterials(q, category, 1)
  }

  const handleCategoryChange = (val: string) => {
    setCategory(val)
    setPage(1)
    if (searched) fetchMaterials(q, val, 1)
  }

  const handlePageChange = (next: number) => {
    setPage(next)
    fetchMaterials(q, category, next)
  }

  return (
    <div className="p-6 max-w-[1200px]">
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
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="코드 또는 자재명 검색"
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-card w-64"
        />
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
        <div className="mb-4 px-4 py-3 rounded-lg text-sm text-red-600"
             style={{ background: 'rgba(183,28,28,0.08)', border: '1px solid rgba(183,28,28,0.2)' }}>
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
                  items.map(item => (
                    <tr key={item.id} className="hover:bg-[rgba(91,164,217,0.04)] transition-colors">
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
                  ))
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
    </div>
  )
}
