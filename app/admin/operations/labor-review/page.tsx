'use client'

import { useEffect, useState, useCallback } from 'react'

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
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>공수/정산 사전 검토</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="month"
            value={monthKey}
            onChange={e => { setMonthKey(e.target.value); setPage(1) }}
            style={{ padding: '7px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px' }}
          />
          <button onClick={load} disabled={loading} style={btnStyle('#1565c0', loading)}>
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      {/* 요약 */}
      {summary && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <SummaryCard label="전체" value={summary.totalItems} />
          <SummaryCard label="미확정 (DRAFT)" value={summary.totalDraft} color={summary.totalDraft > 0 ? '#e65100' : '#2e7d32'} />
          <SummaryCard label="확정 완료" value={summary.totalConfirmed} color="#2e7d32" />
          <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            {items.length > 0 && (
              <button onClick={confirmAll} style={btnStyle('#2e7d32', loading)}>
                현재 페이지 전체 확정 ({items.length}건)
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '12px', marginBottom: '12px', color: '#c62828', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* 목록 */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#263238', color: '#fff' }}>
                <th style={th}>근로자</th>
                <th style={th}>현장</th>
                <th style={th}>작업일</th>
                <th style={th}>공수</th>
                <th style={th}>자동계산</th>
                <th style={th}>최종시간</th>
                <th style={th}>기본급</th>
                <th style={th}>수정여부</th>
                <th style={th}>확정</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    {loading ? '조회 중...' : '미확정 항목이 없습니다.'}
                  </td>
                </tr>
              ) : (
                items.map((item, i) => {
                  const isConfirming = confirming.has(item.id)
                  return (
                    <tr key={item.id} style={{ background: item.isZeroMinutes ? '#fff8e1' : item.hasOverride ? '#f3e5f5' : i % 2 === 1 ? '#fafafa' : '#fff' }}>
                      <td style={td}>
                        <div style={{ fontWeight: 700 }}>{item.workerName}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{item.workerPhone}</div>
                      </td>
                      <td style={td}>{item.siteName}</td>
                      <td style={td}>{item.workDate}</td>
                      <td style={td}>
                        <span style={{ fontWeight: 700 }}>{item.confirmedWorkUnits > 0 ? `${item.confirmedWorkUnits}공수` : '—'}</span>
                        {item.confirmedWorkType && (
                          <div style={{ fontSize: '11px', color: '#888' }}>{item.confirmedWorkType}</div>
                        )}
                      </td>
                      <td style={td}>{fmtMinutes(item.workedMinutesAuto)}</td>
                      <td style={{ ...td, color: item.isZeroMinutes ? '#c62828' : item.hasOverride ? '#6a1b9a' : '#333', fontWeight: item.isZeroMinutes ? 700 : 400 }}>
                        {fmtMinutes(item.workedMinutesFinal)}
                        {item.isZeroMinutes && <span style={{ fontSize: '10px', marginLeft: '4px' }}>⚠️0</span>}
                      </td>
                      <td style={td}>{fmtAmount(item.confirmedBaseAmount)}</td>
                      <td style={td}>
                        {item.hasOverride ? (
                          <span style={{ color: '#6a1b9a', fontSize: '11px', fontWeight: 700 }}>수동수정</span>
                        ) : (
                          <span style={{ color: '#999', fontSize: '11px' }}>자동</span>
                        )}
                        {item.manualAdjustedReason && (
                          <div style={{ fontSize: '10px', color: '#888', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.manualAdjustedReason}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => confirmOne(item.id)}
                          disabled={isConfirming}
                          style={{ padding: '5px 12px', background: isConfirming ? '#bdbdbd' : '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: isConfirming ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                        >
                          {isConfirming ? '처리중' : '확정'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(page === 1)}>이전</button>
          <span style={{ fontSize: '13px', alignSelf: 'center', color: '#666' }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(page === totalPages)}>다음</button>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color = '#1565c0' }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '10px 16px', minWidth: '100px' }}>
      <div style={{ fontSize: '11px', color: '#888' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '9px 12px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }

function btnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return { padding: '8px 16px', background: disabled ? '#bdbdbd' : bg, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700 }
}
function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return { padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', background: disabled ? '#f5f5f5' : '#fff', color: disabled ? '#bbb' : '#333', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px' }
}
