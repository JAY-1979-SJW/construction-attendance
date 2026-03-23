'use client'

import { useState, useEffect, useCallback } from 'react'

interface JoinRequest {
  id: string
  status: string
  joinMethod: string
  requestedAt: string
  reviewedAt: string | null
  rejectReason: string | null
  note: string | null
  worker: { id: string; name: string; phone: string; jobTitle: string }
  site: { id: string; name: string; address: string }
}

const STATUS_LABEL: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }
const STATUS_COLOR: Record<string, string> = { PENDING: '#ff9800', APPROVED: '#2e7d32', REJECTED: '#c62828' }

export default function SiteJoinRequestsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [data, setData] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/admin/site-join-requests?status=${filter}`)
    const d = await res.json()
    setData(d.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function approve(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/admin/site-join-requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const d = await res.json()
    setMsg(d.message ?? '')
    setProcessing('')
    load()
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) { setMsg('반려 사유를 입력하세요.'); return }
    setProcessing(id)
    const res = await fetch(`/api/admin/site-join-requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectReason }),
    })
    const d = await res.json()
    setMsg(d.message ?? '')
    setProcessing('')
    setRejectId(null)
    setRejectReason('')
    load()
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>현장 참여 신청 관리</h1>

      <div style={s.tabs}>
        {['PENDING', 'APPROVED', 'REJECTED'].map(st => (
          <button key={st} style={{ ...s.tab, ...(filter === st ? s.tabActive : {}) }} onClick={() => setFilter(st)}>
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>

      {msg && <div style={s.msgBox}>{msg}</div>}

      {rejectId && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={{ margin: '0 0 16px' }}>반려 사유 입력</h3>
            <textarea style={s.textarea} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="반려 사유를 입력하세요." rows={4} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button style={s.cancelBtn} onClick={() => { setRejectId(null); setRejectReason('') }}>취소</button>
              <button style={s.rejectBtn} onClick={() => reject(rejectId)} disabled={processing === rejectId}>
                {processing === rejectId ? '처리 중...' : '반려'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={s.empty}>로딩 중...</div>
      ) : data.length === 0 ? (
        <div style={s.empty}>{STATUS_LABEL[filter]} 상태의 신청이 없습니다.</div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['근로자', '전화번호', '현장', '상태', '신청일', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} style={s.tr}>
                  <td style={s.td}>{r.worker.name}<div style={s.sub}>{r.worker.jobTitle}</div></td>
                  <td style={s.td}>{r.worker.phone}</td>
                  <td style={s.td}>{r.site.name}<div style={s.sub}>{r.site.address}</div></td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: STATUS_COLOR[r.status] }}>{STATUS_LABEL[r.status]}</span>
                    {r.rejectReason && <div style={s.rejectNote}>{r.rejectReason}</div>}
                  </td>
                  <td style={s.td}>{new Date(r.requestedAt).toLocaleDateString()}</td>
                  <td style={s.td}>
                    {r.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={s.approveBtn} onClick={() => approve(r.id)} disabled={processing === r.id}>승인</button>
                        <button style={s.rejectBtnSm} onClick={() => { setRejectId(r.id); setRejectReason('') }}>반려</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:       { padding: '32px 24px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Malgun Gothic",sans-serif' },
  title:      { fontSize: '22px', fontWeight: 700, margin: '0 0 24px', color: '#ffffff' },
  tabs:       { display: 'flex', gap: '8px', marginBottom: '20px' },
  tab:        { padding: '8px 18px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.12)', background: '#243144', fontSize: '14px', cursor: 'pointer', color: '#A0AEC0' },
  tabActive:  { background: '#F47920', color: 'white', border: '1px solid #1976d2', fontWeight: 700 },
  msgBox:     { background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#2e7d32', fontSize: '14px' },
  empty:      { textAlign: 'center' as const, padding: '60px', color: '#A0AEC0', fontSize: '15px' },
  tableWrap:  { overflowX: 'auto' as const },
  table:      { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' },
  th:         { background: '#1E3350', padding: '12px 14px', textAlign: 'left' as const, fontWeight: 700, color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)' },
  tr:         { borderBottom: '1px solid #f0f0f0' },
  td:         { padding: '12px 14px', verticalAlign: 'middle' as const },
  sub:        { fontSize: '11px', color: '#A0AEC0', marginTop: '2px' },
  badge:      { display: 'inline-block', color: 'white', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px' },
  rejectNote: { fontSize: '11px', color: '#c62828', marginTop: '4px', maxWidth: '160px' },
  approveBtn: { padding: '6px 12px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  rejectBtnSm:{ padding: '6px 12px', background: '#c62828', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  overlay:    { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:      { background: '#243144', borderRadius: '12px', padding: '28px', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  textarea:   { width: '100%', padding: '10px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' as const, resize: 'vertical' as const },
  cancelBtn:  { padding: '8px 16px', background: '#eee', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  rejectBtn:  { padding: '8px 16px', background: '#c62828', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 700 },
}
