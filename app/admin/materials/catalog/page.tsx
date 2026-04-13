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

interface LookupResultItem {
  id: number
  code: string
  name: string
  spec: string | null
  unit: string | null
  category: string | null
  source: string
  base_date: string | null
}

interface LookupResult {
  parsedCount: number
  requestedCount: number
  foundCount: number
  items: LookupResultItem[]
  missingCodes: string[]
}

interface MaterialSummary {
  totalMaterials: number
  totalCategories: number
  priceAvailableCount: number
  priceUnavailableCount: number
  latestBaseDate: string | null
  sourceCounts: Record<string, number>
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

// ── 붙여넣기 조회 섹션 ──────────────────────────────────────────
function LookupSection({
  selectedId,
  onSelectId,
}: {
  selectedId: number | null
  onSelectId: (id: number | null) => void
}) {
  const [text, setText]               = useState('')
  const [loading, setLoading]         = useState(false)
  const [csvLoading, setCsvLoading]   = useState(false)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState<LookupResult | null>(null)

  // 공통 파싱 + 유효성 검사 (lookupText, handleCsvDownload 공유)
  const parseAndValidate = (trimmed: string): string[] | null => {
    const codes = Array.from(new Set(
      trimmed.split(/[\n,\t\s]+/).map(s => s.trim()).filter(Boolean)
    ))
    if (codes.length > 100) {
      setError(`최대 100개까지 입력 가능합니다. (현재 ${codes.length}개)`)
      return null
    }
    return codes
  }

  const handleLookup = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setError('코드를 입력해주세요.')
      return
    }
    // 클라이언트 파싱: 줄바꿈, 쉼표, 공백, 탭 구분
    if (!parseAndValidate(trimmed)) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/proxy/material-lookup-text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      const d = await res.json()
      if (!d.success) {
        setError(d.message ?? '조회 실패')
        return
      }
      setResult(d.data)
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  const handleCsvDownload = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setError('코드를 입력해주세요.')
      return
    }
    if (!parseAndValidate(trimmed)) return
    setCsvLoading(true)
    setError('')
    try {
      const res = await fetch('/api/proxy/material-lookup-text-export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { message?: string }).message ?? 'CSV 다운로드 실패')
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const fnMatch = cd.match(/filename\*?=(?:UTF-8'')?([^;]+)/i)
      const filename = fnMatch
        ? decodeURIComponent(fnMatch[1].replace(/"/g, '').trim())
        : 'materials.csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('CSV 다운로드 실패')
    } finally {
      setCsvLoading(false)
    }
  }

  const handleReset = () => {
    setText('')
    setError('')
    setResult(null)
  }

  return (
    <div className="mb-6 rounded-[12px] overflow-hidden"
         style={{ border: '1px solid rgba(91,164,217,0.18)', background: 'rgba(91,164,217,0.03)' }}>
      {/* 섹션 헤더 */}
      <div className="px-5 py-3 flex items-center gap-2"
           style={{ borderBottom: '1px solid rgba(91,164,217,0.12)', background: 'rgba(91,164,217,0.05)' }}>
        <span className="text-sm font-semibold">코드 붙여넣기 조회</span>
        <span className="text-[11px] text-muted-brand">줄바꿈 / 쉼표 / 공백으로 여러 코드 입력 · 최대 100개</span>
      </div>

      <div className="px-5 py-4">
        {/* textarea */}
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setError('') }}
          placeholder={'예) A-0001\nA-0002, A-0003 A-0004'}
          rows={4}
          className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-card font-mono resize-y mb-3"
          style={{ minHeight: '80px', maxHeight: '200px' }}
        />

        {/* 버튼 */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={handleLookup}
            disabled={loading || csvLoading}
            className="px-5 py-[8px] bg-brand-accent text-white border-0 rounded-md text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            {loading ? '조회 중...' : '일괄 조회'}
          </button>
          <button
            onClick={handleCsvDownload}
            disabled={csvLoading || loading}
            className="px-4 py-[8px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm cursor-pointer bg-transparent disabled:opacity-50 transition-colors"
            style={{ color: '#5BA4D9' }}
          >
            {csvLoading ? '다운로드 중...' : 'CSV 다운로드'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-[8px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm cursor-pointer bg-transparent text-muted-brand hover:text-white transition-colors"
          >
            초기화
          </button>
        </div>

        {/* 에러 */}
        {error && (
          <div className="mb-3 px-4 py-3 rounded-lg text-sm"
               style={{ background: 'rgba(183,28,28,0.08)', border: '1px solid rgba(183,28,28,0.2)', color: '#ef5350' }}>
            {error}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <>
            {/* 수치 */}
            <div className="flex gap-4 mb-3 text-sm">
              <span className="text-muted-brand">파싱 <strong className="text-white">{result.parsedCount}</strong>개</span>
              <span className="text-muted-brand">요청 <strong className="text-white">{result.requestedCount}</strong>개</span>
              <span className="text-muted-brand">
                조회됨 <strong style={{ color: result.foundCount > 0 ? '#5BA4D9' : '#ef5350' }}>{result.foundCount}</strong>개
              </span>
              {result.missingCodes.length > 0 && (
                <span className="text-muted-brand">
                  누락 <strong style={{ color: '#f9a825' }}>{result.missingCodes.length}</strong>개
                </span>
              )}
            </div>

            {/* 결과 테이블 */}
            {result.items.length > 0 && (
              <div className="rounded-[10px] overflow-hidden mb-3"
                   style={{ border: '1px solid rgba(91,164,217,0.15)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        {['코드', '자재명', '규격', '단위', '분류', '출처', '기준일'].map(h => (
                          <th key={h} className="text-left px-3 py-[9px] text-[12px] text-muted-brand whitespace-nowrap font-semibold"
                              style={{ borderBottom: '1px solid rgba(91,164,217,0.18)', background: 'rgba(91,164,217,0.04)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map(item => {
                        const isSelected = item.id === selectedId
                        return (
                        <tr
                          key={item.id}
                          onClick={() => onSelectId(isSelected ? null : item.id)}
                          className="cursor-pointer transition-colors"
                          style={{ background: isSelected ? 'rgba(91,164,217,0.12)' : undefined }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(91,164,217,0.04)' }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                        >
                          <td className="px-3 py-[8px] border-b border-[rgba(91,164,217,0.08)] font-mono text-[12px] text-muted-brand whitespace-nowrap">
                            {item.code}
                          </td>
                          <td className="px-3 py-[8px] border-b border-[rgba(91,164,217,0.08)] font-semibold max-w-[200px] truncate" title={item.name}>
                            {item.name}
                          </td>
                          <td className="px-3 py-[8px] border-b border-[rgba(91,164,217,0.08)] text-[12px] text-muted-brand max-w-[160px] truncate" title={item.spec ?? ''}>
                            {item.spec ?? '-'}
                          </td>
                          <td className="px-3 py-[8px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">
                            {item.unit ?? '-'}
                          </td>
                          <td className="px-3 py-[8px] border-b border-[rgba(91,164,217,0.08)] text-[12px] max-w-[140px] truncate" title={item.category ?? ''}>
                            {item.category ?? '-'}
                          </td>
                          <td className="px-3 py-[8px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap">
                            <span className="text-[11px] px-2 py-[2px] rounded-[10px]"
                                  style={{ background: 'rgba(91,164,217,0.12)', color: '#5BA4D9' }}>
                              {item.source}
                            </span>
                          </td>
                          <td className="px-3 py-[8px] border-b border-[rgba(91,164,217,0.08)] text-[12px] text-muted-brand whitespace-nowrap">
                            {item.base_date ? item.base_date.split('T')[0] : '-'}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.items.length === 0 && result.foundCount === 0 && (
              <div className="mb-3 text-sm text-muted-brand">조회된 자재가 없습니다.</div>
            )}

            {/* 누락 코드 */}
            {result.missingCodes.length > 0 && (
              <div className="px-4 py-3 rounded-lg text-sm"
                   style={{ background: 'rgba(249,168,37,0.08)', border: '1px solid rgba(249,168,37,0.25)' }}>
                <span className="font-semibold text-[12px]" style={{ color: '#f9a825' }}>
                  누락 코드 {result.missingCodes.length}개
                </span>
                <div className="mt-1 font-mono text-[12px] text-muted-brand flex flex-wrap gap-1">
                  {result.missingCodes.map(c => (
                    <span key={c} className="px-2 py-[2px] rounded"
                          style={{ background: 'rgba(249,168,37,0.12)' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── 카테고리 트리뷰 (2단계: 대분류 > 중분류) ────────────────────
interface CategoryTreeNode {
  category: string
  count: number
  subCategories: { subCategory: string; count: number }[]
}

// ── 즐겨찾기 ──────────────────────────────────────────
interface FavoriteItem {
  type: 'cat' | 'sub'
  category: string
  subCategory?: string
}
const FAV_KEY = 'material-catalog-favorites'
const MAX_FAV = 10

function loadFavs(): FavoriteItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') } catch { return [] }
}
function saveFavs(items: FavoriteItem[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(items))
}
function favId(f: Pick<FavoriteItem, 'type' | 'category' | 'subCategory'>) {
  return f.type === 'cat' ? `cat:${f.category}` : `sub:${f.category}:${f.subCategory}`
}

// ── 최근 본 분류 ───────────────────────────────────────
const RECENT_KEY = 'material-catalog-recents'
const MAX_RECENT = 10

function loadRecents(): FavoriteItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
function saveRecents(items: FavoriteItem[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(items))
}

// ── 필터 프리셋 ───────────────────────────────────────
interface FilterPreset {
  name: string
  category: string
  subCategory: string
  q: string
  savedAt: string
}
const PRESET_KEY = 'material-catalog-presets'
const MAX_PRESET = 10

function loadPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(PRESET_KEY) ?? '[]') } catch { return [] }
}
function savePresets(items: FilterPreset[]) {
  localStorage.setItem(PRESET_KEY, JSON.stringify(items))
}

// ── 마지막 사용 상태 ──────────────────────────────────
const LAST_STATE_KEY = 'material-catalog-last-state'

interface LastFilterState {
  category: string
  subCategory: string
  q: string
  savedAt: string
}

function loadLastState(): LastFilterState | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(LAST_STATE_KEY) ?? 'null') } catch { return null }
}
function saveLastState(state: LastFilterState) {
  localStorage.setItem(LAST_STATE_KEY, JSON.stringify(state))
}
function clearLastState() {
  localStorage.removeItem(LAST_STATE_KEY)
}

// ── 트리 펼침/스크롤 상태 ─────────────────────────────
const TREE_STATE_KEY = 'material-catalog-tree-state'
interface TreeState {
  expandedCats: string[]
  treeScrollTop: number
  savedAt: string
}
function loadTreeState(): TreeState | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(TREE_STATE_KEY) ?? 'null') } catch { return null }
}
function saveTreeState(state: TreeState) {
  localStorage.setItem(TREE_STATE_KEY, JSON.stringify(state))
}
function clearTreeState() {
  localStorage.removeItem(TREE_STATE_KEY)
}

function CategoryTree({
  treeData,
  selectedCat,
  selectedSub,
  expandedCats,
  onSelectCat,
  onSelectSub,
  onToggleExpand,
  totalCount,
  onClearTreeState,
}: {
  treeData: CategoryTreeNode[]
  selectedCat: string
  selectedSub: string
  expandedCats: Set<string>
  onSelectCat: (cat: string) => void
  onSelectSub: (cat: string, sub: string) => void
  onToggleExpand: (cat: string) => void
  totalCount: number
  onClearTreeState: () => void
}) {
  const [treeSearch, setTreeSearch] = useState('')
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => loadFavs())
  const [recents, setRecents] = useState<FavoriteItem[]>(() => loadRecents())

  // 트리 스크롤 ref + 복원
  const treeListRef = useRef<HTMLUListElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // treeData 로드 완료 후 스크롤 복원
  useEffect(() => {
    if (treeData.length > 0 && treeListRef.current) {
      const saved = loadTreeState()
      if (saved?.treeScrollTop) {
        treeListRef.current.scrollTop = saved.treeScrollTop
      }
    }
  }, [treeData])

  const handleTreeScroll = () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      if (treeListRef.current) {
        const state = loadTreeState()
        saveTreeState({
          expandedCats: state?.expandedCats ?? [],
          treeScrollTop: treeListRef.current.scrollTop,
          savedAt: new Date().toISOString(),
        })
      }
    }, 300)
  }

  const handleClearTree = () => {
    clearTreeState()
    if (treeListRef.current) treeListRef.current.scrollTop = 0
    onClearTreeState()
  }

  const keyword = treeSearch.trim()

  // ── 최근 본 분류 기록 ──────────────────────────────
  const addRecent = (item: FavoriteItem) => {
    setRecents(prev => {
      const id = favId(item)
      const filtered = prev.filter(r => favId(r) !== id)
      const next = [item, ...filtered].slice(0, MAX_RECENT)
      saveRecents(next)
      return next
    })
  }

  // ── 선택 래퍼 (recents 기록 포함) ─────────────────
  const handleSelectCat = (cat: string) => {
    if (cat) addRecent({ type: 'cat', category: cat })
    onSelectCat(cat)
  }
  const handleSelectSub = (cat: string, sub: string) => {
    addRecent({ type: 'sub', category: cat, subCategory: sub })
    onSelectSub(cat, sub)
  }

  // ── 즐겨찾기 토글 ──────────────────────────────────
  const toggleFav = (item: FavoriteItem) => {
    setFavorites(prev => {
      const id = favId(item)
      const exists = prev.some(f => favId(f) === id)
      let next: FavoriteItem[]
      if (exists) {
        next = prev.filter(f => favId(f) !== id)
      } else {
        // 최대 10개 — 오래된 것 제거
        const trimmed = prev.length >= MAX_FAV ? prev.slice(1) : prev
        next = [...trimmed, item]
      }
      saveFavs(next)
      return next
    })
  }

  const isFav = (item: Pick<FavoriteItem, 'type' | 'category' | 'subCategory'>) =>
    favorites.some(f => favId(f) === favId(item))

  // ── 검색 필터링 ────────────────────────────────────
  const filteredTree = keyword === ''
    ? treeData
    : treeData
        .map(node => {
          const catMatch = node.category.includes(keyword)
          const matchedSubs = node.subCategories.filter(s => s.subCategory.includes(keyword))
          if (!catMatch && matchedSubs.length === 0) return null
          return { ...node, subCategories: catMatch ? node.subCategories : matchedSubs }
        })
        .filter((n): n is CategoryTreeNode => n !== null)

  // 검색 중이면 매칭된 category는 항상 펼침
  const autoExpanded = keyword !== ''
    ? new Set(filteredTree.map(n => n.category))
    : null

  const isExpanded = (cat: string) =>
    autoExpanded ? autoExpanded.has(cat) : expandedCats.has(cat)

  const rootSelected = selectedCat === '' && selectedSub === ''

  // ── 핀 버튼 공통 스타일 ────────────────────────────
  const PinBtn = ({ item }: { item: FavoriteItem }) => {
    const pinned = isFav(item)
    return (
      <button
        onClick={e => { e.stopPropagation(); toggleFav(item) }}
        className="flex-shrink-0 border-0 bg-transparent cursor-pointer text-[11px] leading-none px-1"
        style={{ color: pinned ? '#f0b429' : 'rgba(255,255,255,0.2)', transition: 'color 0.15s' }}
        title={pinned ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      >
        {pinned ? '★' : '☆'}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-brand">분류</span>
        <button
          onClick={handleClearTree}
          className="text-[10px] border-0 bg-transparent cursor-pointer leading-none"
          style={{ color: 'rgba(91,164,217,0.3)' }}
          title="트리 펼침 상태 + 스크롤 위치 초기화"
        >초기화</button>
      </div>

      {/* 트리 내부 검색창 */}
      <div className="px-3 pb-2">
        <div className="relative">
          <input
            type="text"
            value={treeSearch}
            onChange={e => setTreeSearch(e.target.value)}
            placeholder="분류 검색..."
            className="w-full rounded-[7px] border-0 text-[12px] px-3 py-[6px] pr-7 outline-none"
            style={{ background: 'rgba(91,164,217,0.08)', color: 'rgba(255,255,255,0.85)' }}
          />
          {treeSearch && (
            <button
              onClick={() => setTreeSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 border-0 bg-transparent cursor-pointer text-[10px] leading-none"
              style={{ color: 'rgba(91,164,217,0.6)' }}
              title="지우기"
            >✕</button>
          )}
        </div>
      </div>

      {/* 즐겨찾기 영역 */}
      {favorites.length > 0 && (
        <div className="px-3 pb-2" style={{ borderBottom: '1px solid rgba(91,164,217,0.1)' }}>
          <div className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'rgba(91,164,217,0.5)' }}>
            즐겨찾기
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {favorites.map(fav => {
              const label = fav.type === 'sub'
                ? `${fav.category} › ${fav.subCategory}`
                : fav.category
              const isActive = fav.type === 'cat'
                ? selectedCat === fav.category && selectedSub === ''
                : selectedCat === fav.category && selectedSub === fav.subCategory
              return (
                <li key={favId(fav)} className="flex items-center gap-0">
                  <button
                    onClick={() => fav.type === 'cat'
                      ? handleSelectCat(fav.category)
                      : handleSelectSub(fav.category, fav.subCategory!)}
                    className="flex-1 text-left rounded-[6px] px-2 py-[4px] text-[11px] border-0 cursor-pointer truncate transition-colors"
                    style={{
                      background: isActive ? 'rgba(91,164,217,0.15)' : 'transparent',
                      color: isActive ? '#5BA4D9' : 'rgba(255,255,255,0.75)',
                      fontWeight: isActive ? 600 : undefined,
                    }}
                    title={label}
                  >
                    {label}
                  </button>
                  <button
                    onClick={() => toggleFav(fav)}
                    className="flex-shrink-0 border-0 bg-transparent cursor-pointer text-[10px] px-1 leading-none"
                    style={{ color: 'rgba(91,164,217,0.4)' }}
                    title="즐겨찾기 삭제"
                  >✕</button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 최근 본 분류 영역 */}
      {recents.length > 0 && (
        <div className="px-3 pb-2" style={{ borderBottom: '1px solid rgba(91,164,217,0.1)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'rgba(91,164,217,0.5)' }}>
              최근 본 분류
            </span>
            <button
              onClick={() => { setRecents([]); saveRecents([]) }}
              className="border-0 bg-transparent cursor-pointer text-[10px] leading-none"
              style={{ color: 'rgba(91,164,217,0.35)' }}
              title="전체 삭제"
            >전체 삭제</button>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {recents.map(r => {
              const label = r.type === 'sub'
                ? `${r.category} › ${r.subCategory}`
                : r.category
              const isActive = r.type === 'cat'
                ? selectedCat === r.category && selectedSub === ''
                : selectedCat === r.category && selectedSub === r.subCategory
              return (
                <li key={favId(r)} className="flex items-center gap-0">
                  <button
                    onClick={() => r.type === 'cat'
                      ? handleSelectCat(r.category)
                      : handleSelectSub(r.category, r.subCategory!)}
                    className="flex-1 text-left rounded-[6px] px-2 py-[4px] text-[11px] border-0 cursor-pointer truncate transition-colors"
                    style={{
                      background: isActive ? 'rgba(91,164,217,0.15)' : 'transparent',
                      color: isActive ? '#5BA4D9' : 'rgba(255,255,255,0.6)',
                      fontWeight: isActive ? 600 : undefined,
                    }}
                    title={label}
                  >
                    {label}
                  </button>
                  <button
                    onClick={() => {
                      setRecents(prev => {
                        const next = prev.filter(x => favId(x) !== favId(r))
                        saveRecents(next)
                        return next
                      })
                    }}
                    className="flex-shrink-0 border-0 bg-transparent cursor-pointer text-[10px] px-1 leading-none"
                    style={{ color: 'rgba(91,164,217,0.4)' }}
                    title="삭제"
                  >✕</button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ul ref={treeListRef} onScroll={handleTreeScroll} className="flex-1 overflow-y-auto px-2 pb-4" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {/* 전체 — 검색 중일 때는 숨김 */}
        {!keyword && (
          <li>
            <button
              onClick={() => onSelectCat('')}
              className="w-full flex items-center justify-between px-3 py-[7px] rounded-[7px] text-left text-sm transition-colors border-0 cursor-pointer"
              style={{
                background: rootSelected ? 'rgba(91,164,217,0.15)' : 'transparent',
                color:      rootSelected ? '#5BA4D9'               : undefined,
                fontWeight: rootSelected ? 600                     : undefined,
              }}
            >
              <span>전체</span>
              {totalCount > 0 && (
                <span className="text-[11px] text-muted-brand">{totalCount.toLocaleString()}</span>
              )}
            </button>
          </li>
        )}
        {/* 대분류 */}
        {filteredTree.map(node => {
          const catActive  = selectedCat === node.category && selectedSub === ''
          const expanded   = isExpanded(node.category)
          return (
            <li key={node.category}>
              <div className="flex items-center gap-0">
                {/* 펼침/접기 토글 */}
                <button
                  onClick={() => onToggleExpand(node.category)}
                  className="flex-shrink-0 border-0 bg-transparent cursor-pointer px-1 py-[7px] text-[10px]"
                  style={{ color: 'rgba(91,164,217,0.5)', width: '20px', textAlign: 'center' }}
                  title={expanded ? '접기' : '펼치기'}
                >
                  {expanded ? '▾' : '▸'}
                </button>
                {/* 대분류 클릭 */}
                <button
                  onClick={() => handleSelectCat(node.category)}
                  className="flex-1 flex items-center justify-between px-2 py-[7px] rounded-[7px] text-left text-sm transition-colors border-0 cursor-pointer"
                  style={{
                    background: catActive ? 'rgba(91,164,217,0.15)' : 'transparent',
                    color:      catActive ? '#5BA4D9'               : undefined,
                    fontWeight: catActive ? 600                     : undefined,
                  }}
                >
                  <span className="truncate pr-1">{node.category}</span>
                  <span className="text-[11px] text-muted-brand flex-shrink-0">{node.count.toLocaleString()}</span>
                </button>
                {/* 대분류 핀 버튼 */}
                <PinBtn item={{ type: 'cat', category: node.category }} />
              </div>
              {/* 중분류 */}
              {expanded && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {node.subCategories.map(sub => {
                    const subActive = selectedCat === node.category && selectedSub === sub.subCategory
                    return (
                      <li key={sub.subCategory} className="flex items-center gap-0">
                        <button
                          onClick={() => handleSelectSub(node.category, sub.subCategory)}
                          className="flex-1 flex items-center justify-between rounded-[7px] text-left text-[12px] transition-colors border-0 cursor-pointer"
                          style={{
                            paddingLeft: '28px', paddingRight: '6px',
                            paddingTop: '5px', paddingBottom: '5px',
                            background: subActive ? 'rgba(91,164,217,0.12)' : 'transparent',
                            color:      subActive ? '#5BA4D9'               : 'rgba(255,255,255,0.7)',
                            fontWeight: subActive ? 600                     : undefined,
                          }}
                        >
                          <span className="truncate pr-1">{sub.subCategory}</span>
                          <span className="text-[11px] text-muted-brand flex-shrink-0">{sub.count.toLocaleString()}</span>
                        </button>
                        {/* 중분류 핀 버튼 */}
                        <PinBtn item={{ type: 'sub', category: node.category, subCategory: sub.subCategory }} />
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
        {filteredTree.length === 0 && (
          <li className="px-3 py-2 text-xs text-muted-brand">
            {keyword ? `"${keyword}" 검색 결과 없음` : '데이터 없음'}
          </li>
        )}
      </ul>
    </div>
  )
}

export default function MaterialCatalogPage() {
  const [q, setQ]                         = useState('')
  const [category, setCategory]           = useState('')
  const [subCategory, setSubCategory]     = useState('')
  const [page, setPage]                   = useState(1)
  const [items, setItems]                 = useState<MaterialItem[]>([])
  const [total, setTotal]                 = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [treeData, setTreeData]           = useState<CategoryTreeNode[]>([])
  const [expandedCats, setExpandedCats]   = useState<Set<string>>(new Set())
  const [syncStatus, setSyncStatus]       = useState<SyncStatus | null>(null)
  const [searched, setSearched]           = useState(false)
  const [selectedId, setSelectedId]       = useState<number | null>(null)

  const [summary, setSummary]               = useState<MaterialSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError]     = useState('')

  const [catalogCsvLoading, setCatalogCsvLoading] = useState(false)
  const [catalogCsvError, setCatalogCsvError]     = useState('')

  const [suggests, setSuggests]           = useState<SuggestItem[]>([])
  const [suggestOpen, setSuggestOpen]     = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [activeIdx, setActiveIdx]         = useState(-1)
  const [suggestError, setSuggestError]   = useState('')

  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchMaterials = useCallback((qVal: string, catVal: string, subCatVal: string, pageVal: number) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(pageVal), pageSize: String(PAGE_SIZE) })
    if (qVal.trim())   params.set('q', qVal.trim())
    if (catVal)        params.set('category', catVal)
    if (subCatVal)     params.set('subCategory', subCatVal)
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

  useEffect(() => {
    fetch('/api/proxy/material-categories-tree')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const nodes: CategoryTreeNode[] = d.data ?? []
          setTreeData(nodes)
        }
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

    fetch('/api/proxy/material-summary')
      .then(r => r.json())
      .then(d => {
        if (d.success) setSummary(d.data)
        else setSummaryError(d.message ?? 'summary 조회 실패')
      })
      .catch(() => setSummaryError('summary 네트워크 오류'))
      .finally(() => setSummaryLoading(false))

    // URL 파라미터 복원 (클라이언트 전용)
    const sp = new URLSearchParams(window.location.search)
    const urlQ      = sp.get('q') || ''
    const urlCat    = sp.get('category') || ''
    const urlSub    = sp.get('subCategory') || ''
    const urlPage   = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const rawSel    = sp.get('selectedId')
    const urlSelId  = rawSel ? (parseInt(rawSel, 10) || null) : null
    // 트리 펼침 상태 복원 (URL/last-state 공통 기반)
    const savedTree = loadTreeState()
    const baseExpanded: Set<string> = savedTree?.expandedCats?.length
      ? new Set(savedTree.expandedCats)
      : new Set()

    if (urlQ || urlCat || urlSub || urlPage > 1 || urlSelId !== null) {
      // URL 우선 — 기존 로직 + 저장된 트리 펼침 상태 병합
      if (urlQ)             setQ(urlQ)
      if (urlCat)           setCategory(urlCat)
      if (urlSub)           setSubCategory(urlSub)
      if (urlCat)           baseExpanded.add(urlCat)
      setExpandedCats(new Set(baseExpanded))
      if (urlPage > 1)      setPage(urlPage)
      if (urlSelId !== null) setSelectedId(urlSelId)
      if (urlQ || urlCat || urlSub || urlPage > 1) fetchMaterials(urlQ, urlCat, urlSub, urlPage)
    } else {
      // URL 없으면 마지막 사용 상태 자동 복원
      const last = loadLastState()
      if (last && (last.category || last.subCategory || last.q)) {
        setQ(last.q)
        setCategory(last.category)
        setSubCategory(last.subCategory)
        if (last.category) baseExpanded.add(last.category)
        setExpandedCats(new Set(baseExpanded))
        fetchMaterials(last.q, last.category, last.subCategory, 1)
        syncURL(last.q, last.category, last.subCategory, 1, null)
      } else if (baseExpanded.size > 0) {
        // 필터 없어도 트리 펼침 상태만 복원
        setExpandedCats(new Set(baseExpanded))
      }
    }
  }, [fetchMaterials])

  // URL 동기화 (replace 기반 — 히스토리 불필요 누적 방지)
  const syncURL = (qVal: string, catVal: string, subCatVal: string, pageVal: number, idVal: number | null) => {
    const sp = new URLSearchParams()
    if (qVal.trim())       sp.set('q', qVal.trim())
    if (catVal)            sp.set('category', catVal)
    if (subCatVal)         sp.set('subCategory', subCatVal)
    if (pageVal > 1)       sp.set('page', String(pageVal))
    if (idVal !== null)    sp.set('selectedId', String(idVal))
    const qs = sp.toString()
    history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }

  const handleCatalogCsvDownload = async () => {
    setCatalogCsvLoading(true)
    setCatalogCsvError('')
    try {
      const params = new URLSearchParams()
      if (q.trim())      params.set('q', q.trim())
      if (category)      params.set('category', category)
      if (subCategory)   params.set('subCategory', subCategory)
      const res = await fetch(`/api/proxy/material-catalog-export?${params}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setCatalogCsvError((d as { message?: string }).message ?? 'CSV 다운로드 실패')
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const fnMatch = cd.match(/filename\*?=(?:UTF-8'')?([^;]+)/i)
      const filename = fnMatch
        ? decodeURIComponent(fnMatch[1].replace(/"/g, '').trim())
        : 'materials.csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setCatalogCsvError('CSV 다운로드 실패')
    } finally {
      setCatalogCsvLoading(false)
    }
  }

  const closeSuggest = () => {
    setSuggestOpen(false)
    setSuggests([])
    setActiveIdx(-1)
    setSuggestError('')
  }

  const fetchSuggests = useCallback((val: string) => {
    if (val.trim().length < 1) { closeSuggest(); return }
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
      .catch(() => { setSuggestOpen(false); setSuggests([]) })
      .finally(() => setSuggestLoading(false))
  }, [])

  const handleInputChange = (val: string) => {
    setQ(val)
    setActiveIdx(-1)
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (val.trim().length === 0) { closeSuggest(); return }
    suggestTimer.current = setTimeout(() => fetchSuggests(val), 200)
  }

  const handleSuggestSelect = (item: SuggestItem) => {
    setQ(item.name)
    closeSuggest()
    setPage(1)
    setSelectedId(null)
    fetchMaterials(item.name, category, subCategory, 1)
    syncURL(item.name, category, subCategory, 1, null)
  }

  const handleSearch = () => {
    closeSuggest()
    setPage(1)
    setSelectedId(null)
    fetchMaterials(q, category, subCategory, 1)
    syncURL(q, category, subCategory, 1, null)
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

  const handleCategoryChange = (cat: string) => {
    setCategory(cat)
    setSubCategory('')
    setPage(1)
    setSelectedId(null)
    // 대분류 선택 시 자동 펼치기
    if (cat) setExpandedCats(prev => { const s = new Set(Array.from(prev)); s.add(cat); return s })
    fetchMaterials(q, cat, '', 1)
    syncURL(q, cat, '', 1, null)
  }

  const handleSubCategoryChange = (cat: string, sub: string) => {
    setCategory(cat)
    setSubCategory(sub)
    setPage(1)
    setSelectedId(null)
    fetchMaterials(q, cat, sub, 1)
    syncURL(q, cat, sub, 1, null)
    setSearched(true)
  }

  const handleToggleExpand = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      // 트리 펼침 상태 저장
      const state = loadTreeState()
      saveTreeState({
        expandedCats: Array.from(next),
        treeScrollTop: state?.treeScrollTop ?? 0,
        savedAt: new Date().toISOString(),
      })
      return next
    })
  }

  const handlePageChange = (next: number) => {
    setPage(next)
    fetchMaterials(q, category, subCategory, next)
    syncURL(q, category, subCategory, next, selectedId)
  }

  const handleClearSub = () => {
    setSubCategory('')
    setPage(1)
    setSelectedId(null)
    fetchMaterials(q, category, '', 1)
    syncURL(q, category, '', 1, null)
  }

  const handleClearQ = () => {
    setQ('')
    closeSuggest()
    setPage(1)
    setSelectedId(null)
    fetchMaterials('', category, subCategory, 1)
    syncURL('', category, subCategory, 1, null)
  }

  const handleClearAll = () => {
    setQ('')
    setCategory('')
    setSubCategory('')
    setPage(1)
    setSelectedId(null)
    closeSuggest()
    fetchMaterials('', '', '', 1)
    syncURL('', '', '', 1, null)
  }

  // ── 프리셋 ─────────────────────────────────────────
  const [presets, setPresets]               = useState<FilterPreset[]>(() => loadPresets())
  const [presetName, setPresetName]         = useState('')
  const [showPresetInput, setShowPresetInput] = useState(false)

  const handleSavePreset = () => {
    const name = presetName.trim()
    if (!name) return
    setPresets(prev => {
      const filtered = prev.filter(p => p.name !== name)
      const next = [
        { name, category, subCategory, q, savedAt: new Date().toISOString() },
        ...filtered,
      ].slice(0, MAX_PRESET)
      savePresets(next)
      return next
    })
    setPresetName('')
    setShowPresetInput(false)
  }

  const handleApplyPreset = (preset: FilterPreset) => {
    setQ(preset.q)
    setCategory(preset.category)
    setSubCategory(preset.subCategory)
    setPage(1)
    setSelectedId(null)
    if (preset.category) setExpandedCats(prev => { const s = new Set(Array.from(prev)); s.add(preset.category); return s })
    fetchMaterials(preset.q, preset.category, preset.subCategory, 1)
    syncURL(preset.q, preset.category, preset.subCategory, 1, null)
  }

  const handleDeletePreset = (name: string) => {
    setPresets(prev => { const next = prev.filter(p => p.name !== name); savePresets(next); return next })
  }

  // ── 마지막 상태 자동 저장 ─────────────────────────
  useEffect(() => {
    if (searched) {
      saveLastState({ category, subCategory, q, savedAt: new Date().toISOString() })
    }
  }, [searched, category, subCategory, q])

  const handleClearLastState = () => {
    clearLastState()
    handleClearAll()
  }

  // ── 트리 상태 초기화 ──────────────────────────────
  const handleClearTreeState = () => {
    setExpandedCats(new Set())
  }

  return (
    <div className="flex" style={{ marginRight: selectedId !== null ? '360px' : '0', transition: 'margin-right 0.2s' }}>
      {/* 좌측 카테고리 트리 */}
      <aside
        className="flex-shrink-0 sticky top-0 overflow-y-auto"
        style={{
          width: '220px',
          height: '100vh',
          borderRight: '1px solid rgba(91,164,217,0.12)',
          background: 'rgba(91,164,217,0.02)',
        }}
      >
        <CategoryTree
          treeData={treeData}
          selectedCat={category}
          selectedSub={subCategory}
          expandedCats={expandedCats}
          onSelectCat={handleCategoryChange}
          onSelectSub={handleSubCategoryChange}
          onToggleExpand={handleToggleExpand}
          totalCount={summary?.totalMaterials ?? 0}
          onClearTreeState={handleClearTreeState}
        />
      </aside>

      {/* 우측 콘텐츠 */}
      <div className="flex-1 min-w-0 p-6">

      {/* 헤더 */}
      <div className="mb-3">
        <h1 className="text-2xl font-bold m-0 mb-1">자재 카탈로그</h1>
        <p className="text-sm text-muted-brand m-0">나라장터 자재 코드 조회 · 내부 테스트</p>
      </div>
      {/* 경로 표시 */}
      <div className="flex items-center gap-1 text-[12px] mb-4" style={{ color: 'rgba(91,164,217,0.7)' }}>
        <button
          onClick={() => handleCategoryChange('')}
          className="border-0 bg-transparent cursor-pointer p-0 text-[12px] transition-colors hover:text-white"
          style={{ color: category ? 'rgba(91,164,217,0.7)' : '#5BA4D9', fontWeight: category ? 400 : 600 }}
        >
          전체
        </button>
        {category && (
          <>
            <span style={{ opacity: 0.4 }}>›</span>
            <button
              onClick={() => handleCategoryChange(category)}
              className="border-0 bg-transparent cursor-pointer p-0 text-[12px] transition-colors hover:text-white"
              style={{ color: subCategory ? 'rgba(91,164,217,0.7)' : '#5BA4D9', fontWeight: subCategory ? 400 : 600 }}
            >
              {category}
            </button>
          </>
        )}
        {subCategory && (
          <>
            <span style={{ opacity: 0.4 }}>›</span>
            <span style={{ color: '#5BA4D9', fontWeight: 600 }}>{subCategory}</span>
          </>
        )}
      </div>

      {/* 요약 카드 */}
      {summaryLoading ? (
        <div className="mb-5 px-4 py-3 rounded-lg text-sm text-muted-brand"
             style={{ background: 'rgba(91,164,217,0.04)', border: '1px solid rgba(91,164,217,0.12)' }}>
          불러오는 중...
        </div>
      ) : summaryError ? (
        <div className="mb-5 px-4 py-3 rounded-lg text-sm"
             style={{ background: 'rgba(183,28,28,0.08)', border: '1px solid rgba(183,28,28,0.2)', color: '#ef5350' }}>
          {summaryError}
        </div>
      ) : summary ? (
        <div className="mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-2">
            {[
              { label: '총 자재 수',    value: (summary.totalMaterials ?? 0).toLocaleString(),     sub: null },
              { label: '카테고리',      value: `${summary.totalCategories ?? 0}개`,              sub: null },
              { label: '가격 있음',     value: (summary.priceAvailableCount ?? 0).toLocaleString(), sub: null },
              { label: '가격 없음',     value: (summary.priceUnavailableCount ?? 0).toLocaleString(), sub: 'price_available=false' },
              { label: '최신 기준일',   value: summary.latestBaseDate ? summary.latestBaseDate.split('T')[0] : '-', sub: null },
              { label: 'nara 건수',     value: (summary.sourceCounts?.nara ?? 0).toLocaleString(), sub: '실수집 보류' },
            ].map(card => (
              <div key={card.label}
                   className="rounded-[10px] px-4 py-3 flex flex-col gap-[3px]"
                   style={{ background: 'rgba(91,164,217,0.05)', border: '1px solid rgba(91,164,217,0.14)' }}>
                <span className="text-[11px] text-muted-brand">{card.label}</span>
                <span className="text-[15px] font-bold">{card.value}</span>
                {card.sub && (
                  <span className="text-[10px]" style={{ color: '#f9a825' }}>{card.sub}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

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

      {/* 붙여넣기 조회 섹션 */}
      <LookupSection
        selectedId={selectedId}
        onSelectId={(id) => { setSelectedId(id); syncURL(q, category, subCategory, page, id) }}
      />

      {/* 필터 */}
      <div className="flex gap-3 items-center flex-wrap mb-4">
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
          {suggestLoading && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-brand">...</span>
          )}
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

        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-5 py-[9px] bg-brand-accent text-white border-0 rounded-md text-sm font-semibold cursor-pointer"
        >
          {loading ? '조회 중...' : '조회'}
        </button>
        <button
          onClick={handleCatalogCsvDownload}
          disabled={catalogCsvLoading || loading}
          className="px-4 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm cursor-pointer bg-transparent disabled:opacity-50 transition-colors"
          style={{ color: '#5BA4D9' }}
        >
          {catalogCsvLoading ? '다운로드 중...' : '목록 CSV'}
        </button>
        {searched && (
          <span className="text-sm text-muted-brand">총 {(total ?? 0).toLocaleString()}건</span>
        )}
      </div>

      {/* 선택 필터 요약 바 */}
      {(category || subCategory || q.trim()) && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {category && (
            <span className="inline-flex items-center text-[12px] rounded-full px-3 py-[4px]"
                  style={{ background: 'rgba(91,164,217,0.12)', border: '1px solid rgba(91,164,217,0.25)', color: '#5BA4D9' }}>
              <span className="text-muted-brand mr-1">대분류:</span>{category}
              <button
                onClick={() => handleCategoryChange('')}
                className="ml-2 border-0 bg-transparent cursor-pointer text-[11px] leading-none"
                style={{ color: 'rgba(91,164,217,0.6)' }}
                title="대분류 해제"
              >✕</button>
            </span>
          )}
          {subCategory && (
            <span className="inline-flex items-center text-[12px] rounded-full px-3 py-[4px]"
                  style={{ background: 'rgba(91,164,217,0.12)', border: '1px solid rgba(91,164,217,0.25)', color: '#5BA4D9' }}>
              <span className="text-muted-brand mr-1">중분류:</span>{subCategory}
              <button
                onClick={handleClearSub}
                className="ml-2 border-0 bg-transparent cursor-pointer text-[11px] leading-none"
                style={{ color: 'rgba(91,164,217,0.6)' }}
                title="중분류 해제"
              >✕</button>
            </span>
          )}
          {q.trim() && (
            <span className="inline-flex items-center text-[12px] rounded-full px-3 py-[4px]"
                  style={{ background: 'rgba(91,164,217,0.12)', border: '1px solid rgba(91,164,217,0.25)', color: '#5BA4D9' }}>
              <span className="text-muted-brand mr-1">검색어:</span>{q}
              <button
                onClick={handleClearQ}
                className="ml-2 border-0 bg-transparent cursor-pointer text-[11px] leading-none"
                style={{ color: 'rgba(91,164,217,0.6)' }}
                title="검색어 해제"
              >✕</button>
            </span>
          )}
          <button
            onClick={handleClearAll}
            className="text-[11px] border border-[rgba(91,164,217,0.22)] rounded-full px-3 py-[4px] bg-transparent cursor-pointer"
            style={{ color: 'rgba(91,164,217,0.5)' }}
          >전체 해제</button>
          <button
            onClick={() => { setShowPresetInput(v => !v); setPresetName('') }}
            className="text-[11px] border border-[rgba(91,164,217,0.3)] rounded-full px-3 py-[4px] bg-transparent cursor-pointer"
            style={{ color: '#5BA4D9' }}
            title="현재 필터를 프리셋으로 저장"
          >+ 저장</button>
          <button
            onClick={handleClearLastState}
            className="text-[11px] border-0 bg-transparent cursor-pointer"
            style={{ color: 'rgba(91,164,217,0.3)' }}
            title="마지막 상태 기록 삭제 + 전체 초기화"
          >기록 삭제</button>
        </div>
      )}

      {/* 프리셋 저장 입력 */}
      {showPresetInput && (category || subCategory || q.trim()) && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSavePreset()
              if (e.key === 'Escape') { setShowPresetInput(false); setPresetName('') }
            }}
            placeholder="프리셋 이름 입력"
            autoFocus
            maxLength={30}
            className="px-3 py-[6px] border border-[rgba(91,164,217,0.35)] rounded-md text-[12px] bg-card"
            style={{ width: '170px' }}
          />
          <button
            onClick={handleSavePreset}
            disabled={!presetName.trim()}
            className="px-4 py-[6px] bg-brand-accent text-white border-0 rounded-md text-[12px] cursor-pointer disabled:opacity-40"
          >저장</button>
          <button
            onClick={() => { setShowPresetInput(false); setPresetName('') }}
            className="px-3 py-[6px] border border-[rgba(91,164,217,0.25)] rounded-md text-[12px] bg-transparent cursor-pointer text-muted-brand"
          >취소</button>
        </div>
      )}

      {/* 프리셋 목록 */}
      {presets.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[10px] font-semibold tracking-wider uppercase flex-shrink-0"
                style={{ color: 'rgba(91,164,217,0.45)' }}>프리셋</span>
          {presets.map(preset => {
            const isActive =
              preset.category === category &&
              preset.subCategory === subCategory &&
              preset.q === q
            return (
              <span
                key={preset.name}
                className="inline-flex items-center text-[12px] rounded-full px-3 py-[4px]"
                style={{
                  background: isActive ? 'rgba(91,164,217,0.2)' : 'rgba(91,164,217,0.07)',
                  border: `1px solid ${isActive ? 'rgba(91,164,217,0.45)' : 'rgba(91,164,217,0.18)'}`,
                  color: isActive ? '#5BA4D9' : 'rgba(255,255,255,0.7)',
                }}
              >
                <button
                  onClick={() => handleApplyPreset(preset)}
                  className="border-0 bg-transparent cursor-pointer text-[12px] leading-none"
                  style={{ color: 'inherit' }}
                  title={`대분류:${preset.category || '전체'} 중분류:${preset.subCategory || '-'} 검색어:${preset.q || '-'}`}
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => handleDeletePreset(preset.name)}
                  className="ml-2 border-0 bg-transparent cursor-pointer text-[11px] leading-none flex-shrink-0"
                  style={{ color: 'rgba(91,164,217,0.45)' }}
                  title="프리셋 삭제"
                >✕</button>
              </span>
            )
          })}
          {presets.length > 1 && (
            <button
              onClick={() => { setPresets([]); savePresets([]) }}
              className="text-[10px] border-0 bg-transparent cursor-pointer"
              style={{ color: 'rgba(91,164,217,0.3)' }}
            >전체 삭제</button>
          )}
        </div>
      )}

      {/* 목록 CSV 에러 */}
      {catalogCsvError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm"
             style={{ background: 'rgba(183,28,28,0.08)', border: '1px solid rgba(183,28,28,0.2)', color: '#ef5350' }}>
          {catalogCsvError}
        </div>
      )}

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
                        onClick={() => { const next = isSelected ? null : item.id; setSelectedId(next); syncURL(q, category, subCategory, page, next) }}
                        className="cursor-pointer transition-colors"
                        style={{ background: isSelected ? 'rgba(91,164,217,0.12)' : undefined }}
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

      {selectedId !== null && (
        <DetailPanel id={selectedId} onClose={() => { setSelectedId(null); syncURL(q, category, subCategory, page, null) }} />
      )}
      </div>{/* end right content */}
    </div>
  )
}
