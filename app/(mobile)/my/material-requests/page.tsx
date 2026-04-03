'use client'

import { useState, useEffect, useCallback } from 'react'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

interface RequestItem {
  itemName: string
  spec: string
  unit: string
  requestedQty: string
  notes: string
  fromCatalog: boolean
  isUrgent: boolean
  allowSubstitute: boolean
}

interface AvailableSite {
  siteId: string
  siteName: string
}

interface CatalogItem {
  id: string
  itemCode: string
  standardItemName: string
  standardSpec: string | null
  standardUnit: string | null
  disciplineCode: string | null
}

interface Discipline { code: string; label: string; count: number }

interface MyRequest {
  id: string
  requestNo: string
  title: string
  status: string
  createdAt: string
  _count?: { items: number }
  itemCount?: number
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: '임시저장', color: 'text-gray-600', bg: 'bg-gray-100' },
  SUBMITTED: { label: '제출완료', color: 'text-amber-700', bg: 'bg-amber-50' },
  REVIEWED: { label: '검토중', color: 'text-blue-700', bg: 'bg-blue-50' },
  APPROVED: { label: '승인', color: 'text-green-700', bg: 'bg-green-50' },
  REJECTED: { label: '반려', color: 'text-red-700', bg: 'bg-red-50' },
  CANCELLED: { label: '취소', color: 'text-gray-500', bg: 'bg-gray-50' },
}

const EMPTY_ITEM: RequestItem = { itemName: '', spec: '', unit: '', requestedQty: '', notes: '', fromCatalog: false, isUrgent: false, allowSubstitute: true }

