'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Site { id: string; name: string }

export default function NewMaterialRequestPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])

  // 헤더 정보
  const [siteId, setSiteId]     = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes]       = useState('')

  // 품목 정보 (단일 인라인)
  const [itemName, setItemName]   = useState('')
  const [spec, setSpec]           = useState('')
  const [qty, setQty]             = useState('')
  const [unit, setUnit]           = useState('')
  const [useLocation, setUseLocation] = useState('')
  const [isUrgent, setIsUrgent]   = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => { if (d.success) setSites(d.data.sites ?? d.data ?? []) })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName.trim()) { setError('품목명을 입력하세요.'); return }
    const qtyNum = parseFloat(qty)
    if (!qty || isNaN(qtyNum) || qtyNum <= 0) { setError('수량을 올바르게 입력하세요.'); return }

    setSubmitting(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        itemName: itemName.trim(),
        requestedQty: qtyNum,
        isUrgent,
      }
      if (siteId)             body.siteId = siteId
      if (spec.trim())        body.spec = spec.trim()
      if (unit.trim())        body.unit = unit.trim()
      if (useLocation.trim()) body.useLocation = useLocation.trim()
      if (notes.trim())       body.notes = notes.trim()
      if (deliveryDate)       body.deliveryRequestedAt = new Date(deliveryDate).toISOString()

      const res = await fetch('/api/admin/materials/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!d.success) { setError(d.error ?? '등록 실패'); return }
      router.push(`/admin/materials/requests/${d.data.id}`)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-[680px]">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/materials/requests" className="text-muted-brand text-[13px] px-3 py-1 border border-[rgba(91,164,217,0.2)] rounded no-underline whitespace-nowrap">← 목록</Link>
          <h1 className="text-[20px] font-bold m-0">자재 신청</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-[10px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          {/* 현장 + 필요일 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[12px] text-muted-brand mb-1">현장</label>
              <select value={siteId} onChange={e => setSiteId(e.target.value)}
                className="w-full px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card text-white">
                <option value="">현장 선택</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-muted-brand mb-1">필요일</label>
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card text-white" />
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t border-[rgba(91,164,217,0.1)] mb-4 mt-2" />

          {/* 품목 정보 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-[12px] text-muted-brand mb-1">품목명 *</label>
              <input value={itemName} onChange={e => setItemName(e.target.value)}
                placeholder="예: 철근 D16"
                className="w-full px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card text-white" />
            </div>
            <div>
              <label className="block text-[12px] text-muted-brand mb-1">규격</label>
              <input value={spec} onChange={e => setSpec(e.target.value)}
                placeholder="예: D16 × 9m"
                className="w-full px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card text-white" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12px] text-muted-brand mb-1">수량 *</label>
                <input type="number" min="0.01" step="0.01" value={qty} onChange={e => setQty(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card text-white" />
              </div>
              <div>
                <label className="block text-[12px] text-muted-brand mb-1">단위</label>
                <input value={unit} onChange={e => setUnit(e.target.value)}
                  placeholder="예: 본, EA, m"
                  className="w-full px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card text-white" />
              </div>
            </div>
          </div>

          {/* 사용 위치/용도 */}
          <div className="mb-4">
            <label className="block text-[12px] text-muted-brand mb-1">사용 위치 / 용도</label>
            <input value={useLocation} onChange={e => setUseLocation(e.target.value)}
              placeholder="예: 3층 기둥 배근"
              className="w-full px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card text-white" />
          </div>

          {/* 긴급 여부 */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)}
                className="w-4 h-4" />
              <span className="text-sm">긴급 신청</span>
              <span className="text-[11px] text-muted-brand">(즉시 처리 필요)</span>
            </label>
          </div>

          {/* 비고 */}
          <div className="mb-5">
            <label className="block text-[12px] text-muted-brand mb-1">비고</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="추가 요청사항"
              rows={2}
              className="w-full px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card text-white resize-none" />
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-md text-[13px] text-red-400 bg-red-400/10 border border-red-400/20">{error}</div>
          )}

          <div className="flex gap-3 justify-end">
            <Link href="/admin/materials/requests"
              className="px-4 py-2 text-muted-brand border border-[rgba(91,164,217,0.2)] rounded-md text-sm no-underline">취소</Link>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 bg-brand-accent text-white border-0 rounded-md text-sm font-semibold cursor-pointer disabled:opacity-50">
              {submitting ? '등록 중...' : '신청 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
