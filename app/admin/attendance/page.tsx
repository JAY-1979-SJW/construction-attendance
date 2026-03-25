'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PageShell, SectionCard,
  FilterInput, FilterSelect, FilterPill,
  StatusBadge, Btn,
} from '@/components/admin/ui'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface AttendanceRecord {
  id: string
  workerId: string
  workerName: string
  workerPhone: string
  company: string
  jobTitle: string
  siteId: string
  siteName: string
  checkOutSiteName: string | null
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: string
  checkInDistance: number | null
  checkOutDistance: number | null
  checkInWithinRadius: boolean | null
  checkOutWithinRadius: boolean | null
  checkInLat: number | null
  checkInLng: number | null
  checkOutLat: number | null
  checkOutLng: number | null
  isDirectCheckIn: boolean
  exceptionReason: string | null
  adminNote: string | null
  isAutoCheckout: boolean
  hasSiteMove: boolean
  moveCount: number
  movePath: string | null
  moveEvents: { siteId: string; siteName: string; movedAt: string }[]
  workedMinutesRaw: number | null
  workedMinutesFinal: number | null
  manualAdjustedYn: boolean
  manualAdjustedReason: string | null
  dayWage: number
  monthWage: number
  totalWage: number
  hasCheckInPhoto: boolean
  hasCheckOutPhoto: boolean
}

interface PhotoRecord {
  id: string
  photoType: 'CHECK_IN' | 'CHECK_OUT'
  filePath: string
  capturedAt: string
  latitude: number | null
  longitude: number | null
}

interface SummaryData {
  total: number
  working: number
  completed: number
  missing: number
  exception: number
  needsAction: number
  todayWage: number
}

interface SiteOption {
  id: string
  name: string
}

// ── 공수 계산 ─────────────────────────────────────────────────────────────────
function calcManDay(minutes: number | null): { label: string; value: string; color: string } {
  if (minutes == null) return { label: '-', value: '-', color: '#9CA3AF' }
  const effective = minutes > 240 ? minutes - 60 : minutes
  if (effective >= 480) return { label: '1.0', value: '1.0', color: '#2563EB' }
  if (effective >= 240) return { label: '0.5', value: '0.5', color: '#D97706' }
  return { label: '0', value: '0', color: '#B91C1C' }
}

// ── 노임 포맷 ─────────────────────────────────────────────────────────────────
function fmtWage(v: number): string {
  if (v === 0) return '-'
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000) return `${Math.floor(v / 10_000)}만`
  return v.toLocaleString()
}

function fmtWageFull(v: number): string {
  if (v === 0) return '-'
  return v.toLocaleString() + '원'
}

// ── 시각 포맷 ─────────────────────────────────────────────────────────────────
function fmtTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// ── 상태 레이블 ───────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  WORKING: '출근중',
  COMPLETED: '퇴근완료',
  MISSING_CHECKOUT: '미출근',
  EXCEPTION: '확인필요',
  ADJUSTED: '수정됨',
}

// ── 확인상태 도출 ─────────────────────────────────────────────────────────────
function getConfirmStatus(r: AttendanceRecord): { label: string; color: string; bg: string } {
  if (r.status === 'EXCEPTION') return { label: '확인필요', color: '#B91C1C', bg: '#FEE2E2' }
  if (r.status === 'MISSING_CHECKOUT') return { label: '확인필요', color: '#B91C1C', bg: '#FEE2E2' }
  if (r.checkInWithinRadius === false || r.checkOutWithinRadius === false)
    return { label: '확인필요', color: '#B91C1C', bg: '#FEE2E2' }
  if (r.manualAdjustedYn || r.status === 'ADJUSTED')
    return { label: '수정됨', color: '#7C3AED', bg: '#F3E8FF' }
  return { label: '정상', color: '#16A34A', bg: '#DCFCE7' }
}

function isNeedsReview(r: AttendanceRecord): boolean {
  return (
    r.status === 'EXCEPTION' ||
    r.status === 'MISSING_CHECKOUT' ||
    r.checkInWithinRadius === false ||
    r.checkOutWithinRadius === false
  )
}

// ── GPS 뱃지 ──────────────────────────────────────────────────────────────────
function GpsBadge({ within }: { within: boolean | null }) {
  if (within === null) return <span className="text-[11px] text-[#D1D5DB]">-</span>
  return within
    ? <span className="text-[11px] font-semibold text-[#16A34A]">범위내</span>
    : <span className="text-[11px] font-semibold text-[#DC2626]">범위외</span>
}

