'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields } from '@/components/admin/ui'

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

  if (loading) return (
    <div className="p-8"><p className="text-muted-brand text-[14px]">로딩 중...</p></div>
  )
  if (error === 'ACCESS_DENIED') return (
    <div className="p-8">
      <div className="bg-red-light border border-[#fca5a5] rounded-lg p-8 text-center text-status-rejected">
        <strong>접근 권한이 없습니다</strong>
        <p>이 현장에 대한 접근 권한이 없습니다.</p>
        <Link href="/ops/sites" className="text-[#1d4ed8] no-underline text-[14px] mt-3 block">← 현장 목록으로</Link>
      </div>
    </div>
  )
  if (!site) return (
    <div className="p-8"><p className="text-muted-brand text-[14px]">현장을 찾을 수 없습니다.</p></div>
  )

  return (
    <div className="p-8">
      <div className="mb-3">
        <Link href="/ops/sites" className="text-muted-brand no-underline text-[13px]">← 현장 목록</Link>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="text-[22px] font-bold text-fore-brand m-0">{site.name}</h1>
        {isReadOnly && (
          <span className="text-[11px] px-[10px] py-[3px] bg-yellow-light text-status-pending border border-[#f59e0b] rounded">읽기 전용</span>
        )}
        <StatusBadge status={site.status} />
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-brand mb-6 flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`px-4 py-2 border-none bg-transparent cursor-pointer text-[14px] border-b-2 transition-colors ${
              tab === key
                ? 'text-[#1d4ed8] border-b-[#1d4ed8] font-semibold'
                : 'text-muted-brand border-b-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-lg p-6 border border-brand">
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
      <div className="grid grid-cols-2 gap-3">
        <InfoRow label="현장명" value={site.name} />
        <InfoRow label="주소" value={site.address ?? '—'} />
        <InfoRow label="상태" value={site.status} />
        <InfoRow label="시작일" value={site.startDate?.slice(0, 10) ?? '—'} />
        <InfoRow label="종료 예정" value={site.endDate?.slice(0, 10) ?? '—'} />
        {site.description && <InfoRow label="설명" value={site.description} />}
      </div>
      {!isReadOnly && (
        <div className="mt-4">
          <Link href={`/admin/sites/${siteId}`} className="text-[#1d4ed8] text-[13px] no-underline">
            ↗ 관리자 상세 페이지에서 수정
          </Link>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-muted2-brand font-medium">{label}</span>
      <span className="text-[14px] text-[#1f2937]">{value}</span>
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
      <div className="flex gap-3 items-center mb-4 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-[10px] py-[6px] border border-[rgba(91,164,217,0.3)] rounded-md text-[14px]"
        />
        {!canMutate && (
          <span className="text-[12px] text-[#b45309] bg-yellow-light px-3 py-[6px] rounded">
            이 현장의 출퇴근은 읽기 전용입니다.
          </span>
        )}
      </div>
      {loading ? <p className="text-muted-brand text-[14px]">로딩 중...</p> : (
        <MobileCardList
          items={items}
          keyExtractor={(item) => item.id as string}
          emptyMessage="출퇴근 기록이 없습니다."
          renderCard={(item) => (
            <MobileCard
              title={item.workerName as string}
              badge={<AttStatusBadge status={item.status as string} />}
            >
              <MobileCardFields>
                <MobileCardField label="출근" value={formatTime(item.checkInAt as string | null)} />
                <MobileCardField label="퇴근" value={formatTime(item.checkOutAt as string | null)} />
              </MobileCardFields>
            </MobileCard>
          )}
          renderTable={() => (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface">
                  <th className="px-[14px] py-[10px] text-left text-[12px] font-semibold text-muted-brand border-b border-brand">작업자</th>
                  <th className="px-[14px] py-[10px] text-left text-[12px] font-semibold text-muted-brand border-b border-brand">출근</th>
                  <th className="px-[14px] py-[10px] text-left text-[12px] font-semibold text-muted-brand border-b border-brand">퇴근</th>
                  <th className="px-[14px] py-[10px] text-left text-[12px] font-semibold text-muted-brand border-b border-brand">상태</th>
                  {canMutate && <th className="px-[14px] py-[10px] text-left text-[12px] font-semibold text-muted-brand border-b border-brand"></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id as string} className="border-b border-brand">
                    <td className="px-[14px] py-3 text-[14px] text-[#1f2937]">{item.workerName as string}</td>
                    <td className="px-[14px] py-3 text-[14px] text-[#1f2937]">{formatTime(item.checkInAt as string | null)}</td>
                    <td className="px-[14px] py-3 text-[14px] text-[#1f2937]">{formatTime(item.checkOutAt as string | null)}</td>
                    <td className="px-[14px] py-3 text-[14px] text-[#1f2937]"><AttStatusBadge status={item.status as string} /></td>
                    {canMutate && (
                      <td className="px-[14px] py-3 text-[14px] text-[#1f2937]">
                        <Link href={`/admin/attendance/${item.id}`} className="text-[#1d4ed8] text-[13px] no-underline">수정</Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      )}
    </div>
  )
}

// ── 작업일보 탭 ─────────────────────────────────────────────────────────────────
function WorklogsTab({ siteId, isReadOnly }: { siteId: string; isReadOnly: boolean }) {
  return (
    <div>
      <p className="text-muted-brand text-[14px]">
        작업일보 기능은 현장 상세 페이지에서 이용하세요.{' '}
        <Link href={`/admin/sites/${siteId}`} className="text-[#1d4ed8] text-[13px] no-underline">관리자 현장 페이지 →</Link>
      </p>
      {isReadOnly && (
        <p className="text-[12px] text-[#b45309] bg-yellow-light px-3 py-[6px] rounded inline-block">
          지정 현장 운영형은 작업일보 작성이 제한됩니다.
        </p>
      )}
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
      {loading ? <p className="text-muted-brand text-[14px]">로딩 중...</p> : (
        notices.length === 0 ? (
          <p className="text-muted-brand text-[14px]">등록된 공지가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {notices.map(n => (
              <div key={n.id as string} className="px-4 py-[14px] border border-brand rounded-md bg-surface">
                <strong className="text-[#1f2937]">{n.title as string}</strong>
                <p className="text-[13px] text-muted-brand mt-1 mb-0">
                  {(n.startDate as string)?.slice(0, 10)}
                </p>
              </div>
            ))}
          </div>
        )
      )}
      {!isReadOnly && (
        <div className="mt-3">
          <Link href={`/admin/sites/${siteId}`} className="text-[#1d4ed8] text-[13px] no-underline">↗ 공지 작성은 관리자 페이지에서</Link>
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
      {loading ? <p className="text-muted-brand text-[14px]">로딩 중...</p> : (
        <MobileCardList
          items={schedules}
          keyExtractor={(s) => s.id as string}
          emptyMessage="등록된 일정이 없습니다."
          renderCard={(s) => (
            <MobileCard title={s.title as string} subtitle={(s.scheduleDate as string)?.slice(0, 10)}>
              <MobileCardFields>
                <MobileCardField label="구분" value={s.scheduleType as string} />
              </MobileCardFields>
            </MobileCard>
          )}
          renderTable={() => (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface">
                  <th className="px-[14px] py-[10px] text-left text-[12px] font-semibold text-muted-brand border-b border-brand">날짜</th>
                  <th className="px-[14px] py-[10px] text-left text-[12px] font-semibold text-muted-brand border-b border-brand">구분</th>
                  <th className="px-[14px] py-[10px] text-left text-[12px] font-semibold text-muted-brand border-b border-brand">제목</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => (
                  <tr key={s.id as string} className="border-b border-brand">
                    <td className="px-[14px] py-3 text-[14px] text-[#1f2937]">{(s.scheduleDate as string)?.slice(0, 10)}</td>
                    <td className="px-[14px] py-3 text-[14px] text-[#1f2937]">{s.scheduleType as string}</td>
                    <td className="px-[14px] py-3 text-[14px] text-[#1f2937]">{s.title as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      )}
      {!isReadOnly && (
        <div className="mt-3">
          <Link href={`/admin/sites/${siteId}`} className="text-[#1d4ed8] text-[13px] no-underline">↗ 일정 작성은 관리자 페이지에서</Link>
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
  return (
    <span
      className="text-[12px] px-2 py-[3px] rounded font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
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
    <span
      className="text-[12px] px-2 py-[3px] rounded font-medium text-body-brand"
      style={{ background: map[status] ?? '#f3f4f6' }}
    >
      {status}
    </span>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}
