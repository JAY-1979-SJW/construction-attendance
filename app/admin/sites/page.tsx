'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'
import {
  PageShell, PageHeader, PageBadge,
  SectionCard, Btn,
  FilterInput, FilterSelect, FilterPill, FilterSpacer,
  KpiCard,
  FormInput, FormSelect, FormGrid, ModalFooter,
  Modal, Toast,
} from '@/components/admin/ui'

// ── 전역 타입 ──────────────────────────────────────────────────────────────
declare global {
  interface Window {
    daum: {
      Postcode: new (opts: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void
      }) => { open: () => void }
    }
  }
}

// ── 미출근 확인필요 기준값
// 현재: 하드코딩 임시값 (기본 2명)
// 예정: /admin/settings → AppSettings.absentAlertThreshold 에서 동적 조회로 전환
//       (추후 API에서 settings 값 병행 로드 후 이 상수를 대체)
const ABSENT_ALERT_THRESHOLD = 2

// ── 타입 ───────────────────────────────────────────────────────────────────
interface SiteCompanyAssignment {
  id: string
  companyId: string
  company: { id: string; companyName: string; companyType?: string }
  contractType: string
  startDate: string
  endDate?: string | null
  managerName?: string | null
  managerPhone?: string | null
  notes?: string | null
}

interface Site {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  allowedRadius: number
  isActive: boolean
  siteCode?: string | null
  openedAt?: string | null
  closedAt?: string | null
  notes?: string | null
  createdAt: string
  companyAssignments: SiteCompanyAssignment[]
  // 통계 (API includeStats=true)
  assignedWorkerCount: number
  todayCheckInCount: number
  absentCount: number
  todayWage: number
  monthWage: number
  totalWage: number
}

interface Company { id: string; companyName: string; companyType?: string }

// ── 운영 상태 / 계약 상태 (완전 분리) ────────────────────────────────────
//
// 운영 상태: 현장이 현재 어떤 상태로 운영 중인가
//   ACTIVE    운영중   — isActive=true, 정상 운영 중
//   UPCOMING  예정     — isActive=true, 착공일 미도달
//   SUSPENDED 중지     — isActive=false이지만 계약기간이 아직 있음 (강제 중지)
//   CLOSED    종료     — isActive=false이고 계약도 종료됨 (또는 날짜 없이 비활성)
//   ATTENTION 확인필요 — 운영 중인데 문제 사유 존재
//
// 계약 상태: 계약기간이 어느 단계에 있는가
//   UNSET       미입력    — openedAt/closedAt 모두 없음
//   NOT_STARTED 시작전    — openedAt가 오늘 이후
//   IN_PROGRESS 진행중    — openedAt <= 오늘, closedAt > 오늘+30
//   ENDING_SOON 종료임박  — closedAt가 30일 이내
//   ENDED       종료됨    — closedAt가 오늘 이전
//
type OpStatus = 'ACTIVE' | 'UPCOMING' | 'SUSPENDED' | 'CLOSED' | 'ATTENTION'
type CpStatus = 'IN_PROGRESS' | 'NOT_STARTED' | 'ENDING_SOON' | 'ENDED' | 'UNSET'

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function computeStatuses(s: Site): {
  opStatus: OpStatus
  cpStatus: CpStatus
  reasons: string[]     // 확인필요 사유 목록
} {
  const closeDays  = daysUntil(s.closedAt)   // null = closedAt 없음
  const openDays   = daysUntil(s.openedAt)   // null = openedAt 없음

  // ── 계약 상태 ────────────────────────────────────────────────────────────
  let cpStatus: CpStatus
  if (!s.openedAt && !s.closedAt) {
    cpStatus = 'UNSET'
  } else if (s.openedAt && openDays !== null && openDays > 0) {
    cpStatus = 'NOT_STARTED'
  } else if (s.closedAt && closeDays !== null && closeDays < 0) {
    cpStatus = 'ENDED'
  } else if (closeDays !== null && closeDays <= 30) {
    cpStatus = 'ENDING_SOON'
  } else {
    cpStatus = 'IN_PROGRESS'
  }

  // ── 확인필요 사유 (운영 중인 현장 대상) ──────────────────────────────────
  const reasons: string[] = []
  if (s.isActive) {
    // 1. 종료일 경과 (계약은 끝났지만 아직 활성으로 남아 있음)
    if (s.closedAt && closeDays !== null && closeDays < 0) {
      reasons.push('종료일 경과')
    }
    // 2. 계약기간 미입력 (운영 중인데 착공일 또는 준공일이 없음)
    if (!s.openedAt || !s.closedAt) {
      reasons.push('계약기간 미입력')
    }
    // 3. 담당업체 미배정
    if (s.companyAssignments.length === 0) {
      reasons.push('담당업체 미배정')
    }
    // 4. 미출근 다수 (배정 인원이 있는 날에만 판단)
    // 기준값: ABSENT_ALERT_THRESHOLD (추후 /admin/settings 연동)
    if (s.assignedWorkerCount > 0 && s.absentCount >= ABSENT_ALERT_THRESHOLD) {
      reasons.push(`미출근 다수 (${s.absentCount}명)`)
    }
  }

  // ── 운영 상태 ────────────────────────────────────────────────────────────
  let opStatus: OpStatus
  if (!s.isActive) {
    // 비활성: 계약기간이 남아있으면 "중지", 없거나 지났으면 "종료"
    const contractRemaining = closeDays === null || closeDays >= 0
    opStatus = contractRemaining && s.closedAt ? 'SUSPENDED' : 'CLOSED'
  } else if (reasons.length > 0) {
    // 운영 중이지만 사유 있음 → 확인필요
    opStatus = 'ATTENTION'
  } else if (s.openedAt && openDays !== null && openDays > 0) {
    // 착공일 미도달 → 예정
    opStatus = 'UPCOMING'
  } else {
    opStatus = 'ACTIVE'
  }

  return { opStatus, cpStatus, reasons }
}

