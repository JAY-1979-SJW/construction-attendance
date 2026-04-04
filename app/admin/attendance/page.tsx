'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PageShell, SectionCard, PageHeader,
  FilterInput, FilterSelect, FilterPill,
  AdminTable, AdminTr, AdminTd, EmptyRow,
  StatusBadge, Btn,
  FormInput, FormTextarea, ModalFooter,
  FloatingToast, Modal,
  MobileCardList, MobileCard, MobileCardField, MobileCardFields,
  BulkToolbar,
} from '@/components/admin/ui'
import AttendanceCalendar from '@/components/admin/AttendanceCalendar'
import { useBulkSelection } from '@/lib/hooks/useBulkSelection'

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
  unassigned: number
  notCheckedIn: number
  siteMismatch: number
}

interface WorkerBrief {
  id: string
  name: string
  phone: string
  jobTitle: string
  activeSites: { id: string; name: string; isPrimary?: boolean }[]
  todayAttendance: { siteId: string; siteName: string; checkInAt: string | null; checkOutAt: string | null; status: string } | null
  accountStatus: string
  isActive: boolean
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

// ── 퇴근누락 의심 기준: 오후 9시(KST) 이후 WORKING이면 퇴근누락 의심 ──
const CHECKOUT_SUSPECT_HOUR = 21

// ── 확인상태 + 사유 도출 ─────────────────────────────────────────────────────
interface ConfirmResult { label: string; reason: string; color: string; bg: string }

function getConfirmStatus(r: AttendanceRecord, workers?: WorkerBrief[]): ConfirmResult {
  const reasons: string[] = []

  // 현장불일치
  if (workers) {
    const w = workers.find(w2 => w2.id === r.workerId)
    const primary = w?.activeSites.find(s => s.isPrimary)
    if (primary && primary.id !== r.siteId) reasons.push('현장불일치')
    if (w && w.activeSites.length === 0) reasons.push('미배정')
  }

  // 퇴근누락 의심 (WORKING 상태 + 현재 시각이 기준 초과)
  if (r.status === 'WORKING' && !r.checkOutAt) {
    const now = new Date()
    const kstHour = (now.getUTCHours() + 9) % 24
    if (kstHour >= CHECKOUT_SUSPECT_HOUR) reasons.push('퇴근누락')
  }

  if (r.status === 'MISSING_CHECKOUT') reasons.push('퇴근누락')
  if (r.status === 'EXCEPTION') reasons.push('예외')
  if (r.checkInWithinRadius === false) reasons.push('GPS범위외')
  if (r.checkOutWithinRadius === false) reasons.push('퇴근GPS')
  if (r.manualAdjustedYn || r.status === 'ADJUSTED') {
    if (reasons.length === 0) return { label: '수정됨', reason: '수동수정', color: '#7C3AED', bg: '#F3E8FF' }
    reasons.push('수동수정')
  }

  if (reasons.length > 0) {
    return { label: '확인필요', reason: reasons[0], color: '#B91C1C', bg: '#FEE2E2' }
  }
  return { label: '정상', reason: '', color: '#16A34A', bg: '#DCFCE7' }
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
    ? <span className="text-[11px] font-semibold text-status-working">범위내</span>
    : <span className="text-[11px] font-semibold text-status-rejected">범위외</span>
}

// ── 사진 상태 아이콘 ──────────────────────────────────────────────────────────
function PhotoIcon({ has }: { has: boolean }) {
  if (has) {
    return (
      <span title="사진 있음" className="text-status-info">
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
        className="h-9 px-3 text-[13px] rounded-[8px] border border-brand bg-card text-body-brand hover:border-accent transition-colors flex items-center gap-2 min-w-[160px] max-w-[220px]"
      >
        <span className="flex-1 text-left truncate">{selected ? selected.name : '전체 현장'}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-[240px] bg-card border border-brand rounded-[12px] shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-brand">
            <input
              autoFocus
              type="text"
              placeholder="현장 검색..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full h-9 px-3 text-[13px] rounded-[6px] border border-brand outline-none focus:border-accent"
            />
          </div>
          <ul className="max-h-[220px] overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setQuery('') }}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface ${!value ? 'text-accent font-semibold' : 'text-body-brand'}`}
              >
                전체 현장
              </button>
            </li>
            {filtered.map(o => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => { onChange(o.id); setOpen(false); setQuery('') }}
                  className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface ${value === o.id ? 'text-accent font-semibold' : 'text-body-brand'}`}
                >
                  {o.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-muted2-brand">검색 결과 없음</li>
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
          ? 'border-accent bg-accent-light'
          : 'border-brand bg-card hover:border-accent/50'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="text-[11px] font-semibold text-muted-brand mb-1">{label}</div>
      <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: color ?? '#0F172A' }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted2-brand mt-1">{sub}</div>}
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
      <div className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${warn ? 'text-status-rejected' : 'text-muted2-brand'}`}>
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
      <span className="text-[12px] text-muted2-brand w-[80px] shrink-0 pt-[1px]">{label}</span>
      <span className={`text-[13px] font-medium flex-1 ${warn ? 'text-status-rejected' : 'text-body-brand'}`}>
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
  const [allWorkers, setAllWorkers]   = useState<WorkerBrief[]>([])
  const [summary, setSummary]         = useState<SummaryData | null>(null)
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(false)

  // 상세 패널
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [photos, setPhotos]           = useState<PhotoRecord[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)

  // 운영 메모
  const [memoText, setMemoText]       = useState('')
  const [memoSaving, setMemoSaving]   = useState(false)

  // 수정 폼
  const [correcting, setCorrecting]   = useState(false)
  const [correctCheckIn, setCorrectCheckIn]   = useState('')
  const [correctCheckOut, setCorrectCheckOut] = useState('')
  const [workedMinutesInput, setWorkedMinutesInput] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [correctNote, setCorrectNote] = useState('')
  const [correctSaving, setCorrectSaving] = useState(false)
  const [correctError, setCorrectError] = useState('')

  // 대리 출근 등록 모달
  const [proxyOpen, setProxyOpen]           = useState(false)
  const [proxyWorkerId, setProxyWorkerId]   = useState('')
  const [proxySiteId, setProxySiteId]       = useState('')
  const [proxyDate, setProxyDate]           = useState('')
  const [proxyCheckIn, setProxyCheckIn]     = useState('08:00')
  const [proxyCheckOut, setProxyCheckOut]   = useState('')
  const [proxyReason, setProxyReason]       = useState('')
  const [proxyNote, setProxyNote]           = useState('')
  const [proxySaving, setProxySaving]       = useState(false)
  const [proxyError, setProxyError]         = useState('')

  // 대량 처리
  const { selectedIds, toggleSelect, clearSelection } = useBulkSelection()
  const [bulkCheckoutTime, setBulkCheckoutTime] = useState('17:00')
  const [bulkSaving, setBulkSaving] = useState(false)

  // 저장 토스트
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [viewTab, setViewTab] = useState<'list' | 'calendar'>('list')
  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  // 데이터 로드
  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ date, pageSize: '500' })
    if (siteId)       params.set('siteId', siteId)
    if (statusFilter && !['NOT_CHECKED_IN', 'UNASSIGNED', 'SITE_MISMATCH'].includes(statusFilter)) {
      params.set('status', statusFilter)
    }
    if (nameSearch)   params.set('name', nameSearch)

    Promise.all([
      fetch(`/api/admin/attendance?${params}`).then(r => r.json()),
      fetch('/api/admin/workers?pageSize=500').then(r => r.json()),
    ]).then(([attData, wkData]) => {
      if (!attData.success) { router.push('/admin/login'); return }
      setItems(attData.data.items)
      setTotal(attData.data.total)
      setSiteOptions(attData.data.siteOptions ?? [])

      const workers: WorkerBrief[] = (wkData.data?.items ?? []).filter((w: WorkerBrief) => w.isActive && w.accountStatus === 'APPROVED')
      setAllWorkers(workers)

      // 확장 요약 계산
      const checkedInWorkerIds = new Set(attData.data.items.map((i: AttendanceRecord) => i.workerId))
      const unassigned = workers.filter((w: WorkerBrief) => w.activeSites.length === 0).length
      const assignedNotCheckedIn = workers.filter((w: WorkerBrief) => w.activeSites.length > 0 && !checkedInWorkerIds.has(w.id)).length
      const siteMismatch = attData.data.items.filter((i: AttendanceRecord) => {
        const w = workers.find((w2: WorkerBrief) => w2.id === i.workerId)
        if (!w) return false
        const primary = w.activeSites.find((s: { isPrimary?: boolean }) => s.isPrimary)
        return primary && primary.id !== i.siteId
      }).length

      setSummary({
        ...attData.data.summary,
        unassigned,
        notCheckedIn: assignedNotCheckedIn,
        siteMismatch,
      })
      setLoading(false)
    }).catch(() => setLoading(false))
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
    setMemoText('')
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

  // 대리 출근 등록 모달 열기
  const openProxyModal = () => {
    const d = new Date(); const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    setProxyDate(kst.toISOString().slice(0, 10))
    setProxyWorkerId('')
    setProxySiteId(siteId || '')
    setProxyCheckIn('08:00')
    setProxyCheckOut('')
    setProxyReason('')
    setProxyNote('')
    setProxyError('')
    setProxyOpen(true)
  }

  // 대리 출근 등록 저장
  const saveProxy = async () => {
    setProxySaving(true)
    setProxyError('')
    try {
      const res = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: proxyWorkerId,
          siteId: proxySiteId,
          workDate: proxyDate,
          checkInAt: proxyCheckIn,
          checkOutAt: proxyCheckOut || undefined,
          reason: proxyReason,
          adminNote: proxyNote || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setProxyOpen(false)
        showToast(true, '대리 출근이 등록됐습니다.')
        load()
      } else {
        setProxyError(data.message ?? '등록에 실패했습니다.')
      }
    } catch {
      setProxyError('서버 연결 오류')
    } finally {
      setProxySaving(false)
    }
  }

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

