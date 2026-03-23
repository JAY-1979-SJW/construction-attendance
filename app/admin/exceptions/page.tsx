'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

interface ExceptionRecord {
  id: string
  workerName: string
  workerPhone: string
  company: string
  siteName: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  exceptionReason: string | null
  createdAt: string
}

export default function ExceptionsPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [items, setItems] = useState<ExceptionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ExceptionRecord | null>(null)
  const [approveData, setApproveData] = useState({ checkInAt: '', checkOutAt: '', note: '' })
  const [processing, setProcessing] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/admin/exceptions')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
  }

  useEffect(load, [router])

  const handleAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selected) return
    setProcessing(true)
    setMsg('')
    const res = await fetch('/api/admin/exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceLogId: selected.id, action, ...approveData }),
    })
    const data = await res.json()
    setMsg(data.message)
    if (data.success) { setSelected(null); load() }
    setProcessing(false)
  }

  const formatDt = (iso: string | null) => iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          { href: '/admin',               label: '대시보드' },
          { href: '/admin/workers',       label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
          { href: '/admin/sites',         label: '현장 관리' },
          { href: '/admin/attendance',      label: '출퇴근 조회' },
          { href: '/admin/presence-checks', label: '체류확인 현황' },
          { href: '/admin/labor',           label: '투입현황/노임서류' },
          { href: '/admin/exceptions',    label: '예외 승인' },
          { href: '/admin/device-requests', label: '기기 승인' },
          { href: '/admin/settings',        label: '⚙️ 시스템 설정' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} style={styles.navItem}>{label}</Link>
        ))}
      </nav>
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>예외 승인 ({total}건)</h1>

        {loading ? <p>로딩 중...</p> : (
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>{['날짜', '이름', '현장', '사유', '요청일', '처리'].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>대기 중인 예외 요청이 없습니다.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>{item.workDate}</td>
                    <td style={styles.td}>{item.workerName}<br /><span style={styles.sub}>{item.company}</span></td>
                    <td style={styles.td}>{item.siteName}</td>
                    <td style={styles.td}><span style={{ fontSize: '12px' }}>{item.exceptionReason}</span></td>
                    <td style={styles.td}>{formatDt(item.createdAt)}</td>
                    <td style={styles.td}>
                      {canMutate
                        ? <button onClick={() => { setSelected(item); setApproveData({ checkInAt: item.checkInAt?.slice(0, 16) ?? '', checkOutAt: item.checkOutAt?.slice(0, 16) ?? '', note: '' }) }} style={styles.actionBtn}>처리</button>
                        : <span style={{ fontSize: '12px', color: '#bbb' }}>조회 전용</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 처리 모달 */}
        {selected && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={{ margin: '0 0 16px' }}>예외 처리</h3>
              <p style={{ fontSize: '14px', color: '#555', marginBottom: '16px' }}>
                {selected.workerName} · {selected.siteName} · {selected.workDate}
              </p>
              <div style={styles.inputGroup}>
                <label style={styles.label}>출근 시각 수정 (선택)</label>
                <input type="datetime-local" value={approveData.checkInAt} onChange={(e) => setApproveData({ ...approveData, checkInAt: e.target.value })} style={styles.input} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>퇴근 시각 수정 (선택)</label>
                <input type="datetime-local" value={approveData.checkOutAt} onChange={(e) => setApproveData({ ...approveData, checkOutAt: e.target.value })} style={styles.input} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>메모</label>
                <input type="text" value={approveData.note} onChange={(e) => setApproveData({ ...approveData, note: e.target.value })} style={styles.input} placeholder="처리 메모 (선택)" />
              </div>
              {msg && <p style={{ color: '#2e7d32', fontSize: '13px' }}>{msg}</p>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                {canMutate && <button onClick={() => handleAction('APPROVE')} disabled={processing} style={{ ...styles.approveBtn }}>승인</button>}
                {canMutate && <button onClick={() => handleAction('REJECT')} disabled={processing} style={{ ...styles.rejectBtn }}>반려</button>}
                <button onClick={() => setSelected(null)} style={styles.cancelBtn}>닫기</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar: { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main: { flex: 1, padding: '32px' },
  pageTitle: { fontSize: '22px', fontWeight: 700, margin: '0 0 20px' },
  tableCard: { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)' },
  td: { padding: '12px', fontSize: '14px', borderBottom: '1px solid #f5f5f5' },
  tr: {},
  sub: { fontSize: '12px', color: '#999' },
  actionBtn: { padding: '6px 14px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#243144', borderRadius: '12px', padding: '32px', width: '400px', maxWidth: '90vw' },
  inputGroup: { marginBottom: '12px' },
  label: { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' },
  input: { width: '100%', padding: '8px 12px', fontSize: '14px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', boxSizing: 'border-box' as const },
  approveBtn: { flex: 1, padding: '10px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 },
  rejectBtn: { flex: 1, padding: '10px', background: '#e53935', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 },
  cancelBtn: { flex: 1, padding: '10px', background: '#1B2838', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' },
}
