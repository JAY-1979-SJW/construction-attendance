'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { WorklogTab } from '@/components/admin/site-ops/WorklogTab'
import { TbmTab } from '@/components/admin/site-ops/TbmTab'
import { DailyOpsCard } from '@/components/admin/site-ops/DailyOpsCard'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Tab = 'info' | 'companies' | 'assigned-workers' | 'notices' | 'schedules' | 'worklogs' | 'tbm' | 'workers'

interface SiteNotice {
  id: string
  title: string
  content: string
  noticeType: string
  visibilityScope: string
  startDate: string
  endDate: string | null
  isTodayHighlight: boolean
  isActive: boolean
  createdAt: string
}

interface SiteDailySchedule {
  id: string
  scheduleDate: string
  scheduleType: string
  title: string
  description: string | null
  plannedStartAt: string | null
  plannedEndAt: string | null
  location: string | null
  status: string
  createdAt: string
}

interface SiteInfo {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  allowedRadius: number
  isActive: boolean
  siteCode: string | null
  openedAt: string | null
  closedAt: string | null
  notes: string | null
}

interface AssignedWorker {
  id: string
  workerId: string
  companyId: string
  assignedFrom: string
  assignedTo: string | null
  tradeType: string | null
  isPrimary: boolean
  isActive: boolean
  notes: string | null
  worker: { id: string; name: string; phone?: string; jobTitle?: string }
  company: { id: string; companyName: string }
}

interface SiteCompanyAssignment {
  id: string
  companyId: string
  contractType: string
  startDate: string
  endDate: string | null
  managerName: string | null
  managerPhone: string | null
  notes: string | null
  participationStatus: string
  managerCount: number
  company: {
    id: string
    companyName: string
    companyType: string
    businessNumber: string | null
    externalVerificationStatus: string | null
    isActive: boolean
  }
}

interface DailyWorkerStatus {
  id: string
  workerId: string
  companyId: string | null
  teamLabel: string | null
  attendanceStatus: string
  checkInAt: string | null
  checkOutAt: string | null
  tbmStatus: string
  safetyCheckStatus: string
  workAssignedStatus: string
  remarks: string | null
  worker: { id: string; name: string; phone?: string }
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const NOTICE_TYPE_LABELS: Record<string, string> = {
  GENERAL_NOTICE:        '일반',
  SAFETY_NOTICE:         '안전',
  SCHEDULE_NOTICE:       '일정',
  INSPECTION_NOTICE:     '검측',
  MATERIAL_NOTICE:       '자재',
  ACCESS_CONTROL_NOTICE: '출입통제',
  EMERGENCY_NOTICE:      '긴급',
}

const NOTICE_TYPE_COLORS: Record<string, string> = {
  GENERAL_NOTICE:        'bg-[rgba(255,255,255,0.08)] text-[#CBD5E0]',
  SAFETY_NOTICE:         'bg-red-100 text-red-700',
  SCHEDULE_NOTICE:       'bg-blue-100 text-blue-700',
  INSPECTION_NOTICE:     'bg-purple-100 text-purple-700',
  MATERIAL_NOTICE:       'bg-yellow-100 text-yellow-700',
  ACCESS_CONTROL_NOTICE: 'bg-orange-100 text-orange-700',
  EMERGENCY_NOTICE:      'bg-red-200 text-red-800 font-bold',
}

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  TBM:               'TBM',
  INSPECTION:        '검측',
  MATERIAL_DELIVERY: '자재반입',
  SAFETY_CHECK:      '안전점검',
  MEETING:           '회의',
  RESTRICTED_ACCESS: '출입통제',
  OTHER:             '기타',
}

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  PLANNED:     '예정',
  IN_PROGRESS: '진행중',
  DONE:        '완료',
  CANCELED:    '취소',
  POSTPONED:   '연기',
}

const SCHEDULE_STATUS_COLORS: Record<string, string> = {
  PLANNED:     'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  DONE:        'bg-green-100 text-green-700',
  CANCELED:    'bg-[rgba(255,255,255,0.04)] text-[#718096] line-through',
  POSTPONED:   'bg-orange-100 text-orange-700',
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: '출근',
  ABSENT:  '결근',
  LATE:    '지각',
  UNKNOWN: '미확인',
}

const TBM_STATUS_LABELS: Record<string, string> = {
  ATTENDED:     '참석',
  NOT_ATTENDED: '미참석',
  UNKNOWN:      '미확인',
}

const SAFETY_STATUS_LABELS: Record<string, string> = {
  COMPLETED:     '완료',
  NOT_COMPLETED: '미완료',
  UNKNOWN:       '미확인',
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR')
}

