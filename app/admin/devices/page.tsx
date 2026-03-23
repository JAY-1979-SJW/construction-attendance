'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

interface DeviceItem {
  id: string
  workerId: string
  workerName: string
  workerPhone: string
  workerStatus: string
  deviceToken: string
  deviceName: string
  isPrimary: boolean
  isBlocked: boolean
  blockReason: string | null
  blockedAt: string | null
  lastLoginAt: string | null
  platform: string | null
}

export default function DevicesPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'

  const [items, setItems] = useState<DeviceItem[]>([])
  const [total, setTotal] = useState(0)
  const [filterBlocked, setFilterBlocked] = useState<'all' | 'blocked' | 'normal'>('all')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [blockReasonInput, setBlockReasonInput] = useState<Record<string, string>>({})

  const load = useCallback((filter: typeof filterBlocked = filterBlocked) => {
    setLoading(true)
    const q = filter === 'blocked' ? '?isBlocked=true' : filter === 'normal' ? '?isBlocked=false' : ''
    fetch(`/api/admin/devices${q}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filterBlocked, router])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlock = async (deviceId: string) => {
    const reason = blockReasonInput[deviceId] ?? ''
    setProcessing(deviceId)
    setMsg(null)
    const res = await fetch(`/api/admin/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'BLOCK', blockReason: reason }),
    })
    const data = await res.json()
    setMsg({ text: data.success ? '기기가 차단되었습니다.' : (data.message ?? '처리 실패'), ok: data.success })
    if (data.success) load()
    setProcessing(null)
  }

  const handleUnblock = async (deviceId: string) => {
    setProcessing(deviceId)
    setMsg(null)
    const res = await fetch(`/api/admin/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UNBLOCK' }),
    })
    const data = await res.json()
    setMsg({ text: data.success ? '차단이 해제되었습니다.' : (data.message ?? '처리 실패'), ok: data.success })
    if (data.success) load()
    setProcessing(null)
  }

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '-'
  const fmtPhone = (p: string) => p.length === 11 ? `${p.slice(0,3)}-${p.slice(3,7)}-${p.slice(7)}` : p

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 승인'], ['/admin/devices', '기기 차단 관리'],
        ].map(([href, label]) => <Link key={href} href={href} style={styles.navItem}>{label}</Link>)}
      </nav>

      <main style={styles.main}>
        <h1 style={styles.pageTitle}>기기 차단 관리 ({total}건)</h1>

        {msg && (
          <div style={{ ...styles.msgBox, background: msg.ok ? '#e8f5e9' : '#ffebee', borderColor: msg.ok ? '#a5d6a7' : '#ef9a9a', color: msg.ok ? '#2e7d32' : '#c62828' }}>
            {msg.text}
          </div>
        )}

        <div style={styles.tabRow}>
          {([['all', '전체'], ['blocked', '차단됨'], ['normal', '정상']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setFilterBlocked(v); load(v) }}
              style={{ ...styles.tab, ...(filterBlocked === v ? styles.tabActive : {}) }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['근로자', '연락처', '기기명', '기기토큰', '플랫폼', '마지막 로그인', '상태', '차단 사유', '처리'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>기기가 없습니다.</td></tr>
                ) : items.map(item => (
                  <tr key={item.id} style={{ ...styles.tr, background: item.isBlocked ? '#fff8f8' : 'white' }}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{item.workerName}</div>
                      {item.isPrimary && <span style={styles.primaryBadge}>주기기</span>}
                    </td>
                    <td style={styles.td}>{fmtPhone(item.workerPhone)}</td>
                    <td style={styles.td}>{item.deviceName}</td>
                    <td style={{ ...styles.td, fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>{item.deviceToken}</td>
                    <td style={styles.td}>{item.platform ?? '-'}</td>
                    <td style={styles.td}>{fmt(item.lastLoginAt)}</td>
                    <td style={styles.td}>
                      {item.isBlocked ? (
                        <span style={styles.blockedBadge}>차단됨</span>
                      ) : (
                        <span style={styles.normalBadge}>정상</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {item.isBlocked ? (
                        <span style={{ fontSize: '12px', color: '#c62828' }}>{item.blockReason ?? '-'}</span>
                      ) : (
                        canMutate && (
                          <input
                            type="text"
                            placeholder="차단 사유 (선택)"
                            value={blockReasonInput[item.id] ?? ''}
                            onChange={e => setBlockReasonInput(prev => ({ ...prev, [item.id]: e.target.value }))}
                            style={styles.reasonInput}
                          />
                        )
                      )}
                    </td>
                    <td style={styles.td}>
                      {canMutate && (
                        item.isBlocked ? (
                          <button
                            onClick={() => handleUnblock(item.id)}
                            disabled={processing === item.id}
                            style={styles.unblockBtn}
                          >
                            차단 해제
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlock(item.id)}
                            disabled={processing === item.id}
                            style={styles.blockBtn}
                          >
                            차단
                          </button>
                        )
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
  layout: { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar: { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main: { flex: 1, padding: '32px' },
  pageTitle: { fontSize: '22px', fontWeight: 700, margin: '0 0 20px' },
  msgBox: { border: '1px solid', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', marginBottom: '16px' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tab: { padding: '8px 20px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#666' },
  tabActive: { background: '#1a1a2e', color: 'white', borderColor: '#1a1a2e' },
  tableCard: { background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#888', borderBottom: '2px solid #f0f0f0' },
  td: { padding: '12px', fontSize: '14px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle' },
  tr: {},
  primaryBadge: { fontSize: '10px', background: '#e3f2fd', color: '#1565c0', padding: '1px 6px', borderRadius: '8px', marginTop: '2px', display: 'inline-block' },
  blockedBadge: { fontSize: '11px', background: '#ffebee', color: '#c62828', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 },
  normalBadge: { fontSize: '11px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 },
  blockBtn: { padding: '5px 12px', background: '#c62828', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' },
  unblockBtn: { padding: '5px 12px', background: '#37474f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' },
  reasonInput: { padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', width: '120px' },
}
