'use client'

import { useState, useEffect, useCallback } from 'react'

interface CompanyAdminRequest {
  id: string
  applicantName: string
  phone: string
  email: string | null
  companyName: string
  businessNumber: string
  representativeName: string | null
  contactPhone: string | null
  jobTitle: string | null
  status: string
  requestedAt: string
  reviewedAt: string | null
  rejectReason: string | null
  createdAdminUserId: string | null
}

const STATUS_LABEL: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }
const STATUS_COLOR: Record<string, string> = { PENDING: '#ff9800', APPROVED: '#2e7d32', REJECTED: '#c62828' }

export default function CompanyAdminRequestsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [data, setData] = useState<CompanyAdminRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<CompanyAdminRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [tempPass, setTempPass] = useState('')
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null)
  const [processing, setProcessing] = useState(false)
  const [msg, setMsg] = useState('')
  const [approveResult, setApproveResult] = useState<{ temporaryPassword: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/admin/company-admin-requests?status=${filter}`)
    const d = await res.json()
    setData(d.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function submitApprove() {
    if (!selected) return
    setProcessing(true)
    const res = await fetch(`/api/admin/company-admin-requests/${selected.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temporaryPassword: tempPass || undefined }),
    })
    const d = await res.json()
    setProcessing(false)
    if (d.success) {
      setApproveResult({ temporaryPassword: d.data?.temporaryPassword })
      setMode(null)
      load()
    } else {
      setMsg(d.message ?? '오류가 발생했습니다.')
    }
  }

  async function submitReject() {
    if (!selected || !rejectReason.trim()) { setMsg('반려 사유를 입력하세요.'); return }
    setProcessing(true)
    const res = await fetch(`/api/admin/company-admin-requests/${selected.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectReason }),
    })
    const d = await res.json()
    setProcessing(false)
    setMsg(d.message ?? '')
    setMode(null)
    setSelected(null)
    setRejectReason('')
    load()
  }

  const closeModal = () => { setMode(null); setSelected(null); setRejectReason(''); setTempPass('') }

  return (
    <div style={s.page}>
      <h1 style={s.title}>업체 관리자 신청 관리</h1>

      <div style={s.tabs}>
        {['PENDING', 'APPROVED', 'REJECTED'].map(st => (
          <button key={st} style={{ ...s.tab, ...(filter === st ? s.tabActive : {}) }} onClick={() => setFilter(st)}>
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>

      {msg && <div style={s.msgBox}>{msg}</div>}

      {/* 승인 결과 — 임시 비밀번호 표시 */}
      {approveResult && (
        <div style={s.resultBox}>
          <strong>승인 완료!</strong> 아래 임시 비밀번호를 신청자에게 전달하세요.<br />
          <code style={s.code}>{approveResult.temporaryPassword}</code>
          <button style={s.closeMsgBtn} onClick={() => setApproveResult(null)}>닫기</button>
        </div>
      )}

      {/* 모달 */}
      {mode && selected && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={{ margin: '0 0 12px' }}>
              {mode === 'approve' ? '업체 관리자 승인' : '신청 반려'}
            </h3>
            <div style={s.modalInfo}>
              <span style={s.infoLabel}>업체명</span><span>{selected.companyName}</span>
              <span style={s.infoLabel}>사업자번호</span><span>{selected.businessNumber}</span>
              <span style={s.infoLabel}>담당자</span><span>{selected.applicantName}</span>
              <span style={s.infoLabel}>연락처</span><span>{selected.phone}</span>
            </div>
            {mode === 'approve' && (
              <>
                <label style={s.label}>임시 비밀번호 (비워두면 자동 생성)</label>
                <input style={s.input} value={tempPass} onChange={e => setTempPass(e.target.value)} placeholder="8자 이상" minLength={8} />
              </>
            )}
            {mode === 'reject' && (
              <>
                <label style={s.label}>반려 사유 *</label>
                <textarea style={s.textarea} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="반려 사유를 입력하세요." rows={3} />
              </>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button style={s.cancelBtn} onClick={closeModal}>취소</button>
              {mode === 'approve'
                ? <button style={s.approveBtn} onClick={submitApprove} disabled={processing}>{processing ? '처리 중...' : '승인'}</button>
                : <button style={s.rejectBtn} onClick={submitReject} disabled={processing}>{processing ? '처리 중...' : '반려'}</button>
              }
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
                {['업체명', '사업자번호', '담당자', '연락처', '상태', '신청일', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} style={s.tr}>
                  <td style={s.td}>{r.companyName}</td>
                  <td style={s.td}>{r.businessNumber}</td>
                  <td style={s.td}>{r.applicantName}<div style={s.sub}>{r.jobTitle}</div></td>
                  <td style={s.td}>{r.phone}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: STATUS_COLOR[r.status] }}>{STATUS_LABEL[r.status]}</span>
                    {r.rejectReason && <div style={s.rejectNote}>{r.rejectReason}</div>}
                  </td>
                  <td style={s.td}>{new Date(r.requestedAt).toLocaleDateString()}</td>
                  <td style={s.td}>
                    {r.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={s.approveBtnSm} onClick={() => { setSelected(r); setMode('approve') }}>승인</button>
                        <button style={s.rejectBtnSm} onClick={() => { setSelected(r); setMode('reject') }}>반려</button>
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
  page:       { padding: '32px 24px', maxWidth: '1100px', margin: '0 auto', fontFamily: '"Malgun Gothic",sans-serif' },
  title:      { fontSize: '22px', fontWeight: 700, margin: '0 0 24px', color: '#1a1a2e' },
  tabs:       { display: 'flex', gap: '8px', marginBottom: '20px' },
  tab:        { padding: '8px 18px', borderRadius: '20px', border: '1px solid #ddd', background: 'white', fontSize: '14px', cursor: 'pointer', color: '#666' },
  tabActive:  { background: '#F47920', color: 'white', border: '1px solid #1976d2', fontWeight: 700 },
  msgBox:     { background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#2e7d32', fontSize: '14px' },
  resultBox:  { background: 'rgba(91,164,217,0.1)', border: '1px solid #90caf9', borderRadius: '8px', padding: '16px', marginBottom: '16px', fontSize: '14px' },
  code:       { display: 'block', fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, margin: '8px 0', color: '#4A93C8', letterSpacing: '0.1em' },
  closeMsgBtn:{ padding: '4px 12px', background: '#eee', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', marginTop: '8px' },
  empty:      { textAlign: 'center' as const, padding: '60px', color: '#A0AEC0', fontSize: '15px' },
  tableWrap:  { overflowX: 'auto' as const },
  table:      { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' },
  th:         { background: '#1E3350', padding: '12px 14px', textAlign: 'left' as const, fontWeight: 700, color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)' },
  tr:         { borderBottom: '1px solid #f0f0f0' },
  td:         { padding: '12px 14px', verticalAlign: 'middle' as const },
  sub:        { fontSize: '11px', color: '#A0AEC0', marginTop: '2px' },
  badge:      { display: 'inline-block', color: 'white', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px' },
  rejectNote: { fontSize: '11px', color: '#c62828', marginTop: '4px', maxWidth: '160px' },
  approveBtnSm: { padding: '6px 12px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  rejectBtnSm:{ padding: '6px 12px', background: '#c62828', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  overlay:    { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:      { background: '#243144', borderRadius: '12px', padding: '28px', width: '440px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  modalInfo:  { display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px 12px', fontSize: '14px', marginBottom: '16px', padding: '14px', background: '#f8f9fa', borderRadius: '8px' },
  infoLabel:  { color: '#A0AEC0', fontWeight: 600 },
  label:      { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' },
  input:      { width: '100%', padding: '10px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const },
  textarea:   { width: '100%', padding: '10px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, resize: 'vertical' as const },
  cancelBtn:  { padding: '8px 16px', background: '#eee', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  approveBtn: { padding: '8px 16px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 700 },
  rejectBtn:  { padding: '8px 16px', background: '#c62828', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 700 },
}
