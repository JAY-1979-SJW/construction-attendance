'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell, PageHeader, StatusBadge, Btn, FilterInput, FilterSelect, AdminTable, AdminTr, AdminTd, EmptyRow } from '@/components/admin/ui'

// ── 타입 ──────────────────────────────────────────────────────────────────
interface Summary {
  totalWorkers: number; activeSites: number
  todayTotal: number; todayCheckedIn: number; todayCompleted: number
  todayMissing: number; todayException: number
  pendingMissing: number; pendingExceptions: number; pendingDeviceRequests: number
  todayWage: number; monthWage: number; totalWage: number
  todayPresenceTotal: number; todayPresencePending: number
  todayPresenceNoResponse: number; todayPresenceReview: number
}
interface WorkerRecord {
  id: string; workerId: string
  workerName: string; company: string; siteName: string
  checkInAt: string | null; checkOutAt: string | null; status: string
  dayWage: number; monthWage: number; totalWage: number
}
interface SiteSummary {
  id: string; name: string
  openedAt: string | null; closedAt: string | null
  working: number; completed: number; issue: number
  todayWage: number; monthWage: number; totalWage: number
}
interface SiteOption { id: string; name: string }

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

const fmtWageShort = (n: number) => {
  if (n === 0) return '-'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억원'
  if (n >= 10_000)      return Math.round(n / 10_000) + '만원'
  return n.toLocaleString('ko-KR') + '원'
}
const fmtWageFull = (n: number) => n > 0 ? n.toLocaleString('ko-KR') + '원' : '-'
const fmtDate = (iso: string | null) => iso ? iso.slice(0, 10) : null

const getDaysUntil = (iso: string | null) => {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}
const getContractProgress = (openedAt: string | null, closedAt: string | null) => {
  if (!openedAt || !closedAt) return null
  const start = new Date(openedAt).getTime()
  const end   = new Date(closedAt).getTime()
  if (end <= start) return null
  const pct = Math.round(((Date.now() - start) / (end - start)) * 100)
  const remaining = Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)))
  return { pct: Math.min(100, Math.max(0, pct)), remaining }
}

const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무중', COMPLETED: '퇴근', MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외',
}
const STATUS_SORT: Record<string, number> = {
  MISSING_CHECKOUT: 0, EXCEPTION: 1, WORKING: 2, COMPLETED: 3,
}

