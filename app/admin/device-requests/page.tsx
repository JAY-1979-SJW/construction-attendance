'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

interface DeviceRequest {
  id: string
  workerName: string
  workerPhone: string
  company: string
  oldDeviceToken: string | null
  newDeviceName: string
  reason: string
  status: string
  requestedAt: string
  processedAt: string | null
}

const STATUS_LABEL: Record<string, string> = { PENDING: '대기중', APPROVED: '승인', REJECTED: '반려' }
const STATUS_COLOR: Record<string, string> = { PENDING: '#e65100', APPROVED: '#2e7d32', REJECTED: '#888' }

export default function DeviceRequestsPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [items, setItems] = useState<DeviceRequest[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = (s = statusFilter) => {
    setLoading(true)
    fetch(`/api/admin/device-requests?status=${s}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setProcessing(requestId)
    setMsg('')
    const res = await fetch('/api/admin/device-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action }),
    })
    const data = await res.json()
    setMsg(data.message)
    if (data.success) load()
    setProcessing(null)
  }

  const formatPhone = (p: string) => p.length === 11 ? `${p.slice(0,3)}-${p.slice(3,7)}-${p.slice(7)}` : p
  const formatDt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  const getRequestType = (item: DeviceRequest) => item.oldDeviceToken === null ? '신규 등록' : '기기 변경'
  const getTypeColor = (item: DeviceRequest) => item.oldDeviceToken === null ? '#1565c0' : '#6a1b9a'

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 승인'],
        ].map(([href, label]) => <Link key={href} href={href} style={styles.navItem}>{label}</Link>)}
      </nav>
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>기기 등록/변경 요청 ({total}건)</h1>

        {msg && <div style={styles.msgBox}>{msg}</div>}

        {/* 상태 탭 */}
        <div style={styles.tabRow}>
          {[['PENDING', '대기중'], ['APPROVED', '승인'], ['REJECTED', '반려']].map(([s, label]) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); load(s) }}
              style={{ ...styles.tab, ...(statusFilter === s ? styles.tabActive : {}) }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>{['유형', '근로자', '연락처', '회사', '새 기기명', '변경 사유', '요청일', '상태', '처리'].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>요청이 없습니다.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: getTypeColor(item),
                        background: item.oldDeviceToken === null ? '#e3f2fd' : '#f3e5f5',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        whiteSpace: 'nowrap',
                      }}>
                        {getRequestType(item)}
                      </span>
                    </td>
                    <td style={styles.td}>{item.workerName}</td>
                    <td style={styles.td}>{formatPhone(item.workerPhone)}</td>
                    <td style={styles.td}>{item.company}</td>
                    <td style={styles.td}>{item.newDeviceName}</td>
                    <td style={styles.td}><span style={{ fontSize: '12px' }}>{item.reason}</span></td>
                    <td style={styles.td}>{formatDt(item.requestedAt)}</td>
                    <td style={styles.td}>
                      <span style={{ color: STATUS_COLOR[item.status], fontWeight: 600, fontSize: '12px' }}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {item.status === 'PENDING' && canMutate && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleAction(item.id, 'APPROVE')}
                            disabled={processing === item.id}
                            style={styles.approveBtn}
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleAction(item.id, 'REJECT')}
                            disabled={processing === item.id}
                            style={styles.rejectBtn}
                          >
                            반려
                          </button>
                        </div>
                      )}
                      {item.status === 'PENDING' && !canMutate && (
                        <span style={{ fontSize: '12px', color: '#bbb' }}>조회 전용</span>
                      )}
                      {item.processedAt && (
                        <span style={{ fontSize: '11px', color: '#999' }}>{formatDt(item.processedAt)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  msgBox: { background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#2e7d32', marginBottom: '16px' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tab: { padding: '8px 20px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#666' },
  tabActive: { background: '#1a1a2e', color: 'white', borderColor: '#1a1a2e' },
  tableCard: { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)' },
  td: { padding: '12px', fontSize: '14px', borderBottom: '1px solid #f5f5f5' },
  tr: {},
  approveBtn: { padding: '5px 12px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' },
  rejectBtn: { padding: '5px 12px', background: '#e53935', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' },
}
