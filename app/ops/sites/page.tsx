'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Site {
  id: string
  name: string
  address: string | null
  status: string
  workerCount: number
  companyName: string | null
}

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE:   { label: '운영중', bg: '#d1fae5', color: '#065f46' },
  PLANNED:  { label: '준비중', bg: '#dbeafe', color: '#1e40af' },
  CLOSED:   { label: '종료',   bg: '#f3f4f6', color: '#6b7280' },
  ARCHIVED: { label: '보관',   bg: '#f3f4f6', color: '#9ca3af' },
}

export default function OpsSiteList() {
  const [sites, setSites] = useState<Site[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '50' })
    if (search) params.set('search', search)
    fetch(`/api/admin/sites?${params}`)
      .then(r => r.json())
      .then(data => {
        setSites(data?.items ?? [])
        setTotal(data?.total ?? 0)
      })
      .finally(() => setLoading(false))
  }, [search])

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>내 담당 현장</h1>
        <span style={styles.count}>{total}개</span>
      </div>

      <div style={styles.filterBar}>
        <input
          style={styles.searchInput}
          placeholder="현장명 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p style={styles.loading}>로딩 중...</p>
      ) : sites.length === 0 ? (
        <div style={styles.emptyState}>
          <p>배정된 현장이 없습니다.</p>
          <p style={styles.emptyHint}>관리자에게 현장 배정을 요청하세요.</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>현장명</th>
                <th style={styles.th}>주소</th>
                <th style={styles.th}>상태</th>
                <th style={styles.th}>작업자 수</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {sites.map(site => {
                const s = STATUS_LABELS[site.status] ?? { label: site.status, bg: '#f3f4f6', color: '#6b7280' }
                return (
                  <tr key={site.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.siteName}>{site.name}</span>
                    </td>
                    <td style={{ ...styles.td, color: '#6b7280', fontSize: '13px' }}>
                      {site.address ?? '—'}
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{site.workerCount ?? '—'}</td>
                    <td style={styles.td}>
                      <Link href={`/ops/sites/${site.id}`} style={styles.viewBtn}>상세 보기</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 },
  count: { fontSize: '14px', color: '#6b7280', background: '#f3f4f6', padding: '2px 10px', borderRadius: '12px' },
  filterBar: { marginBottom: '16px' },
  searchInput: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    width: '240px',
    outline: 'none',
  },
  loading: { color: '#6b7280' },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#fff',
    borderRadius: '8px',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
  },
  emptyHint: { fontSize: '13px', marginTop: '8px', color: '#9ca3af' },
  tableWrap: { background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#1f2937' },
  siteName: { fontWeight: 600 },
  badge: { fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: 500 },
  viewBtn: {
    padding: '5px 12px',
    background: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: '5px',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
  },
}