function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function SiteDetailPage() {
  const params    = useParams()
  const router    = useRouter()
  const siteId    = params.id as string

  const [tab, setTab] = useState<Tab>('info')
  const [siteName, setSiteName] = useState<string>('')

  // ── 기본정보 탭 상태 ───────────────────────────────────────────
  const [siteInfo, setSiteInfo]       = useState<SiteInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoEditing, setInfoEditing] = useState(false)
  const [infoSaving, setInfoSaving]   = useState(false)
  const [infoForm, setInfoForm]       = useState({
    name: '', address: '', latitude: '', longitude: '',
    allowedRadius: '', siteCode: '', openedAt: '', closedAt: '', notes: '',
  })

  // ── 참여회사 탭 상태 ───────────────────────────────────────────
  const [siteCompanies, setSiteCompanies]       = useState<SiteCompanyAssignment[]>([])
  const [scLoading, setScLoading]               = useState(false)
  const [showCompanyForm, setShowCompanyForm]   = useState(false)
  const [companyMode, setCompanyMode]           = useState<'existing' | 'new'>('existing')
  const [companyFormData, setCompanyFormData]   = useState({
    companyId: '', contractType: 'SUBCONTRACT', startDate: '',
    endDate: '', managerName: '', managerPhone: '', notes: '',
  })
  const [newCompanyData, setNewCompanyData]     = useState({
    companyName: '', businessNumber: '', representativeName: '',
    contactPhone: '', email: '', companyType: 'PARTNER',
  })
  const [companyList, setCompanyList]           = useState<{ id: string; companyName: string }[]>([])
  const [companyFormError, setCompanyFormError] = useState('')
  const [companyFormSaving, setCompanyFormSaving] = useState(false)

  // ── 작업자 배치 탭 상태 ────────────────────────────────────────
  const [assignedWorkers, setAssignedWorkers]   = useState<AssignedWorker[]>([])
  const [awLoading, setAwLoading]               = useState(false)
  const [showAssignForm, setShowAssignForm]      = useState(false)
  const [assignForm, setAssignForm]             = useState({
    workerId: '', companyId: '', assignedFrom: today(),
    assignedTo: '', tradeType: '', isPrimary: false, notes: '',
  })
  const [workerSearch, setWorkerSearch]         = useState('')
  const [workerSearchResults, setWorkerSearchResults] = useState<{ id: string; name: string; phone?: string }[]>([])
  const [wsSearching, setWsSearching]           = useState(false)

  // 날짜 필터 (일정/작업일보/출근자 공용)
  const [selectedDate, setSelectedDate] = useState<string>(today())
  // 작업일보 상태 (TbmTab/DailyOpsCard 잠금 전파용)
  const [worklogStatus, setWorklogStatus] = useState<string | null>(null)
  const [opsCardRefresh, setOpsCardRefresh] = useState(0)

  const handleWorklogStatusChange = useCallback((status: string | null) => {
    setWorklogStatus(status)
    setOpsCardRefresh((n) => n + 1)
  }, [])

  // ── 공지 상태 ────────────────────────────────────────────────────
  const [notices, setNotices]       = useState<SiteNotice[]>([])
  const [noticeLoading, setNL]      = useState(false)
  const [showNoticeForm, setSNF]    = useState(false)
  const [noticeForm, setNoticeForm] = useState({
    title: '', content: '', noticeType: 'GENERAL_NOTICE',
    visibilityScope: 'ALL_WORKERS', startDate: today(), endDate: '',
    isTodayHighlight: false,
  })

  // ── 일정 상태 ────────────────────────────────────────────────────
  const [schedules, setSchedules]   = useState<SiteDailySchedule[]>([])
  const [schedLoading, setSL]       = useState(false)
  const [showSchedForm, setSSF]     = useState(false)
  const [schedForm, setSchedForm]   = useState({
    title: '', scheduleType: 'TBM', description: '',
    plannedStartAt: '', plannedEndAt: '', location: '', status: 'PLANNED',
  })

  // ── 출근자 상태 ────────────────────────────────────────────────
  const [workers, setWorkers]       = useState<DailyWorkerStatus[]>([])
  const [wrkLoading, setWKL]        = useState(false)
  const [wrkFilter, setWrkFilter]   = useState<string>('ALL')

  // ─── 데이터 로드 ───────────────────────────────────────────────

  const loadSiteInfo = useCallback(async () => {
    setInfoLoading(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}`)
      if (res.ok) {
        const data = await res.json()
        const s = data.data as SiteInfo | undefined
        if (s) {
          setSiteName(s.name)
          setSiteInfo(s)
        }
      }
    } catch { /* ignore */ }
    finally { setInfoLoading(false) }
  }, [siteId])

  const loadSiteCompanies = useCallback(async () => {
    setScLoading(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/company-assignments`)
      if (res.ok) {
        const data = await res.json()
        setSiteCompanies(data.data ?? [])
      }
    } finally { setScLoading(false) }
  }, [siteId])

  const loadAssignedWorkers = useCallback(async () => {
    setAwLoading(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/workers?activeOnly=true`)
      if (res.ok) {
        const data = await res.json()
        setAssignedWorkers(data.data?.assignments ?? [])
      }
    } finally { setAwLoading(false) }
  }, [siteId])

  const loadNotices = useCallback(async () => {
    setNL(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/notices?activeOnly=true`)
      if (res.ok) {
        const data = await res.json()
        setNotices(data.data?.notices ?? [])
      }
    } finally { setNL(false) }
  }, [siteId])

  const loadSchedules = useCallback(async () => {
    setSL(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/schedules?date=${selectedDate}`)
      if (res.ok) {
        const data = await res.json()
        setSchedules(data.data?.schedules ?? [])
      }
    } finally { setSL(false) }
  }, [siteId, selectedDate])

  const loadWorkers = useCallback(async () => {
    setWKL(true)
    try {
      const params = new URLSearchParams({ date: selectedDate })
      if (wrkFilter !== 'ALL') {
        if (['PRESENT','ABSENT','LATE','UNKNOWN'].includes(wrkFilter)) params.set('attendanceStatus', wrkFilter)
        else if (['ATTENDED','NOT_ATTENDED'].includes(wrkFilter)) params.set('tbmStatus', wrkFilter)
        else if (['COMPLETED','NOT_COMPLETED'].includes(wrkFilter)) params.set('safetyCheckStatus', wrkFilter)
      }
      const res = await fetch(`/api/admin/sites/${siteId}/daily-workers?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWorkers(data.data?.statuses ?? [])
      }
    } finally { setWKL(false) }
  }, [siteId, selectedDate, wrkFilter])

  useEffect(() => { loadSiteInfo() }, [loadSiteInfo])

  useEffect(() => {
    if (tab === 'info')             loadSiteInfo()
    if (tab === 'companies')        loadSiteCompanies()
    if (tab === 'assigned-workers') loadAssignedWorkers()
    if (tab === 'notices')          loadNotices()
    if (tab === 'schedules')        loadSchedules()
    if (tab === 'workers')          loadWorkers()
  }, [tab, selectedDate, loadSiteInfo, loadSiteCompanies, loadAssignedWorkers, loadNotices, loadSchedules, loadWorkers])

  useEffect(() => {
    if (tab === 'workers') loadWorkers()
  }, [wrkFilter, tab, loadWorkers])

  // ─── 참여회사 추가 ────────────────────────────────────────────

  const openCompanyForm = async () => {
    setCompanyFormError('')
    setShowCompanyForm(true)
    if (companyList.length === 0) {
      const res = await fetch('/api/admin/companies?pageSize=200')
      if (res.ok) {
        const d = await res.json()
        setCompanyList(d.data?.items ?? [])
      }
    }
  }

  const submitCompanyAssign = async () => {
    if (!companyFormData.startDate) {
      setCompanyFormError('시작일은 필수입니다.')
      return
    }
    if (companyMode === 'existing' && !companyFormData.companyId) {
      setCompanyFormError('회사를 선택하세요.')
      return
    }
    if (companyMode === 'new' && !newCompanyData.companyName.trim()) {
      setCompanyFormError('회사명을 입력하세요.')
      return
    }
    setCompanyFormSaving(true)
    setCompanyFormError('')
    try {
      const body = companyMode === 'existing'
        ? {
            companyId:    companyFormData.companyId,
            contractType: companyFormData.contractType,
            startDate:    companyFormData.startDate,
            endDate:      companyFormData.endDate   || null,
            managerName:  companyFormData.managerName  || null,
            managerPhone: companyFormData.managerPhone || null,
            notes:        companyFormData.notes        || null,
          }
        : {
            newCompany:   newCompanyData,
            contractType: companyFormData.contractType,
            startDate:    companyFormData.startDate,
            endDate:      companyFormData.endDate   || null,
            managerName:  companyFormData.managerName  || null,
            managerPhone: companyFormData.managerPhone || null,
            notes:        companyFormData.notes        || null,
          }

      const res = await fetch(`/api/admin/sites/${siteId}/company-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowCompanyForm(false)
        setCompanyFormData({ companyId: '', contractType: 'SUBCONTRACT', startDate: '', endDate: '', managerName: '', managerPhone: '', notes: '' })
        setNewCompanyData({ companyName: '', businessNumber: '', representativeName: '', contactPhone: '', email: '', companyType: 'PARTNER' })
        setCompanyMode('existing')
        loadSiteCompanies()
      } else {
        const d = await res.json()
        setCompanyFormError(d.error ?? '등록 실패')
      }
    } finally { setCompanyFormSaving(false) }
  }

  const changeParticipationStatus = async (assignmentId: string, status: string) => {
    const res = await fetch(`/api/admin/sites/${siteId}/company-assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participationStatus: status }),
    })
    const d = await res.json()
    if (!res.ok) {
      alert(d.error ?? '상태 변경 실패')
      return
    }
    loadSiteCompanies()
  }

  const removeCompanyAssignment = async (assignmentId: string) => {
    if (!confirm('이 회사의 현장 배정을 해제하시겠습니까?')) return
    await fetch(`/api/admin/sites/${siteId}/company-assignments?assignmentId=${assignmentId}`, { method: 'DELETE' })
    loadSiteCompanies()
  }

  // ─── 기본정보 저장 ────────────────────────────────────────────

  const startInfoEdit = () => {
    if (!siteInfo) return
    setInfoForm({
      name:          siteInfo.name,
      address:       siteInfo.address,
      latitude:      String(siteInfo.latitude),
      longitude:     String(siteInfo.longitude),
      allowedRadius: String(siteInfo.allowedRadius),
      siteCode:      siteInfo.siteCode ?? '',
      openedAt:      siteInfo.openedAt ? siteInfo.openedAt.slice(0, 10) : '',
      closedAt:      siteInfo.closedAt ? siteInfo.closedAt.slice(0, 10) : '',
      notes:         siteInfo.notes ?? '',
    })
    setInfoEditing(true)
  }

  const saveInfoEdit = async () => {
    setInfoSaving(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          infoForm.name || undefined,
          address:       infoForm.address || undefined,
          latitude:      infoForm.latitude  ? parseFloat(infoForm.latitude)  : undefined,
          longitude:     infoForm.longitude ? parseFloat(infoForm.longitude) : undefined,
          allowedRadius: infoForm.allowedRadius ? parseInt(infoForm.allowedRadius) : undefined,
          siteCode:      infoForm.siteCode  || null,
          openedAt:      infoForm.openedAt  || null,
          closedAt:      infoForm.closedAt  || null,
          notes:         infoForm.notes     || null,
        }),
      })
      if (res.ok) {
        setInfoEditing(false)
        await loadSiteInfo()
      } else {
        const d = await res.json()
        alert(d.message ?? '저장 실패')
      }
    } finally { setInfoSaving(false) }
  }

  // ─── 근로자 검색 ──────────────────────────────────────────────

  const searchWorkers = async (q: string) => {
    if (q.length < 1) { setWorkerSearchResults([]); return }
    setWsSearching(true)
    try {
      const res = await fetch(`/api/admin/workers?search=${encodeURIComponent(q)}&pageSize=10`)
      if (res.ok) {
        const data = await res.json()
        setWorkerSearchResults(data.data?.items ?? [])
      }
    } finally { setWsSearching(false) }
  }

  // ─── 현장 근로자 배정 ─────────────────────────────────────────

  const submitAssign = async () => {
    if (!assignForm.workerId || !assignForm.companyId) {
      alert('근로자와 소속 회사를 선택해주세요.')
      return
    }
    const res = await fetch(`/api/admin/sites/${siteId}/workers`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId:    assignForm.workerId,
        companyId:   assignForm.companyId,
        assignedFrom: assignForm.assignedFrom,
        assignedTo:  assignForm.assignedTo  || null,
        tradeType:   assignForm.tradeType   || null,
        isPrimary:   assignForm.isPrimary,
        notes:       assignForm.notes       || null,
      }),
    })
    if (res.ok) {
      setShowAssignForm(false)
      setAssignForm({ workerId: '', companyId: '', assignedFrom: today(), assignedTo: '', tradeType: '', isPrimary: false, notes: '' })
      setWorkerSearch('')
      setWorkerSearchResults([])
      loadAssignedWorkers()
    } else {
      const d = await res.json()
      alert(d.error ?? '배정 실패')
    }
  }

  const removeAssignment = async (assignmentId: string) => {
    if (!confirm('이 근로자의 현장 배정을 해제하시겠습니까?')) return
    const res = await fetch(`/api/admin/sites/${siteId}/workers?assignmentId=${assignmentId}`, { method: 'DELETE' })
    if (res.ok) loadAssignedWorkers()
  }

  // ─── 공지 등록 ───────────────────────────────────────────────

  const submitNotice = async () => {
    const res = await fetch(`/api/admin/sites/${siteId}/notices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...noticeForm,
        endDate: noticeForm.endDate || null,
      }),
    })
    if (res.ok) {
      setSNF(false)
      setNoticeForm({ title: '', content: '', noticeType: 'GENERAL_NOTICE', visibilityScope: 'ALL_WORKERS', startDate: today(), endDate: '', isTodayHighlight: false })
      loadNotices()
    } else {
      const d = await res.json()
      alert(d.message ?? '등록 실패')
    }
  }

  const deactivateNotice = async (noticeId: string) => {
    if (!confirm('이 공지를 비활성화하시겠습니까?')) return
    const res = await fetch(`/api/admin/sites/${siteId}/notices/${noticeId}`, { method: 'DELETE' })
    if (res.ok) loadNotices()
  }

  // ─── 일정 등록 ───────────────────────────────────────────────

  const submitSchedule = async () => {
    const body = {
      scheduleDate: selectedDate,
      scheduleType: schedForm.scheduleType,
      title:        schedForm.title,
      description:  schedForm.description || null,
      location:     schedForm.location   || null,
      plannedStartAt: schedForm.plannedStartAt || null,
      plannedEndAt:   schedForm.plannedEndAt   || null,
      status:         schedForm.status,
    }
    const res = await fetch(`/api/admin/sites/${siteId}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setSSF(false)
      setSchedForm({ title: '', scheduleType: 'TBM', description: '', plannedStartAt: '', plannedEndAt: '', location: '', status: 'PLANNED' })
      loadSchedules()
    } else {
      const d = await res.json()
      alert(d.message ?? '등록 실패')
    }
  }

  const updateScheduleStatus = async (scheduleId: string, status: string) => {
    await fetch(`/api/admin/sites/${siteId}/schedules/${scheduleId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    loadSchedules()
  }

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return
    await fetch(`/api/admin/sites/${siteId}/schedules/${scheduleId}`, { method: 'DELETE' })
    loadSchedules()
  }

  // ─── 렌더 ────────────────────────────────────────────────────

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-[#718096] hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-[#1B2838]">
      {/* 헤더 */}
      <div className="bg-card border-b border-[rgba(91,164,217,0.15)] px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-[#718096] hover:text-white text-sm"
        >
          ← 목록
        </button>
        <h1 className="text-lg font-semibold text-white">
          {siteName || '현장 운영'}
        </h1>
        <span className="text-[#718096] text-sm">/ 운영 기록</span>
      </div>

      {/* 탭 바 */}
      <div className="bg-card border-b border-[rgba(91,164,217,0.15)] px-6 flex gap-1 overflow-x-auto">
        <button className={tabClass('info')}             onClick={() => setTab('info')}>            기본정보</button>
        <button className={tabClass('companies')}        onClick={() => setTab('companies')}>       참여회사</button>
        <button className={tabClass('assigned-workers')} onClick={() => setTab('assigned-workers')}> 작업자 배치</button>
        <div className="h-8 w-px bg-[rgba(91,164,217,0.15)] self-center mx-1" />
        <button className={tabClass('notices')}          onClick={() => setTab('notices')}>          공지</button>
        <button className={tabClass('schedules')}        onClick={() => setTab('schedules')}>        당일 일정</button>
        <button className={tabClass('worklogs')}         onClick={() => setTab('worklogs')}>         작업일보</button>
        <button className={tabClass('tbm')}              onClick={() => setTab('tbm')}>              TBM/안전</button>
        <button className={tabClass('workers')}          onClick={() => setTab('workers')}>          출근자 상세</button>
      </div>

      <div className="px-6 py-6 max-w-5xl mx-auto">

        {/* 날짜 선택 (운영 탭 공용) */}
        {(tab === 'schedules' || tab === 'worklogs' || tab === 'tbm' || tab === 'workers') && (
          <div className="mb-4 flex items-center gap-2">
            <label className="text-sm text-[#CBD5E0] font-medium">날짜</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setWorklogStatus(null)   // 날짜 바뀌면 상태 초기화
              }}
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-xs text-[#718096]">작업일보·TBM·출근자 탭 공용</span>
          </div>
        )}

        {/* 일일 운영 현황 요약 카드 (작업일보/TBM/출근자 탭에서만) */}
        {(tab === 'worklogs' || tab === 'tbm' || tab === 'workers') && (
          <DailyOpsCard
            siteId={siteId}
            selectedDate={selectedDate}
            onStatusLoad={setWorklogStatus}
            refreshKey={opsCardRefresh}
          />
        )}

        {/* ── 탭: 기본정보 ── */}
        {tab === 'info' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-[#CBD5E0]">현장 기본정보</h2>
              {!infoEditing && (
                <button
                  onClick={startInfoEdit}
                  className="text-sm border border-blue-500 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-50"
                >
                  수정
                </button>
              )}
            </div>

            {infoLoading ? (
              <div className="text-center text-[#718096] py-8">불러오는 중...</div>
            ) : infoEditing ? (
              <div className="bg-[rgba(91,164,217,0.06)] border border-blue-500/30 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-blue-300">기본정보 수정</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs text-[#CBD5E0] block mb-1">현장명 *</label>
                    <input className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={infoForm.name}
                      onChange={(e) => setInfoForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-[#CBD5E0] block mb-1">주소</label>
                    <input className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={infoForm.address}
                      onChange={(e) => setInfoForm((f) => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">위도</label>
                    <input type="number" step="any" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={infoForm.latitude}
                      onChange={(e) => setInfoForm((f) => ({ ...f, latitude: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">경도</label>
                    <input type="number" step="any" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={infoForm.longitude}
                      onChange={(e) => setInfoForm((f) => ({ ...f, longitude: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">인증 반경 (m)</label>
                    <input type="number" min="10" max="5000" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={infoForm.allowedRadius}
                      onChange={(e) => setInfoForm((f) => ({ ...f, allowedRadius: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">현장 코드</label>
                    <input className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={infoForm.siteCode}
                      onChange={(e) => setInfoForm((f) => ({ ...f, siteCode: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">착공일</label>
                    <input type="date" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={infoForm.openedAt}
                      onChange={(e) => setInfoForm((f) => ({ ...f, openedAt: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">준공일</label>
                    <input type="date" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={infoForm.closedAt}
                      onChange={(e) => setInfoForm((f) => ({ ...f, closedAt: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-[#CBD5E0] block mb-1">메모</label>
                    <textarea rows={3} className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={infoForm.notes}
                      onChange={(e) => setInfoForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveInfoEdit} disabled={infoSaving}
                    className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                    {infoSaving ? '저장 중...' : '저장'}
                  </button>
                  <button onClick={() => setInfoEditing(false)}
                    className="text-sm border border-[rgba(91,164,217,0.25)] px-4 py-2 rounded text-[#CBD5E0] hover:bg-[rgba(255,255,255,0.05)]">
                    취소
                  </button>
                </div>
              </div>
            ) : siteInfo ? (
              <div className="bg-card border border-[rgba(91,164,217,0.15)] rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div>
                    <span className="text-xs text-[#718096] block">현장명</span>
                    <span className="font-medium text-white">{siteInfo.name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#718096] block">현장 코드</span>
                    <span className="text-[#CBD5E0]">{siteInfo.siteCode ?? '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-[#718096] block">주소</span>
                    <span className="text-[#CBD5E0]">{siteInfo.address}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#718096] block">위도 / 경도</span>
                    <span className="text-[#CBD5E0]">{siteInfo.latitude}, {siteInfo.longitude}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#718096] block">인증 반경</span>
                    <span className="text-[#CBD5E0]">{siteInfo.allowedRadius}m</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#718096] block">착공일</span>
                    <span className="text-[#CBD5E0]">{fmtDate(siteInfo.openedAt)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#718096] block">준공일</span>
                    <span className="text-[#CBD5E0]">{fmtDate(siteInfo.closedAt)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#718096] block">활성 상태</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${siteInfo.isActive ? 'bg-green-100 text-green-700' : 'bg-[rgba(255,255,255,0.04)] text-[#718096]'}`}>
                      {siteInfo.isActive ? '운영중' : '종료'}
                    </span>
                  </div>
                  {siteInfo.notes && (
                    <div className="col-span-2">
                      <span className="text-xs text-[#718096] block">메모</span>
                      <span className="text-[#CBD5E0] whitespace-pre-line">{siteInfo.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-[#718096] py-8">정보를 불러올 수 없습니다.</div>
            )}
          </div>
        )}

        {/* ── 탭: 참여회사 ── */}
        {tab === 'companies' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-[#CBD5E0]">참여회사 목록</h2>
              <button
                onClick={openCompanyForm}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
              >
                + 참여회사 추가
              </button>
            </div>

            {/* 참여회사 추가 폼 */}
            {showCompanyForm && (
              <div className="bg-[rgba(91,164,217,0.06)] border border-blue-500/30 rounded-xl p-5 space-y-4 mb-4">
                <h3 className="text-sm font-semibold text-blue-300">참여회사 추가</h3>

                {/* 모드 선택 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setCompanyMode('existing')}
                    className={`text-xs px-3 py-1.5 rounded border ${companyMode === 'existing' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgba(255,255,255,0.04)] text-[#CBD5E0] border-[rgba(91,164,217,0.25)]'}`}
                  >
                    기존 회사 연결
                  </button>
                  <button
                    onClick={() => setCompanyMode('new')}
                    className={`text-xs px-3 py-1.5 rounded border ${companyMode === 'new' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[rgba(255,255,255,0.04)] text-[#CBD5E0] border-[rgba(91,164,217,0.25)]'}`}
                  >
                    신규 회사 등록
                  </button>
                </div>

                {companyFormError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{companyFormError}</p>
                )}

                {companyMode === 'new' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
                    신규 회사는 <strong>사업자 인증 대기(PENDING_VERIFICATION)</strong> 상태로 등록됩니다.
                    인증 완료 전에는 운영 권한이 열리지 않습니다.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* 회사 선택 또는 신규 입력 */}
                  {companyMode === 'existing' ? (
                    <div className="col-span-2">
                      <label className="text-xs text-[#CBD5E0] block mb-1">회사 선택 *</label>
                      <select
                        className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                        value={companyFormData.companyId}
                        onChange={(e) => setCompanyFormData((f) => ({ ...f, companyId: e.target.value }))}
                      >
                        <option value="">회사를 선택하세요</option>
                        {companyList.map((c) => (
                          <option key={c.id} value={c.id}>{c.companyName}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs text-[#CBD5E0] block mb-1">회사명 *</label>
                        <input className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                          placeholder="예: (주)대림건설"
                          value={newCompanyData.companyName}
                          onChange={(e) => setNewCompanyData((f) => ({ ...f, companyName: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-[#CBD5E0] block mb-1">사업자등록번호</label>
                        <input className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                          placeholder="000-00-00000"
                          value={newCompanyData.businessNumber}
                          onChange={(e) => setNewCompanyData((f) => ({ ...f, businessNumber: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-[#CBD5E0] block mb-1">대표자</label>
                        <input className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                          value={newCompanyData.representativeName}
                          onChange={(e) => setNewCompanyData((f) => ({ ...f, representativeName: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-[#CBD5E0] block mb-1">연락처</label>
                        <input className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                          placeholder="010-0000-0000"
                          value={newCompanyData.contactPhone}
                          onChange={(e) => setNewCompanyData((f) => ({ ...f, contactPhone: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-[#CBD5E0] block mb-1">유형</label>
                        <select className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                          value={newCompanyData.companyType}
                          onChange={(e) => setNewCompanyData((f) => ({ ...f, companyType: e.target.value }))}>
                          <option value="PARTNER">협력사</option>
                          <option value="GENERAL_CONSTRUCTOR">종합건설</option>
                          <option value="SPECIALTY_CONSTRUCTOR">전문건설</option>
                          <option value="OTHER">기타</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[#CBD5E0] block mb-1">이메일</label>
                        <input type="email" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                          value={newCompanyData.email}
                          onChange={(e) => setNewCompanyData((f) => ({ ...f, email: e.target.value }))} />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">계약 유형</label>
                    <select
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={companyFormData.contractType}
                      onChange={(e) => setCompanyFormData((f) => ({ ...f, contractType: e.target.value }))}
                    >
                      <option value="PRIME">원청</option>
                      <option value="SUBCONTRACT">하도급</option>
                      <option value="JOINT_VENTURE">공동도급</option>
                      <option value="SPECIALTY">전문건설</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">시작일 *</label>
                    <input type="date" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={companyFormData.startDate}
                      onChange={(e) => setCompanyFormData((f) => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">종료일</label>
                    <input type="date" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={companyFormData.endDate}
                      onChange={(e) => setCompanyFormData((f) => ({ ...f, endDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">현장 담당자명</label>
                    <input className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      placeholder="예: 홍길동"
                      value={companyFormData.managerName}
                      onChange={(e) => setCompanyFormData((f) => ({ ...f, managerName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">담당자 연락처</label>
                    <input className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      placeholder="010-0000-0000"
                      value={companyFormData.managerPhone}
                      onChange={(e) => setCompanyFormData((f) => ({ ...f, managerPhone: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={submitCompanyAssign} disabled={companyFormSaving}
                    className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                    {companyFormSaving ? '등록 중...' : companyMode === 'new' ? '신규 등록' : '연결'}
                  </button>
                  <button onClick={() => setShowCompanyForm(false)}
                    className="text-sm border border-[rgba(91,164,217,0.25)] px-4 py-2 rounded text-[#CBD5E0] hover:bg-[rgba(255,255,255,0.05)]">
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 참여회사 목록 */}
            {scLoading ? (
              <div className="text-center text-[#718096] py-8">불러오는 중...</div>
            ) : siteCompanies.length === 0 ? (
              <div className="text-center text-[#718096] py-8 bg-card border border-[rgba(91,164,217,0.15)] rounded-xl">
                <p className="mb-2">등록된 참여회사가 없습니다.</p>
                <p className="text-xs">위 버튼으로 참여회사를 추가하세요.</p>
              </div>
            ) : (
              <div className="bg-card border border-[rgba(91,164,217,0.15)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[rgba(255,255,255,0.04)] border-b border-[rgba(91,164,217,0.15)]">
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">회사명</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">참여 상태</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">인증 상태</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">관리자</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">담당자</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">기간</th>
                      <th className="px-4 py-2.5 text-xs text-[#CBD5E0] font-medium text-right">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteCompanies.map((a) => {
                      const vs = a.company.externalVerificationStatus
                      const ps = a.participationStatus
                      const vsLabel: Record<string, string> = {
                        DRAFT: '미신청', PENDING_VERIFICATION: '인증 대기',
                        VERIFIED: '인증완료', REJECTED: '반려', INACTIVE: '비활성',
                      }
                      const vsColor: Record<string, string> = {
                        DRAFT: 'bg-[rgba(255,255,255,0.04)] text-[#718096]',
                        PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-700',
                        VERIFIED: 'bg-green-100 text-green-700',
                        REJECTED: 'bg-red-100 text-red-600',
                        INACTIVE: 'bg-[rgba(255,255,255,0.04)] text-[#718096]',
                      }
                      const psLabel: Record<string, string> = {
                        PLANNED: '참여 예정', ACTIVE: '운영 중', STOPPED: '참여 중지',
                      }
                      const psColor: Record<string, string> = {
                        PLANNED: 'bg-blue-50 text-blue-600',
                        ACTIVE:  'bg-green-100 text-green-700',
                        STOPPED: 'bg-[rgba(255,255,255,0.04)] text-[#718096]',
                      }
                      const ctype: Record<string, string> = {
                        PRIME: '원청', SUBCONTRACT: '하도급', JOINT_VENTURE: '공동도급', SPECIALTY: '전문건설',
                      }
                      const canActivate = ps !== 'ACTIVE' && (!vs || vs === 'VERIFIED')
                      const canStop = ps === 'ACTIVE'
                      return (
                        <tr key={a.id} className="border-b border-[rgba(91,164,217,0.15)] hover:bg-[rgba(255,255,255,0.05)]">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-sm text-white">{a.company.companyName}</div>
                            <div className="text-xs text-[#718096]">{ctype[a.contractType] ?? a.contractType}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${psColor[ps] ?? 'bg-[rgba(255,255,255,0.04)] text-[#718096]'}`}>
                              {psLabel[ps] ?? ps}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {vs ? (
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${vsColor[vs] ?? 'bg-[rgba(255,255,255,0.04)] text-[#718096]'}`}>
                                {vsLabel[vs] ?? vs}
                              </span>
                            ) : (
                              <span className="text-xs text-[#718096]">내부</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center text-sm text-[#CBD5E0]">
                            {a.managerCount > 0 ? (
                              <span className="bg-blue-900/40 text-blue-300 text-xs px-2 py-0.5 rounded">{a.managerCount}명</span>
                            ) : (
                              <span className="text-xs text-[#718096]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[#718096] text-xs">
                            {a.managerName ?? '—'}{a.managerPhone && ` · ${a.managerPhone}`}
                          </td>
                          <td className="px-4 py-2.5 text-[#718096] text-xs">
                            {fmtDate(a.startDate)} ~{a.endDate ? ` ${fmtDate(a.endDate)}` : ' 진행중'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex gap-1.5 justify-end">
                              {canActivate && (
                                <button
                                  onClick={() => changeParticipationStatus(a.id, 'ACTIVE')}
                                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                                >
                                  운영 활성
                                </button>
                              )}
                              {canStop && (
                                <button
                                  onClick={() => changeParticipationStatus(a.id, 'STOPPED')}
                                  className="text-xs bg-gray-400 text-white px-2 py-1 rounded hover:bg-gray-500"
                                >
                                  중지
                                </button>
                              )}
                              <button
                                onClick={() => removeCompanyAssignment(a.id)}
                                className="text-xs text-red-400 hover:text-red-600 px-1"
                              >
                                해제
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} className="px-4 py-2 text-xs text-[#718096] bg-[rgba(255,255,255,0.04)]">
                        총 {siteCompanies.length}개 회사 · 운영중 {siteCompanies.filter((a) => a.participationStatus === 'ACTIVE').length}개
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── 탭: 작업자 배치 ── */}
        {tab === 'assigned-workers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-[#CBD5E0]">현장 배치 근로자</h2>
              <button
                onClick={() => setShowAssignForm((v) => !v)}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
              >
                + 근로자 배치
              </button>
            </div>

            {/* 배치 폼 */}
            {showAssignForm && (
              <div className="bg-[rgba(91,164,217,0.06)] border border-blue-500/30 rounded-xl p-5 space-y-4 mb-4">
                <h3 className="text-sm font-semibold text-blue-300">근로자 현장 배치</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* 근로자 검색 */}
                  <div className="col-span-2">
                    <label className="text-xs text-[#CBD5E0] block mb-1">근로자 검색 (이름/전화번호) *</label>
                    <input
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      placeholder="이름 또는 전화번호 입력"
                      value={workerSearch}
                      onChange={(e) => {
                        setWorkerSearch(e.target.value)
                        searchWorkers(e.target.value)
                      }}
                    />
                    {wsSearching && <p className="text-xs text-[#718096] mt-1">검색 중...</p>}
                    {workerSearchResults.length > 0 && (
                      <div className="border border-[rgba(91,164,217,0.25)] rounded bg-card shadow-[0_2px_8px_rgba(0,0,0,0.35)] mt-1 max-h-40 overflow-y-auto">
                        {workerSearchResults.map((w) => (
                          <button
                            key={w.id}
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[rgba(255,255,255,0.05)] border-b border-[rgba(91,164,217,0.15)] last:border-0"
                            onClick={() => {
                              setAssignForm((f) => ({ ...f, workerId: w.id }))
                              setWorkerSearch(`${w.name} ${w.phone ?? ''}`.trim())
                              setWorkerSearchResults([])
                            }}
                          >
                            {w.name} {w.phone && <span className="text-[#718096] text-xs ml-1">{w.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {assignForm.workerId && (
                      <p className="text-xs text-green-600 mt-1">✓ 근로자 선택됨 (ID: {assignForm.workerId.slice(0, 8)}...)</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">소속 회사 ID *</label>
                    <input
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      placeholder="회사 ID 입력"
                      value={assignForm.companyId}
                      onChange={(e) => setAssignForm((f) => ({ ...f, companyId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">공종</label>
                    <input
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      placeholder="예: 철근, 거푸집"
                      value={assignForm.tradeType}
                      onChange={(e) => setAssignForm((f) => ({ ...f, tradeType: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">배정 시작일 *</label>
                    <input type="date" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={assignForm.assignedFrom}
                      onChange={(e) => setAssignForm((f) => ({ ...f, assignedFrom: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">배정 종료일</label>
                    <input type="date" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={assignForm.assignedTo}
                      onChange={(e) => setAssignForm((f) => ({ ...f, assignedTo: e.target.value }))} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <input type="checkbox" id="isPrimary"
                      checked={assignForm.isPrimary}
                      onChange={(e) => setAssignForm((f) => ({ ...f, isPrimary: e.target.checked }))} />
                    <label htmlFor="isPrimary" className="text-sm text-[#CBD5E0]">주 배정 현장으로 설정</label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={submitAssign}
                    className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    배치 등록
                  </button>
                  <button onClick={() => { setShowAssignForm(false); setWorkerSearch(''); setWorkerSearchResults([]) }}
                    className="text-sm border border-[rgba(91,164,217,0.25)] px-4 py-2 rounded text-[#CBD5E0] hover:bg-[rgba(255,255,255,0.05)]">
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 배치된 근로자 목록 */}
            {awLoading ? (
              <div className="text-center text-[#718096] py-8">불러오는 중...</div>
            ) : assignedWorkers.length === 0 ? (
              <div className="text-center text-[#718096] py-8 bg-card border border-[rgba(91,164,217,0.15)] rounded-xl">
                <p className="mb-2">배치된 근로자가 없습니다.</p>
                <p className="text-xs">위 버튼으로 근로자를 이 현장에 배치하세요.</p>
              </div>
            ) : (
              <div className="bg-card border border-[rgba(91,164,217,0.15)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[rgba(255,255,255,0.04)] border-b border-[rgba(91,164,217,0.15)]">
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">이름</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">소속</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">공종</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">배정 기간</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">주 배정</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {assignedWorkers.map((a) => (
                      <tr key={a.id} className="border-b border-[rgba(91,164,217,0.15)] hover:bg-[rgba(255,255,255,0.05)]">
                        <td className="px-4 py-2.5 font-medium text-white">{a.worker.name}</td>
                        <td className="px-4 py-2.5 text-[#718096] text-xs">{a.company.companyName}</td>
                        <td className="px-4 py-2.5 text-[#718096] text-xs">{a.tradeType ?? '—'}</td>
                        <td className="px-4 py-2.5 text-[#718096] text-xs">
                          {fmtDate(a.assignedFrom)} ~ {a.assignedTo ? fmtDate(a.assignedTo) : '진행중'}
                        </td>
                        <td className="px-4 py-2.5">
                          {a.isPrimary && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">주</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => removeAssignment(a.id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            배정해제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="px-4 py-2 text-xs text-[#718096] bg-[rgba(255,255,255,0.04)]">
                        총 {assignedWorkers.length}명 배치됨
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── 탭 1: 공지 ── */}
        {tab === 'notices' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-[#CBD5E0]">현장 공지</h2>
              <button
                onClick={() => setSNF(true)}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
              >
                + 공지 등록
              </button>
            </div>

            {/* 공지 등록 폼 */}
            {showNoticeForm && (
              <div className="bg-[rgba(91,164,217,0.06)] border border-blue-500/30 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-blue-300 mb-3">새 공지 등록</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-[#CBD5E0] block mb-1">제목</label>
                    <input
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      value={noticeForm.title}
                      onChange={(e) => setNoticeForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="공지 제목"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">공지 유형</label>
                    <select
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={noticeForm.noticeType}
                      onChange={(e) => setNoticeForm((f) => ({ ...f, noticeType: e.target.value }))}
                    >
                      {Object.entries(NOTICE_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">노출 대상</label>
                    <select
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={noticeForm.visibilityScope}
                      onChange={(e) => setNoticeForm((f) => ({ ...f, visibilityScope: e.target.value }))}
                    >
                      <option value="ALL_WORKERS">전체 근로자</option>
                      <option value="SITE_MANAGERS_ONLY">현장 관리자 이상</option>
                      <option value="HQ_AND_SITE_MANAGERS">본사+현장 관리자</option>
                      <option value="SPECIFIC_TEAM_ONLY">특정 팀만</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">시작일</label>
                    <input
                      type="date" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={noticeForm.startDate}
                      onChange={(e) => setNoticeForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">종료일 (선택)</label>
                    <input
                      type="date" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={noticeForm.endDate}
                      onChange={(e) => setNoticeForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-[#CBD5E0] block mb-1">내용</label>
                    <textarea
                      rows={3}
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={noticeForm.content}
                      onChange={(e) => setNoticeForm((f) => ({ ...f, content: e.target.value }))}
                      placeholder="공지 내용을 입력하세요"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="todayHighlight"
                      checked={noticeForm.isTodayHighlight}
                      onChange={(e) => setNoticeForm((f) => ({ ...f, isTodayHighlight: e.target.checked }))}
                    />
                    <label htmlFor="todayHighlight" className="text-sm text-[#CBD5E0]">오늘 강조 공지</label>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={submitNotice}
                    className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700"
                  >
                    등록
                  </button>
                  <button
                    onClick={() => setSNF(false)}
                    className="text-sm border border-[rgba(91,164,217,0.25)] px-4 py-1.5 rounded text-[#CBD5E0] hover:bg-[rgba(255,255,255,0.05)]"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 공지 목록 */}
            {noticeLoading ? (
              <div className="text-center text-[#718096] py-8">불러오는 중...</div>
            ) : notices.length === 0 ? (
              <div className="text-center text-[#718096] py-8">등록된 공지가 없습니다.</div>
            ) : (
              <div className="space-y-3">
                {notices.map((n) => (
                  <div
                    key={n.id}
                    className={`bg-card border rounded-lg p-4 ${n.isTodayHighlight ? 'border-blue-400 shadow-[0_2px_8px_rgba(0,0,0,0.35)]' : 'border-[rgba(91,164,217,0.15)]'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.isTodayHighlight && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">오늘 강조</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded ${NOTICE_TYPE_COLORS[n.noticeType] ?? 'bg-[rgba(255,255,255,0.08)] text-[#CBD5E0]'}`}>
                          {NOTICE_TYPE_LABELS[n.noticeType] ?? n.noticeType}
                        </span>
                        <span className="font-medium text-white text-sm">{n.title}</span>
                      </div>
                      <button
                        onClick={() => deactivateNotice(n.id)}
                        className="text-xs text-red-400 hover:text-red-600 ml-2 flex-shrink-0"
                      >
                        비활성화
                      </button>
                    </div>
                    <p className="text-sm text-[#CBD5E0] mt-2 whitespace-pre-line">{n.content}</p>
                    <div className="text-xs text-[#718096] mt-2">
                      유효 기간: {fmtDate(n.startDate)} ~ {n.endDate ? fmtDate(n.endDate) : '미정'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 탭 2: 당일 일정 ── */}
        {tab === 'schedules' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-[#CBD5E0]">{fmtDate(selectedDate)} 일정</h2>
              <button
                onClick={() => setSSF(true)}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
              >
                + 일정 등록
              </button>
            </div>

            {/* 일정 등록 폼 */}
            {showSchedForm && (
              <div className="bg-[rgba(91,164,217,0.06)] border border-green-500/30 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-green-400 mb-3">일정 등록 — {selectedDate}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-[#CBD5E0] block mb-1">제목</label>
                    <input
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={schedForm.title}
                      onChange={(e) => setSchedForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="일정 제목"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">일정 유형</label>
                    <select
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={schedForm.scheduleType}
                      onChange={(e) => setSchedForm((f) => ({ ...f, scheduleType: e.target.value }))}
                    >
                      {Object.entries(SCHEDULE_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">상태</label>
                    <select
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={schedForm.status}
                      onChange={(e) => setSchedForm((f) => ({ ...f, status: e.target.value }))}
                    >
                      {Object.entries(SCHEDULE_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">시작 시각 (선택)</label>
                    <input
                      type="datetime-local" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={schedForm.plannedStartAt}
                      onChange={(e) => setSchedForm((f) => ({ ...f, plannedStartAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">종료 시각 (선택)</label>
                    <input
                      type="datetime-local" className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={schedForm.plannedEndAt}
                      onChange={(e) => setSchedForm((f) => ({ ...f, plannedEndAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#CBD5E0] block mb-1">위치 (선택)</label>
                    <input
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={schedForm.location}
                      onChange={(e) => setSchedForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="예: 3층 복도"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-[#CBD5E0] block mb-1">상세 설명 (선택)</label>
                    <textarea
                      rows={2}
                      className="w-full border border-[rgba(91,164,217,0.25)] rounded px-2 py-1.5 text-sm bg-[rgba(255,255,255,0.06)] text-white"
                      value={schedForm.description}
                      onChange={(e) => setSchedForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={submitSchedule}
                    className="text-sm bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700"
                  >
                    등록
                  </button>
                  <button
                    onClick={() => setSSF(false)}
                    className="text-sm border border-[rgba(91,164,217,0.25)] px-4 py-1.5 rounded text-[#CBD5E0] hover:bg-[rgba(255,255,255,0.05)]"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 일정 목록 */}
            {schedLoading ? (
              <div className="text-center text-[#718096] py-8">불러오는 중...</div>
            ) : schedules.length === 0 ? (
              <div className="text-center text-[#718096] py-8">등록된 일정이 없습니다.</div>
            ) : (
              <div className="space-y-3">
                {schedules.map((s) => (
                  <div key={s.id} className="bg-card border border-[rgba(91,164,217,0.15)] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-[rgba(255,255,255,0.08)] text-[#CBD5E0] px-2 py-0.5 rounded">
                          {SCHEDULE_TYPE_LABELS[s.scheduleType] ?? s.scheduleType}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${SCHEDULE_STATUS_COLORS[s.status] ?? ''}`}>
                          {SCHEDULE_STATUS_LABELS[s.status] ?? s.status}
                        </span>
                        <span className="font-medium text-white text-sm">{s.title}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <select
                          className="text-xs border border-[rgba(91,164,217,0.25)] rounded px-1 py-0.5 bg-[rgba(255,255,255,0.06)] text-white"
                          value={s.status}
                          onChange={(e) => updateScheduleStatus(s.id, e.target.value)}
                        >
                          {Object.entries(SCHEDULE_STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => deleteSchedule(s.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    {(s.plannedStartAt || s.location) && (
                      <div className="text-xs text-[#718096] mt-1">
                        {s.plannedStartAt && <span>⏰ {fmtDateTime(s.plannedStartAt)}</span>}
                        {s.plannedEndAt   && <span> ~ {fmtDateTime(s.plannedEndAt)}</span>}
                        {s.location       && <span className="ml-3">📍 {s.location}</span>}
                      </div>
                    )}
                    {s.description && (
                      <p className="text-xs text-[#718096] mt-1">{s.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 탭 3: 작업일보 ── */}
        {tab === 'worklogs' && (
          <WorklogTab
            siteId={siteId}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onStatusChange={handleWorklogStatusChange}
          />
        )}

        {/* ── 탭 4: TBM/안전 ── */}
        {tab === 'tbm' && (
          <TbmTab
            siteId={siteId}
            selectedDate={selectedDate}
            locked={worklogStatus === 'LOCKED'}
          />
        )}

        {/* ── 탭 5: 출근자 상세 (관리자 전용) ── */}
        {tab === 'workers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-[#CBD5E0]">{fmtDate(selectedDate)} 출근자 상세</h2>
              <div className="flex items-center gap-2">
                {worklogStatus === 'LOCKED' && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-600">
                    🔒 작업일보 확정 — 조회 전용
                  </span>
                )}
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                  관리자 전용
                </span>
              </div>
            </div>

            {/* 필터 버튼 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { value: 'ALL',           label: '전체' },
                { value: 'PRESENT',       label: '출근' },
                { value: 'ABSENT',        label: '결근' },
                { value: 'NOT_ATTENDED',  label: 'TBM 미참석' },
                { value: 'NOT_COMPLETED', label: '안전확인 누락' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setWrkFilter(value)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    wrkFilter === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-[rgba(91,164,217,0.25)] text-[#CBD5E0] hover:bg-[rgba(255,255,255,0.05)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {wrkLoading ? (
              <div className="text-center text-[#718096] py-8">불러오는 중...</div>
            ) : workers.length === 0 ? (
              <div className="text-center text-[#718096] py-8">해당 날짜 인원 데이터가 없습니다.</div>
            ) : (
              <div className="bg-card border border-[rgba(91,164,217,0.15)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[rgba(255,255,255,0.04)] border-b border-[rgba(91,164,217,0.15)]">
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">이름</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">팀</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">출근</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">출근시각</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">퇴근시각</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">TBM</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">안전확인</th>
                      <th className="text-left px-4 py-2.5 text-xs text-[#CBD5E0] font-medium">특이사항</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((w) => (
                      <tr key={w.id} className="border-b border-[rgba(91,164,217,0.15)] hover:bg-[rgba(255,255,255,0.05)]">
                        <td className="px-4 py-2.5 font-medium text-white">{w.worker.name}</td>
                        <td className="px-4 py-2.5 text-[#718096]">{w.teamLabel ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            w.attendanceStatus === 'PRESENT' ? 'bg-green-100 text-green-700' :
                            w.attendanceStatus === 'ABSENT'  ? 'bg-red-100 text-red-700' :
                            'bg-[rgba(255,255,255,0.04)] text-[#718096]'
                          }`}>
                            {ATTENDANCE_STATUS_LABELS[w.attendanceStatus] ?? w.attendanceStatus}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[#CBD5E0] text-xs">{fmtDateTime(w.checkInAt)}</td>
                        <td className="px-4 py-2.5 text-[#CBD5E0] text-xs">
                          {w.checkOutAt ? fmtDateTime(w.checkOutAt) : (
                            <span className="text-orange-500">미퇴근</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            w.tbmStatus === 'ATTENDED'     ? 'bg-green-100 text-green-700' :
                            w.tbmStatus === 'NOT_ATTENDED' ? 'bg-red-100 text-red-700' :
                            'bg-[rgba(255,255,255,0.04)] text-[#718096]'
                          }`}>
                            {TBM_STATUS_LABELS[w.tbmStatus] ?? w.tbmStatus}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            w.safetyCheckStatus === 'COMPLETED'     ? 'bg-green-100 text-green-700' :
                            w.safetyCheckStatus === 'NOT_COMPLETED' ? 'bg-red-100 text-red-700' :
                            'bg-[rgba(255,255,255,0.04)] text-[#718096]'
                          }`}>
                            {SAFETY_STATUS_LABELS[w.safetyCheckStatus] ?? w.safetyCheckStatus}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#718096]">{w.remarks ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 text-xs text-[#718096] bg-[rgba(255,255,255,0.04)]">
                  총 {workers.length}명
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