// ── 사진 상태 아이콘 ──────────────────────────────────────────────────────────
function PhotoIcon({ has }: { has: boolean }) {
  if (has) {
    return (
      <span title="사진 있음" className="text-[#2563EB]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </span>
    )
  }
  return (
    <span title="사진 없음" className="text-[#D1D5DB]">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
        <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2"/>
      </svg>
    </span>
  )
}

// ── 검색 가능한 현장 선택 ─────────────────────────────────────────────────────
function SiteSelect({
  value, onChange, options,
}: {
  value: string
  onChange: (v: string) => void
  options: SiteOption[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.id === value)
  const filtered = query ? options.filter(o => o.name.includes(query)) : options

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
        onClick={() => { setOpen(o => !o); setQuery('') }}
        className="h-9 px-3 text-[13px] rounded-[8px] border border-[#E5E7EB] bg-white text-[#374151] hover:border-[#F97316] transition-colors flex items-center gap-2 min-w-[160px] max-w-[220px]"
      >
        <span className="flex-1 text-left truncate">{selected ? selected.name : '전체 현장'}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-[240px] bg-white border border-[#E5E7EB] rounded-[10px] shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-[#F3F4F6]">
            <input
              autoFocus
              type="text"
              placeholder="현장 검색..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full h-8 px-3 text-[13px] rounded-[6px] border border-[#E5E7EB] outline-none focus:border-[#F97316]"
            />
          </div>
          <ul className="max-h-[220px] overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setQuery('') }}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#F9FAFB] ${!value ? 'text-[#F97316] font-semibold' : 'text-[#374151]'}`}
              >
                전체 현장
              </button>
            </li>
            {filtered.map(o => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => { onChange(o.id); setOpen(false); setQuery('') }}
                  className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#F9FAFB] ${value === o.id ? 'text-[#F97316] font-semibold' : 'text-[#374151]'}`}
                >
                  {o.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-[#9CA3AF]">검색 결과 없음</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── KPI 카드 ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color, onClick, active,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 rounded-[10px] border px-4 py-3 text-left transition-all ${
        active
          ? 'border-[#F97316] bg-[#FFF7ED]'
          : 'border-[#E5E7EB] bg-white hover:border-[#F97316]/50'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="text-[11px] font-semibold text-[#6B7280] mb-1">{label}</div>
      <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: color ?? '#0F172A' }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-[#9CA3AF] mt-1">{sub}</div>}
    </button>
  )
}

// ── 패널 섹션 / 행 ────────────────────────────────────────────────────────────
function PanelSection({ label, children, warn }: {
  label: string
  children: React.ReactNode
  warn?: boolean
}) {
  return (
    <div className="mb-5">
      <div className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${warn ? 'text-[#DC2626]' : 'text-[#9CA3AF]'}`}>
        {label}
      </div>
      {children}
    </div>
  )
}

function PanelRow({ label, value, warn }: {
  label: string
  value: React.ReactNode
  warn?: boolean
}) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <span className="text-[12px] text-[#9CA3AF] w-[80px] shrink-0 pt-[1px]">{label}</span>
      <span className={`text-[13px] font-medium flex-1 ${warn ? 'text-[#DC2626]' : 'text-[#374151]'}`}>
        {value}
      </span>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
function AttendancePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const todayStr = () => {
    const d = new Date()
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    return kst.toISOString().slice(0, 10)
  }

  // URL 파라미터 초기값 (labor 페이지에서 이동 시 자동 반영)
  const initDate = searchParams.get('date') || todayStr()
  const initName = searchParams.get('name') || ''
  const autoOpenRef  = useRef(initName)
  const didFirstLoad = useRef(false)

  // 필터
  const [date, setDate]               = useState(initDate)
  const [siteId, setSiteId]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [nameSearch, setNameSearch]   = useState(initName)
  const [sortKey, setSortKey]         = useState('needsAction')

  // 데이터
  const [items, setItems]             = useState<AttendanceRecord[]>([])
  const [summary, setSummary]         = useState<SummaryData | null>(null)
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(false)

  // 상세 패널
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [photos, setPhotos]           = useState<PhotoRecord[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)

  // 수정 폼
  const [correcting, setCorrecting]   = useState(false)
  const [correctCheckIn, setCorrectCheckIn]   = useState('')
  const [correctCheckOut, setCorrectCheckOut] = useState('')
  const [workedMinutesInput, setWorkedMinutesInput] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [correctNote, setCorrectNote] = useState('')
  const [correctSaving, setCorrectSaving] = useState(false)
  const [correctError, setCorrectError] = useState('')

  // 저장 토스트
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  // 데이터 로드
  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ date, pageSize: '500' })
    if (siteId)       params.set('siteId', siteId)
    if (statusFilter) params.set('status', statusFilter)
    if (nameSearch)   params.set('name', nameSearch)

    fetch(`/api/admin/attendance?${params}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setSummary(data.data.summary)
        setSiteOptions(data.data.siteOptions ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [date, siteId, statusFilter, nameSearch, router])

  useEffect(() => { load() }, [load])

  // 사진 로드 (패널 오픈 시)
  const loadPhotos = useCallback((logId: string) => {
    setPhotosLoading(true)
    fetch(`/api/admin/attendance/photos?attendanceLogId=${logId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setPhotos(data.data.items)
        setPhotosLoading(false)
      })
      .catch(() => setPhotosLoading(false))
  }, [])

  // 패널 열기/닫기
  const openDetail = (id: string) => {
    if (selectedId === id) { setSelectedId(null); return }
    setSelectedId(id)
    setCorrecting(false)
    setCorrectCheckIn('')
    setCorrectCheckOut('')
    setWorkedMinutesInput('')
    setManualReason('')
    setCorrectNote('')
    setCorrectError('')
    setPhotos([])
    loadPhotos(id)
  }

  const closePanel = () => {
    setSelectedId(null)
    setCorrecting(false)
    setCorrectError('')
    setPhotos([])
  }

  // URL 파라미터 진입 시 첫 로드 완료 후 해당 근로자 자동 오픈
  useEffect(() => {
    if (loading) { didFirstLoad.current = true; return }
    if (!didFirstLoad.current || !autoOpenRef.current) return
    const name = autoOpenRef.current
    autoOpenRef.current = ''
    const target = items.find(r => r.workerName === name) ?? items[0]
    if (target) openDetail(target.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items])

  // 보정 저장
  const saveCorrection = async () => {
    if (!selected) return
    if (!correctCheckOut && !correctCheckIn && workedMinutesInput === '') return
    if (!manualReason) return
    setCorrectSaving(true)
    setCorrectError('')
    const body: Record<string, unknown> = {}
    if (correctCheckIn)  body.checkInAt  = new Date(`${selected.workDate}T${correctCheckIn}:00+09:00`).toISOString()
    if (correctCheckOut) body.checkOutAt = new Date(`${selected.workDate}T${correctCheckOut}:00+09:00`).toISOString()
    if (workedMinutesInput !== '') body.workedMinutesOverride = parseInt(workedMinutesInput)
    body.manualAdjustedReason = manualReason
    if (correctNote) body.adminNote = correctNote
    if (correctCheckOut || correctCheckIn) body.status = 'ADJUSTED'
    const res = await fetch(`/api/admin/attendance/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.success) {
      showToast(true, '보정이 저장됐습니다.')
      closePanel()
      load()
    } else {
      setCorrectError(data.message ?? '보정 저장에 실패했습니다. 다시 시도해 주세요.')
    }
    setCorrectSaving(false)
  }

  // 퇴근 누락 빠른 보정
  const quickCheckoutFix = async (time: string) => {
    if (!selected) return
    const res = await fetch(`/api/admin/attendance/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkOutAt: new Date(`${selected.workDate}T${time}:00+09:00`).toISOString(),
        status: 'ADJUSTED',
        adminNote: '[수동보정] 퇴근 누락 보정',
        manualAdjustedReason: '퇴근 누락 보정',
      }),
    })
    const data = await res.json()
    if (data.success) { closePanel(); load() }
  }

  // 정렬 로직
  const reviewRank = (r: AttendanceRecord) => {
    if (isNeedsReview(r)) return 0
    if (r.status === 'MISSING_CHECKOUT') return 1
    if (r.status === 'ADJUSTED' || r.manualAdjustedYn) return 2
    if (r.status === 'WORKING') return 3
    return 4
  }

  const sorted = [...items].sort((a, b) => {
    switch (sortKey) {
      case 'needsAction': return reviewRank(a) - reviewRank(b)
      case 'missing':
        return (b.status === 'MISSING_CHECKOUT' ? 1 : 0) - (a.status === 'MISSING_CHECKOUT' ? 1 : 0)
      case 'checkIn':
        return (b.checkInAt ?? '').localeCompare(a.checkInAt ?? '')
      case 'checkOut':
        return (b.checkOutAt ?? '').localeCompare(a.checkOutAt ?? '')
      case 'wage':
        return b.dayWage - a.dayWage
      case 'name':
        return a.workerName.localeCompare(b.workerName, 'ko')
      default:
        return reviewRank(a) - reviewRank(b)
    }
  })

  const selected = items.find(r => r.id === selectedId) ?? null
  const hasPanelOpen = selectedId !== null
  const checkInPhoto  = photos.find(p => p.photoType === 'CHECK_IN')
  const checkOutPhoto = photos.find(p => p.photoType === 'CHECK_OUT')
  const selectedSite  = siteOptions.find(s => s.id === siteId)

  // ── 빠른 보정 시각 임시 ref ───────────────────────────────────────────────
  const quickCheckoutRef = useRef<HTMLInputElement>(null)

  return (
    <PageShell className="flex flex-col gap-4">

      {/* ── 저장 토스트 ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-[10px] shadow-xl text-[13px] font-semibold text-white transition-all ${toast.ok ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── 제목 + 필터 바 ── */}
      <SectionCard padding={false}>
        {/* 1행: 제목 + 조회 컨트롤 */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap border-b border-[#F3F4F6]">
          <h1 className="text-[16px] font-bold text-[#0F172A] mr-1 shrink-0">출퇴근관리</h1>
          <FilterInput
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-[140px]"
          />
          <SiteSelect value={siteId} onChange={setSiteId} options={siteOptions} />
          <FilterInput
            type="text"
            placeholder="이름 검색"
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            className="w-[120px]"
          />
          <FilterSelect value={sortKey} onChange={e => setSortKey(e.target.value)}>
            <option value="needsAction">확인필요 우선</option>
            <option value="missing">미출근 우선</option>
            <option value="checkIn">출근시간 순</option>
            <option value="checkOut">퇴근시간 순</option>
            <option value="wage">노임 큰 순</option>
            <option value="name">이름순</option>
          </FilterSelect>
          <div className="flex-1" />
          <Btn variant="ghost" size="sm" onClick={load}>새로고침</Btn>
          <Btn
            variant="ghost" size="sm"
            onClick={() => {
              const p = new URLSearchParams({ date })
              if (siteId) p.set('siteId', siteId)
              window.location.href = `/api/export/attendance?${p}`
            }}
          >
            엑셀
          </Btn>
        </div>
        {/* 2행: 상태 필터 pills */}
        <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap">
          {[
            { value: '',                 label: '전체' },
            { value: 'WORKING',          label: '출근중' },
            { value: 'COMPLETED',        label: '퇴근완료' },
            { value: 'MISSING_CHECKOUT', label: '미출근' },
            { value: 'EXCEPTION',        label: '확인필요' },
            { value: 'ADJUSTED',         label: '수정됨' },
          ].map(opt => (
            <FilterPill
              key={opt.value}
              active={statusFilter === opt.value}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </FilterPill>
          ))}
          <span className="text-[12px] text-[#6B7280] ml-1">총 {total}명</span>
        </div>
      </SectionCard>

      {/* ── 요약 KPI 6개 ── */}
      {summary && (
        <div className="flex gap-3">
          <KpiCard
            label="조회 인원"
            value={summary.total}
            sub="명"
            onClick={() => setStatusFilter('')}
            active={statusFilter === ''}
          />
          <KpiCard
            label="출근중"
            value={summary.working}
            color="#16A34A"
            onClick={() => setStatusFilter('WORKING')}
            active={statusFilter === 'WORKING'}
          />
          <KpiCard
            label="퇴근완료"
            value={summary.completed}
            color="#6B7280"
            onClick={() => setStatusFilter('COMPLETED')}
            active={statusFilter === 'COMPLETED'}
          />
          <KpiCard
            label="미출근"
            value={summary.missing}
            color={summary.missing > 0 ? '#D97706' : '#6B7280'}
            onClick={() => setStatusFilter('MISSING_CHECKOUT')}
            active={statusFilter === 'MISSING_CHECKOUT'}
          />
          <KpiCard
            label="확인필요"
            value={summary.exception}
            color={summary.exception > 0 ? '#DC2626' : '#6B7280'}
            onClick={() => setStatusFilter('EXCEPTION')}
            active={statusFilter === 'EXCEPTION'}
          />
          <KpiCard
            label="오늘 총 노임"
            value={fmtWage(summary.todayWage)}
            sub={summary.todayWage > 0 ? fmtWageFull(summary.todayWage) : undefined}
            color="#F97316"
          />
        </div>
      )}

      {/* ── 현장 보조 정보 (현장 선택 시) ── */}
      {siteId && selectedSite && summary && (
        <div className="bg-white border border-[#E5E7EB] rounded-[10px] px-5 py-3 flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-[11px] text-[#9CA3AF] block">선택 현장</span>
            <span className="text-[14px] font-bold text-[#0F172A]">{selectedSite.name}</span>
          </div>
          <div className="h-8 w-px bg-[#F3F4F6]" />
          <div>
            <span className="text-[11px] text-[#9CA3AF] block">오늘 출근</span>
            <span className="text-[14px] font-semibold text-[#16A34A]">
              {summary.working + summary.completed}명
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#9CA3AF] block">미출근</span>
            <span className={`text-[14px] font-semibold ${summary.missing > 0 ? 'text-[#D97706]' : 'text-[#6B7280]'}`}>
              {summary.missing}명
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#9CA3AF] block">확인필요</span>
            <span className={`text-[14px] font-semibold ${summary.exception > 0 ? 'text-[#DC2626]' : 'text-[#6B7280]'}`}>
              {summary.exception}건
            </span>
          </div>
          <div className="h-8 w-px bg-[#F3F4F6]" />
          <div>
            <span className="text-[11px] text-[#9CA3AF] block">오늘 현장 총 노임</span>
            <span className="text-[14px] font-bold text-[#F97316]">{fmtWageFull(summary.todayWage)}</span>
          </div>
        </div>
      )}

      {/* ── 2-column 본문 ── */}
      <div className="flex gap-4 items-start">

        {/* 근로자 목록 */}
        <div className={`flex-1 min-w-0 transition-all ${hasPanelOpen ? 'max-w-[calc(100%-444px)]' : ''}`}>
          <SectionCard padding={false}>
            {loading ? (
              <div className="py-12 text-center text-[13px] text-[#9CA3AF]">로딩 중...</div>
            ) : sorted.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[#9CA3AF]">조회된 기록이 없습니다</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]" style={{ minWidth: 780 }}>
                  <thead>
                    <tr className="border-b border-[#F3F4F6] bg-[#FAFAFA]">
                      {['이름', '현장', '출근', '퇴근', '근무상태', '공수', '일노임', '출사', '퇴사', '확인상태'].map(h => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(item => {
                      const md = calcManDay(item.workedMinutesFinal ?? item.workedMinutesRaw)
                      const cs = getConfirmStatus(item)
                      const isSelected = item.id === selectedId
                      const rowBg =
                        isSelected        ? 'bg-[#FFF7ED]' :
                        isNeedsReview(item) ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]' :
                        (item.manualAdjustedYn || item.status === 'ADJUSTED') ? 'bg-[#FAF5FF] hover:bg-[#F3E8FF]' :
                        'hover:bg-[#F9FAFB]'
                      return (
                        <tr
                          key={item.id}
                          onClick={() => openDetail(item.id)}
                          className={`border-b border-[#F9FAFB] cursor-pointer transition-colors ${rowBg}`}
                          style={isSelected ? { borderLeft: '3px solid #F97316' } : {}}
                        >
                          {/* 이름 */}
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-[#111827] whitespace-nowrap">{item.workerName}</div>
                            {item.company && (
                              <div className="text-[11px] text-[#9CA3AF]">{item.company}</div>
                            )}
                          </td>
                          {/* 현장 */}
                          <td className="px-3 py-2.5 max-w-[100px]">
                            <div className="text-[#6B7280] truncate text-[12px]">{item.siteName}</div>
                            {item.hasSiteMove && (
                              <span className="text-[10px] bg-[#EFF6FF] text-[#2563EB] px-1 py-[1px] rounded">
                                +{item.moveCount}이동
                              </span>
                            )}
                          </td>
                          {/* 출근 */}
                          <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                            <span className={item.checkInWithinRadius === false ? 'text-[#DC2626]' : 'text-[#374151]'}>
                              {fmtTime(item.checkInAt)}
                            </span>
                            {item.checkInWithinRadius === false && (
                              <span className="ml-1 text-[9px] text-[#DC2626] font-bold">GPS!</span>
                            )}
                          </td>
                          {/* 퇴근 */}
                          <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                            {item.checkOutAt ? (
                              <span className={item.checkOutWithinRadius === false ? 'text-[#DC2626]' : 'text-[#374151]'}>
                                {fmtTime(item.checkOutAt)}
                                {item.isAutoCheckout && (
                                  <span className="ml-1 text-[9px] bg-[#FEE2E2] text-[#B91C1C] px-1 rounded font-bold">AUTO</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[#D1D5DB]">-</span>
                            )}
                          </td>
                          {/* 근무상태 */}
                          <td className="px-3 py-2.5">
                            <StatusBadge status={item.status} label={STATUS_LABEL[item.status] ?? item.status} />
                          </td>
                          {/* 공수 */}
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className="text-[13px] font-bold" style={{ color: md.color }}>{md.value}</span>
                          </td>
                          {/* 일노임 */}
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {item.dayWage > 0 ? (
                              <span className="font-semibold text-[#374151]">{fmtWage(item.dayWage)}</span>
                            ) : (
                              <span className="text-[#D1D5DB]">-</span>
                            )}
                          </td>
                          {/* 출근사진 */}
                          <td className="px-3 py-2.5 text-center">
                            <PhotoIcon has={item.hasCheckInPhoto} />
                          </td>
                          {/* 퇴근사진 */}
                          <td className="px-3 py-2.5 text-center">
                            <PhotoIcon has={item.hasCheckOutPhoto} />
                          </td>
                          {/* 확인상태 */}
                          <td className="px-3 py-2.5">
                            <span
                              className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                              style={{ color: cs.color, backgroundColor: cs.bg }}
                            >
                              {cs.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* 상세 패널 (sticky) */}
        {hasPanelOpen && selected && (
          <div className="w-[420px] shrink-0 sticky top-4">
            <SectionCard padding={false} className="overflow-hidden">
              {/* 오렌지 4px 라인 */}
              <div className="h-1 bg-[#F97316]" />

              {/* 패널 헤더 */}
              <div className="px-5 py-3.5 flex items-start justify-between border-b border-[#E5E7EB]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-[#0F172A] leading-snug shrink-0">
                      {selected.workerName}
                    </h3>
                    <StatusBadge status={selected.status} label={STATUS_LABEL[selected.status] ?? selected.status} />
                    {selected.isAutoCheckout && (
                      <span className="text-[10px] bg-[#FEE2E2] text-[#B91C1C] px-1.5 py-[2px] rounded font-bold">AUTO</span>
                    )}
                    {selected.manualAdjustedYn && (
                      <span className="text-[10px] bg-[#F3E8FF] text-[#7C3AED] px-1.5 py-[2px] rounded font-bold">수동보정</span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                    {selected.workDate} · {selected.siteName}
                  </p>
                </div>
                <button
                  onClick={closePanel}
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors shrink-0 ml-2 mt-0.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* 패널 본문 */}
              <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>

                {/* A. 기본 정보 */}
                <PanelSection label="A. 기본 정보">
                  <PanelRow label="소속" value={selected.company || '-'} />
                  <PanelRow label="직종" value={selected.jobTitle || '-'} />
                  <PanelRow label="연락처" value={selected.workerPhone || '-'} />
                  <div className="h-px bg-[#F3F4F6] my-2" />
                  <PanelRow
                    label="이번달 누적"
                    value={<span className="font-semibold text-[#374151]">{fmtWageFull(selected.monthWage)}</span>}
                  />
                  <PanelRow
                    label="전체 누적"
                    value={<span className="text-[#6B7280]">{fmtWageFull(selected.totalWage)}</span>}
                  />
                </PanelSection>

                {/* B. 출퇴근 정보 */}
                <PanelSection label="B. 출퇴근 정보" warn={isNeedsReview(selected)}>
                  {selected.exceptionReason && (
                    <div className="mb-3 rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5] px-3 py-2">
                      <div className="text-[11px] font-bold text-[#DC2626] mb-0.5">예외 사유</div>
                      <div className="text-[13px] text-[#7F1D1D]">{selected.exceptionReason}</div>
                    </div>
                  )}
                  <PanelRow
                    label="출근 시각"
                    value={fmtDateTime(selected.checkInAt)}
                    warn={!selected.checkInAt}
                  />
                  <PanelRow
                    label="퇴근 시각"
                    value={selected.checkOutAt ? fmtDateTime(selected.checkOutAt) : '미기록'}
                    warn={!selected.checkOutAt}
                  />
                  <div className="h-px bg-[#F3F4F6] my-2" />
                  <PanelRow
                    label="출근 GPS"
                    value={
                      <span className="flex items-center gap-2">
                        <GpsBadge within={selected.checkInWithinRadius} />
                        {selected.checkInDistance != null && (
                          <span className="text-[11px] text-[#6B7280]">({selected.checkInDistance}m)</span>
                        )}
                      </span>
                    }
                  />
                  <PanelRow
                    label="퇴근 GPS"
                    value={
                      <span className="flex items-center gap-2">
                        <GpsBadge within={selected.checkOutWithinRadius} />
                        {selected.checkOutDistance != null && (
                          <span className="text-[11px] text-[#6B7280]">({selected.checkOutDistance}m)</span>
                        )}
                      </span>
                    }
                  />
                  <PanelRow
                    label="기록 방식"
                    value={selected.isDirectCheckIn ? '직접입력 (수동)' : 'QR 스캔 (자동)'}
                  />
                  {selected.hasSiteMove && (
                    <>
                      <div className="h-px bg-[#F3F4F6] my-2" />
                      <PanelRow
                        label="현장 이동"
                        value={<span className="text-[12px] leading-relaxed">{selected.movePath}</span>}
                      />
                    </>
                  )}
                  {selected.manualAdjustedYn && (
                    <>
                      <div className="h-px bg-[#F3F4F6] my-2" />
                      <PanelRow
                        label="수정 이력"
                        value={
                          <span className="flex items-center gap-2">
                            <span className="text-[#7C3AED]">있음 — {selected.manualAdjustedReason || '사유 없음'}</span>
                            <a
                              href={`/admin/corrections?targetId=${selected.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-secondary-brand underline whitespace-nowrap"
                            >
                              전체 이력 →
                            </a>
                          </span>
                        }
                      />
                    </>
                  )}
                </PanelSection>

                {/* C. 사진 증빙 */}
                <PanelSection label="C. 사진 증빙">
                  {photosLoading ? (
                    <div className="text-[12px] text-[#9CA3AF] py-2">사진 로딩 중...</div>
                  ) : (
                    <div className="flex gap-3">
                      {/* 출근 사진 */}
                      <div className="flex-1">
                        <div className="text-[11px] text-[#6B7280] mb-1.5 font-medium">출근 사진</div>
                        {checkInPhoto ? (
                          <div className="rounded-[8px] overflow-hidden border border-[#E5E7EB]">
                            <img
                              src={`/api/admin/attendance/photos/${checkInPhoto.id}/file`}
                              alt="출근 사진"
                              className="w-full h-[100px] object-cover"
                            />
                            <div className="px-2 py-1 text-[11px] text-[#6B7280] bg-[#F9FAFB]">
                              {fmtDateTime(checkInPhoto.capturedAt)}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[8px] border border-dashed border-[#E5E7EB] h-[80px] flex items-center justify-center text-[12px] text-[#D1D5DB] bg-[#F9FAFB]">
                            없음
                          </div>
                        )}
                      </div>
                      {/* 퇴근 사진 */}
                      <div className="flex-1">
                        <div className="text-[11px] text-[#6B7280] mb-1.5 font-medium">퇴근 사진</div>
                        {checkOutPhoto ? (
                          <div className="rounded-[8px] overflow-hidden border border-[#E5E7EB]">
                            <img
                              src={`/api/admin/attendance/photos/${checkOutPhoto.id}/file`}
                              alt="퇴근 사진"
                              className="w-full h-[100px] object-cover"
                            />
                            <div className="px-2 py-1 text-[11px] text-[#6B7280] bg-[#F9FAFB]">
                              {fmtDateTime(checkOutPhoto.capturedAt)}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[8px] border border-dashed border-[#E5E7EB] h-[80px] flex items-center justify-center text-[12px] text-[#D1D5DB] bg-[#F9FAFB]">
                            없음
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {selected.adminNote && (
                    <div className="mt-3 rounded-[8px] bg-[#FFF7ED] border border-[#FDE68A] px-3 py-2">
                      <div className="text-[11px] font-bold text-[#9CA3AF] mb-0.5">관리자 메모</div>
                      <div className="text-[13px] text-[#374151]">{selected.adminNote}</div>
                    </div>
                  )}
                </PanelSection>

                {/* D. 근무 인정 */}
                <PanelSection label="D. 근무 인정">
                  {(() => {
                    const min = selected.workedMinutesFinal ?? selected.workedMinutesRaw
                    const md  = calcManDay(min)
                    return (
                      <>
                        <PanelRow
                          label="실 근무"
                          value={
                            min != null
                              ? `${min}분 (${Math.floor(min / 60)}시간 ${min % 60}분)`
                              : '집계 전'
                          }
                        />
                        <PanelRow
                          label="인정 공수"
                          value={<span style={{ color: md.color, fontWeight: 700 }}>{md.label} 공수</span>}
                          warn={md.value === '0'}
                        />
                        {selected.manualAdjustedYn && selected.manualAdjustedReason && (
                          <PanelRow
                            label="보정 사유"
                            value={<span className="text-[#7C3AED]">{selected.manualAdjustedReason}</span>}
                          />
                        )}
                        <div className="h-px bg-[#F3F4F6] my-2" />
                        <PanelRow
                          label="일 노임"
                          value={<span className="font-bold text-[#F97316]">{fmtWageFull(selected.dayWage)}</span>}
                        />
                        <PanelRow label="월 누적" value={fmtWageFull(selected.monthWage)} />
                        <PanelRow label="전체 누적" value={fmtWageFull(selected.totalWage)} />
                      </>
                    )
                  })()}
                </PanelSection>

                {/* E. 관리자 처리 */}
                <PanelSection label="E. 관리자 처리">

                  {!correcting && (
                    <div className="flex flex-col gap-2">
                      {/* 미퇴근 빠른 보정 */}
                      {selected.status === 'MISSING_CHECKOUT' && (
                        <div className="rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5] px-3 py-3">
                          <div className="text-[11px] font-bold text-[#DC2626] mb-2">퇴근 누락 빠른 보정</div>
                          <div className="flex items-center gap-2">
                            <input
                              ref={quickCheckoutRef}
                              type="time"
                              className="h-8 px-2 text-[13px] border border-[#E5E7EB] rounded-[6px] outline-none focus:border-[#DC2626] bg-white w-[110px]"
                              defaultValue="17:00"
                            />
                            <button
                              onClick={() => {
                                const t = quickCheckoutRef.current?.value
                                if (t) quickCheckoutFix(t)
                              }}
                              className="flex-1 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[12px] font-semibold rounded-[6px] border-none cursor-pointer transition-colors"
                            >
                              퇴근 시각 보정
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => setCorrecting(true)}
                        className="w-full py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-semibold rounded-[8px] transition-colors border-none cursor-pointer"
                      >
                        출퇴근 시각 / 공수 수정
                      </button>
                    </div>
                  )}

                  {correcting && (
                    <div className="rounded-[10px] bg-[#F5F3FF] border border-[#DDD6FE] px-4 py-4">
                      <div className="text-[11px] font-bold text-[#7C3AED] mb-3">수동 보정</div>

                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[12px] text-[#6B7280] w-[60px] shrink-0">출근</span>
                        <input
                          type="time"
                          value={correctCheckIn}
                          onChange={e => setCorrectCheckIn(e.target.value)}
                          className="h-8 px-2 text-[13px] border border-[#E5E7EB] rounded-[6px] outline-none focus:border-[#7C3AED] bg-white w-[120px]"
                        />
                        <span className="text-[11px] text-[#9CA3AF]">현재 {fmtTime(selected.checkInAt)}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[12px] text-[#6B7280] w-[60px] shrink-0">퇴근</span>
                        <input
                          type="time"
                          value={correctCheckOut}
                          onChange={e => setCorrectCheckOut(e.target.value)}
                          className="h-8 px-2 text-[13px] border border-[#E5E7EB] rounded-[6px] outline-none focus:border-[#7C3AED] bg-white w-[120px]"
                        />
                        <span className="text-[11px] text-[#9CA3AF]">현재 {fmtTime(selected.checkOutAt)}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[12px] text-[#6B7280] w-[60px] shrink-0">공수(분)</span>
                        <input
                          type="number"
                          min="0"
                          max="1440"
                          value={workedMinutesInput}
                          onChange={e => setWorkedMinutesInput(e.target.value)}
                          className="h-8 px-2 text-[13px] border border-[#E5E7EB] rounded-[6px] outline-none focus:border-[#7C3AED] bg-white w-[80px]"
                          placeholder="분"
                        />
                        {workedMinutesInput && (
                          <span className="text-[11px] text-[#7C3AED] font-semibold">
                            → {calcManDay(parseInt(workedMinutesInput)).label} 공수
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[12px] text-[#6B7280] w-[60px] shrink-0">
                          사유 <span className="text-[#DC2626]">*</span>
                        </span>
                        <input
                          type="text"
                          value={manualReason}
                          onChange={e => setManualReason(e.target.value)}
                          className="h-8 px-2 text-[13px] border border-[#E5E7EB] rounded-[6px] outline-none focus:border-[#7C3AED] bg-white flex-1"
                          placeholder="수정 사유 (필수)"
                        />
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[12px] text-[#6B7280] w-[60px] shrink-0">메모</span>
                        <input
                          type="text"
                          value={correctNote}
                          onChange={e => setCorrectNote(e.target.value)}
                          className="h-8 px-2 text-[13px] border border-[#E5E7EB] rounded-[6px] outline-none focus:border-[#7C3AED] bg-white flex-1"
                          placeholder="관리자 메모 (선택)"
                        />
                      </div>

                      <div className="text-[11px] text-[#9CA3AF] mb-3 flex items-center justify-between">
                        <span>보정 이력은 감사 로그에 기록됩니다.</span>
                        <a
                          href={`/admin/corrections?targetId=${selected.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-secondary-brand underline"
                        >
                          이력 보기 →
                        </a>
                      </div>

                      {correctError && (
                        <div className="mb-3 rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5] px-3 py-2 text-[12px] text-[#DC2626]">
                          {correctError}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={saveCorrection}
                          disabled={
                            (!correctCheckOut && !correctCheckIn && workedMinutesInput === '') ||
                            !manualReason ||
                            correctSaving
                          }
                          className="flex-1 py-2 bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-[8px] border-none cursor-pointer transition-colors"
                        >
                          {correctSaving ? '저장 중...' : '보정 저장'}
                        </button>
                        <button
                          onClick={() => setCorrecting(false)}
                          className="px-4 py-2 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] cursor-pointer bg-white transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </PanelSection>

              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </PageShell>
  )
}

export default function AdminAttendancePage() {
  return (
    <Suspense>
      <AttendancePageInner />
    </Suspense>
  )
}
