'use client'

import { useEffect, useState, useCallback } from 'react'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

/**
 * 공수/정산 사전 검토 화면
 * GET  /api/admin/labor-count/review?monthKey=YYYY-MM
 * POST /api/admin/labor-count/review/[id]/confirm
 */

interface LaborItem {
  id:                   string
  workerId:             string
  workerName:           string
  workerPhone:          string
  siteId:               string
  siteName:             string
  workDate:             string
  confirmationStatus:   string
  confirmedWorkType:    string | null
  confirmedWorkUnits:   number
  confirmedWorkMinutes: number
  confirmedBaseAmount:  number
  confirmedTotalAmount: number
  incomeTypeSnapshot:   string | null
  workedMinutesAuto:     number | null
  workedMinutesOverride: number | null
  workedMinutesFinal:    number | null
  manualAdjustedYn:     boolean
  manualAdjustedReason: string | null
  hasOverride:          boolean
  isZeroMinutes:        boolean
}

interface Summary {
  totalDraft:     number
  totalConfirmed: number
  totalItems:     number
}

function fmtMinutes(m: number | null): string {
  if (m == null || m === 0) return '—'
  const h = Math.floor(m / 60); const min = m % 60
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

function fmtAmount(n: number): string {
  return n === 0 ? '—' : n.toLocaleString('ko-KR') + '원'
}

export default function LaborReviewPage() {
  const now      = new Date()
  const initMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [monthKey,  setMonthKey]  = useState(initMonth)
  const [items,     setItems]     = useState<LaborItem[]>([])
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [confirming, setConfirming] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!monthKey) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/admin/labor-count/review?monthKey=${monthKey}&page=${page}&pageSize=50`)
      const data = await res.json()
      if (data.success) {
        setItems(data.items)
        setSummary(data.summary)
        setTotal(data.total)
      } else {
        setError(data.error ?? '조회 오류')
      }
    } catch {
      setError('서버 연결 오류')
    } finally {
      setLoading(false)
    }
  }, [monthKey, page])

  useEffect(() => { load() }, [load])

  async function confirmOne(id: string, workUnits?: number) {
    setConfirming(s => new Set(s).add(id))
    try {
      const res = await fetch(`/api/admin/labor-count/review/${id}/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(workUnits !== undefined ? { workUnits } : {}),
      })
      const data = await res.json()
      if (data.success) {
        setItems(prev => prev.filter(i => i.id !== id))
        setTotal(t => t - 1)
        setSummary(s => s ? { ...s, totalDraft: s.totalDraft - 1, totalConfirmed: s.totalConfirmed + 1 } : s)
      } else {
        alert(data.error ?? '확정 오류')
      }
    } finally {
      setConfirming(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function confirmAll() {
    if (!confirm(`현재 페이지 ${items.length}건을 모두 확정하시겠습니까?`)) return
    for (const item of items) {
      await confirmOne(item.id)
    }
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-6 font-[system-ui,sans-serif]">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <h1 className="m-0 text-[20px] font-black">공수/정산 사전 검토</h1>
        <div className="flex gap-[10px] items-center">
          <input
            type="month"
            value={monthKey}
            onChange={e => { setMonthKey(e.target.value); setPage(1) }}
            className="px-3 py-[7px] border border-[rgba(91,164,217,0.2)] rounded-md text-[13px] bg-card text-white"
          />
          <button
            onClick={load}
            disabled={loading}
            className={`px-4 py-2 text-white border-none rounded-md text-[13px] font-bold ${loading ? 'bg-[#bdbdbd] cursor-not-allowed' : 'bg-[#1565c0] cursor-pointer'}`}
          >
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      {/* 요약 */}
      {summary && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <SummaryCard label="전체" value={summary.totalItems} />
          <SummaryCard label="미확정 (DRAFT)" value={summary.totalDraft} color={summary.totalDraft > 0 ? '#e65100' : '#2e7d32'} />
          <SummaryCard label="확정 완료" value={summary.totalConfirmed} color="#2e7d32" />
          <div className="ml-auto self-center">
            {items.length > 0 && (
              <button
                onClick={confirmAll}
                className={`px-4 py-2 text-white border-none rounded-md text-[13px] font-bold ${loading ? 'bg-[#bdbdbd] cursor-not-allowed' : 'bg-[#2e7d32] cursor-pointer'}`}
              >
                현재 페이지 전체 확정 ({items.length}건)
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-light border border-[#ef9a9a] rounded-lg p-3 mb-3 text-[#c62828] text-[13px]">
          {error}
        </div>
      )}

      {/* 목록 */}
      <div className="bg-card border border-brand rounded-[12px] overflow-hidden">
        <MobileCardList
          items={items}
          emptyMessage={loading ? '조회 중...' : '미확정 항목이 없습니다.'}
          keyExtractor={(item) => item.id}
          renderCard={(item) => {
            const isConfirming = confirming.has(item.id)
            return (
              <MobileCard
                title={item.workerName}
                subtitle={`${item.workDate} · ${item.siteName}`}
                badge={
                  item.isZeroMinutes ? (
                    <span className="text-[11px] font-bold text-[#c62828]">0분</span>
                  ) : item.hasOverride ? (
                    <span className="text-[11px] font-bold text-[#6a1b9a]">수동수정</span>
                  ) : undefined
                }
              >
                <MobileCardFields>
                  <MobileCardField label="공수" value={item.confirmedWorkUnits > 0 ? `${item.confirmedWorkUnits}공수` : '—'} />
                  <MobileCardField label="자동계산" value={fmtMinutes(item.workedMinutesAuto)} />
                  <MobileCardField label="최종시간" value={
                    <span style={{ color: item.isZeroMinutes ? '#c62828' : item.hasOverride ? '#6a1b9a' : undefined, fontWeight: item.isZeroMinutes ? 700 : undefined }}>
                      {fmtMinutes(item.workedMinutesFinal)}
                    </span>
                  } />
                  <MobileCardField label="기본급" value={fmtAmount(item.confirmedBaseAmount)} />
                  {item.manualAdjustedReason && <MobileCardField label="수정사유" value={item.manualAdjustedReason} />}
                </MobileCardFields>
                <MobileCardActions>
                  <button
                    onClick={() => confirmOne(item.id)}
                    disabled={isConfirming}
                    className={`px-3 py-1.5 text-white border-none rounded text-xs font-bold ${isConfirming ? 'bg-[#bdbdbd] cursor-not-allowed' : 'bg-[#2e7d32] cursor-pointer'}`}
                  >
                    {isConfirming ? '처리중' : '확정'}
                  </button>
                </MobileCardActions>
              </MobileCard>
            )
          }}
          renderTable={() => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px] min-w-[900px]">
                <thead>
                  <tr className="bg-[#263238] text-white">
                    <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">근로자</th>
                    <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">현장</th>
                    <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">작업일</th>
                    <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">공수</th>
                    <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">자동계산</th>
                    <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">최종시간</th>
                    <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">기본급</th>
                    <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">수정여부</th>
                    <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">확정</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const isConfirming = confirming.has(item.id)
                    return (
                      <tr key={item.id} style={{ background: item.isZeroMinutes ? '#fff8e1' : item.hasOverride ? '#f3e5f5' : i % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td className="px-3 py-[9px] border-b border-brand align-top">
                          <div className="font-bold">{item.workerName}</div>
                          <div className="text-[11px] text-muted-brand">{item.workerPhone}</div>
                        </td>
                        <td className="px-3 py-[9px] border-b border-brand align-top">{item.siteName}</td>
                        <td className="px-3 py-[9px] border-b border-brand align-top">{item.workDate}</td>
                        <td className="px-3 py-[9px] border-b border-brand align-top">
                          <span className="font-bold">{item.confirmedWorkUnits > 0 ? `${item.confirmedWorkUnits}공수` : '—'}</span>
                          {item.confirmedWorkType && (
                            <div className="text-[11px] text-muted-brand">{item.confirmedWorkType}</div>
                          )}
                        </td>
                        <td className="px-3 py-[9px] border-b border-brand align-top">{fmtMinutes(item.workedMinutesAuto)}</td>
                        <td className="px-3 py-[9px] border-b border-brand align-top" style={{ color: item.isZeroMinutes ? '#c62828' : item.hasOverride ? '#6a1b9a' : '#333', fontWeight: item.isZeroMinutes ? 700 : 400 }}>
                          {fmtMinutes(item.workedMinutesFinal)}
                          {item.isZeroMinutes && <span className="text-[11px] ml-1">⚠️0</span>}
                        </td>
                        <td className="px-3 py-[9px] border-b border-brand align-top">{fmtAmount(item.confirmedBaseAmount)}</td>
                        <td className="px-3 py-[9px] border-b border-brand align-top">
                          {item.hasOverride ? (
                            <span className="text-[#6a1b9a] text-[11px] font-bold">수동수정</span>
                          ) : (
                            <span className="text-[#718096] text-[11px]">자동</span>
                          )}
                          {item.manualAdjustedReason && (
                            <div className="text-[11px] text-muted-brand max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
                              {item.manualAdjustedReason}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-[9px] border-b border-brand align-top">
                          <button
                            onClick={() => confirmOne(item.id)}
                            disabled={isConfirming}
                            className={`px-3 py-[5px] text-white border-none rounded text-xs font-bold ${isConfirming ? 'bg-[#bdbdbd] cursor-not-allowed' : 'bg-[#2e7d32] cursor-pointer'}`}
                          >
                            {isConfirming ? '처리중' : '확정'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        />
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className={`px-[14px] py-[6px] border border-[rgba(91,164,217,0.2)] rounded-md text-[13px] ${page === 1 ? 'bg-surface text-[#bbb] cursor-not-allowed' : 'bg-white text-[#333] cursor-pointer'}`}>이전</button>
          <span className="text-[13px] self-center text-muted-brand">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`px-[14px] py-[6px] border border-[rgba(91,164,217,0.2)] rounded-md text-[13px] ${page === totalPages ? 'bg-surface text-[#bbb] cursor-not-allowed' : 'bg-white text-[#333] cursor-pointer'}`}>다음</button>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color = '#1565c0' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-brand rounded-[12px] px-4 py-[10px] min-w-[100px]">
      <div className="text-[11px] text-muted-brand">{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

