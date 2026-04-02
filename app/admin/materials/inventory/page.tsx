'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface InventoryRow {
  siteId:            string | null
  siteName:          string
  itemName:          string
  spec:              string | null
  unit:              string | null
  requestedQty:      string
  orderedQty:        string
  receivedQty:       string
  pendingReceiveQty: string
  pendingOrderQty:   string
}

interface Site { id: string; name: string }

function fmt(v: string) {
  const n = Number(v)
  return n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function InventoryPage() {
  const router = useRouter()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [loading, setLoading] = useState(true)

  const load = (sid = siteId) => {
    setLoading(true)
    const qs = sid ? `?siteId=${sid}` : ''
    fetch(`/api/admin/materials/inventory${qs}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.push('/admin/login'); return }
        setRows(d.data.rows)
        setSites(d.data.sites)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  // 집계 합계
  const total = rows.reduce((acc, r) => ({
    requestedQty:     acc.requestedQty + Number(r.requestedQty),
    orderedQty:       acc.orderedQty + Number(r.orderedQty),
    receivedQty:      acc.receivedQty + Number(r.receivedQty),
    pendingReceiveQty: acc.pendingReceiveQty + Number(r.pendingReceiveQty),
    pendingOrderQty:  acc.pendingOrderQty + Number(r.pendingOrderQty),
  }), { requestedQty: 0, orderedQty: 0, receivedQty: 0, pendingReceiveQty: 0, pendingOrderQty: 0 })

  return (
    <div className="p-8 overflow-x-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-[22px] font-bold m-0">재고 현황</h1>
            <p className="text-[13px] text-muted-brand mt-1 mb-0">청구 → 발주 → 입고 누적 집계</p>
          </div>
          <select
            value={siteId}
            onChange={e => { setSiteId(e.target.value); load(e.target.value) }}
            className="px-3 py-[9px] border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-brand text-white min-w-[160px]"
          >
            <option value="">전체 현장</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: '총 청구량',    value: total.requestedQty,     color: '#5BA4D9' },
            { label: '총 발주량',    value: total.orderedQty,       color: '#F47920' },
            { label: '총 입고량',    value: total.receivedQty,      color: '#66bb6a' },
            { label: '미입고 잔량', value: total.pendingReceiveQty, color: '#f9a825' },
            { label: '미발주 잔량', value: total.pendingOrderQty,   color: '#ef5350' },
          ].map(c => (
            <div key={c.label} className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <div className="text-[11px] text-muted-brand mb-1">{c.label}</div>
              <div className="text-[22px] font-bold" style={{ color: c.color }}>
                {c.value % 1 === 0 ? c.value.toLocaleString() : c.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>

        {/* 테이블 */}
        <div className="bg-card rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          {loading ? (
            <div className="text-center py-12 text-muted-brand text-sm">로딩 중...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-brand text-sm">집계 데이터가 없습니다.</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['현장', '자재명', '규격', '단위', '청구량', '발주량', '입고량', '미입고잔량', '미발주잔량'].map(h => (
                    <th key={h} className="text-left px-4 py-[10px] text-[11px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const pendingReceive = Number(row.pendingReceiveQty)
                  const pendingOrder   = Number(row.pendingOrderQty)
                  return (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-muted-brand whitespace-nowrap">{row.siteName}</td>
                      <td className="px-4 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-white font-medium">{row.itemName}</td>
                      <td className="px-4 py-[10px] text-[12px] border-b border-[rgba(91,164,217,0.08)] text-muted-brand">{row.spec ?? '-'}</td>
                      <td className="px-4 py-[10px] text-[12px] border-b border-[rgba(91,164,217,0.08)] text-muted-brand">{row.unit ?? '-'}</td>
                      <td className="px-4 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-secondary-brand text-right">{fmt(row.requestedQty)}</td>
                      <td className="px-4 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-accent text-right">{fmt(row.orderedQty)}</td>
                      <td className="px-4 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-[#66bb6a] text-right font-semibold">{fmt(row.receivedQty)}</td>
                      <td className="px-4 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-right">
                        <span style={{ color: pendingReceive > 0 ? '#f9a825' : '#66bb6a' }}>
                          {fmt(row.pendingReceiveQty)}
                        </span>
                      </td>
                      <td className="px-4 py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.08)] text-right">
                        <span style={{ color: pendingOrder > 0 ? '#ef5350' : '#66bb6a' }}>
                          {fmt(row.pendingOrderQty)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
    </div>
  )
}