// ── 표시 테이블 ───────────────────────────────────────────────────────────
const OP_LABEL: Record<OpStatus, string> = {
  ACTIVE: '운영중', UPCOMING: '예정', SUSPENDED: '중지', CLOSED: '종료', ATTENTION: '확인필요',
}
const OP_COLOR: Record<OpStatus, string> = {
  ACTIVE:    'bg-green-light text-[#059669]',
  UPCOMING:  'bg-blue-light text-status-info',
  SUSPENDED: 'bg-accent-light text-status-pending',
  CLOSED:    'bg-footer text-muted-brand',
  ATTENTION: 'bg-red-light text-status-rejected',
}
const CP_LABEL: Record<CpStatus, string> = {
  IN_PROGRESS: '진행중', NOT_STARTED: '시작전', ENDING_SOON: '종료임박', ENDED: '종료됨', UNSET: '미입력',
}
const CP_COLOR: Record<CpStatus, string> = {
  IN_PROGRESS: 'bg-green-light text-[#059669]',
  NOT_STARTED: 'bg-blue-light text-status-info',
  ENDING_SOON: 'bg-accent-light text-accent-hover',
  ENDED:       'bg-footer text-muted-brand',
  UNSET:       'bg-[#FEF9C3] text-status-pending',
}

function fmtWon(n: number): string {
  if (n === 0) return '—'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`
  return `${n.toLocaleString()}원`
}

function fmtDate(d?: string | null): string {
  return d ? new Date(d).toLocaleDateString('ko-KR') : '—'
}

function progressPct(openedAt?: string | null, closedAt?: string | null): number | null {
  if (!openedAt || !closedAt) return null
  const start = new Date(openedAt).getTime()
  const end   = new Date(closedAt).getTime()
  if (end <= start) return null
  return Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)))
}

// ── 폼 초기값 ─────────────────────────────────────────────────────────────
const emptyForm = {
  name: '', address: '', addressJibun: '', addressDetail: '', latitude: '', longitude: '',
  allowedRadius: '100', siteCode: '', openedAt: '', closedAt: '', notes: '',
}
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  PRIME: '원청', SUBCONTRACT: '하도급', JOINT_VENTURE: '공동도급', SPECIALTY: '전문건설',
}

// ── 컴포넌트 ───────────────────────────────────────────────────────────────
export default function SitesPage() {
  const router    = useRouter()
  const role      = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'

  const [sites,   setSites]   = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Site | null>(null)

  // 필터/정렬
  const [search,   setSearch]   = useState('')
  const [opFilter, setOpFilter] = useState<OpStatus | 'ALL'>('ALL')
  const [cpFilter, setCpFilter] = useState<CpStatus | 'ALL'>('ALL')
  const [sortKey,  setSortKey]  = useState('ATTENTION_FIRST')

  // 등록 모달
  const [showForm,      setShowForm]      = useState(false)
  const [form,          setForm]          = useState(emptyForm)
  const [formError,     setFormError]     = useState('')
  const [saving,        setSaving]        = useState(false)
  const [formGeoStatus, setFormGeoStatus] = useState<'idle'|'loading'|'done'|'error'>('idle')

  // 수정 모달
  const [editTarget,    setEditTarget]    = useState<Site | null>(null)
  const [editForm,      setEditForm]      = useState(emptyForm)
  const [editActive,    setEditActive]    = useState(true)
  const [editError,     setEditError]     = useState('')
  const [editSaving,    setEditSaving]    = useState(false)
  const [editGeoStatus, setEditGeoStatus] = useState<'idle'|'loading'|'done'|'error'>('idle')

  // 회사 배정 모달
  const [assignSite, setAssignSite] = useState<Site | null>(null)
  const [companies,  setCompanies]  = useState<Company[]>([])
  const [assignForm, setAssignForm] = useState({
    companyId: '', contractType: 'SUBCONTRACT', startDate: '', endDate: '',
    managerName: '', managerPhone: '', notes: '',
  })
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError,  setAssignError]  = useState('')

  // 근무시간 정책 모달
  const [policySite,      setPolicySite]      = useState<Site | null>(null)
  const [policyEffective, setPolicyEffective] = useState<{
    workStartTime: string; workEndTime: string
    breakStartTime: string | null; breakEndTime: string | null
    breakMinutes: number; isCustom: boolean
  } | null>(null)
  const [policyForm, setPolicyForm] = useState({
    workStartTime: '', workEndTime: '', breakStartTime: '', breakEndTime: '', breakMinutes: '',
  })
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policySaving,  setPolicySaving]  = useState(false)
  const [policyError,   setPolicyError]   = useState('')

  const [gpsLoading, setGpsLoading] = useState(false)

  // Daum 우편번호 스크립트 (마운트 1회)
  useEffect(() => {
    if (!document.getElementById('kakao-postcode-script')) {
      const s = document.createElement('script')
      s.id = 'kakao-postcode-script'
      s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      document.head.appendChild(s)
    }
  }, [])

  // ── 데이터 로드 ───────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/sites?includeInactive=true&includeStats=true')
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        const items: Site[] = Array.isArray(data.data)
          ? data.data
          : (data.data?.items ?? [])
        setSites(items.map(s => ({
          ...s,
          assignedWorkerCount: s.assignedWorkerCount ?? 0,
          todayCheckInCount:   s.todayCheckInCount   ?? 0,
          absentCount:         s.absentCount         ?? 0,
          todayWage:  s.todayWage  ?? 0,
          monthWage:  s.monthWage  ?? 0,
          totalWage:  s.totalWage  ?? 0,
        })))
        setLoading(false)
      })
  }, [router])

  useEffect(() => { load() }, [load])

  const loadCompanies = () => {
    fetch('/api/admin/companies?pageSize=200')
      .then(r => r.json())
      .then(d => { if (d.success) setCompanies(d.data?.items ?? []) })
  }

  // ── 상태 계산 캐시 ────────────────────────────────────────────────────────
  const sitesWithStatus = useMemo(
    () => sites.map(s => ({ ...s, ...computeStatuses(s) })),
    [sites]
  )

  // ── 요약 통계 (KPI 7개) ───────────────────────────────────────────────────
  const summary = useMemo(() => ({
    total:      sitesWithStatus.length,
    active:     sitesWithStatus.filter(s => s.opStatus === 'ACTIVE').length,
    endingSoon: sitesWithStatus.filter(s => s.cpStatus === 'ENDING_SOON').length,
    attention:  sitesWithStatus.filter(s => s.opStatus === 'ATTENTION').length,
    todayTotal: sitesWithStatus.reduce((a, s) => a + s.todayWage, 0),
    monthTotal: sitesWithStatus.reduce((a, s) => a + s.monthWage, 0),
    grandTotal: sitesWithStatus.reduce((a, s) => a + s.totalWage, 0),
  }), [sitesWithStatus])

  // ── 필터·정렬 ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = sitesWithStatus.filter(s => {
      if (search && !s.name.includes(search) && !s.address.includes(search)) return false
      if (opFilter !== 'ALL' && s.opStatus !== opFilter) return false
      if (cpFilter !== 'ALL' && s.cpStatus !== cpFilter) return false
      return true
    })

    const opPriority: Record<OpStatus, number> = {
      ATTENTION: 0, ACTIVE: 1, UPCOMING: 2, SUSPENDED: 3, CLOSED: 4,
    }
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'ATTENTION_FIRST':
          return opPriority[a.opStatus] - opPriority[b.opStatus]
        case 'ENDING_SOON_FIRST': {
          const da = daysUntil(a.closedAt) ?? 9999
          const db = daysUntil(b.closedAt) ?? 9999
          return da - db
        }
        case 'MOST_WORKERS':    return b.assignedWorkerCount - a.assignedWorkerCount
        case 'TODAY_WAGE_DESC': return b.todayWage - a.todayWage
        case 'TOTAL_WAGE_DESC': return b.totalWage - a.totalWage
        case 'NAME_ASC':        return a.name.localeCompare(b.name, 'ko')
        default: return 0
      }
    })
    return list
  }, [sitesWithStatus, search, opFilter, cpFilter, sortKey])

  // ── 주소 검색 / GPS ───────────────────────────────────────────────────────
  const openAddressSearch = (target: 'form' | 'edit') => {
    if (!window.daum?.Postcode) { alert('주소 검색 서비스 로딩 중입니다.'); return }
    new window.daum.Postcode({
      oncomplete: async (data: { roadAddress: string; jibunAddress: string }) => {
        const address = data.roadAddress || data.jibunAddress
        const addressJibun = data.jibunAddress || ''
        const setStatus = target === 'form' ? setFormGeoStatus : setEditGeoStatus
        const setF      = target === 'form' ? setForm          : setEditForm
        setF(f => ({ ...f, address, addressJibun, latitude: '', longitude: '' }))
        setStatus('loading')
        try {
          const res  = await fetch(`/api/admin/geocode?address=${encodeURIComponent(address)}`)
          const json = await res.json()
          if (json.success && json.data?.lat && json.data?.lng) {
            setF(f => ({ ...f, latitude: String(json.data.lat), longitude: String(json.data.lng) }))
            setStatus('done')
          } else {
            setStatus('error')
          }
        } catch {
          setStatus('error')
        }
      },
    }).open()
  }

  const fillCurrentLocation = (target: 'form' | 'edit') => {
    if (!navigator.geolocation) { alert('이 브라우저는 GPS를 지원하지 않습니다.'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(7)
        const lng = pos.coords.longitude.toFixed(7)
        if (target === 'form') { setForm(f => ({ ...f, latitude: lat, longitude: lng })); setFormGeoStatus('done') }
        else { setEditForm(f => ({ ...f, latitude: lat, longitude: lng })); setEditGeoStatus('done') }
        setGpsLoading(false)
      },
      () => { alert('GPS 위치를 가져올 수 없습니다.'); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // ── 저장 핸들러 ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setFormError('')
    const lat = parseFloat(form.latitude), lng = parseFloat(form.longitude)
    if (!form.name.trim()) { setFormError('현장명을 입력하세요.'); setSaving(false); return }
    if (!form.address.trim()) { setFormError('주소를 입력하세요.'); setSaving(false); return }
    if (isNaN(lat) || isNaN(lng)) { setFormError('주소 검색 후 좌표를 확인하세요.'); setSaving(false); return }
    const fullAddress = form.addressDetail?.trim() ? `${form.address} ${form.addressDetail.trim()}` : form.address
    const res = await fetch('/api/admin/sites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, address: fullAddress, addressJibun: form.addressJibun || undefined,
        latitude: lat, longitude: lng,
        allowedRadius: parseInt(form.allowedRadius, 10),
        siteCode: form.siteCode || undefined,
        openedAt: form.openedAt || undefined, closedAt: form.closedAt || undefined,
        notes: form.notes || undefined,
      }),
    })
    const data = await res.json()
    if (!data.success) { setFormError(data.message); setSaving(false); return }
    setShowForm(false); setForm(emptyForm); load(); setSaving(false)
  }

  const openEdit = (s: Site) => {
    setEditTarget(s)
    setEditForm({
      name: s.name, address: s.address, addressDetail: '',
      latitude: String(s.latitude), longitude: String(s.longitude),
      allowedRadius: String(s.allowedRadius),
      siteCode: s.siteCode ?? '',
      openedAt: s.openedAt ? s.openedAt.substring(0, 10) : '',
      closedAt: s.closedAt ? s.closedAt.substring(0, 10) : '',
      notes: s.notes ?? '',
    })
    setEditActive(s.isActive); setEditError('')
    setEditGeoStatus(s.latitude && s.longitude ? 'done' : 'idle')
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setEditSaving(true); setEditError('')
    const lat = parseFloat(editForm.latitude), lng = parseFloat(editForm.longitude)
    if (isNaN(lat) || isNaN(lng)) { setEditError('유효한 좌표가 없습니다.'); setEditSaving(false); return }
    const res = await fetch(`/api/admin/sites/${editTarget.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name, address: editForm.addressDetail?.trim() ? `${editForm.address} ${editForm.addressDetail.trim()}` : editForm.address, latitude: lat, longitude: lng,
        allowedRadius: parseInt(editForm.allowedRadius, 10), isActive: editActive,
        siteCode: editForm.siteCode || null,
        openedAt: editForm.openedAt || null, closedAt: editForm.closedAt || null,
        notes: editForm.notes || null,
      }),
    })
    const data = await res.json()
    if (!data.success) { setEditError(data.message); setEditSaving(false); return }
    if (selected?.id === editTarget.id) setSelected(null)
    setEditTarget(null); load(); setEditSaving(false)
  }

  const handleAssign = async () => {
    if (!assignSite) return
    setAssignSaving(true); setAssignError('')
    const res = await fetch(`/api/admin/sites/${assignSite.id}/company-assignments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: assignForm.companyId, contractType: assignForm.contractType,
        startDate: assignForm.startDate, endDate: assignForm.endDate || null,
        managerName: assignForm.managerName || null,
        managerPhone: assignForm.managerPhone || null,
        notes: assignForm.notes || null,
      }),
    })
    const data = await res.json()
    if (!data.success) { setAssignError(data.error ?? data.message ?? '저장 실패'); setAssignSaving(false); return }
    setAssignSite(null); load(); setAssignSaving(false)
  }

  const handleDeleteAssignment = async (siteId: string, assignmentId: string) => {
    if (!confirm('이 배정을 삭제하시겠습니까?')) return
    await fetch(`/api/admin/sites/${siteId}/company-assignments?assignmentId=${assignmentId}`, { method: 'DELETE' })
    load()
  }

  const openPolicyModal = async (s: Site) => {
    setPolicySite(s); setPolicyError(''); setPolicyEffective(null); setPolicyLoading(true)
    const res  = await fetch(`/api/admin/sites/${s.id}/policy`)
    const data = await res.json()
    if (data.success) {
      const c = data.data.custom
      setPolicyEffective({ ...data.data.effective, isCustom: data.data.isCustom })
      setPolicyForm({
        workStartTime:  c?.workStartTime  ?? '',
        workEndTime:    c?.workEndTime    ?? '',
        breakStartTime: c?.breakStartTime ?? '',
        breakEndTime:   c?.breakEndTime   ?? '',
        breakMinutes:   c?.breakMinutes != null ? String(c.breakMinutes) : '',
      })
    }
    setPolicyLoading(false)
  }

  const handleSavePolicy = async () => {
    if (!policySite) return
    setPolicySaving(true); setPolicyError('')
    const res = await fetch(`/api/admin/sites/${policySite.id}/policy`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workStartTime:  policyForm.workStartTime  || null,
        workEndTime:    policyForm.workEndTime    || null,
        breakStartTime: policyForm.breakStartTime || null,
        breakEndTime:   policyForm.breakEndTime   || null,
        breakMinutes:   policyForm.breakMinutes !== '' ? parseInt(policyForm.breakMinutes, 10) : null,
      }),
    })
    const data = await res.json()
    if (!data.success) { setPolicyError(data.message ?? '저장 실패'); setPolicySaving(false); return }
    setPolicySite(null); setPolicySaving(false)
  }

  // ── CSS 상수 ──────────────────────────────────────────────────────────────
  const labelCls     = 'block text-[13px] font-semibold text-muted-brand mb-1'

  // ── 폼 필드 공통 렌더 ────────────────────────────────────────────────────
  const renderFormFields = (
    f: typeof emptyForm,
    target: 'form' | 'edit',
    onChange: (k: string, v: string) => void,
    geoStatus: 'idle' | 'loading' | 'done' | 'error',
  ) => (
    <>
      <FormInput label="현장명" required value={f.name} placeholder="해한 1호 현장" onChange={e => onChange('name', e.target.value)} />
      <FormInput label="현장 코드" value={f.siteCode} placeholder="SITE-001 (선택)" onChange={e => onChange('siteCode', e.target.value)} />
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className={labelCls}>주소 *</label>
          <div className="flex gap-[6px]">
            <button type="button"
              className="px-3 py-[6px] bg-[rgba(244,121,32,0.12)] text-accent border border-[#90caf9] rounded-md cursor-pointer text-[13px] font-semibold whitespace-nowrap"
              onClick={() => openAddressSearch(target)}>주소 검색</button>
            <button type="button"
              className="px-3 py-[6px] bg-green-light text-[#2e7d32] border border-[#a5d6a7] rounded-md cursor-pointer text-[13px] font-semibold whitespace-nowrap disabled:opacity-50"
              disabled={gpsLoading} onClick={() => fillCurrentLocation(target)}>
              {gpsLoading ? '확인 중...' : '현재 위치'}
            </button>
          </div>
        </div>
        <FormInput value={f.address} placeholder="주소 검색 또는 직접 입력" onChange={e => onChange('address', e.target.value)} />
        <FormInput value={f.addressDetail ?? ''} placeholder="상세주소 (동/호/층)" onChange={e => onChange('addressDetail', e.target.value)} />
      </div>
      {geoStatus === 'loading' && <div className="text-xs text-[#F59E0B] mb-1">좌표 확인 중...</div>}
      {geoStatus === 'error'   && <div className="text-xs text-[#e53935] mb-1">좌표를 찾지 못했습니다. 주소를 다시 검색하세요.</div>}
      {geoStatus === 'done' && f.latitude && <div className="text-xs text-status-working mb-1">좌표 확인 완료</div>}
      <input type="hidden" value={f.latitude} />
      <input type="hidden" value={f.longitude} />
      <FormInput label="GPS 허용 반경 (m)" value={f.allowedRadius} placeholder="100" onChange={e => onChange('allowedRadius', e.target.value)} />
      <FormGrid cols={2}>
        <FormInput label="착공일" type="date" value={f.openedAt} onChange={e => onChange('openedAt', e.target.value)} />
        <FormInput label="준공일" type="date" value={f.closedAt} onChange={e => onChange('closedAt', e.target.value)} />
      </FormGrid>
      <FormInput label="메모" value={f.notes} placeholder="현장 특이사항" onChange={e => onChange('notes', e.target.value)} />
    </>
  )

  // ── 우측 상세 패널 ────────────────────────────────────────────────────────
  const renderDetailPanel = (s: typeof filtered[0]) => {
    const pct  = progressPct(s.openedAt, s.closedAt)
    const days = daysUntil(s.closedAt)

    return (
      <div className="w-full sm:w-[360px] flex-shrink-0 flex flex-col gap-3 sm:sticky sm:top-4 sm:max-h-[calc(100vh-2rem)] overflow-y-auto pb-4">

        {/* 헤더: 현장명 + 두 상태 배지 */}
        <SectionCard>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-title-brand leading-snug">{s.name}</div>
              {s.siteCode && <div className="font-mono text-[11px] text-muted2-brand mt-[2px]">{s.siteCode}</div>}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-6 h-6 flex items-center justify-center rounded text-muted2-brand hover:bg-footer text-[16px] cursor-pointer flex-shrink-0"
            >×</button>
          </div>
          {/* 운영 상태 + 계약 상태 배지 (분리 표시) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted2-brand">운영</span>
              <span className={`px-2 py-[3px] rounded-[6px] text-[11px] font-bold ${OP_COLOR[s.opStatus]}`}>
                {OP_LABEL[s.opStatus]}
              </span>
            </div>
            <span className="text-[#D1D5DB]">|</span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted2-brand">계약</span>
              <span className={`px-2 py-[3px] rounded-[6px] text-[11px] font-bold ${CP_COLOR[s.cpStatus]}`}>
                {CP_LABEL[s.cpStatus]}
              </span>
            </div>
          </div>
          {/* 확인필요 사유 (있는 경우) */}
          {s.reasons.length > 0 && (
            <div className="mt-2 pt-2 border-t border-brand flex flex-wrap gap-1">
              {s.reasons.map(r => (
                <span key={r} className="inline-flex items-center gap-1 px-2 py-[3px] bg-red-light text-status-rejected text-[11px] rounded-[5px] font-medium">
                  <span className="text-[9px]">!</span>{r}
                </span>
              ))}
            </div>
          )}
        </SectionCard>

        {/* A. 기본정보 */}
        <SectionCard>
          <div className="text-[11px] font-bold text-muted2-brand tracking-wide uppercase mb-2">기본정보</div>
          <dl className="space-y-[6px] text-[13px]">
            <div className="flex gap-2">
              <dt className="text-muted2-brand w-[56px] flex-shrink-0">주소</dt>
              <dd className="text-body-brand break-all m-0">{s.address}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted2-brand w-[56px] flex-shrink-0">반경</dt>
              <dd className="text-body-brand m-0">{s.allowedRadius}m</dd>
            </div>
            {s.companyAssignments.length > 0 ? (
              <div className="flex gap-2">
                <dt className="text-muted2-brand w-[56px] flex-shrink-0">담당업체</dt>
                <dd className="text-body-brand m-0">
                  {s.companyAssignments.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 ? ', ' : ''}{a.company.companyName}
                      {a.managerName && ` (${a.managerName})`}
                    </span>
                  ))}
                </dd>
              </div>
            ) : (
              <div className="flex gap-2">
                <dt className="text-muted2-brand w-[56px] flex-shrink-0">담당업체</dt>
                <dd className="text-[#EF4444] font-medium m-0">미배정</dd>
              </div>
            )}
            {s.notes && (
              <div className="flex gap-2">
                <dt className="text-muted2-brand w-[56px] flex-shrink-0">메모</dt>
                <dd className="text-body-brand m-0">{s.notes}</dd>
              </div>
            )}
          </dl>
        </SectionCard>

        {/* B. 계약기간 */}
        <SectionCard>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-muted2-brand tracking-wide uppercase">계약기간</div>
            <span className={`px-2 py-[2px] rounded-[5px] text-[11px] font-bold ${CP_COLOR[s.cpStatus]}`}>
              {CP_LABEL[s.cpStatus]}
            </span>
          </div>
          {(s.openedAt || s.closedAt) ? (
            <>
              <div className="text-[13px] text-body-brand font-medium mb-2">
                {fmtDate(s.openedAt)} ~ {fmtDate(s.closedAt)}
              </div>
              {pct !== null && (
                <>
                  <div className="h-[6px] bg-footer rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.cpStatus === 'ENDING_SOON' ? 'bg-brand-accent' :
                        s.cpStatus === 'ENDED'       ? 'bg-muted2-brand' : 'bg-[#3B82F6]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted2-brand">
                    <span>진행률 {pct}%</span>
                    {days !== null && (
                      <span className={days < 0 ? 'text-status-rejected font-bold' : days <= 30 ? 'text-accent-hover font-bold' : ''}>
                        {days < 0 ? `${Math.abs(days)}일 경과` : `${days}일 남음`}
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-[12px] text-[#EF4444] font-medium">착공일·준공일 미입력</div>
          )}
        </SectionCard>

        {/* C. 운영현황 */}
        <SectionCard>
          <div className="text-[11px] font-bold text-muted2-brand tracking-wide uppercase mb-2">오늘 운영현황</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-center">
            <div className="bg-surface rounded-[8px] py-2">
              <div className="text-[18px] font-bold text-title-brand">{s.assignedWorkerCount}</div>
              <div className="text-[11px] text-muted2-brand mt-[1px]">배정</div>
            </div>
            <div className="bg-surface rounded-[8px] py-2">
              <div className="text-[18px] font-bold text-[#059669]">{s.todayCheckInCount}</div>
              <div className="text-[11px] text-muted2-brand mt-[1px]">출근</div>
            </div>
            <div className={`rounded-[8px] py-2 ${s.absentCount >= ABSENT_ALERT_THRESHOLD ? 'bg-red-light' : 'bg-surface'}`}>
              <div className={`text-[18px] font-bold ${s.absentCount >= ABSENT_ALERT_THRESHOLD ? 'text-status-rejected' : 'text-title-brand'}`}>
                {s.absentCount}
              </div>
              <div className="text-[11px] text-muted2-brand mt-[1px]">미출근</div>
            </div>
          </div>
        </SectionCard>

        {/* D. 노임 (오늘/월누계/총누계) */}
        <SectionCard>
          <div className="text-[11px] font-bold text-muted2-brand tracking-wide uppercase mb-2">노임</div>
          <dl className="space-y-[6px] text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted-brand">오늘</dt>
              <dd className="font-semibold text-title-brand m-0">{fmtWon(s.todayWage)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-brand">이번 달 누계</dt>
              <dd className="font-semibold text-title-brand m-0">{fmtWon(s.monthWage)}</dd>
            </div>
            <div className="flex justify-between border-t border-brand pt-[6px] mt-[6px]">
              <dt className="text-muted-brand font-semibold">총 누계</dt>
              <dd className="font-bold text-title-brand m-0">{fmtWon(s.totalWage)}</dd>
            </div>
          </dl>
        </SectionCard>

        {/* E. 관리 */}
        <SectionCard>
          <div className="text-[11px] font-bold text-muted2-brand tracking-wide uppercase mb-2">관리</div>
          <div className="flex flex-col gap-2">
            <Link href={`/admin/attendance?siteId=${s.id}`} className="no-underline">
              <Btn variant="orange" className="w-full">출근현황 보기</Btn>
            </Link>
            {canMutate && (
              <>
                <Btn variant="secondary" className="w-full" onClick={() => openEdit(s)}>기본정보 수정</Btn>
                <Btn variant="secondary" className="w-full" onClick={() => openPolicyModal(s)}>근무시간 정책</Btn>
                <Btn variant="secondary" className="w-full" onClick={() => {
                  setAssignSite(s); loadCompanies()
                  setAssignForm({ companyId: '', contractType: 'SUBCONTRACT', startDate: '', endDate: '', managerName: '', managerPhone: '', notes: '' })
                  setAssignError('')
                }}>업체 배정 추가</Btn>
              </>
            )}
          </div>

          {/* 배정업체 목록 */}
          {s.companyAssignments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-brand">
              <div className="text-[11px] font-bold text-muted2-brand tracking-wide uppercase mb-2">
                배정업체 ({s.companyAssignments.length})
              </div>
              <div className="space-y-2">
                {s.companyAssignments.map(a => (
                  <div key={a.id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[12px] font-semibold text-fore-brand">{a.company.companyName}</div>
                      <div className="text-[11px] text-muted2-brand">
                        {CONTRACT_TYPE_LABELS[a.contractType] ?? a.contractType} · {fmtDate(a.startDate)}
                        {a.managerName && ` · ${a.managerName}`}
                      </div>
                    </div>
                    {canMutate && (
                      <button
                        onClick={() => handleDeleteAssignment(s.id, a.id)}
                        className="text-[11px] text-[#EF4444] hover:underline flex-shrink-0 bg-transparent border-none cursor-pointer"
                      >삭제</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    )
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    <PageShell
      className="flex flex-col gap-4"
      header={
        <div className="flex flex-col gap-3">
          <PageHeader
            title="현장관리"
            description="등록된 현장을 관리합니다"
            badge={<PageBadge>{loading ? '...' : `${filtered.length}개`}</PageBadge>}
          />
          {/* KPI 7개 */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <KpiCard label="전체 현장"      value={summary.total}      unit="개" accentColor="#E5E7EB" />
            <KpiCard label="운영중"          value={summary.active}     unit="개" accentColor="#10B981" />
            <KpiCard label="종료임박 (계약)" value={summary.endingSoon} unit="개" accentColor="#F97316" />
            <KpiCard label="확인필요"        value={summary.attention}  unit="개" accentColor="#EF4444" />
            <KpiCard label="오늘 노임"       value={fmtWon(summary.todayTotal)} accentColor="#6366F1" />
            <KpiCard label="월 누계 노임"    value={fmtWon(summary.monthTotal)} accentColor="#8B5CF6" />
            <KpiCard label="총 누계 노임"    value={fmtWon(summary.grandTotal)} accentColor="#0EA5E9" />
          </div>
          {/* 필터바 */}
          <SectionCard padding={false}>
            <div className="px-4 py-3 flex flex-wrap items-center gap-2">
              <FilterInput
                type="text"
                placeholder="현장명 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-[180px]"
              />
              {/* 운영 상태 필터 */}
              {(['ALL','ACTIVE','UPCOMING','SUSPENDED','CLOSED','ATTENTION'] as const).map(v => (
                <FilterPill key={v} active={opFilter === v} onClick={() => setOpFilter(v)}>
                  {v === 'ALL' ? '전체' : OP_LABEL[v as OpStatus] ?? v}
                </FilterPill>
              ))}
              {/* 계약 상태 필터 */}
              <FilterSelect value={cpFilter} onChange={e => setCpFilter(e.target.value as CpStatus | 'ALL')}>
                <option value="ALL">계약 전체</option>
                <option value="IN_PROGRESS">진행중</option>
                <option value="NOT_STARTED">시작전</option>
                <option value="ENDING_SOON">종료임박</option>
                <option value="ENDED">종료됨</option>
                <option value="UNSET">미입력</option>
              </FilterSelect>
              {/* 정렬 */}
              <FilterSelect value={sortKey} onChange={e => setSortKey(e.target.value)}>
                <option value="ATTENTION_FIRST">확인필요 우선</option>
                <option value="ENDING_SOON_FIRST">종료임박 우선</option>
                <option value="MOST_WORKERS">인원 많은 순</option>
                <option value="TODAY_WAGE_DESC">오늘 노임 큰 순</option>
                <option value="TOTAL_WAGE_DESC">총 누계 큰 순</option>
                <option value="NAME_ASC">이름순</option>
              </FilterSelect>
              <FilterSpacer />
              <Btn variant="ghost" size="sm" onClick={load}>새로고침</Btn>
              {canMutate && (
                <Btn variant="orange" onClick={() => { setShowForm(true); setFormGeoStatus('idle'); setForm(emptyForm) }}>
                  + 현장 등록
                </Btn>
              )}
            </div>
          </SectionCard>
        </div>
      }
    >

      {/* ── 2컬럼: 목록 + 패널 ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">

        {/* 현장 목록 */}
        <div className="flex-1 min-w-0">
          <SectionCard padding={false}>
            {/* 헤더: 운영상태 + 계약상태 분리 (데스크톱만) */}
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_76px_100px_70px_56px_80px_80px] gap-2 px-4 py-2 bg-surface border-b border-brand text-[11px] font-bold text-muted2-brand uppercase tracking-wide">
              <span>현장명</span>
              <span className="text-center">운영</span>
              <span className="text-center">계약기간</span>
              <span className="text-right">인원(출/배)</span>
              <span className="text-right">미출근</span>
              <span className="text-right">오늘노임</span>
              <span className="text-right">총누계</span>
            </div>

            {loading ? (
              <p className="text-muted2-brand text-[13px] py-10 text-center">로딩 중...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted2-brand text-[13px] py-10 text-center">
                {search || opFilter !== 'ALL' || cpFilter !== 'ALL'
                  ? '조건에 맞는 현장이 없습니다.'
                  : '등록된 현장이 없습니다.'}
              </p>
            ) : (
              <div className="divide-y divide-brand">
                {filtered.map(s => {
                  const isSelected = selected?.id === s.id
                  const days = daysUntil(s.closedAt)
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelected(isSelected ? null : s)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-accent-light border-l-[3px] border-accent'
                          : 'hover:bg-surface border-l-[3px] border-l-transparent'
                      } ${!s.isActive ? 'opacity-60' : ''}`}
                    >
                      {/* 데스크톱: 그리드 행 */}
                      <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_76px_100px_70px_56px_80px_80px] gap-2 px-4 py-3 items-center">
                        <div className="min-w-0">
                          <div className="font-semibold text-[13px] text-fore-brand truncate">{s.name}</div>
                          {s.reasons.length > 0 ? (
                            <div className="text-[11px] text-status-rejected truncate">{s.reasons[0]}{s.reasons.length > 1 ? ` 외 ${s.reasons.length - 1}건` : ''}</div>
                          ) : (
                            <div className="text-[11px] text-muted2-brand truncate">{s.address}</div>
                          )}
                        </div>
                        <div className="text-center">
                          <span className={`inline-block px-[6px] py-[2px] rounded-[5px] text-[11px] font-bold ${OP_COLOR[s.opStatus]}`}>{OP_LABEL[s.opStatus]}</span>
                        </div>
                        <div className="text-center">
                          <span className={`inline-block px-[5px] py-[1px] rounded-[4px] text-[11px] font-bold mb-[1px] ${CP_COLOR[s.cpStatus]}`}>{CP_LABEL[s.cpStatus]}</span>
                          {days !== null && (
                            <div className={`text-[11px] ${days < 0 ? 'text-status-rejected font-bold' : days <= 30 ? 'text-accent-hover font-semibold' : 'text-muted2-brand'}`}>
                              {days < 0 ? `${Math.abs(days)}일 경과` : `${days}일 남음`}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-[13px] font-semibold text-body-brand">
                          {s.todayCheckInCount}<span className="text-[11px] text-muted2-brand font-normal">/{s.assignedWorkerCount}</span>
                        </div>
                        <div className={`text-right text-[13px] font-semibold ${s.absentCount >= ABSENT_ALERT_THRESHOLD ? 'text-status-rejected' : 'text-muted2-brand'}`}>
                          {s.absentCount > 0 ? s.absentCount : '—'}
                        </div>
                        <div className="text-right text-[12px] text-body-brand">{fmtWon(s.todayWage)}</div>
                        <div className="text-right text-[12px] font-semibold text-body-brand">{fmtWon(s.totalWage)}</div>
                      </div>

                      {/* 모바일: 카드형 */}
                      <div className="sm:hidden px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[14px] text-fore-brand truncate">{s.name}</div>
                            {s.reasons.length > 0 ? (
                              <div className="text-[11px] text-status-rejected truncate mt-0.5">{s.reasons[0]}{s.reasons.length > 1 ? ` 외 ${s.reasons.length - 1}건` : ''}</div>
                            ) : (
                              <div className="text-[11px] text-muted2-brand truncate mt-0.5">{s.address}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`px-[6px] py-[2px] rounded-[5px] text-[11px] font-bold ${OP_COLOR[s.opStatus]}`}>{OP_LABEL[s.opStatus]}</span>
                            <span className={`px-[5px] py-[1px] rounded-[4px] text-[11px] font-bold ${CP_COLOR[s.cpStatus]}`}>{CP_LABEL[s.cpStatus]}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[12px] text-muted2-brand flex-wrap">
                          <span>출근 <strong className="text-body-brand">{s.todayCheckInCount}</strong>/{s.assignedWorkerCount}명</span>
                          {s.absentCount >= ABSENT_ALERT_THRESHOLD && (
                            <span className="text-status-rejected font-semibold">미출근 {s.absentCount}명</span>
                          )}
                          <span>오늘 {fmtWon(s.todayWage)}</span>
                          <span>누계 {fmtWon(s.totalWage)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* 우측 상세 패널 */}
        {selected && renderDetailPanel(
          filtered.find(s => s.id === selected.id)
            ?? { ...selected, ...computeStatuses(selected) }
        )}
      </div>

      {/* ── 등록 모달 ──────────────────────────────────────────── */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setFormError('') }} title="현장 등록" width={600}>
        {renderFormFields(form, 'form', (k, v) => setForm(f => ({ ...f, [k]: v })), formGeoStatus)}
        {formError && <Toast message={formError} variant="error" />}
        <ModalFooter>
          <Btn variant="secondary" onClick={() => { setShowForm(false); setFormError('') }}>취소</Btn>
          <Btn variant="orange" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Btn>
        </ModalFooter>
      </Modal>

      {/* ── 수정 모달 ──────────────────────────────────────────── */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`현장 수정 — ${editTarget?.name ?? ''}`} width={600}>
        {editTarget && (
          <>
            {renderFormFields(editForm, 'edit', (k, v) => setEditForm(f => ({ ...f, [k]: v })), editGeoStatus)}
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" id="editActive" checked={editActive} onChange={e => setEditActive(e.target.checked)} />
              <label htmlFor="editActive" className="text-sm text-body-brand">현장 활성 상태</label>
            </div>
            {editError && <Toast message={editError} variant="error" />}
            <ModalFooter>
              <Btn variant="secondary" onClick={() => setEditTarget(null)}>취소</Btn>
              <Btn variant="orange" onClick={handleEdit} disabled={editSaving}>{editSaving ? '저장 중...' : '저장'}</Btn>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* ── 회사 배정 모달 ─────────────────────────────────────── */}
      <Modal open={!!assignSite} onClose={() => setAssignSite(null)} title={`업체 배정 — ${assignSite?.name ?? ''}`}>
        {assignSite && (
          <>
            <FormSelect
              label="회사" required
              value={assignForm.companyId}
              onChange={e => setAssignForm(f => ({ ...f, companyId: e.target.value }))}
              placeholder="선택하세요"
              options={companies.map(c => ({ value: c.id, label: c.companyName }))}
            />
            <FormSelect
              label="계약 유형"
              value={assignForm.contractType}
              onChange={e => setAssignForm(f => ({ ...f, contractType: e.target.value }))}
              options={[
                { value: 'PRIME', label: '원청' },
                { value: 'SUBCONTRACT', label: '하도급' },
                { value: 'JOINT_VENTURE', label: '공동도급' },
                { value: 'SPECIALTY', label: '전문건설' },
              ]}
            />
            <FormGrid cols={2}>
              <FormInput label="시작일" required type="date" value={assignForm.startDate} onChange={e => setAssignForm(f => ({ ...f, startDate: e.target.value }))} />
              <FormInput label="종료일" type="date" value={assignForm.endDate} onChange={e => setAssignForm(f => ({ ...f, endDate: e.target.value }))} />
            </FormGrid>
            <FormInput label="담당자명" value={assignForm.managerName} onChange={e => setAssignForm(f => ({ ...f, managerName: e.target.value }))} placeholder="홍길동" />
            <FormInput label="담당자 연락처" value={assignForm.managerPhone} onChange={e => setAssignForm(f => ({ ...f, managerPhone: e.target.value }))} placeholder="01012345678" />
            <FormInput label="메모" value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} />
            {assignError && <Toast message={assignError} variant="error" />}
            <ModalFooter>
              <Btn variant="secondary" onClick={() => setAssignSite(null)}>취소</Btn>
              <Btn variant="orange" onClick={handleAssign} disabled={assignSaving || !assignForm.companyId || !assignForm.startDate}>
                {assignSaving ? '저장 중...' : '저장'}
              </Btn>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* ── 근무시간 정책 모달 ──────────────────────────────────── */}
      <Modal open={!!policySite} onClose={() => setPolicySite(null)} title={`근무시간 정책 — ${policySite?.name ?? ''}`}>
        {policySite && (
          <>
            <p className="text-[12px] text-muted-brand mb-4 leading-relaxed">
              빈칸 = 회사 기본값 (출근 07:00 / 퇴근 17:00 / 휴게 60분).<br />
              <strong>휴게시간 차감(분)</strong>이 공수 계산에 직접 영향을 줍니다.
            </p>
            {policyLoading ? <p className="text-muted2-brand text-center text-[13px]">로딩 중...</p> : (
              <>
                {policyEffective && (
                  <Toast
                    message={`실효값: 출근 ${policyEffective.workStartTime} / 퇴근 ${policyEffective.workEndTime} / 휴게 ${policyEffective.breakMinutes}분${!policyEffective.isCustom ? ' (회사 기본값)' : ''}`}
                    variant="success"
                  />
                )}
                <FormGrid cols={2}>
                  <FormInput label="출근 기준" type="time" value={policyForm.workStartTime}
                    onChange={e => setPolicyForm(f => ({ ...f, workStartTime: e.target.value }))} />
                  <FormInput label="퇴근 기준" type="time" value={policyForm.workEndTime}
                    onChange={e => setPolicyForm(f => ({ ...f, workEndTime: e.target.value }))} />
                </FormGrid>
                <FormGrid cols={2}>
                  <FormInput label="휴게 시작" type="time" value={policyForm.breakStartTime}
                    onChange={e => setPolicyForm(f => ({ ...f, breakStartTime: e.target.value }))} />
                  <FormInput label="휴게 종료" type="time" value={policyForm.breakEndTime}
                    onChange={e => setPolicyForm(f => ({ ...f, breakEndTime: e.target.value }))} />
                </FormGrid>
                <FormInput label="휴게시간 차감 (분)" type="number" value={policyForm.breakMinutes} placeholder="60"
                  onChange={e => setPolicyForm(f => ({ ...f, breakMinutes: e.target.value }))} />
                {policyError && <Toast message={policyError} variant="error" />}
                <ModalFooter>
                  <Btn variant="secondary" onClick={() => setPolicySite(null)}>취소</Btn>
                  <Btn variant="orange" onClick={handleSavePolicy} disabled={policySaving}>{policySaving ? '저장 중...' : '저장'}</Btn>
                </ModalFooter>
              </>
            )}
          </>
        )}
      </Modal>

    </PageShell>
  )
}
