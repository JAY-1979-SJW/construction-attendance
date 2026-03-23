'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DeviceRequest {
  id: string
  workerName: string
  deviceName: string
  status: string
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = { PENDING: '대기중', APPROVED: '승인', REJECTED: '반려' }
const STATUS_COLOR: Record<string, string> = { PENDING: '#e65100', APPROVED: '#2e7d32', REJECTED: '#888' }
const STATUS_BG: Record<string, string> = { PENDING: '#fff3e0', APPROVED: '#e8f5e9', REJECTED: '#f5f5f5' }

export default function CompanyDevicesPage() {
  const router = useRouter()
  const [items, setItems] = useState<DeviceRequest[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = (s = statusFilter) => {
    setLoading(true)
    const q = s !== 'ALL' ? `?status=${s}` : ''
    fetch(`/api/company/devices${q}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/company/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id)
    setMsg('')
    try {
      const res = await fetch(`/api/company/devices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      setMsg(data.success ? (action === 'approve' ? '승인되었습니다.' : '반려되었습니다.') : (data.message ?? '오류가 발생했습니다.'))
      if (data.success) load()
    } catch {
      setMsg('네트워크 오류가 발생했습니다.')
    } finally {
      setProcessing(null)
    }
  }

  const handleFilterChange = (s: string) => {
    setStatusFilter(s)
    load(s)
  }

  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>기기 승인 ({total}건)</h1>

      {msg && (
        <p style={{ ...styles.msg, background: msg.includes('오류') ? '#ffebee' : '#e8f5e9', color: msg.includes('오류') ? '#b71c1c' : '#2e7d32' }}>
          {msg}
        </p>
      )}

      <div style={styles.filterRow}>
        {[['PENDING', '대기중'], ['APPROVED', '승인'], ['REJECTED', '반려'], ['ALL', '전체']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => handleFilterChange(val)}
            style={{ ...styles.filterBtn, background: statusFilter === val ? '#0f4c75' : '#eee', color: statusFilter === val ? 'white' : '#555' }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={styles.loading}>불러오는 중...</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['근로자명', '기기명', '요청일시', '상태', '처리'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} style={styles.empty}>기기 요청이 없습니다.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} style={styles.tr}>
                  <td style={styles.td}>{item.workerName}</td>
                  <td style={styles.td}>{item.deviceName}</td>
                  <td style={styles.td}>{formatDt(item.createdAt)}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      background: STATUS_BG[item.status] ?? '#f5f5f5',
                      color: STATUS_COLOR[item.status] ?? '#555',
                    }}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {item.status === 'PENDING' && (
                      <div style={styles.actionBtns}>
                        <button
                          onClick={() => handleAction(item.id, 'approve')}
                          disabled={processing === item.id}
                          style={{ ...styles.approveBtn, opacity: processing === item.id ? 0.6 : 1 }}
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleAction(item.id, 'reject')}
                          disabled={processing === item.id}
                          style={{ ...styles.rejectBtn, opacity: processing === item.id ? 0.6 : 1 }}
                        >
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

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '32px' },
  title: { fontSize: '22px', fontWeight: 700, margin: '0 0 16px', color: '#ffffff' },
  msg: { padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  filterRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  filterBtn: { padding: '7px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  loading: { color: '#A0AEC0', fontSize: '15px' },
  tableWrapper: { background: '#243144', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid #eee', background: '#fafafa', whiteSpace: 'nowrap' as const },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#CBD5E0', whiteSpace: 'nowrap' as const },
  empty: { padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '14px' },
  badge: { padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 },
  actionBtns: { display: 'flex', gap: '6px' },
  approveBtn: { padding: '5px 12px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  rejectBtn: { padding: '5px 12px', background: '#b71c1c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
}