  // 대량 퇴근 보정
  const bulkAdjust = async () => {
    if (!selectedIds.size) return
    setBulkSaving(true)
    try {
      const res = await fetch('/api/admin/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: 'adjust-checkout',
          checkOutTime: bulkCheckoutTime,
          reason: '퇴근 누락 대량 보정',
        }),
      })
      const data = await res.json()
      if (data.success) {
        const { succeeded, failed } = data.data
        clearSelection()
        showToast(true, `대량 퇴근 보정 완료: ${succeeded}건 성공${failed > 0 ? `, ${failed}건 실패` : ''}`)
        load()
      } else {
        showToast(false, data.message ?? '대량 보정에 실패했습니다.')
      }
    } catch {
      showToast(false, '서버 연결 오류')
    } finally {
      setBulkSaving(false)
    }
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

  // 미출근/미배정/현장불일치 필터용 가상 행 생성
  const checkedInWorkerIds = new Set(items.map(i => i.workerId))
  const notCheckedInWorkers = allWorkers.filter(w => w.activeSites.length > 0 && !checkedInWorkerIds.has(w.id))
  const unassignedWorkers = allWorkers.filter(w => w.activeSites.length === 0)
  const siteMismatchItems = items.filter(i => {
    const w = allWorkers.find(w2 => w2.id === i.workerId)
    const primary = w?.activeSites.find(s => s.isPrimary)
    return primary && primary.id !== i.siteId
  })

  // 필터별 표시할 아이템 결정
  const displayItems: AttendanceRecord[] =
    statusFilter === 'NOT_CHECKED_IN' ? [] :
    statusFilter === 'UNASSIGNED' ? [] :
    statusFilter === 'SITE_MISMATCH' ? siteMismatchItems :
    items

  const sorted = [...displayItems].sort((a, b) => {
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
        <FloatingToast message={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />
      )}

      <PageHeader
        title="출퇴근관리"
        description="날짜별 출퇴근 현황을 관리합니다"
      />

      {/* ── 뷰 탭 ── */}
      <div className="flex bg-card rounded-xl border border-brand overflow-hidden">
        {[
          { key: 'list' as const, label: '리스트' },
          { key: 'calendar' as const, label: '캘린더' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setViewTab(t.key)}
            className={`flex-1 py-2.5 text-[13px] font-semibold border-none cursor-pointer transition-colors ${
              viewTab === t.key ? 'bg-brand-accent text-white' : 'bg-card text-muted-brand hover:bg-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 캘린더 뷰 ── */}
      {viewTab === 'calendar' && (
        <SectionCard>
          <AttendanceCalendar siteId={siteId || undefined} />
        </SectionCard>
      )}

      {/* ── 리스트 뷰: 필터 바 ── */}
      {viewTab === 'list' && <>
      {/* ── 필터 바 ── */}
      <SectionCard padding={false}>
        {/* 1행: 조회 컨트롤 */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap border-b border-brand">
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
          <Btn variant="primary" size="sm" onClick={openProxyModal}>대리 등록</Btn>
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
            { value: 'WORKING',          label: '근무중' },
            { value: 'COMPLETED',        label: '퇴근완료' },
            { value: 'NOT_CHECKED_IN',   label: '미출근' },
            { value: 'UNASSIGNED',       label: '미배정' },
            { value: 'SITE_MISMATCH',    label: '현장불일치' },
            { value: 'EXCEPTION',        label: '확인필요' },
          ].map(opt => (
            <FilterPill
              key={opt.value}
              active={statusFilter === opt.value}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </FilterPill>
          ))}
          <span className="text-[12px] text-muted-brand ml-1">총 {total}명</span>
        </div>
      </SectionCard>

      {/* ── 요약 KPI ── */}
      {summary && (
        <div className="flex gap-3">
          <KpiCard
            label="오늘 출근"
            value={summary.total}
            sub="명"
            onClick={() => setStatusFilter('')}
            active={statusFilter === ''}
          />
          <KpiCard
            label="근무중"
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
            value={summary.notCheckedIn}
            color={summary.notCheckedIn > 0 ? '#D97706' : '#6B7280'}
            onClick={() => setStatusFilter('NOT_CHECKED_IN')}
            active={statusFilter === 'NOT_CHECKED_IN'}
          />
          {summary.unassigned > 0 && (
            <KpiCard
              label="미배정"
              value={summary.unassigned}
              color="#D97706"
              onClick={() => setStatusFilter('UNASSIGNED')}
              active={statusFilter === 'UNASSIGNED'}
            />
          )}
        </div>
      )}

      {/* ── 현장 보조 정보 (현장 선택 시) ── */}
      {siteId && selectedSite && summary && (
        <div className="bg-card border border-brand rounded-[12px] px-5 py-3 flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-[11px] text-muted2-brand block">선택 현장</span>
            <span className="text-[14px] font-bold text-title-brand">{selectedSite.name}</span>
          </div>
          <div className="h-8 w-px bg-footer" />
          <div>
            <span className="text-[11px] text-muted2-brand block">오늘 출근</span>
            <span className="text-[14px] font-semibold text-status-working">
              {summary.working + summary.completed}명
            </span>
          </div>
          <div>
            <span className="text-[11px] text-muted2-brand block">미출근</span>
            <span className={`text-[14px] font-semibold ${summary.missing > 0 ? 'text-status-exception' : 'text-muted-brand'}`}>
              {summary.missing}명
            </span>
          </div>
          <div>
            <span className="text-[11px] text-muted2-brand block">확인필요</span>
            <span className={`text-[14px] font-semibold ${summary.exception > 0 ? 'text-status-rejected' : 'text-muted-brand'}`}>
              {summary.exception}건
            </span>
          </div>
          <div className="h-8 w-px bg-footer" />
          <div>
            <span className="text-[11px] text-muted2-brand block">오늘 현장 총 노임</span>
            <span className="text-[14px] font-bold text-accent">{fmtWageFull(summary.todayWage)}</span>
          </div>
        </div>
      )}

      {/* ── 대량 처리 툴바 ── */}
      <BulkToolbar count={selectedIds.size} onClear={clearSelection} disabled={bulkSaving}>
        <span className="text-[12px] text-muted-brand">퇴근 시각</span>
        <input
          type="time"
          value={bulkCheckoutTime}
          onChange={e => setBulkCheckoutTime(e.target.value)}
          className="h-8 px-2 text-[13px] border border-brand rounded-[6px] outline-none focus:border-accent bg-card w-[100px]"
        />
        <button
          onClick={bulkAdjust}
          disabled={bulkSaving}
          className="px-4 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[12px] font-semibold rounded-[8px] border-none cursor-pointer disabled:opacity-50 transition-colors"
        >
          {bulkSaving ? '처리 중...' : '대량 퇴근 보정'}
        </button>
      </BulkToolbar>

      {/* ── 2-column 본문 ── */}
      <div className="flex gap-4 items-start">

        {/* 근로자 목록 */}
        <div className={`flex-1 min-w-0 transition-all ${hasPanelOpen ? 'max-w-[calc(100%-444px)]' : ''}`}>
          <SectionCard padding={false}>
            {loading ? (
              <div className="py-12 text-center text-[13px] text-muted2-brand">로딩 중...</div>
            ) : (
              <MobileCardList
                items={sorted}
                keyExtractor={(item) => item.id}
                emptyMessage="조회된 기록이 없습니다"
                renderCard={(item) => {
                  const cs = getConfirmStatus(item, allWorkers)
                  return (
                    <MobileCard
                      title={item.workerName}
                      subtitle={`${item.jobTitle} · ${item.siteName}`}
                      badge={<StatusBadge status={item.status} label={STATUS_LABEL[item.status] ?? item.status} />}
                      onClick={() => openDetail(item.id)}
                    >
                      {item.status === 'MISSING_CHECKOUT' && (
                        <label
                          className="flex items-center gap-1.5 text-[12px] text-muted-brand mb-1 cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="w-4 h-4 cursor-pointer accent-[#DC2626]"
                          />
                          선택
                        </label>
                      )}
                      <MobileCardFields>
                        <MobileCardField
                          label="출근"
                          value={
                            <span className={item.checkInWithinRadius === false ? 'text-status-rejected' : ''}>
                              {fmtTime(item.checkInAt)}
                            </span>
                          }
                        />
                        <MobileCardField
                          label="퇴근"
                          value={fmtTime(item.checkOutAt)}
                        />
                        <MobileCardField
                          label="확인"
                          value={
                            <span
                              className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                              style={{ color: cs.color, backgroundColor: cs.bg }}
                            >
                              {cs.label}{cs.reason && ` · ${cs.reason}`}
                            </span>
                          }
                        />
                      </MobileCardFields>
                    </MobileCard>
                  )
                }}
                renderTable={() => (
                  sorted.length === 0 ? (
                    <AdminTable headers={['', '이름', '직종', '주배정현장', '출근현장', '출근', '퇴근', '상태', '확인']}>
                      <EmptyRow colSpan={9} message="조회된 기록이 없습니다" />
                    </AdminTable>
                  ) : (
                    <AdminTable headers={['', '이름', '직종', '주배정현장', '출근현장', '출근', '퇴근', '상태', '확인']}>

                          {sorted.map(item => {
                            const md = calcManDay(item.workedMinutesFinal ?? item.workedMinutesRaw)
                            const cs = getConfirmStatus(item, allWorkers)
                            const isSelected = item.id === selectedId
                            const rowBg =
                              isSelected        ? 'bg-accent-light hover:bg-accent-light' :
                              isNeedsReview(item) ? 'bg-red-light hover:bg-red-light' :
                              (item.manualAdjustedYn || item.status === 'ADJUSTED') ? 'bg-[#FAF5FF] hover:bg-[#F3E8FF]' :
                              ''
                            return (
                              <AdminTr
                                key={item.id}
                                onClick={() => openDetail(item.id)}
                                className={rowBg}
                              >
                                <AdminTd onClick={e => e.stopPropagation()} className="w-8">
                                  {item.status === 'MISSING_CHECKOUT' && (
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(item.id)}
                                      onChange={() => toggleSelect(item.id)}
                                      className="w-4 h-4 cursor-pointer accent-[#DC2626]"
                                    />
                                  )}
                                </AdminTd>
                                <AdminTd>
                                  <div className="font-semibold text-fore-brand">{item.workerName}</div>
                                </AdminTd>
                                <AdminTd className="text-[12px] text-muted-brand">{item.jobTitle}</AdminTd>
                                <AdminTd className="max-w-[100px]">
                                  {(() => {
                                    const w = allWorkers.find(w2 => w2.id === item.workerId)
                                    const primary = w?.activeSites.find(s => s.isPrimary)
                                    if (primary) return <div className="text-[12px] text-body-brand truncate">{primary.name}</div>
                                    if (w && w.activeSites.length > 0) return <div className="text-[12px] text-body-brand truncate">{w.activeSites[0].name}</div>
                                    return <StatusBadge status="PENDING" label="미배정" />
                                  })()}
                                </AdminTd>
                                <AdminTd className="max-w-[100px]">
                                  <div className="text-[12px] text-body-brand truncate">{item.siteName}</div>
                                  {(() => {
                                    const w = allWorkers.find(w2 => w2.id === item.workerId)
                                    const primary = w?.activeSites.find(s => s.isPrimary)
                                    if (primary && primary.id !== item.siteId) {
                                      return <span className="text-[11px] font-bold text-status-exception bg-yellow-light px-1 py-[1px] rounded">불일치</span>
                                    }
                                    return null
                                  })()}
                                </AdminTd>
                                <AdminTd className="tabular-nums">
                                  <span className={item.checkInWithinRadius === false ? 'text-status-rejected' : 'text-body-brand'}>
                                    {fmtTime(item.checkInAt)}
                                  </span>
                                </AdminTd>
                                <AdminTd className="tabular-nums">
                                  {item.checkOutAt ? (
                                    <span className="text-body-brand">{fmtTime(item.checkOutAt)}</span>
                                  ) : (
                                    <span className="text-[#D1D5DB]">-</span>
                                  )}
                                </AdminTd>
                                <AdminTd>
                                  <StatusBadge status={item.status} label={STATUS_LABEL[item.status] ?? item.status} />
                                </AdminTd>
                                <AdminTd>
                                  <span
                                    className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                                    style={{ color: cs.color, backgroundColor: cs.bg }}
                                  >
                                    {cs.label}{cs.reason && ` · ${cs.reason}`}
                                  </span>
                                  {item.adminNote && (
                                    <div className="text-[11px] text-muted-brand mt-[2px] max-w-[120px] truncate" title={item.adminNote}>📝 {item.adminNote}</div>
                                  )}
                                </AdminTd>
                              </AdminTr>
                            )
                          })}
                          {/* 미출근 행 (NOT_CHECKED_IN 필터 또는 전체) */}
                          {(statusFilter === 'NOT_CHECKED_IN' || statusFilter === '') && notCheckedInWorkers.map(w => {
                            if (statusFilter === '' && items.length > 0) return null // 전체 모드에서는 출근자만 표시
                            const primary = w.activeSites.find(s => s.isPrimary) ?? w.activeSites[0]
                            return (
                              <AdminTr key={`nc-${w.id}`} onClick={() => router.push(`/admin/workers?search=${encodeURIComponent(w.name)}`)} className="bg-yellow-light hover:bg-yellow-light">
                                <AdminTd className="font-semibold text-fore-brand">{w.name}</AdminTd>
                                <AdminTd className="text-[12px] text-muted-brand">{w.jobTitle}</AdminTd>
                                <AdminTd className="text-[12px] text-body-brand">{primary?.name ?? '-'}</AdminTd>
                                <AdminTd><span className="text-[#D1D5DB]">-</span></AdminTd>
                                <AdminTd><span className="text-[#D1D5DB]">-</span></AdminTd>
                                <AdminTd><span className="text-[#D1D5DB]">-</span></AdminTd>
                                <AdminTd><StatusBadge status="PENDING" label="미출근" /></AdminTd>
                                <AdminTd><span className="text-[#D1D5DB]">-</span></AdminTd>
                              </AdminTr>
                            )
                          })}
                          {/* 미배정 행 */}
                          {statusFilter === 'UNASSIGNED' && unassignedWorkers.map(w => (
                            <AdminTr key={`ua-${w.id}`} onClick={() => router.push(`/admin/workers?search=${encodeURIComponent(w.name)}`)} highlighted className="bg-red-light hover:bg-red-light">
                              <AdminTd className="font-semibold text-fore-brand">{w.name}</AdminTd>
                              <AdminTd className="text-[12px] text-muted-brand">{w.jobTitle}</AdminTd>
                              <AdminTd><StatusBadge status="PENDING" label="미배정" /></AdminTd>
                              <AdminTd><span className="text-[#D1D5DB]">-</span></AdminTd>
                              <AdminTd><span className="text-[#D1D5DB]">-</span></AdminTd>
                              <AdminTd><span className="text-[#D1D5DB]">-</span></AdminTd>
                              <AdminTd><StatusBadge status="PENDING" label="미배정" /></AdminTd>
                              <AdminTd><span className="text-[#D1D5DB]">-</span></AdminTd>
                            </AdminTr>
                          ))}
                    </AdminTable>
                  )
                )}
              />
            )}
          </SectionCard>
        </div>

        {/* 상세 패널 (sticky) */}
        {hasPanelOpen && selected && (
          <div className="w-[420px] shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <SectionCard padding={false} className="overflow-hidden">
              {/* 오렌지 4px 라인 */}
              <div className="h-1 bg-brand-accent" />

              {/* 패널 헤더 */}
              <div className="px-5 py-3.5 flex items-start justify-between border-b border-brand">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-title-brand leading-snug shrink-0">
                      {selected.workerName}
                    </h3>
                    <StatusBadge status={selected.status} label={STATUS_LABEL[selected.status] ?? selected.status} />
                    {selected.isAutoCheckout && (
                      <span className="text-[11px] bg-red-light text-status-missing px-1.5 py-[2px] rounded font-bold">AUTO</span>
                    )}
                    {selected.manualAdjustedYn && (
                      <span className="text-[11px] bg-[#F3E8FF] text-status-adjusted px-1.5 py-[2px] rounded font-bold">수동보정</span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted2-brand mt-0.5">
                    {selected.workDate} · {selected.siteName}
                  </p>
                </div>
                <button
                  onClick={closePanel}
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted2-brand hover:bg-footer hover:text-body-brand transition-colors shrink-0 ml-2 mt-0.5"
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
                  {(() => {
                    const w = allWorkers.find(w2 => w2.id === selected.workerId)
                    const primary = w?.activeSites.find(s => s.isPrimary) ?? w?.activeSites[0]
                    return (
                      <>
                        <PanelRow label="주배정" value={primary?.name ?? <span className="text-status-exception">미배정</span>} warn={!primary} />
                        {primary && primary.id !== selected.siteId && (
                          <div className="mb-2 text-[11px] text-status-exception bg-yellow-light rounded px-2 py-1">⚠ 주배정 현장과 다른 곳에 출근</div>
                        )}
                      </>
                    )
                  })()}
                </PanelSection>

                {/* B. 운영 메모 */}
                <PanelSection label="B. 운영 메모">
                  {selected.adminNote && !memoText && (
                    <div className="mb-2 p-2 bg-surface border border-brand rounded-lg">
                      <div className="text-[12px] text-body-brand">{selected.adminNote}</div>
                    </div>
                  )}
                  <FormTextarea
                    rows={2}
                    value={memoText}
                    onChange={e => setMemoText(e.target.value)}
                    placeholder={selected.adminNote ? '메모 수정...' : '운영 메모 입력...'}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={async () => {
                        if (!memoText.trim()) return
                        setMemoSaving(true)
                        await fetch(`/api/admin/attendance/${selected.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ adminNote: memoText.trim() }),
                        })
                        setMemoSaving(false)
                        setMemoText('')
                        load()
                      }}
                      disabled={!memoText.trim() || memoSaving}
                      className="px-3 py-[5px] bg-brand-accent text-white border-none rounded-[6px] text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                    >
                      {memoSaving ? '저장중...' : '메모 저장'}
                    </button>
                    <button onClick={() => router.push(`/admin/workers?search=${encodeURIComponent(selected.workerName)}`)} className="px-3 py-[5px] text-[11px] text-accent border border-accent bg-transparent rounded-[6px] cursor-pointer font-semibold hover:bg-[rgba(249,115,22,0.06)]">근로자 상세</button>
                  </div>
                </PanelSection>

                {/* C. 출퇴근 정보 */}
                <PanelSection label="B. 출퇴근 정보" warn={isNeedsReview(selected)}>
                  {selected.exceptionReason && (
                    <div className="mb-3 rounded-[8px] bg-red-light border border-[#FCA5A5] px-3 py-2">
                      <div className="text-[11px] font-bold text-status-rejected mb-0.5">예외 사유</div>
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
                  <div className="h-px bg-footer my-2" />
                  <PanelRow
                    label="출근 GPS"
                    value={
                      <span className="flex items-center gap-2">
                        <GpsBadge within={selected.checkInWithinRadius} />
                        {selected.checkInDistance != null && (
                          <span className="text-[11px] text-muted-brand">({selected.checkInDistance}m)</span>
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
                          <span className="text-[11px] text-muted-brand">({selected.checkOutDistance}m)</span>
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
                      <div className="h-px bg-footer my-2" />
                      <PanelRow
                        label="현장 이동"
                        value={<span className="text-[12px] leading-relaxed">{selected.movePath}</span>}
                      />
                    </>
                  )}
                  {selected.manualAdjustedYn && (
                    <>
                      <div className="h-px bg-footer my-2" />
                      <PanelRow
                        label="수정 이력"
                        value={
                          <span className="flex items-center gap-2">
                            <span className="text-status-adjusted">있음 — {selected.manualAdjustedReason || '사유 없음'}</span>
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
                    <div className="text-[12px] text-muted2-brand py-2">사진 로딩 중...</div>
                  ) : (
                    <div className="flex gap-3">
                      {/* 출근 사진 */}
                      <div className="flex-1">
                        <div className="text-[11px] text-muted-brand mb-1.5 font-medium">출근 사진</div>
                        {checkInPhoto ? (
                          <div className="rounded-[8px] overflow-hidden border border-brand">
                            <img
                              src={`/api/admin/attendance/photos/${checkInPhoto.id}/file`}
                              alt="출근 사진"
                              className="w-full h-[100px] object-cover"
                            />
                            <div className="px-2 py-1 text-[11px] text-muted-brand bg-surface">
                              {fmtDateTime(checkInPhoto.capturedAt)}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[8px] border border-dashed border-brand h-[80px] flex items-center justify-center text-[12px] text-[#D1D5DB] bg-surface">
                            없음
                          </div>
                        )}
                      </div>
                      {/* 퇴근 사진 */}
                      <div className="flex-1">
                        <div className="text-[11px] text-muted-brand mb-1.5 font-medium">퇴근 사진</div>
                        {checkOutPhoto ? (
                          <div className="rounded-[8px] overflow-hidden border border-brand">
                            <img
                              src={`/api/admin/attendance/photos/${checkOutPhoto.id}/file`}
                              alt="퇴근 사진"
                              className="w-full h-[100px] object-cover"
                            />
                            <div className="px-2 py-1 text-[11px] text-muted-brand bg-surface">
                              {fmtDateTime(checkOutPhoto.capturedAt)}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[8px] border border-dashed border-brand h-[80px] flex items-center justify-center text-[12px] text-[#D1D5DB] bg-surface">
                            없음
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {selected.adminNote && (
                    <div className="mt-3 rounded-[8px] bg-accent-light border border-yellow px-3 py-2">
                      <div className="text-[11px] font-bold text-muted2-brand mb-0.5">관리자 메모</div>
                      <div className="text-[13px] text-body-brand">{selected.adminNote}</div>
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
                            value={<span className="text-status-adjusted">{selected.manualAdjustedReason}</span>}
                          />
                        )}
                        <div className="h-px bg-footer my-2" />
                        <PanelRow
                          label="일 노임"
                          value={<span className="font-bold text-accent">{fmtWageFull(selected.dayWage)}</span>}
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
                        <div className="rounded-[8px] bg-red-light border border-[#FCA5A5] px-3 py-3">
                          <div className="text-[11px] font-bold text-status-rejected mb-2">퇴근 누락 빠른 보정</div>
                          <div className="flex items-center gap-2">
                            <input
                              ref={quickCheckoutRef}
                              type="time"
                              className="h-9 px-2 text-[13px] border border-brand rounded-[6px] outline-none focus:border-[#DC2626] bg-card w-[110px]"
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
                    <div className="rounded-[10px] bg-[#F5F3FF] border border-purple px-4 py-4">
                      <div className="text-[11px] font-bold text-status-adjusted mb-3">수동 보정</div>

                      <FormInput
                        label="출근"
                        type="time"
                        value={correctCheckIn}
                        onChange={e => setCorrectCheckIn(e.target.value)}
                        helper={`현재 ${fmtTime(selected.checkInAt)}`}
                      />

                      <FormInput
                        label="퇴근"
                        type="time"
                        value={correctCheckOut}
                        onChange={e => setCorrectCheckOut(e.target.value)}
                        helper={`현재 ${fmtTime(selected.checkOutAt)}`}
                      />

                      <FormInput
                        label="공수(분)"
                        type="number"
                        min={0}
                        max={1440}
                        value={workedMinutesInput}
                        onChange={e => setWorkedMinutesInput(e.target.value)}
                        placeholder="분"
                        helper={workedMinutesInput ? `→ ${calcManDay(parseInt(workedMinutesInput)).label} 공수` : undefined}
                      />

                      <FormInput
                        label="사유"
                        required
                        type="text"
                        value={manualReason}
                        onChange={e => setManualReason(e.target.value)}
                        placeholder="수정 사유 (필수)"
                      />

                      <FormInput
                        label="메모"
                        type="text"
                        value={correctNote}
                        onChange={e => setCorrectNote(e.target.value)}
                        placeholder="관리자 메모 (선택)"
                      />

                      <div className="text-[11px] text-muted2-brand mb-3 flex items-center justify-between">
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
                        <div className="mb-3 rounded-[8px] bg-red-light border border-[#FCA5A5] px-3 py-2 text-[12px] text-status-rejected">
                          {correctError}
                        </div>
                      )}

                      <ModalFooter>
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={() => setCorrecting(false)}
                        >
                          취소
                        </Btn>
                        <Btn
                          variant="orange"
                          size="sm"
                          onClick={saveCorrection}
                          disabled={
                            (!correctCheckOut && !correctCheckIn && workedMinutesInput === '') ||
                            !manualReason ||
                            correctSaving
                          }
                        >
                          {correctSaving ? '저장 중...' : '보정 저장'}
                        </Btn>
                      </ModalFooter>
                    </div>
                  )}
                </PanelSection>

              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* ── 대리 출근 등록 모달 ── */}
      <Modal open={proxyOpen} onClose={() => setProxyOpen(false)} title="대리 출근 등록">
        <div className="text-[13px] text-muted-brand mb-5">
          관리자가 근로자의 출퇴근을 대리 등록합니다. 감사 로그에 기록됩니다.
        </div>

        {proxyError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-[13px] text-red-700">
            {proxyError}
          </div>
        )}

        {/* 근로자 선택 */}
        <div className="mb-[14px]">
          <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">근로자 *</label>
          <select
            value={proxyWorkerId}
            onChange={e => setProxyWorkerId(e.target.value)}
            className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border"
          >
            <option value="">선택하세요</option>
            {allWorkers.map(w => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.phone}) {w.activeSites[0] ? `- ${w.activeSites[0].name}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 현장 선택 */}
        <div className="mb-[14px]">
          <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">현장 *</label>
          <select
            value={proxySiteId}
            onChange={e => setProxySiteId(e.target.value)}
            className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border"
          >
            <option value="">선택하세요</option>
            {siteOptions.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* 날짜 */}
        <div className="mb-[14px]">
          <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">작업일 *</label>
          <input
            type="date"
            value={proxyDate}
            onChange={e => setProxyDate(e.target.value)}
            className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border"
          />
        </div>

        {/* 출퇴근 시간 */}
        <div className="flex gap-3 mb-[14px]">
          <div className="flex-1">
            <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">출근 시간 *</label>
            <input
              type="time"
              value={proxyCheckIn}
              onChange={e => setProxyCheckIn(e.target.value)}
              className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">퇴근 시간</label>
            <input
              type="time"
              value={proxyCheckOut}
              onChange={e => setProxyCheckOut(e.target.value)}
              className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border"
            />
          </div>
        </div>

        {/* 사유 */}
        <div className="mb-[14px]">
          <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">대리 등록 사유 *</label>
          <textarea
            value={proxyReason}
            onChange={e => setProxyReason(e.target.value)}
            placeholder="예: 휴대폰 고장으로 본인 출근 처리 불가"
            rows={2}
            className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border resize-y"
          />
        </div>

        {/* 관리자 메모 */}
        <div className="mb-5">
          <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">관리자 메모</label>
          <textarea
            value={proxyNote}
            onChange={e => setProxyNote(e.target.value)}
            placeholder="추가 메모 (선택)"
            rows={2}
            className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border resize-y"
          />
        </div>

        <div className="flex gap-[10px]">
          <button
            onClick={() => setProxyOpen(false)}
            className="flex-1 py-3 border border-brand rounded-lg bg-card cursor-pointer text-sm"
          >
            취소
          </button>
          <button
            onClick={saveProxy}
            disabled={!proxyWorkerId || !proxySiteId || !proxyDate || !proxyCheckIn || !proxyReason || proxySaving}
            style={{
              flex: 2, padding: '12px', border: 'none', borderRadius: '8px',
              background: (!proxyWorkerId || !proxySiteId || !proxyDate || !proxyCheckIn || !proxyReason || proxySaving) ? '#bdbdbd' : '#1565c0',
              color: '#fff',
              cursor: (!proxyWorkerId || !proxySiteId || !proxyDate || !proxyCheckIn || !proxyReason || proxySaving) ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 700,
            }}
          >
            {proxySaving ? '등록 중...' : '대리 출근 등록'}
          </button>
        </div>
      </Modal>
      </>}
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
