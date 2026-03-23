'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

// ops 현장 상세 — /admin/sites/[id] 의 read-only 버전
// EXTERNAL_SITE_ADMIN: 수정 불가, 출퇴근 수정 불가
// SITE_ADMIN: 공지/일정/작업일보/TBM 작성 가능, 출퇴근 수정 가능

type Tab = 'info' | 'attendance' | 'worklogs' | 'notices' | 'schedules'

interface SiteInfo {
  id: string
  name: string
  address: string | null
  status: string
  description: string | null
  startDate: string | null
  endDate: string | null
}

interface AdminSession {
  role: string
  name: string
}

export default function OpsSiteDetail() {
  const { siteId } = useParams<{ siteId: string }>()
  const [tab, setTab] = useState<Tab>('info')
  const [site, setSite] = useState<SiteInfo | null>(null)
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/sites/${siteId}`).then(r => {
        if (r.status === 403) throw new Error('ACCESS_DENIED')
        if (!r.ok) throw new Error('NOT_FOUND')
        return r.json()
      }),
      fetch('/api/admin/auth/me').then(r => r.ok ? r.json() : null),
    ]).then(([siteData, meData]) => {
      setSite(siteData?.item ?? siteData)
      setSession(meData)
    }).catch(err => {
      setError(err.message)
    }).finally(() => setLoading(false))
  }, [siteId])

  const isReadOnly = session?.role === 'EXTERNAL_SITE_ADMIN'
  const canMutateAttendance = session?.role === 'SITE_ADMIN' || session?.role === 'ADMIN' || session?.role === 'SUPER_ADMIN'

  if (loading) return <div style={styles.page}><p style={styles.muted}>로딩 중...</p></div>
  if (error === 'ACCESS_DENIED') return (
    <div style={styles.page}>
      <div style={styles.errorBox}>
        <strong>접근 권한이 없습니다</strong>
        <p>이 현장에 대한 접근 권한이 없습니다.</p>
        <Link href="/ops/sites" style={styles.backLink}>← 현장 목록으로</Link>
      </div>
    </div>
  )
  if (!site) return <div style={styles.page}><p style={styles.muted}>현장을 찾을 수 없습니다.</p></div>

  return (
    <div style={styles.page}>
      <div style={styles.breadcrumb}>
        <Link href="/ops/sites" style={styles.breadLink}>← 현장 목록</Link>
      </div>

      <div style={styles.header}>
        <h1 style={styles.title}>{site.name}</h1>
        {isReadOnly && (
          <span style={styles.readOnlyBadge}>읽기 전용</span>
        )}
        <StatusBadge status={site.status} />
      </div>

      {/* 탭 */}
      <div style={styles.tabRow}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            style={{ ...styles.tab, ...(tab === key ? styles.tabActive : {}) }}
            onClick={() => setTab(key as Tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.tabContent}>
        {tab === 'info' && <InfoTab site={site} isReadOnly={isReadOnly} siteId={siteId} />}
        {tab === 'attendance' && <AttendanceTab siteId={siteId} canMutate={canMutateAttendance} />}
        {tab === 'worklogs' && <WorklogsTab siteId={siteId} isReadOnly={isReadOnly} />}
        {tab === 'notices' && <NoticesTab siteId={siteId} isReadOnly={false} />}
        {tab === 'schedules' && <SchedulesTab siteId={siteId} isReadOnly={false} />}
      </div>
    </div>
  )
}

const TABS = [
  { key: 'info',       label: '기본 정보' },
  { key: 'attendance', label: '출퇴근 현황' },
  { key: 'worklogs',   label: '작업일보' },
  { key: 'notices',    label: '공지' },
  { key: 'schedules',  label: '일정' },
]

// ── 기본 정보 탭 ────────────────────────────────────────────────────────────────
function InfoTab({ site, isReadOnly, siteId }: { site: SiteInfo; isReadOnly: boolean; siteId: string }) {
  return (
    <div>
      <div style={styles.infoGrid}>
        <InfoRow label="현장명" value={site.name} />
        <InfoRow label="주소" value={site.address ?? '—'} />
        <InfoRow label="상태" value={site.status} />
        <InfoRow label="시작일" value={site.startDate?.slice(0, 10) ?? '—'} />
        <InfoRow label="종료 예정" value={site.endDate?.slice(0, 10) ?? '—'} />
        {site.description && <InfoRow label="설명" value={site.description} />}
      </div>
      {!isReadOnly && (
        <div style={{ marginTop: '16px' }}>
          <Link href={`/admin/sites/${siteId}`} style={styles.adminLink}>
            ↗ 관리자 상세 페이지에서 수정
          </Link>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  )
}

// ── 출퇴근 현황 탭 ──────────────────────────────────────────────────────────────
function AttendanceTab({ siteId, canMutate }: { siteId: string; canMutate: boolean }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/attendance?siteId=${siteId}&date=${date}`)
      .then(r => r.json())
      .then(d => setItems(d?.items ?? []))
      .finally(() => setLoading(false))
  }, [siteId, date])

  return (
    <div>
      <div style={styles.filterBar}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={styles.dateInput} />
        {!canMutate && <span style={styles.readOnlyNote}>이 현장의 출퇴근은 읽기 전용입니다.</span>}
      </div>
      {loading ? <p style={styles.muted}>로딩 중...</p> : (
        items.length === 0 ? (
          <p style={styles.muted}>출퇴근 기록이 없습니다.</p>
        ) : (
          <table style={styles.table}>
            <thead><tr style={styles.thead}>
              <th style={styles.th}>작업자</th>
              <th style={styles.th}>출근</th>
              <th style={styles.th}>퇴근</th>
              <th style={styles.th}>상태</th>
              {canMutate && <th style={styles.th}></th>}
            </tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id as string} style={styles.tr}>
                  <td style={styles.td}>{item.workerName as string}</td>
                  <td style={styles.td}>{formatTime(item.checkInAt as string | null)}</td>
                  <td style={styles.td}>{formatTime(item.checkOutAt as string | null)}</td>
                  <td style={styles.td}><AttStatusBadge status={item.status as string} /></td>
                  {canMutate && (
                    <td style={styles.td}>
                      <Link href={`/admin/attendance/${item.id}`} style={styles.adminLink}>수정</Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}

// ── 작업일보 탭 ─────────────────────────────────────────────────────────────────
function WorklogsTab({ siteId, isReadOnly }: { siteId: string; isReadOnly: boolean }) {
  return (
    <div>
      <p style={styles.muted}>
        작업일보 기능은 현장 상세 페이지에서 이용하세요.{' '}
        <Link href={`/admin/sites/${siteId}`} style={styles.adminLink}>관리자 현장 페이지 →</Link>
      </p>
      {isReadOnly && <p style={styles.readOnlyNote}>지정 현장 운영형은 작업일보 작성이 제한됩니다.</p>}
    </div>
  )
}

// ── 공지 탭 ─────────────────────────────────────────────────────────────────────
function NoticesTab({ siteId, isReadOnly }: { siteId: string; isReadOnly: boolean }) {
  const [notices, setNotices] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/sites/${siteId}/notices`)
      .then(r => r.json())
      .then(d => setNotices(d?.items ?? []))
      .finally(() => setLoading(false))
  }, [siteId])

  return (
    <div>
      {loading ? <p style={styles.muted}>로딩 중...</p> : (
        notices.length === 0 ? (
          <p style={styles.muted}>등록된 공지가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notices.map(n => (
              <div key={n.id as string} style={styles.noticeCard}>
                <strong style={{ color: '#1f2937' }}>{n.title as string}</strong>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
                  {(n.startDate as string)?.slice(0, 10)}
                </p>
              </div>
            ))}
          </div>
        )
      )}
      {!isReadOnly && (
        <div style={{ marginTop: '12px' }}>
          <Link href={`/admin/sites/${siteId}`} style={styles.adminLink}>↗ 공지 작성은 관리자 페이지에서</Link>
        </div>
      )}
    </div>
  )
}

// ── 일정 탭 ─────────────────────────────────────────────────────────────────────
function SchedulesTab({ siteId, isReadOnly }: { siteId: string; isReadOnly: boolean }) {
  const [schedules, setSchedules] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/sites/${siteId}/schedules`)
      .then(r => r.json())
      .then(d => setSchedules(d?.items ?? []))
      .finally(() => setLoading(false))
  }, [siteId])

  return (
    <div>
      {loading ? <p style={styles.muted}>로딩 중...</p> : (
        schedules.length === 0 ? (
          <p style={styles.muted}>등록된 일정이 없습니다.</p>
        ) : (
          <table style={styles.table}>
            <thead><tr style={styles.thead}>
              <th style={styles.th}>날짜</th>
              <th style={styles.th}>구분</th>
              <th style={styles.th}>제목</th>
            </tr></thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id as string} style={styles.tr}>
                  <td style={styles.td}>{(s.scheduleDate as string)?.slice(0, 10)}</td>
                  <td style={styles.td}>{s.scheduleType as string}</td>
                  <td style={styles.td}>{s.title as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
      {!isReadOnly && (
        <div style={{ marginTop: '12px' }}>
          <Link href={`/admin/sites/${siteId}`} style={styles.adminLink}>↗ 일정 작성은 관리자 페이지에서</Link>
        </div>
      )}
    </div>
  )
}

// ── 공통 ────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    ACTIVE: { label: '운영중', bg: '#d1fae5', color: '#065f46' },
    PLANNED: { label: '준비중', bg: '#dbeafe', color: '#1e40af' },
    CLOSED: { label: '종료', bg: '#f3f4f6', color: '#6b7280' },
  }
  const s = map[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' }
  return <span style={{ ...styles.badge, background: s.bg, color: s.color }}>{s.label}</span>
}

function AttStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CHECKED_IN: '#d1fae5',
    CHECKED_OUT: '#dbeafe',
    COMPLETED: '#d1fae5',
    MISSING: '#fee2e2',
    ADJUSTED: '#fef3c7',
  }
  return (
    <span style={{ ...styles.badge, background: map[status] ?? '#f3f4f6', color: '#374151' }}>
      {status}
    </span>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px' },
  breadcrumb: { marginBottom: '12px' },
  breadLink: { color: '#6b7280', textDecoration: 'none', fontSize: '13px' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' },
  title: { fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 },
  readOnlyBadge: {
    fontSize: '11px', padding: '3px 10px', background: '#fef3c7', color: '#92400e',
    border: '1px solid #f59e0b', borderRadius: '4px',
  },
  badge: { fontSize: '12px', padding: '3px 8px', borderRadius: '4px', fontWeight: 500 },
  tabRow: { display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px', flexWrap: 'wrap' },
  tab: {
    padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '14px', color: '#6b7280', borderBottom: '2px solid transparent',
  },
  tabActive: { color: '#1d4ed8', borderBottom: '2px solid #1d4ed8', fontWeight: 600 },
  tabContent: { background: '#fff', borderRadius: '8px', padding: '24px', border: '1px solid #e5e7eb' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  infoRow: { display: 'flex', flexDirection: 'column', gap: '4px' },
  infoLabel: { fontSize: '12px', color: '#9ca3af', fontWeight: 500 },
  infoValue: { fontSize: '14px', color: '#1f2937' },
  filterBar: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' },
  dateInput: { padding: '6px 10px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '12px 14px', fontSize: '14px', color: '#1f2937' },
  noticeCard: {
    padding: '14px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    background: '#fafafa',
  },
  muted: { color: '#6b7280', fontSize: '14px' },
  readOnlyNote: { fontSize: '12px', color: '#b45309', background: '#fef3c7', padding: '6px 12px', borderRadius: '4px' },
  adminLink: { color: '#1d4ed8', fontSize: '13px', textDecoration: 'none' },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
    padding: '32px', textAlign: 'center', color: '#991b1b',
  },
  backLink: { color: '#1d4ed8', textDecoration: 'none', fontSize: '14px', marginTop: '12px', display: 'block' },
}