export default function MaterialRequestsPage() {
  const [tab, setTab] = useState<'list' | 'new'>('list')
  const [requests, setRequests] = useState<MyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [siteId, setSiteId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [mySites, setMySites] = useState<AvailableSite[]>([])
  const [items, setItems] = useState<RequestItem[]>([{ ...EMPTY_ITEM }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 카탈로그 검색
  const [searchIdx, setSearchIdx] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDisc, setSearchDisc] = useState('')
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [searching, setSearching] = useState(false)

  const loadRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/worker/materials/requests')
      const json = await res.json()
      if (json.success) setRequests(json.data?.items || json.data || [])
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { loadRequests() }, [])

  // 배정 현장 로드
  useEffect(() => {
    fetch('/api/attendance/available-sites')
      .then(r => r.json())
      .then(d => { if (d.success) setMySites((d.sites || []).map((s: any) => ({ siteId: s.siteId, siteName: s.siteName }))) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (searchIdx !== null && disciplines.length === 0) {
      fetch('/api/worker/materials/catalog?pageSize=1')
        .then(r => r.json())
        .then(d => { if (d.success) setDisciplines(d.data.disciplines) })
        .catch(() => {})
    }
  }, [searchIdx, disciplines.length])

  const searchCatalog = useCallback(async (disc?: string) => {
    const d = disc ?? searchDisc
    if (!searchQuery.trim() && !d) return
    setSearching(true)
    try {
      const params = new URLSearchParams({ pageSize: '15' })
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      if (d) params.set('discipline', d)
      const res = await fetch(`/api/worker/materials/catalog?${params}`)
      const json = await res.json()
      if (json.success) setCatalogItems(json.data.items)
    } catch { /* */ }
    setSearching(false)
  }, [searchQuery, searchDisc])

  const selectCatalogItem = (ci: CatalogItem) => {
    if (searchIdx === null) return
    setItems(prev => prev.map((it, i) => i === searchIdx ? {
      itemName: ci.standardItemName, spec: ci.standardSpec || '', unit: ci.standardUnit || '',
      requestedQty: it.requestedQty, notes: it.notes, fromCatalog: true,
      isUrgent: it.isUrgent, allowSubstitute: it.allowSubstitute,
    } : it))
    setSearchIdx(null); setCatalogItems([]); setSearchQuery(''); setSearchDisc('')
  }

  const updateItem = (idx: number, field: keyof RequestItem, value: string | boolean) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }
  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx: number) => { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx)) }

  const handleSubmit = async () => {
    setError(''); setSuccess('')
    if (!title.trim()) { setError('청구 제목을 입력하세요.'); return }
    const valid = items.filter(i => i.itemName.trim() && Number(i.requestedQty) > 0)
    if (!valid.length) { setError('자재를 최소 1건 입력하세요. (품명 + 수량 필수)'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/worker/materials/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          siteId: siteId || undefined,
          deliveryRequestedAt: deliveryDate || undefined,
          items: valid.map(i => ({
            itemName: i.itemName.trim(), spec: i.spec.trim() || undefined,
            unit: i.unit.trim() || undefined, requestedQty: Number(i.requestedQty),
            notes: i.notes.trim() || undefined,
            isUrgent: i.isUrgent, allowSubstitute: i.allowSubstitute,
          })),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccess(`청구 접수 (${json.data.requestNo})`); setTitle(''); setSiteId(''); setDeliveryDate(''); setItems([{ ...EMPTY_ITEM }])
        setTab('list'); loadRequests()
      } else setError(json.message || '제출 실패')
    } catch { setError('네트워크 오류') }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 overflow-x-hidden">
      <WorkerTopBar />
      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-4">
          {(['list', 'new'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold border-none cursor-pointer ${tab === t ? 'bg-brand-accent text-white' : 'bg-white text-gray-600'}`}>
              {t === 'list' ? '내 청구 목록' : '자재 청구하기'}
            </button>
          ))}
        </div>

        {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-[13px] leading-5 text-green-700">{success}</div>}

        {tab === 'list' && (
          loading ? <div className="text-center py-16 text-sm text-gray-400">불러오는 중...</div>
          : !requests.length ? (
            <div className="text-center py-16">
              <p className="text-[14px] text-gray-500 mb-1">청구 내역이 없습니다</p>
              <p className="text-[13px] leading-5 text-gray-400">'자재 청구하기'에서 요청하세요.</p>
            </div>
          ) : (
            <div className="space-y-3">{requests.map(req => {
              const st = STATUS_MAP[req.status] || STATUS_MAP.DRAFT
              return (
                <div key={req.id} className="bg-card rounded-2xl p-4 shadow-sm border border-brand">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-bold text-sm text-gray-800">{req.title}</div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${st.bg} ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="text-[13px] text-gray-400">{req.requestNo} / {req._count?.items ?? req.itemCount ?? 0}건 / {new Date(req.createdAt).toLocaleDateString('ko-KR')}</div>
                </div>
              )
            })}</div>
          )
        )}

        {tab === 'new' && (
          <div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-[13px] leading-5 text-red-700">{error}</div>}
            <div className="mb-3">
              <label className="block text-[13px] font-semibold text-gray-700 mb-1">청구 제목 *</label>
              <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base bg-white outline-none focus:border-accent box-border"
                value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 3층 창호 자재 요청" />
            </div>
            <div className="space-y-3 mb-3">
              <div>
                <label className="block text-[13px] font-semibold text-gray-600 mb-1">현장</label>
                <select className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base bg-white outline-none focus:border-accent box-border"
                  value={siteId} onChange={e => setSiteId(e.target.value)}>
                  <option value="">전체 (미지정)</option>
                  {mySites.map(s => <option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-gray-600 mb-1">납품 요청일</label>
                <input type="date" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base bg-white outline-none focus:border-accent box-border"
                  value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
            </div>
            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[13px] font-semibold text-gray-700">자재 목록 *</label>
                <button onClick={addItem} className="text-[13px] text-accent font-bold border-none bg-transparent cursor-pointer">+ 품목 추가</button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="bg-white rounded-xl p-3 mb-2 border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-gray-400 font-bold">#{idx + 1}</span>
                      {item.fromCatalog && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">카탈로그</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setSearchIdx(idx); setCatalogItems([]); setSearchQuery(''); setSearchDisc('') }}
                        className="text-[13px] text-blue-500 border-none bg-transparent cursor-pointer">자재 검색</button>
                      {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-[13px] text-red-400 border-none bg-transparent cursor-pointer">삭제</button>}
                    </div>
                  </div>
                  <input className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-base mb-1.5 outline-none focus:border-accent box-border"
                    value={item.itemName} onChange={e => updateItem(idx, 'itemName', e.target.value)} placeholder="품명 * (직접 입력 또는 검색)" />
                  <div className="flex flex-col gap-1.5 mb-1.5">
                    <input className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-base outline-none focus:border-accent box-border"
                      value={item.spec} onChange={e => updateItem(idx, 'spec', e.target.value)} placeholder="규격" />
                    <div className="flex gap-1.5">
                      <input className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-base outline-none focus:border-accent box-border"
                        value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="단위" />
                      <input className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-base outline-none focus:border-accent box-border"
                        value={item.requestedQty} onChange={e => updateItem(idx, 'requestedQty', e.target.value.replace(/\D/g, ''))} placeholder="수량 *" inputMode="numeric" />
                    </div>
                  </div>
                  <input className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-base outline-none focus:border-accent box-border mb-1.5"
                    value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder="비고 (선택)" />
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={item.isUrgent} onChange={e => updateItem(idx, 'isUrgent', e.target.checked)}
                        className="w-3.5 h-3.5 accent-red-500" />
                      <span className={`text-[13px] ${item.isUrgent ? 'text-red-600 font-bold' : 'text-gray-500'}`}>긴급</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={item.allowSubstitute} onChange={e => updateItem(idx, 'allowSubstitute', e.target.checked)}
                        className="w-3.5 h-3.5 accent-[var(--accent)]" />
                      <span className="text-[13px] text-gray-500">대체품 허용</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full h-12 rounded-xl text-sm font-bold bg-brand-accent text-white border-none cursor-pointer disabled:bg-gray-300">
              {submitting ? '제출 중...' : '자재 청구 제출'}
            </button>
          </div>
        )}

        {/* 자재 카탈로그 검색 모달 */}
        {searchIdx !== null && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
            <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 pb-8 max-h-[80vh] flex flex-col">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <h3 className="text-[15px] font-bold text-gray-800 mb-3">자재 검색 (공종별)</h3>
              <div className="flex gap-1.5 flex-wrap mb-3">
                <button onClick={() => { setSearchDisc(''); }}
                  className={`px-2.5 py-1 rounded-full text-[13px] font-bold border cursor-pointer ${!searchDisc ? 'bg-brand-accent text-white border-accent' : 'bg-white text-gray-600 border-gray-200'}`}>전체</button>
                {disciplines.map(d => (
                  <button key={d.code} onClick={() => { setSearchDisc(d.code); searchCatalog(d.code) }}
                    className={`px-2.5 py-1 rounded-full text-[13px] font-bold border cursor-pointer ${searchDisc === d.code ? 'bg-brand-accent text-white border-accent' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {d.label} ({d.count})
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <input className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-base outline-none focus:border-accent box-border"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') searchCatalog() }} placeholder="품명 검색..." autoFocus />
                <button onClick={() => searchCatalog()} disabled={searching}
                  className="px-4 py-2.5 bg-brand-accent text-white rounded-xl text-[13px] font-bold border-none cursor-pointer disabled:bg-gray-300">
                  {searching ? '...' : '검색'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {!catalogItems.length ? (
                  <div className="text-center py-8 text-[13px] leading-5 text-gray-400">{searching ? '검색 중...' : '공종 선택 또는 품명 검색'}</div>
                ) : catalogItems.map(ci => (
                  <button key={ci.id} onClick={() => selectCatalogItem(ci)}
                    className="w-full text-left p-3 border border-gray-100 rounded-xl mb-1.5 hover:bg-orange-50 hover:border-accent cursor-pointer bg-white transition-colors">
                    <div className="text-[13px] font-bold text-gray-800">{ci.standardItemName}</div>
                    {ci.standardSpec && <div className="text-[13px] text-gray-500 mt-0.5">{ci.standardSpec}</div>}
                    {ci.standardUnit && <div className="text-xs text-gray-400 mt-0.5">단위: {ci.standardUnit}</div>}
                  </button>
                ))}
              </div>
              <button onClick={() => { setSearchIdx(null); setCatalogItems([]) }}
                className="w-full py-3 mt-3 rounded-xl text-[13px] font-bold border border-gray-300 bg-white text-gray-600 cursor-pointer">
                닫기 (직접 입력)
              </button>
            </div>
          </div>
        )}
      </div>
      <WorkerBottomNav />
    </div>
  )
}
