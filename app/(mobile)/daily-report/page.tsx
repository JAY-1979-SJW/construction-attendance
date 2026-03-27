'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import WorkerTopBar from '@/components/worker/WorkerTopBar'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface Attendance {
  id: string
  siteId: string
  checkInSite: { id: string; name: string }
  checkInAt: string | null
  status: string
}

interface Report {
  id: string
  siteId: string
  reportDate: string
  tradeFamilyCode: string | null
  tradeFamilyLabel: string | null
  tradeCode: string | null
  tradeLabel: string | null
  taskCode: string | null
  taskLabel: string | null
  workDetail: string | null
  buildingName: string | null
  floorLabel: string | null
  locationDetail: string | null
  locationDisplayName: string | null
  yesterdayWork: string | null
  todayWork: string | null
  tomorrowWork: string | null
  workStartTime: string | null
  workEndTime: string | null
  consecutiveDays: number
  todayManDays: number
  monthlyManDays: number
  totalManDays: number
  notes: string | null
  photos: string[]
  employmentType: string
  jobTitle: string
  status: string
  site: { id: string; name: string }
}

interface TradeFamily {
  id: string; code: string; label: string
  trades: { id: string; code: string; label: string }[]
  tasks: { id: string; code: string; label: string; tradeId: string | null }[]
}

interface Suggestion {
  text: string
  tradeFamilyCode: string | null; tradeFamilyLabel: string | null
  tradeCode: string | null; tradeLabel: string | null
  taskCode: string | null; taskLabel: string | null
  workDetail?: string | null
  buildingName?: string | null; floorLabel?: string | null
  locationDetail?: string | null; locationDisplayName?: string | null
  count?: number
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

const EMP_TYPES = [
  { value: 'DIRECT', label: '직영' },
  { value: 'DAILY', label: '일용' },
  { value: 'OUTSOURCE_LEAD', label: '외주팀장' },
  { value: 'OUTSOURCE_CREW', label: '외주팀원' },
]

// ── 층 그룹 분류 ──────────────────────────────────────────────────────────────

function classifyFloor(label: string): string {
  if (/^B|^지하/.test(label)) return '지하층'
  const m = label.match(/(\d+)/)
  if (!m) return '특수구역'
  const n = parseInt(m[1])
  if (n <= 5) return '저층'
  if (n <= 15) return '중층'
  if (n <= 30) return '고층'
  return '초고층'
}

const FLOOR_GROUP_ORDER = ['최근 사용', '지하층', '저층', '중층', '고층', '초고층', '특수구역']

// ── localStorage 헬퍼 ─────────────────────────────────────────────────────────

const LS_LAST_KEY = 'dr-last-used'
const LS_RECENT_FLOORS_KEY = 'dr-recent-floors'

function saveLastUsed(d: Record<string, string>) {
  try { localStorage.setItem(LS_LAST_KEY, JSON.stringify(d)) } catch {}
}
function loadLastUsed(): Record<string, string> | null {
  try { return JSON.parse(localStorage.getItem(LS_LAST_KEY) || 'null') } catch { return null }
}
function saveRecentFloor(bldg: string, fl: string) {
  try {
    const data = JSON.parse(localStorage.getItem(LS_RECENT_FLOORS_KEY) || '{}')
    const arr: string[] = data[bldg] || []
    const filtered = arr.filter((f: string) => f !== fl)
    filtered.unshift(fl)
    data[bldg] = filtered.slice(0, 5)
    localStorage.setItem(LS_RECENT_FLOORS_KEY, JSON.stringify(data))
  } catch {}
}
function getRecentFloors(bldg: string): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(LS_RECENT_FLOORS_KEY) || '{}')
    return data[bldg] || []
  } catch { return [] }
}

// ── Sel 컴포넌트 (기본 네이티브 select) ──────────────────────────────────────

