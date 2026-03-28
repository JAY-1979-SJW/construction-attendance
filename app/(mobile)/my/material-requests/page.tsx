'use client'

import { useState, useEffect } from 'react'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

interface RequestItem {
  itemName: string
  spec: string
  unit: string
  requestedQty: string
  notes: string
}

interface MyRequest {
  id: string
  requestNo: string
  title: string
  status: string
  createdAt: string
  itemCount: number
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: '임시저장', color: 'text-gray-600', bg: 'bg-gray-100' },
  SUBMITTED: { label: '제출완료', color: 'text-amber-700', bg: 'bg-amber-50' },
  REVIEWED: { label: '검토중', color: 'text-blue-700', bg: 'bg-blue-50' },
  APPROVED: { label: '승인', color: 'text-green-700', bg: 'bg-green-50' },
  REJECTED: { label: '반려', color: 'text-red-700', bg: 'bg-red-50' },
  CANCELLED: { label: '취소', color: 'text-gray-500', bg: 'bg-gray-50' },
}

const EMPTY_ITEM: RequestItem = { itemName: '', spec: '', unit: '', requestedQty: '', notes: '' }

export default function MaterialRequestsPage() {
  const [tab, setTab] = useState<'list' | 'new'>('list')
  const [requests, setRequests] = useState<MyRequest[]>([])
  const [loading, setLoading] = useState(true)

  // 신규 청구 폼
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<RequestItem[]>([{ ...EMPTY_ITEM }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const updateItem = (idx: number, field: keyof RequestItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])

  const removeItem = (idx: number) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    if (!title.trim()) { setError('청구 제목을 입력하세요.'); return }
    const validItems = items.filter(i => i.itemName.trim() && Number(i.requestedQty) > 0)
    if (validItems.length === 0) { setError('자재를 최소 1건 입력하세요. (품명 + 수량 필수)'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/worker/materials/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          items: validItems.map(i => ({
            itemName: i.itemName.trim(),
            spec: i.spec.trim() || undefined,
            unit: i.unit.trim() || undefined,
            requestedQty: Number(i.requestedQty),
            notes: i.notes.trim() || undefined,
          })),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccess(`청구가 접수되었습니다. (${json.data.requestNo})`)
        setTitle('')
        setItems([{ ...EMPTY_ITEM }])
        setTab('list')
        loadRequests()
      } else {
        setError(json.message || '제출에 실패했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <WorkerTopBar />
      <div className="px-4 pt-4">
        {/* 탭 */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('list')}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold border-none cursor-pointer ${tab === 'list' ? 'bg-[#F97316] text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            내 청구 목록
          </button>
          <button onClick={() => { setTab('new'); setError(''); setSuccess('') }}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold border-none cursor-pointer ${tab === 'new' ? 'bg-[#F97316] text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            자재 청구하기
          </button>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-[12px] text-green-700">{success}</div>
        )}

        {/* 목록 탭 */}
        {tab === 'list' && (
          loading ? (
            <div className="text-center py-16 text-sm text-gray-400">불러오는 중...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[14px] text-gray-500 mb-1">청구 내역이 없습니다</p>
              <p className="text-[12px] text-gray-400">'자재 청구하기' 탭에서 필요한 자재를 요청하세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => {
                const st = STATUS_MAP[req.status] || STATUS_MAP.DRAFT
                return (
                  <div key={req.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-bold text-[14px] text-gray-800">{req.title}</div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {req.requestNo} / {req.itemCount}건 / {new Date(req.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* 신규 청구 탭 */}
        {tab === 'new' && (
          <div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-[12px] text-red-700">{error}</div>
            )}

            <div className="mb-4">
              <label className="block text-[13px] font-semibold text-gray-700 mb-1">청구 제목 *</label>
              <input
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[14px] bg-white outline-none focus:border-[#F97316] box-border"
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="예: 3층 창호 자재 요청"
              />
            </div>

            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[13px] font-semibold text-gray-700">자재 목록 *</label>
                <button onClick={addItem} className="text-[12px] text-[#F97316] font-bold border-none bg-transparent cursor-pointer">+ 품목 추가</button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="bg-white rounded-xl p-3 mb-2 border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] text-gray-400 font-bold">#{idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-[11px] text-red-400 border-none bg-transparent cursor-pointer">삭제</button>
                    )}
                  </div>
                  <input
                    className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[13px] mb-1.5 outline-none focus:border-[#F97316] box-border"
                    value={item.itemName} onChange={e => updateItem(idx, 'itemName', e.target.value)}
                    placeholder="품명 *"
                  />
                  <div className="flex gap-1.5 mb-1.5">
                    <input
                      className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-[#F97316] box-border"
                      value={item.spec} onChange={e => updateItem(idx, 'spec', e.target.value)}
                      placeholder="규격"
                    />
                    <input
                      className="w-16 px-2.5 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-[#F97316] box-border"
                      value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                      placeholder="단위"
                    />
                    <input
                      className="w-20 px-2.5 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-[#F97316] box-border"
                      value={item.requestedQty} onChange={e => updateItem(idx, 'requestedQty', e.target.value.replace(/\D/g, ''))}
                      placeholder="수량 *" inputMode="numeric"
                    />
                  </div>
                  <input
                    className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-[#F97316] box-border"
                    value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)}
                    placeholder="비고 (선택)"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3.5 rounded-xl text-[15px] font-bold bg-[#F97316] text-white border-none cursor-pointer disabled:bg-gray-300"
            >
              {submitting ? '제출 중...' : '자재 청구 제출'}
            </button>
          </div>
        )}
      </div>
      <WorkerBottomNav />
    </div>
  )
}
