'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface MaterialRequest {
  id: string
  requestNo: string
  title: string
  status: string
  requestedBy: string
  createdAt: string
  deliveryRequestedAt: string | null
  site: { id: string; name: string } | null
  _count: { items: number }
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:     '작성중',
  SUBMITTED: '제출됨',
  REVIEWED:  '검토됨',
  APPROVED:  '승인됨',
  REJECTED:  '반려됨',
  CANCELLED: '취소됨',
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT:     '#607d8b',
  SUBMITTED: '#f9a825',
  REVIEWED:  '#1565c0',
  APPROVED:  '#2e7d32',
  REJECTED:  '#b71c1c',
  CANCELLED: '#424242',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function MaterialRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const pageSize = 20

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/admin/materials/requests?${params}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.push('/admin/login'); return }
        setRequests(d.data.requests)
        setTotal(d.data.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1) }, [statusFilter])
  useEffect(() => { load() }, [page, statusFilter]) // eslint-disable-line

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={S.layout}>
      <nav style={S.sidebar}>
        <div style={S.sidebarTitle}>해한 출퇴근</div>
        <div style={S.navSection}>관리</div>
        {[
          { href: '/admin', label: '대시보드' },
          { href: '/admin/workers', label: '근로자 관리' },
          { href: '/admin/companies', label: '회사 관리' },
          { href: '/admin/sites', label: '현장 관리' },
          { href: '/admin/attendance', label: '출퇴근 조회' },
          { href: '/admin/materials', label: '자재관리' },
          { href: '/admin/materials/requests', label: '└ 자재청구' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            style={item.href === '/admin/materials/requests' ? S.navItemActive : S.navItem}>
            {item.label}
          </Link>
        ))}
        <button onClick={handleLogout} style={S.logoutBtn}>로그아웃</button>
      </nav>

      <main style={S.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={S.pageTitle}>자재청구 목록</h1>
            <p style={S.pageDesc}>현장별 자재청구서를 관리합니다.</p>
          </div>
          <button onClick={() => router.push('/admin/materials/requests/new')} style={S.primaryBtn}>
            + 청구서 작성
          </button>
        </div>

        {/* 필터 */}
        <div style={S.filterRow}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={S.filterSelect}>
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span style={{ color: '#A0AEC0', fontSize: '14px' }}>총 {total}건</span>
        </div>

        <div style={S.tableCard}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#A0AEC0' }}>로딩 중...</div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#A0AEC0' }}>등록된 청구서가 없습니다.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  {['청구번호', '제목', '현장', '상태', '항목수', '요청일', '납품요청일', ''].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td style={S.td}>
                      <span style={{ fontSize: '12px', color: '#A0AEC0' }}>{r.requestNo}</span>
                    </td>
                    <td style={S.td}>{r.title}</td>
                    <td style={S.td}>{r.site?.name ?? '-'}</td>
                    <td style={S.td}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '12px',
                        background: STATUS_COLOR[r.status] + '22',
                        color: STATUS_COLOR[r.status],
                        border: `1px solid ${STATUS_COLOR[r.status]}66`,
                      }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{r._count.items}</td>
                    <td style={S.td}>{fmtDate(r.createdAt)}</td>
                    <td style={S.td}>{r.deliveryRequestedAt ? fmtDate(r.deliveryRequestedAt) : '-'}</td>
                    <td style={S.td}>
                      <Link href={`/admin/materials/requests/${r.id}`} style={S.actionBtn}>보기</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.pageBtn}>이전</button>
              <span style={{ color: '#A0AEC0', lineHeight: '32px', fontSize: '13px' }}>{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={S.pageBtn}>다음</button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#1B2838', color: 'white' },
  sidebar: { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navItemActive: { display: 'block', color: 'white', padding: '10px 20px', fontSize: '14px', textDecoration: 'none', background: 'rgba(244,121,32,0.15)', borderLeft: '3px solid #F47920' },
  logoutBtn: { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main: { flex: 1, padding: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: 700, margin: '0 0 4px' },
  pageDesc: { fontSize: '14px', color: '#A0AEC0', margin: 0 },
  primaryBtn: { padding: '10px 20px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  filterRow: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' },
  filterSelect: { padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px', background: '#243144', color: 'white' },
  tableCard: { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)' },
  td: { padding: '12px', fontSize: '14px', borderBottom: '1px solid rgba(91,164,217,0.1)' },
  actionBtn: { padding: '4px 10px', background: 'rgba(91,164,217,0.12)', color: '#5BA4D9', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' },
  pageBtn: { padding: '6px 14px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '4px', background: '#243144', cursor: 'pointer', fontSize: '13px', color: 'white' },
}