function Sel({ label, value, onChange, options, placeholder }: {
  label: string; value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] text-[#9CA3AF] mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316]"
      >
        <option value="">{placeholder || `${label} 선택`}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── DropSel 컴포넌트 (커스텀 드롭다운 — 2줄 텍스트 지원) ─────────────────────

function DropSel({ label, value, onChange, options, placeholder }: {
  label: string; value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const handleToggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setOpenUp(window.innerHeight - rect.bottom < 260)
    }
    setOpen(!open)
  }

  const selectedLabel = options.find(o => o.value === value)?.label

  return (
    <div className="flex-1 min-w-0 relative" ref={ref}>
      <div className="text-[11px] text-[#9CA3AF] mb-1">{label}</div>
      <button type="button" onClick={handleToggle}
        className="w-full text-left text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316] truncate">
        <span className={selectedLabel ? 'text-[#374151]' : 'text-[#9CA3AF]'}>
          {selectedLabel || placeholder || `${label} 선택`}
        </span>
      </button>
      {open && (
        <div className={`absolute z-20 left-0 right-0 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[240px] overflow-y-auto ${
          openUp ? 'bottom-full mb-1' : 'mt-1'
        }`}>
          <button type="button" onClick={() => { onChange(''); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-[13px] text-[#9CA3AF] border-b border-[#F3F4F6]">
            {placeholder || `${label} 선택`}
          </button>
          {options.map((o) => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2.5 text-[13px] border-b border-[#F3F4F6] last:border-0 transition-colors ${
                o.value === value ? 'bg-[#FFF7ED] text-[#F97316] font-medium' : 'text-[#374151] active:bg-[#FAFAFA]'
              }`}>
              <div className="line-clamp-2">{o.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 층 선택 (검색 + 그룹화 + 최근 사용 + 건물 미선택 시 비활성) ──────────────

function FloorSel({ value, onChange, floors, building }: {
  value: string
  onChange: (v: string) => void
  floors: string[]
  building: string
}) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const recentFloors = useMemo(() => getRecentFloors(building), [building])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!search) return floors
    return floors.filter(f => f.includes(search))
  }, [floors, search])

  const orderedGroups = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const f of filtered) {
      const g = classifyFloor(f)
      if (!groups[g]) groups[g] = []
      groups[g].push(f)
    }
    const result: { group: string; items: string[] }[] = []
    const recent = recentFloors.filter(f => filtered.includes(f))
    if (recent.length > 0) result.push({ group: '최근 사용', items: recent })
    for (const g of FLOOR_GROUP_ORDER) {
      if (g === '최근 사용') continue
      if (groups[g]?.length) result.push({ group: g, items: groups[g] })
    }
    return result
  }, [filtered, recentFloors])

  const disabled = !building

  return (
    <div className="flex-1 min-w-0 relative" ref={ref}>
      <div className="text-[11px] text-[#9CA3AF] mb-1">층</div>
      <button type="button" onClick={() => {
          if (disabled) return
          if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect()
            setOpenUp(window.innerHeight - rect.bottom < 300)
          }
          setOpen(!open)
        }} disabled={disabled}
        className={`w-full text-left text-[13px] border rounded-lg px-3 py-2.5 truncate ${
          disabled
            ? 'bg-[#F9FAFB] border-[#E5E7EB] text-[#D1D5DB]'
            : 'bg-white border-[#E5E7EB] focus:outline-none focus:border-[#F97316] text-[#374151]'
        }`}>
        {value || (disabled ? '동 먼저 선택' : '층 선택')}
      </button>
      {open && !disabled && (
        <div className={`absolute z-20 left-0 right-0 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[280px] overflow-y-auto ${
            openUp ? 'bottom-full mb-1' : 'mt-1'
          }`}>
          {/* 10개 초과 시 검색 입력 표시 */}
          {floors.length > 10 && (
            <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] p-2">
              <input type="text" placeholder="층 검색..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-[13px] border border-[#E5E7EB] rounded px-2 py-1.5 focus:outline-none focus:border-[#F97316]"
              />
            </div>
          )}
          {orderedGroups.map(({ group, items }) => (
            <div key={group}>
              <div className="px-3 py-1 text-[10px] text-[#9CA3AF] bg-[#F9FAFB] font-medium">{group}</div>
              {items.map((f) => (
                <button key={`${group}-${f}`} type="button"
                  onClick={() => { onChange(f); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-3 py-2 text-[13px] border-b border-[#F3F4F6] last:border-0 transition-colors ${
                    f === value ? 'bg-[#FFF7ED] text-[#F97316] font-medium' : 'text-[#374151] active:bg-[#FAFAFA]'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-[13px] text-[#9CA3AF] text-center">검색 결과 없음</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function DailyReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // 데이터
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [workerName, setWorkerName] = useState('')
  const [workerJobTitle, setWorkerJobTitle] = useState('')

  // 마스터
  const [families, setFamilies] = useState<TradeFamily[]>([])
  const [buildings, setBuildings] = useState<string[]>([])
  const [floorsByBuilding, setFloorsByBuilding] = useState<Record<string, string[]>>({})
  const [detailsByBF, setDetailsByBF] = useState<Record<string, string[]>>({})

  // 제안
  const [yesterdayReport, setYesterdayReport] = useState<any>(null)
  const [recentItems, setRecentItems] = useState<Suggestion[]>([])
  const [frequentItems, setFrequentItems] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // ── 폼 상태 ────────────────────────────────────────────────
  const [empType, setEmpType] = useState('DIRECT')
  const [todayManDays, setTodayManDays] = useState(1.0)
  const [familyCode, setFamilyCode] = useState('')
  const [tradeCode, setTradeCode] = useState('')
  const [taskCode, setTaskCode] = useState('')
  const [workDetail, setWorkDetail] = useState('')
  const [building, setBuilding] = useState('')
  const [floor, setFloor] = useState('')
  const [locDetail, setLocDetail] = useState('')
  const [yesterdayWork, setYesterdayWork] = useState('')
  const [todayWork, setTodayWork] = useState('')
  const [tomorrowWork, setTomorrowWork] = useState('')
  const [workStart, setWorkStart] = useState('')
  const [workEnd, setWorkEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [materialUsed, setMaterialUsed] = useState(false)
  const [materialNote, setMaterialNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // ── 파생 데이터 ────────────────────────────────────────────

  const selectedFamily = families.find((f) => f.code === familyCode)
  const tradeOptions = selectedFamily?.trades.map((t) => ({ value: t.code, label: t.label })) || []
  const taskOptions = (selectedFamily?.tasks || [])
    .filter((t) => !t.tradeId || t.tradeId === families.find(f => f.code === familyCode)?.trades.find(tr => tr.code === tradeCode)?.id)
    .map((t) => ({ value: t.code, label: t.label }))
  const floorList = floorsByBuilding[building] || []
  const detailOptions = (detailsByBF[`${building}__${floor}`] || []).map((d) => ({ value: d, label: d }))

  // 선택 요약 텍스트
  const tradeSummary = [
    selectedFamily?.label,
    selectedFamily?.trades.find(t => t.code === tradeCode)?.label,
    selectedFamily?.tasks.find(t => t.code === taskCode)?.label,
  ].filter(Boolean).join(' > ')

  const locationSummary = [building, floor, locDetail].filter(Boolean).join(' ')

  // ── 초기 로딩 ──────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch(`/api/worker/daily-reports?date=${todayStr}`).then((r) => r.json()),
      fetch('/api/worker/trades').then((r) => r.json()),
    ]).then(([meData, reportData, tradesData]) => {
      if (!meData.success) { router.push('/login'); return }
      setWorkerName(meData.data.name)
      setWorkerJobTitle(meData.data.jobTitle || '미설정')

      if (tradesData.success) setFamilies(tradesData.data)

      if (reportData.success) {
        const { report: rpt, attendance: att } = reportData.data
        setAttendance(att)

        if (rpt) {
          setReport(rpt)
          setFamilyCode(rpt.tradeFamilyCode || '')
          setTradeCode(rpt.tradeCode || '')
          setTaskCode(rpt.taskCode || '')
          setWorkDetail(rpt.workDetail || '')
          setBuilding(rpt.buildingName || '')
          setFloor(rpt.floorLabel || '')
          setLocDetail(rpt.locationDetail || '')
          setYesterdayWork(rpt.yesterdayWork || '')
          setTodayWork(rpt.todayWork || '')
          setTomorrowWork(rpt.tomorrowWork || '')
          setWorkStart(rpt.workStartTime || '')
          setWorkEnd(rpt.workEndTime || '')
          setNotes(rpt.notes || '')
          setEmpType(rpt.employmentType || 'DIRECT')
          setTodayManDays(Number(rpt.todayManDays) || 1.0)
          setPhotos(rpt.photos || [])
        } else {
          // 기존 일보 없음 → localStorage에서 마지막 사용값 불러오기 (같은 현장만)
          const last = loadLastUsed()
          if (last && att && last.siteId === att.checkInSite.id) {
            if (last.familyCode) setFamilyCode(last.familyCode)
            if (last.tradeCode) setTradeCode(last.tradeCode)
            if (last.taskCode) setTaskCode(last.taskCode)
            if (last.building) setBuilding(last.building)
            if (last.floor) setFloor(last.floor)
            if (last.locDetail) setLocDetail(last.locDetail)
          }
        }

        // 위치 + 제안 로딩
        if (att) {
          fetch(`/api/worker/locations?siteId=${att.checkInSite.id}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success) {
                setBuildings(d.data.buildings || [])
                setFloorsByBuilding(d.data.floorsByBuilding || {})
                setDetailsByBF(d.data.detailsByBuildingFloor || {})
              }
            }).catch(() => {})

          fetch(`/api/worker/daily-reports/suggestions?siteId=${att.checkInSite.id}&date=${todayStr}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success) {
                setYesterdayReport(d.data.yesterdayReport)
                setRecentItems(d.data.recent || [])
                setFrequentItems(d.data.frequent || [])
              }
            }).catch(() => {})
        }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [router, todayStr])

  // ── 전일 작업 불러오기 ────────────────────────────────────

  const loadYesterday = useCallback(() => {
    if (!yesterdayReport) return
    setYesterdayWork(yesterdayReport.todayWork || '')
    if (yesterdayReport.tradeFamilyCode) setFamilyCode(yesterdayReport.tradeFamilyCode)
    if (yesterdayReport.tradeCode) setTradeCode(yesterdayReport.tradeCode)
    if (yesterdayReport.taskCode) setTaskCode(yesterdayReport.taskCode)
    if (yesterdayReport.workDetail) setWorkDetail(yesterdayReport.workDetail)
    if (yesterdayReport.buildingName) setBuilding(yesterdayReport.buildingName)
    if (yesterdayReport.floorLabel) setFloor(yesterdayReport.floorLabel)
    if (yesterdayReport.locationDetail) setLocDetail(yesterdayReport.locationDetail)
    flash('전일 작업을 불러왔습니다.')
  }, [yesterdayReport])

  const copyToTomorrow = useCallback(() => {
    setTomorrowWork(todayWork)
    flash('금일 작업을 명일로 복사했습니다.')
  }, [todayWork])

  const selectSuggestion = useCallback((item: Suggestion) => {
    if (item.tradeFamilyCode) setFamilyCode(item.tradeFamilyCode)
    if (item.tradeCode) setTradeCode(item.tradeCode)
    if (item.taskCode) setTaskCode(item.taskCode)
    if (item.taskLabel) setTodayWork(item.taskLabel)
    if (item.workDetail) setWorkDetail(item.workDetail)
    if (item.buildingName) setBuilding(item.buildingName)
    if (item.floorLabel) setFloor(item.floorLabel)
    if (item.locationDetail) setLocDetail(item.locationDetail)
    setShowSuggestions(false)
  }, [])

  function flash(m: string) {
    setMsg(m); setTimeout(() => setMsg(''), 2000)
  }

  // ── 사진 업로드 / 삭제 ──────────────────────────────────

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !attendance || photos.length >= 3) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const res = await fetch('/api/worker/daily-reports/photos/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              siteId: attendance.checkInSite.id,
              photoBase64: reader.result as string,
              mimeType: file.type || 'image/jpeg',
            }),
          })
          const data = await res.json()
          if (data.success) setPhotos(prev => [...prev, data.photoPath])
          else flash(data.message || '사진 업로드 실패')
        } catch { flash('사진 업로드 오류') }
        finally { setUploading(false) }
      }
      reader.readAsDataURL(file)
    } catch { flash('파일 읽기 오류'); setUploading(false) }
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  // ── 저장 ──────────────────────────────────────────────────

  const handleSave = async () => {
    if (!attendance) return
    setSaving(true); setMsg('')

    const selectedTask = selectedFamily?.tasks.find((t) => t.code === taskCode)
    const selectedTrade = selectedFamily?.trades.find((t) => t.code === tradeCode)

    try {
      const res = await fetch('/api/worker/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: attendance.checkInSite.id,
          attendanceLogId: attendance.id,
          reportDate: todayStr,
          employmentType: empType,
          jobTitle: workerJobTitle,
          tradeFamilyCode: familyCode || null,
          tradeFamilyLabel: selectedFamily?.label || null,
          tradeCode: tradeCode || null,
          tradeLabel: selectedTrade?.label || null,
          taskCode: taskCode || null,
          taskLabel: selectedTask?.label || null,
          workDetail: workDetail || null,
          buildingName: building || null,
          floorLabel: floor || null,
          locationDetail: locDetail || null,
          yesterdayWork: yesterdayWork || null,
          todayWork: todayWork || null,
          tomorrowWork: tomorrowWork || null,
          workStartTime: workStart || null,
          workEndTime: workEnd || null,
          todayManDays,
          notes: notes || null,
          materialUsedYn: materialUsed,
          materialNote: materialNote || null,
          photos,
          copiedFromPreviousYn: false,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setReport(data.data)
        flash('저장되었습니다.')
        // localStorage에 마지막 사용값 저장
        saveLastUsed({ siteId: attendance.checkInSite.id, familyCode, tradeCode, taskCode, building, floor, locDetail })
        if (building && floor) saveRecentFloor(building, floor)
      }
      else flash(data.message || '저장 실패')
    } catch { flash('네트워크 오류') }
    finally { setSaving(false) }
  }

  // ── 렌더링 ────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
      <div className="text-[#9CA3AF] text-sm">로딩 중...</div>
    </div>
  )

  if (!attendance) return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <WorkerTopBar />
      <div className="mobile-content">
        <div className="bg-white rounded-xl p-6 mt-4 text-center">
          <div className="text-[#374151] font-semibold text-[15px] mb-1">작업일보</div>
          <div className="text-[#9CA3AF] text-[13px]">
            오늘 출근 기록이 없습니다.<br />출근 후 작업일보를 작성할 수 있습니다.
          </div>
        </div>
      </div>
      <WorkerBottomNav />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <WorkerTopBar />
      <div className="mobile-content">

        {/* ── 현장 + 작업일자 ─────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="text-[16px] font-bold text-[#0F172A]">작업일보</div>
          <div className="mt-1.5 text-[13px] text-[#6B7280]">
            {attendance.checkInSite.name}
          </div>
          <div className="text-[13px] text-[#6B7280]">
            {todayStr} · {workerName} · {workerJobTitle}
          </div>
        </div>

        {/* ── 공종 / 작업사항 ────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="text-[13px] font-semibold text-[#374151] mb-3">공종 / 작업사항</div>
          <div className="space-y-2.5">
            <DropSel label="공종계열" value={familyCode}
              onChange={(v) => { setFamilyCode(v); setTradeCode(''); setTaskCode('') }}
              options={families.map((f) => ({ value: f.code, label: f.label }))}
            />
            <div className="flex gap-2">
              <DropSel label="세부공종" value={tradeCode}
                onChange={(v) => { setTradeCode(v); setTaskCode('') }}
                options={tradeOptions}
              />
              <DropSel label="작업사항" value={taskCode}
                onChange={setTaskCode}
                options={taskOptions}
              />
            </div>
            {tradeSummary && (
              <div className="text-[12px] text-[#6B7280] bg-[#F9FAFB] rounded-xl px-3 py-1.5">
                {tradeSummary}
              </div>
            )}
            <textarea
              placeholder="세부 작업 내용"
              value={workDetail}
              onChange={(e) => setWorkDetail(e.target.value)}
              rows={2}
              className="w-full text-[14px] border border-[#E5E7EB] rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316] resize-none"
            />
          </div>
        </div>

        {/* ── 근무시간 ───────────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="text-[13px] font-semibold text-[#374151] mb-2">근무시간</div>
          <div className="flex gap-2 items-center">
            <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)}
              className="flex-1 text-[14px] border border-[#E5E7EB] rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316]" />
            <span className="text-[14px] text-[#9CA3AF]">~</span>
            <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)}
              className="flex-1 text-[14px] border border-[#E5E7EB] rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316]" />
          </div>
        </div>

        {/* ── 사진 ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold text-[#374151]">사진</div>
            <span className="text-[11px] text-[#9CA3AF]">{photos.length}/3</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E7EB]">
                <img
                  src={`/api/worker/daily-reports/photos/file?path=${encodeURIComponent(p)}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button onClick={() => removePhoto(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full text-white text-[12px] flex items-center justify-center">
                  ✕
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-[#D1D5DB] flex flex-col items-center justify-center cursor-pointer active:bg-[#F9FAFB]">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={handlePhotoUpload} disabled={uploading} />
                {uploading ? (
                  <div className="text-[12px] text-[#9CA3AF]">업로드 중...</div>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#D1D5DB]">
                      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <div className="text-[11px] text-[#9CA3AF] mt-1">사진 추가</div>
                  </>
                )}
              </label>
            )}
          </div>
        </div>

        {/* ── 메모 / 특이사항 ────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="text-[13px] font-semibold text-[#374151] mb-2">메모 / 특이사항</div>
          <textarea
            placeholder="메모나 특이사항을 입력하세요"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full text-[14px] border border-[#E5E7EB] rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316] resize-none"
          />
        </div>

        {/* ── 메시지 ─────────────────────────────────────── */}
        {msg && <div className="mt-3 text-center text-[13px] text-[#F97316] font-medium">{msg}</div>}

        {/* ── 저장 버튼 ──────────────────────────────────── */}
        <button onClick={handleSave} disabled={saving}
          className="w-full mt-4 py-3.5 rounded-xl text-white text-[15px] font-bold transition-colors"
          style={{ background: saving ? '#FDBA74' : '#F97316' }}>
          {saving ? '저장 중...' : report ? '수정 저장' : '저장'}
        </button>
      </div>
      <WorkerBottomNav />
    </div>
  )
}
