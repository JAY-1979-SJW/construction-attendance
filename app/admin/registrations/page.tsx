'use client'

import { useState, useEffect, useCallback } from 'react'

interface Registration {
  id: string
  name: string
  phone: string
  jobTitle: string
  username: string | null
  email: string | null
  accountStatus: string
  rejectReason: string | null
  reviewedAt: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', APPROVED: '승인', REJECTED: '반려', SUSPENDED: '정지',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#ff9800', APPROVED: '#2e7d32', REJECTED: '#c62828', SUSPENDED: '#666',
}

export default function RegistrationsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [data, setData] = useState<Registration[]>([])
  const [loading, setLoading] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/admin/registrations?status=${filter}`)
    const d = await res.json()
    setData(d.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function approve(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/admin/registrations/${id}/approve`, { method: 'POST' })
    const d = await res.json()
    setMsg(d.message ?? '')
    setProcessing('')
    load()
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) { setMsg('반려 사유를 입력하세요.'); return }
    setProcessing(id)
    const res = await fetch(`/api/admin/registrations/${id}/reject`, {
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
      <h1 style={s.title}>회원가입 신청 관리</h1>

      {/* 필터 탭 */}
      <div style={s.tabs}>
        {['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].map(st => (
          <button key={st} style={{ ...s.tab, ...(filter === st ? s.tabActive : {}) }} onClick={() => setFilter(st)}>
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>

      {msg && <div style={s.msgBox}>{msg}</div>}

      {/* 반려 사유 입력 모달 */}
      {rejectId && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={{ margin: '0 0 16px' }}>반려 사유 입력</h3>
            <textarea
              style={s.textarea}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요."
              rows={4}
            />
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
                {['이름', '전화번호', '직종', '아이디', '상태', '신청일', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} style={s.tr}>
                  <td style={s.td}>{r.name}</td>
                  <td style={s.td}>{r.phone}</td>
                  <td style={s.td}>{r.jobTitle}</td>
                  <td style={s.td}>{r.username ?? '-'}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: STATUS_COLOR[r.accountStatus] }}>
                      {STATUS_LABEL[r.accountStatus]}
                    </span>
                    {r.rejectReason && <div style={s.rejectNote}>{r.rejectReason}</div>}
                  </td>
                  <td style={s.td}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td style={s.td}>
                    {r.accountStatus === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={s.approveBtn} onClick={() => approve(r.id)} disabled={processing === r.id}>
                          승인
                        </button>
                        <button style={s.rejectBtnSm} onClick={() => { setRejectId(r.id); setRejectReason('') }}>
                          반려
                        </button>
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
  title:      { fontSize: '22px', fontWeight: 700, margin: '0 0 24px', color: '#1a1a2e' },
  tabs:       { display: 'flex', gap: '8px', marginBottom: '20px' },
  tab:        { padding: '8px 18px', borderRadius: '20px', border: '1px solid #ddd', background: 'white', fontSize: '14px', cursor: 'pointer', color: '#666' },
  tabActive:  { background: '#1976d2', color: 'white', border: '1px solid #1976d2', fontWeight: 700 },
  msgBox:     { background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#2e7d32', fontSize: '14px' },
  empty:      { textAlign: 'center' as const, padding: '60px', color: '#888', fontSize: '15px' },
  tableWrap:  { overflowX: 'auto' as const },
  table:      { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' },
  th:         { background: '#f5f6fa', padding: '12px 14px', textAlign: 'left' as const, fontWeight: 700, color: '#555', borderBottom: '2px solid #eee' },
  tr:         { borderBottom: '1px solid #f0f0f0' },
  td:         { padding: '12px 14px', verticalAlign: 'middle' as const },
  badge:      { display: 'inline-block', color: 'white', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px' },
  rejectNote: { fontSize: '11px', color: '#c62828', marginTop: '4px', maxWidth: '160px' },
  approveBtn: { padding: '6px 12px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  rejectBtnSm:{ padding: '6px 12px', background: '#c62828', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  overlay:    { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:      { background: 'white', borderRadius: '12px', padding: '28px', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  textarea:   { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' as const, resize: 'vertical' as const },
  cancelBtn:  { padding: '8px 16px', background: '#eee', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  rejectBtn:  { padding: '8px 16px', background: '#c62828', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 700 },
}