// ── 검색형 현장 선택 ──────────────────────────────────────────────────────
function SiteSelect({
  options, value, onChange,
}: {
  options: SiteOption[]; value: string; onChange: (v: string) => void
}) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)
  const selectedLabel       = value === '' ? '전체 현장' : (options.find(o => o.id === value)?.name ?? '현장 선택')
  const filtered = useMemo(() =>
    query ? options.filter(o => o.name.includes(query)) : options,
    [options, query]
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery('') }}
        className="h-9 pl-3 pr-8 border border-[#E5E7EB] rounded-[8px] text-[13px] bg-white text-[#374151] text-left min-w-[160px] relative hover:border-[#D1D5DB] focus:outline-none focus:border-[#F97316] transition-colors"
      >
        <span className="truncate block">{selectedLabel}</span>
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" style={{ fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg min-w-[220px] max-h-[300px] flex flex-col">
          <div className="p-2 border-b border-[#F3F4F6]">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="현장 검색..."
              className="w-full h-8 px-3 border border-[#E5E7EB] rounded-[6px] text-[12px] text-[#111827] focus:outline-none focus:border-[#F97316] placeholder:text-[#9CA3AF]"
            />
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setQuery('') }}
              className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#F9FAFB] transition-colors ${value === '' ? 'font-semibold text-[#F97316] bg-[#FFF7ED]' : 'text-[#374151]'}`}
            >
              전체 현장
            </button>
            {filtered.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false); setQuery('') }}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#F9FAFB] transition-colors ${value === o.id ? 'font-semibold text-[#F97316] bg-[#FFF7ED]' : 'text-[#374151]'}`}
              >
                {o.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-[12px] text-[#9CA3AF] text-center">검색 결과 없음</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI 카드 ──────────────────────────────────────────────────────────────
function KpiCard({
  label, value, unit, sub, accentColor = '#E5E7EB', alert = false,
}: {
  label: string; value: string | number; unit?: string; sub?: string
  accentColor?: string; alert?: boolean
}) {
  return (
    <div
      className="bg-white rounded-[12px] border border-[#E5E7EB] px-4 py-4"
      style={{ borderTopWidth: 3, borderTopColor: accentColor }}
    >
      <div className="text-[11px] font-semibold text-[#6B7280] mb-2 uppercase tracking-wide leading-tight">{label}</div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className={`text-[28px] font-bold leading-none tabular-nums ${alert ? 'text-[#B91C1C]' : 'text-[#0F172A]'}`}>
          {value}
        </span>
        {unit && <span className="text-[12px] text-[#9CA3AF]">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-[#9CA3AF] leading-snug">{sub}</div>}
    </div>
  )
}

// ── 현장 카드 ─────────────────────────────────────────────────────────────
function SiteCard({ site }: { site: SiteSummary }) {
  const prog      = getContractProgress(site.openedAt, site.closedAt)
  const remaining = getDaysUntil(site.closedAt)
  const hasIssue  = site.issue > 0
  const isExpired = remaining !== null && remaining <= 0
  const isNearing = remaining !== null && remaining > 0 && remaining <= 30

  return (
    <div className={`bg-white rounded-[12px] border overflow-hidden ${hasIssue ? 'border-[#F87171]' : 'border-[#E5E7EB]'}`}>
      {/* 상단 컬러 라인 */}
      <div className="h-[3px]" style={{
        background: hasIssue ? '#B91C1C' : isExpired ? '#9CA3AF' : isNearing ? '#F97316' : '#E5E7EB',
      }} />
      <div className="px-4 py-3">
        {/* 현장명 + 배지 */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <span className="text-[13px] font-semibold text-[#111827] leading-snug">{site.name}</span>
          <div className="flex items-center gap-1 shrink-0">
            {isExpired && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB]">계약종료</span>
            )}
            {isNearing && !isExpired && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">임박</span>
            )}
            {hasIssue && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] border border-[#F87171]">
                확인 {site.issue}
              </span>
            )}
          </div>
        </div>

        {/* 계약기간 진행 바 */}
        {prog ? (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-[#9CA3AF] tabular-nums">
                {fmtDate(site.openedAt)} ~ {fmtDate(site.closedAt)}
              </span>
              <span className="text-[10px] text-[#6B7280] tabular-nums">{prog.pct}% · 잔여 {prog.remaining}일</span>
            </div>
            <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width:      `${prog.pct}%`,
                  background: prog.pct >= 90 ? '#B91C1C' : prog.pct >= 70 ? '#F97316' : '#16A34A',
                }}
              />
            </div>
          </div>
        ) : (
          site.openedAt || site.closedAt ? (
            <div className="mb-2 text-[10px] text-[#D1D5DB]">
              {fmtDate(site.openedAt)} ~ {fmtDate(site.closedAt)}
            </div>
          ) : null
        )}

        {/* 인원 현황 */}
        <div className="flex items-center gap-2 mb-2 flex-wrap text-[12px]">
          {site.working > 0 && (
            <span className="text-[#16A34A] font-semibold">출근중 {site.working}</span>
          )}
          {site.completed > 0 && (
            <span className="text-[#6B7280]">퇴근 {site.completed}</span>
          )}
          {site.issue > 0 && (
            <span className="text-[#B91C1C] font-semibold">확인필요 {site.issue}</span>
          )}
          {site.working === 0 && site.completed === 0 && site.issue === 0 && (
            <span className="text-[#D1D5DB]">오늘 출근 없음</span>
          )}
        </div>

        {/* 노임 현황 */}
        <div className="border-t border-[#F3F4F6] pt-2 grid grid-cols-3 gap-1 text-center">
          <div>
            <div className="text-[10px] text-[#9CA3AF] mb-0.5">오늘</div>
            <div className="text-[12px] font-semibold text-[#374151] tabular-nums">{fmtWageShort(site.todayWage)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#9CA3AF] mb-0.5">이번달</div>
            <div className="text-[12px] font-semibold text-[#374151] tabular-nums">{fmtWageShort(site.monthWage)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#9CA3AF] mb-0.5">총 누계</div>
            <div className="text-[12px] font-bold text-[#0F172A] tabular-nums">{fmtWageShort(site.totalWage)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()

  const todayIso = useMemo(() => {
    const d = new Date(Date.now() + 9 * 3600000)
    return d.toISOString().slice(0, 10)
  }, [])

  const [selectedDate,   setSelectedDate]   = useState(todayIso)
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [statusFilter,   setStatusFilter]   = useState('ALL')
  const [summary,        setSummary]        = useState<Summary | null>(null)
  const [records,        setRecords]        = useState<WorkerRecord[]>([])
  const [sites,          setSites]          = useState<SiteSummary[]>([])
  const [siteOptions,    setSiteOptions]    = useState<SiteOption[]>([])
  const [loading,        setLoading]        = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ date: selectedDate })
    if (selectedSiteId) params.set('siteId', selectedSiteId)
    fetch(`/api/admin/dashboard?${params}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setSummary(data.data.summary)
        setRecords(data.data.recentAttendance)
        setSites(data.data.sites)
        setSiteOptions(data.data.siteOptions)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedDate, selectedSiteId, router])

  useEffect(() => { load() }, [load])

  // 상태 필터 + 정렬 적용
  const filteredRecords = useMemo(() => {
    let rs = [...records]
    if (statusFilter !== 'ALL') rs = rs.filter(r => r.status === statusFilter)
    return rs.sort((a, b) => (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9))
  }, [records, statusFilter])

  // 현장 패널: 선택 시 단독, 전체 시 상위만 노출
  const displayedSites = useMemo(() => {
    if (selectedSiteId) return sites.filter(s => s.id === selectedSiteId)
    const byIssue = [...sites].sort((a, b) => b.issue - a.issue).slice(0, 8)
    const byWage  = [...sites]
      .sort((a, b) => b.totalWage - a.totalWage)
      .filter(s => !byIssue.find(x => x.id === s.id))
      .slice(0, 4)
    return [...byIssue, ...byWage]
  }, [sites, selectedSiteId])

  // 선택 현장 계약기간 정보
  const selectedSiteInfo  = selectedSiteId ? sites.find(s => s.id === selectedSiteId) : null
  const contractProg      = getContractProgress(selectedSiteInfo?.openedAt ?? null, selectedSiteInfo?.closedAt ?? null)
  const remainingDays     = getDaysUntil(selectedSiteInfo?.closedAt ?? null)

  const monthKey = selectedDate.slice(0, 7)
  const issueCount = (summary?.todayMissing ?? 0) + (summary?.todayException ?? 0)

  return (
    <PageShell>

      <PageHeader
        title="운영 대시보드"
        description="인원·노임·현장 운영 현황 통합 확인"
        actions={
          <>
            <FilterInput
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
            <SiteSelect options={siteOptions} value={selectedSiteId} onChange={setSelectedSiteId} />
            <FilterSelect
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">전체 상태</option>
              <option value="WORKING">근무중</option>
              <option value="COMPLETED">퇴근완료</option>
              <option value="MISSING_CHECKOUT">미퇴근</option>
              <option value="EXCEPTION">예외</option>
            </FilterSelect>
            <Btn variant="ghost" size="sm" onClick={load}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              새로고침
            </Btn>
          </>
        }
      />

      {/* ── 계약기간 보조 정보 바 (특정 현장 선택 시) ────────────────────── */}
      {selectedSiteInfo && (
        <div className="mb-4 bg-white rounded-[10px] border border-[#E5E7EB] px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#374151]">{selectedSiteInfo.name}</span>
            {remainingDays !== null && remainingDays <= 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] border border-[#F87171]">계약 종료</span>
            )}
            {remainingDays !== null && remainingDays > 0 && remainingDays <= 30 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">종료 임박</span>
            )}
          </div>

          {(selectedSiteInfo.openedAt || selectedSiteInfo.closedAt) ? (
            <>
              <div className="text-[12px] text-[#6B7280]">
                계약기간
                <span className="text-[#374151] font-medium ml-1 tabular-nums">
                  {fmtDate(selectedSiteInfo.openedAt) ?? '미설정'} ~ {fmtDate(selectedSiteInfo.closedAt) ?? '미설정'}
                </span>
              </div>
              {contractProg && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#6B7280]">진행률</span>
                  <div className="w-28 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width:      `${contractProg.pct}%`,
                        background: contractProg.pct >= 90 ? '#B91C1C' : contractProg.pct >= 70 ? '#F97316' : '#16A34A',
                      }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold text-[#374151] tabular-nums">{contractProg.pct}%</span>
                  <span className="text-[12px] text-[#9CA3AF]">·</span>
                  <span className="text-[12px] text-[#374151]">잔여 <span className="font-semibold tabular-nums">{contractProg.remaining}</span>일</span>
                </div>
              )}
            </>
          ) : (
            <span className="text-[12px] text-[#D1D5DB]">계약기간 미설정 — 현장관리에서 입력 가능</span>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-[#9CA3AF] text-[13px] py-20 text-center">로딩 중...</div>
      ) : (
        <>
          {/* ── KPI 카드 ────────────────────────────────────────────────── */}
          {/* 인원 4개 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <KpiCard
              label="오늘 출근 인원"
              value={summary?.todayTotal ?? 0}
              unit="명"
              sub={`근무중 ${summary?.todayCheckedIn ?? 0} · 퇴근 ${summary?.todayCompleted ?? 0}`}
              accentColor="#94A3B8"
            />
            <KpiCard
              label="현재 출근중"
              value={summary?.todayCheckedIn ?? 0}
              unit="명"
              sub="현재 현장 체류"
              accentColor="#16A34A"
            />
            <KpiCard
              label="미퇴근 누계"
              value={summary?.pendingMissing ?? 0}
              unit="건"
              sub="이전 일자 미처리"
              accentColor={(summary?.pendingMissing ?? 0) > 0 ? '#F97316' : '#E5E7EB'}
              alert={(summary?.pendingMissing ?? 0) > 0}
            />
            <KpiCard
              label="오늘 확인필요"
              value={issueCount}
              unit="건"
              sub={`미퇴근 ${summary?.todayMissing ?? 0} · 예외 ${summary?.todayException ?? 0}`}
              accentColor={issueCount > 0 ? '#B91C1C' : '#E5E7EB'}
              alert={issueCount > 0}
            />
          </div>
          {/* 노임 3개 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <KpiCard
              label={`오늘 총 노임 (${selectedDate})`}
              value={fmtWageShort(summary?.todayWage ?? 0)}
              sub={(summary?.todayWage ?? 0) > 0 ? fmtWageFull(summary!.todayWage) : '확정 내역 없음'}
              accentColor="#F97316"
            />
            <KpiCard
              label={`이번 달 누계 노임 (${monthKey})`}
              value={fmtWageShort(summary?.monthWage ?? 0)}
              sub={(summary?.monthWage ?? 0) > 0 ? fmtWageFull(summary!.monthWage) : '확정 내역 없음'}
              accentColor="#F97316"
            />
            <KpiCard
              label="총 누계 노임"
              value={fmtWageShort(summary?.totalWage ?? 0)}
              sub={(summary?.totalWage ?? 0) > 0 ? fmtWageFull(summary!.totalWage) : '확정 내역 없음'}
              accentColor="#0F172A"
            />
          </div>

          {/* ── 메인 2단 ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">

            {/* 좌: 근로자 현황 테이블 */}
            <div>
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#111827]">오늘 근로자 현황</span>
                  <span className="text-[11px] text-[#9CA3AF]">문제 인원 우선</span>
                </div>
                <span className="text-[12px] text-[#9CA3AF] tabular-nums">{filteredRecords.length}명</span>
              </div>
              <AdminTable headers={['이름', '소속 현장', '출근', '퇴근', '상태', '일 노임', '월 누계', '총 누계']}>
                {filteredRecords.length === 0 ? (
                  <EmptyRow colSpan={8} message={statusFilter !== 'ALL' ? '해당 상태의 기록이 없습니다' : '오늘 출근 기록이 없습니다'} />
                ) : filteredRecords.slice(0, 30).map(r => {
                  const isIssue = r.status === 'MISSING_CHECKOUT' || r.status === 'EXCEPTION'
                  return (
                    <AdminTr
                      key={r.id}
                      onClick={() => router.push(`/admin/attendance?date=${selectedDate}&name=${encodeURIComponent(r.workerName)}`)}
                      highlighted={isIssue}
                    >
                      <AdminTd className="font-medium text-[#111827]">{r.workerName}</AdminTd>
                      <AdminTd className="text-[#6B7280] max-w-[120px] truncate">{r.siteName}</AdminTd>
                      <AdminTd className="tabular-nums">{fmtTime(r.checkInAt)}</AdminTd>
                      <AdminTd className="tabular-nums">{fmtTime(r.checkOutAt)}</AdminTd>
                      <AdminTd><StatusBadge status={r.status} label={STATUS_LABEL[r.status]} /></AdminTd>
                      <AdminTd className="text-[12px] tabular-nums text-right">
                        {r.dayWage > 0 ? r.dayWage.toLocaleString('ko-KR') : '-'}
                      </AdminTd>
                      <AdminTd className="text-[12px] text-[#6B7280] tabular-nums text-right">
                        {r.monthWage > 0 ? r.monthWage.toLocaleString('ko-KR') : '-'}
                      </AdminTd>
                      <AdminTd className="text-[12px] font-medium tabular-nums text-right">
                        {r.totalWage > 0 ? r.totalWage.toLocaleString('ko-KR') : '-'}
                      </AdminTd>
                    </AdminTr>
                  )
                })}
              </AdminTable>
              {filteredRecords.length > 30 && (
                <div className="px-5 py-2.5 border-t border-[#F3F4F6] text-[12px] text-[#9CA3AF]">
                  {filteredRecords.length - 30}명 더 있음 — 출퇴근관리에서 전체 확인
                </div>
              )}
            </div>

            {/* 우: 현장별 요약 카드 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#111827]">현장별 운영 현황</span>
                {!selectedSiteId && sites.length > 12 && (
                  <span className="text-[11px] text-[#9CA3AF]">문제·노임 상위</span>
                )}
              </div>

              {displayedSites.length === 0 ? (
                <div className="bg-white rounded-[12px] border border-[#E5E7EB] py-12 text-center text-[13px] text-[#9CA3AF]">
                  오늘 운영 현황 없음
                </div>
              ) : displayedSites.map(site => (
                <SiteCard key={site.id} site={site} />
              ))}

              {!selectedSiteId && sites.length > 12 && (
                <div className="text-center text-[12px] text-[#9CA3AF] py-1">
                  전체 현장 {sites.length}개 — 현장관리에서 확인
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </PageShell>
  )
}
