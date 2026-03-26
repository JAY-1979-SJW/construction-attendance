'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { useAdminRole } from '@/lib/hooks/useAdminRole'
import {
  PageShell, SectionCard,
  FilterInput, FilterSelect, FilterPill,
  StatusBadge, Btn,
} from '@/components/admin/ui'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface Worker {
  id: string
  name: string
  phone: string
  jobTitle: string
  isActive: boolean
  accountStatus: string
  birthDate: string | null
  foreignerYn: boolean
  employmentType: string
  organizationType: string
  deviceCount: number
  retirementMutualStatus: string
  createdAt: string
  primaryCompany: { id: string; companyName: string } | null
  activeSites: { id: string; name: string; isPrimary?: boolean }[]
  todayAttendance: { siteId: string; siteName: string; checkInAt: string | null; checkOutAt: string | null; status: string } | null
  // 서류/교육 상태
  hasContract: boolean
  contractDate: string | null
  hasSafetyCert: boolean
  safetyCertDate: string | null
  hasSafetyEducation: boolean
  safetyEducationDate: string | null
  // 노임
  dailyWage: number
  monthWage: number
  totalWage: number
}

interface SiteOption {
  id: string
  name: string
}

// ── 투입 가능 여부 ────────────────────────────────────────────────────────────
type EligibilityStatus = 'ok' | 'blocked' | 'docs_missing' | 'edu_missing'

function getEligibility(w: Worker): EligibilityStatus {
  if (!w.isActive || (w.accountStatus !== 'APPROVED' && w.accountStatus !== 'ACTIVE')) return 'blocked'
  if (!w.hasContract || !w.hasSafetyCert) return 'docs_missing'
  if (!w.hasSafetyEducation) return 'edu_missing'
  return 'ok'
}

const ELIGIBILITY_LABEL: Record<EligibilityStatus, { label: string; color: string; bg: string }> = {
  ok:           { label: '투입가능',   color: '#16A34A', bg: '#DCFCE7' },
  blocked:      { label: '투입불가',   color: '#B91C1C', bg: '#FEE2E2' },
  docs_missing: { label: '서류미비',   color: '#D97706', bg: '#FEF3C7' },
  edu_missing:  { label: '교육미이수', color: '#D97706', bg: '#FEF3C7' },
}

// ── 확인상태 ──────────────────────────────────────────────────────────────────
function getConfirmStatus(w: Worker): { label: string; color: string; bg: string } {
  const elig = getEligibility(w)
  if (elig === 'blocked') return { label: '확인필요', color: '#B91C1C', bg: '#FEE2E2' }
  if (elig === 'docs_missing') return { label: '서류미비', color: '#D97706', bg: '#FEF3C7' }
  if (elig === 'edu_missing') return { label: '교육미비', color: '#D97706', bg: '#FEF3C7' }
  return { label: '정상', color: '#16A34A', bg: '#DCFCE7' }
}

// ── 정렬 우선순위 ─────────────────────────────────────────────────────────────
function sortRank(w: Worker): number {
  const elig = getEligibility(w)
  if (!w.isActive) return 5
  if (elig === 'blocked') return 0
  if (elig === 'docs_missing') return 1
  if (elig === 'edu_missing') return 2
  if (!w.hasContract) return 3
  if (!w.hasSafetyEducation) return 3
  if (!w.hasSafetyCert) return 3
  return 4
}

// ── 포맷 ─────────────────────────────────────────────────────────────────────
function fmtPhone(p: string): string {
  return p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p
}

function fmtWage(v: number): string {
  if (v === 0) return '-'
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000) return `${Math.floor(v / 10_000)}만`
  return v.toLocaleString()
}

function fmtWageFull(v: number): string {
  return v === 0 ? '-' : v.toLocaleString() + '원'
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
}

const EMP_LABELS: Record<string, string> = {
  DAILY_CONSTRUCTION: '건설일용',
  REGULAR:            '상용직',
  FIXED_TERM:         '기간제',
  CONTINUOUS_SITE:    '계속근로형',
  BUSINESS_33:        '3.3%',
  OTHER:              '기타',
}

// ── 도큐먼트/교육 배지 ────────────────────────────────────────────────────────
function DocBadge({ has, yesLabel = '있음', noLabel = '없음' }: { has: boolean; yesLabel?: string; noLabel?: string }) {
  return has
    ? <span className="text-[11px] font-semibold text-[#16A34A]">{yesLabel}</span>
    : <span className="text-[11px] font-semibold text-[#DC2626]">{noLabel}</span>
}

// ── 패널 섹션/행 ──────────────────────────────────────────────────────────────
function PanelSection({ label, children, warn }: { label: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div className="mb-5">
      <div className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${warn ? 'text-[#DC2626]' : 'text-[#9CA3AF]'}`}>
        {label}
      </div>
      {children}
    </div>
  )
}

function PanelRow({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <span className="text-[12px] text-[#9CA3AF] w-[88px] shrink-0 pt-[1px]">{label}</span>
      <span className={`text-[13px] font-medium flex-1 ${warn ? 'text-[#DC2626]' : 'text-[#374151]'}`}>{value}</span>
    </div>
  )
}

// ── 근로자 등록 모달 ──────────────────────────────────────────────────────────
const emptyForm = { name: '', phone: '', jobTitle: '', employmentType: 'DAILY_CONSTRUCTION', organizationType: 'DIRECT', foreignerYn: false }

function RegisterModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true); setError('')
    const res = await fetch('/api/admin/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!data.success) { setError(data.message); setSaving(false); return }
    onSaved()
  }

  const inp = 'h-9 w-full px-3 text-[13px] border border-[#E5E7EB] rounded-[8px] outline-none focus:border-[#F97316] bg-white'
  const lbl = 'text-[12px] font-semibold text-[#6B7280] mb-1 block'

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[12px] w-full max-w-[440px] shadow-2xl overflow-hidden">
        <div className="h-1 bg-[#F97316]" />
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-[#0F172A]">근로자 등록</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          <div><label className={lbl}>이름 *</label>
            <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동" />
          </div>
          <div><label className={lbl}>연락처 * (010으로 시작 11자리)</label>
            <input className={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="01012345678" />
          </div>
          <div><label className={lbl}>직종 *</label>
            <input className={inp} value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="철근공" />
          </div>
          <div><label className={lbl}>고용 형태</label>
            <select className={inp} value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}>
              {Object.entries(EMP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {error && <div className="text-[12px] text-[#DC2626] bg-[#FEF2F2] px-3 py-2 rounded-[6px]">{error}</div>}
        </div>
        <div className="px-6 pb-5 flex gap-2">
          <button onClick={handleSave} disabled={saving || !form.name || !form.phone || !form.jobTitle}
            className="flex-1 py-2.5 bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 text-white text-[13px] font-semibold rounded-[8px] border-none cursor-pointer transition-colors">
            {saving ? '등록 중...' : '등록'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] cursor-pointer bg-white transition-colors">취소</button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function WorkersPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'

  // 필터
  const [nameSearch, setNameSearch]   = useState('')
  const [siteFilter, setSiteFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [eligFilter, setEligFilter]   = useState('')
  const [sortKey, setSortKey]         = useState('needsAction')

  // 데이터
  const [workers, setWorkers]         = useState<Worker[]>([])
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)

  // 패널
  const [selectedId, setSelectedId]   = useState<string | null>(null)

  // 수정 폼 상태 (패널 내부)
  const [editing, setEditing]         = useState(false)
  const [editForm, setEditForm]       = useState({ name: '', phone: '', jobTitle: '', isActive: true })
  const [editSaving, setEditSaving]   = useState(false)
  const [editError, setEditError]     = useState('')

  // 서류 처리 폼
  const [processingDoc, setProcessingDoc] = useState<null | 'contract' | 'safetyEdu' | 'safetyCert'>(null)
  const [docDate, setDocDate]         = useState('')
  const [docSaving, setDocSaving]     = useState(false)

  // 현장 배정 폼
  const [showAssign, setShowAssign] = useState(false)
  const [assignSiteId, setAssignSiteId] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)

  // 등록 모달
  const [showRegister, setShowRegister] = useState(false)

  // 저장 토스트
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  // 데이터 로드
  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '300' })
    if (nameSearch) params.set('search', nameSearch)
    if (siteFilter) params.set('siteId', siteFilter)

    fetch(`/api/admin/workers?${params}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setWorkers(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [nameSearch, siteFilter, router])

  // 현장 목록 로드
  useEffect(() => {
    fetch('/api/admin/sites?includeInactive=false')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const items = Array.isArray(data.data) ? data.data : (data.data?.items ?? [])
          setSiteOptions(items.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))
        }
      })
  }, [])

  useEffect(() => { load() }, [load])

  // 선택된 근로자
  const selected = workers.find(w => w.id === selectedId) ?? null

  const openDetail = (id: string) => {
    if (selectedId === id) { setSelectedId(null); return }
    setSelectedId(id)
    setEditing(false)
    setEditError('')
    setProcessingDoc(null)
    setDocDate('')
  }

  const closePanel = () => {
    setSelectedId(null)
    setEditing(false)
  }

  // 기본정보 수정
  const startEdit = () => {
    if (!selected) return
    setEditForm({ name: selected.name, phone: selected.phone, jobTitle: selected.jobTitle, isActive: selected.isActive })
    setEditing(true)
    setEditError('')
  }

  const saveEdit = async () => {
    if (!selected) return
    // 빈값 검증
    if (!editForm.name.trim())     { setEditError('이름을 입력하세요.'); return }
    if (!editForm.jobTitle.trim()) { setEditError('직종을 입력하세요.'); return }
    if (!editForm.phone.trim())    { setEditError('연락처를 입력하세요.'); return }
    if (!/^010\d{8}$/.test(editForm.phone)) {
      setEditError('010으로 시작하는 11자리 번호를 입력하세요.')
      return
    }
    if (!editForm.isActive && selected.isActive) {
      if (!confirm(`${selected.name} 근로자를 비활성 처리하시겠습니까?`)) return
    }
    setEditSaving(true); setEditError('')
    const res = await fetch(`/api/admin/workers/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (!data.success) {
      setEditError(data.message ?? '저장에 실패했습니다. 다시 시도해 주세요.')
      setEditSaving(false)
      return
    }
    // 전체 재조회 없이 화면 상태 직접 반영
    setWorkers(prev => prev.map(w => w.id === selected.id
      ? { ...w, name: editForm.name, phone: editForm.phone, jobTitle: editForm.jobTitle, isActive: editForm.isActive }
      : w
    ))
    setEditing(false)
    setEditSaving(false)
    showToast(true, '수정이 저장됐습니다.')
  }

  // 현장 배정 처리
  const saveSiteAssign = async () => {
    if (!selected || !assignSiteId) return
    setAssignSaving(true)
    // 현장의 소속 회사 ID 확인 (사이트 옵션에서)
    const site = siteOptions.find(s => s.id === assignSiteId)
    const res = await fetch(`/api/admin/workers/${selected.id}/site-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: assignSiteId,
        companyId: selected.primaryCompany?.id ?? '',
        assignedFrom: new Date().toISOString(),
        tradeType: selected.jobTitle,
        isPrimary: selected.activeSites.length === 0,
      }),
    })
    const data = await res.json()
    if (data.success) {
      showToast(true, `${site?.name ?? '현장'} 배정 완료`)
      setShowAssign(false)
      setAssignSiteId('')
      load()
    } else {
      showToast(false, data.error ?? data.message ?? '배정 실패')
    }
    setAssignSaving(false)
  }

  // 서류/교육 처리
  const saveDocProcess = async () => {
    if (!selected || !processingDoc || !docDate) return
    setDocSaving(true)
    let docType = ''
    if (processingDoc === 'contract') docType = 'WORK_CONDITIONS_RECEIPT'
    if (processingDoc === 'safetyEdu') docType = 'BASIC_SAFETY_EDU_CONFIRM'
    if (processingDoc === 'safetyCert') docType = 'SAFETY_EDUCATION_NEW_HIRE'

    const res = await fetch(`/api/admin/workers/${selected.id}/safety-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentType: docType, documentDate: docDate }),
    })
    const data = await res.json()
    if (data.success || data.id) {
      setProcessingDoc(null)
      setDocDate('')
      load()
    }
    setDocSaving(false)
  }

  // 클라이언트 필터 + 정렬
  const filtered = workers.filter(w => {
    if (statusFilter === 'active' && !w.isActive) return false
    if (statusFilter === 'inactive' && w.isActive) return false
    if (eligFilter === 'ok' && getEligibility(w) !== 'ok') return false
    if (eligFilter === 'blocked' && getEligibility(w) !== 'blocked') return false
    if (eligFilter === 'docs_missing' && getEligibility(w) !== 'docs_missing') return false
    if (eligFilter === 'edu_missing' && getEligibility(w) !== 'edu_missing') return false
    if (siteFilter === '__unassigned__' && w.activeSites.length > 0) return false
    if (siteFilter && siteFilter !== '__unassigned__' && !w.activeSites.some(s => s.id === siteFilter)) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'needsAction': return sortRank(a) - sortRank(b)
      case 'ineligible':  return (getEligibility(a) === 'ok' ? 1 : 0) - (getEligibility(b) === 'ok' ? 1 : 0)
      case 'name':        return a.name.localeCompare(b.name, 'ko')
      case 'createdAt':   return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'monthWage':   return b.monthWage - a.monthWage
      case 'totalWage':   return b.totalWage - a.totalWage
      default:            return sortRank(a) - sortRank(b)
    }
  })

  // 요약 통계 (클라이언트 계산)
  const statsAll       = workers
  const statsActive    = workers.filter(w => w.isActive)
  const statsEligible  = workers.filter(w => getEligibility(w) === 'ok')
  const statsIneligible = workers.filter(w => getEligibility(w) !== 'ok' && w.isActive)
  const statsNoContract = workers.filter(w => !w.hasContract)
  const statsNoEdu      = workers.filter(w => !w.hasSafetyEducation)
  const statsNoCert     = workers.filter(w => !w.hasSafetyCert)

  const hasPanelOpen = selectedId !== null

  return (
    <PageShell className="flex flex-col gap-4" header={
      <h1 className="text-[18px] font-bold text-[#0F172A]">근로자관리</h1>
    }>

      {/* ── 저장 토스트 ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-[10px] shadow-xl text-[13px] font-semibold text-white transition-all ${toast.ok ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── 필터 바 ── */}
      <SectionCard padding={false}>
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap border-b border-[#F3F4F6]">
          <h1 className="text-[16px] font-bold text-[#0F172A] mr-1 shrink-0">근로자관리</h1>
          <FilterInput
            type="text"
            placeholder="이름/연락처 검색"
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            className="w-[140px]"
          />
          {/* 현장 필터 */}
          <select
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            className="h-9 px-3 text-[13px] rounded-[8px] border border-[#E5E7EB] bg-white text-[#374151] outline-none focus:border-[#F97316]"
          >
            <option value="">전체 현장</option>
            <option value="__unassigned__">미배치</option>
            {siteOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <FilterSelect value={sortKey} onChange={e => setSortKey(e.target.value)}>
            <option value="needsAction">확인필요 우선</option>
            <option value="ineligible">투입불가 우선</option>
            <option value="name">이름순</option>
            <option value="createdAt">최근 등록순</option>
            <option value="monthWage">월 누계 노임 큰 순</option>
            <option value="totalWage">총 누계 노임 큰 순</option>
          </FilterSelect>
          <div className="flex-1" />
          <Btn variant="ghost" size="sm" onClick={load}>새로고침</Btn>
          {canMutate && (
            <Btn variant="orange" size="sm" onClick={() => setShowRegister(true)}>+ 근로자 등록</Btn>
          )}
        </div>
        {/* 상태 필터 pills */}
        <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-[#9CA3AF] mr-1">상태</span>
          {[
            { v: '',         l: '전체' },
            { v: 'active',   l: '재직중' },
            { v: 'inactive', l: '비활성' },
          ].map(opt => (
            <FilterPill key={opt.v} active={statusFilter === opt.v} onClick={() => setStatusFilter(opt.v)}>
              {opt.l}
            </FilterPill>
          ))}
          <span className="mx-2 text-[#E5E7EB]">|</span>
          <span className="text-[11px] font-semibold text-[#9CA3AF] mr-1">투입</span>
          {[
            { v: '',            l: '전체' },
            { v: 'ok',          l: '투입가능' },
            { v: 'blocked',     l: '투입불가' },
            { v: 'docs_missing',l: '서류미비' },
            { v: 'edu_missing', l: '교육미이수' },
          ].map(opt => (
            <FilterPill key={opt.v} active={eligFilter === opt.v} onClick={() => setEligFilter(opt.v)}>
              {opt.l}
            </FilterPill>
          ))}
          <span className="text-[12px] text-[#6B7280] ml-1">총 {sorted.length}명</span>
        </div>
      </SectionCard>

      {/* ── 요약 KPI 7개 ── */}
      <div className="grid grid-cols-7 gap-3">
        {[
          { label: '전체',          value: statsAll.length,         color: '#0F172A' },
          { label: '재직중',         value: statsActive.length,      color: '#16A34A' },
          { label: '투입가능',       value: statsEligible.length,    color: '#2563EB' },
          { label: '투입불가',       value: statsIneligible.length,  color: statsIneligible.length > 0 ? '#DC2626' : '#6B7280' },
          { label: '계약서 미교부',  value: statsNoContract.length,  color: statsNoContract.length > 0 ? '#D97706' : '#6B7280' },
          { label: '교육 미이수',    value: statsNoEdu.length,       color: statsNoEdu.length > 0 ? '#D97706' : '#6B7280' },
          { label: '교육증 미등록',  value: statsNoCert.length,      color: statsNoCert.length > 0 ? '#D97706' : '#6B7280' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3">
            <div className="text-[11px] font-semibold text-[#6B7280] mb-1">{kpi.label}</div>
            <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── 2-column 본문 ── */}
      <div className="flex gap-4 items-start">

        {/* 근로자 목록 */}
        <div className={`flex-1 min-w-0 transition-all ${hasPanelOpen ? 'max-w-[calc(100%-444px)]' : ''}`}>
          <SectionCard padding={false}>
            {loading ? (
              <div className="py-12 text-center text-[13px] text-[#9CA3AF]">로딩 중...</div>
            ) : sorted.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[#9CA3AF]">조회된 근로자가 없습니다</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]" style={{ minWidth: 840 }}>
                  <thead>
                    <tr className="border-b border-[#F3F4F6] bg-[#FAFAFA]">
                      {['이름', '직종', '주배정현장', '오늘출근', '상태', '투입가능', '근로계약서', '안전교육', '안전교육증', '일당', '월 누계', '확인상태'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(w => {
                      const elig = getEligibility(w)
                      const cs = getConfirmStatus(w)
                      const isSelected = w.id === selectedId
                      const rowBg =
                        isSelected ? 'bg-[#FFF7ED]' :
                        elig === 'blocked' ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]' :
                        (elig === 'docs_missing' || elig === 'edu_missing') ? 'bg-[#FFFBEB] hover:bg-[#FEF3C7]' :
                        'hover:bg-[#F9FAFB]'
                      return (
                        <tr
                          key={w.id}
                          onClick={() => openDetail(w.id)}
                          className={`border-b border-[#F9FAFB] cursor-pointer transition-colors ${rowBg}`}
                          style={isSelected ? { borderLeft: '3px solid #F97316' } : {}}
                        >
                          {/* 이름 */}
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-[#111827] whitespace-nowrap">{w.name}</div>
                            {w.foreignerYn && <div className="text-[10px] text-[#6B7280]">외국인</div>}
                          </td>
                          {/* 직종 */}
                          <td className="px-3 py-2.5 text-[12px] text-[#6B7280] whitespace-nowrap">{w.jobTitle}</td>
                          {/* 주배정 현장 */}
                          <td className="px-3 py-2.5 max-w-[110px]">
                            {(() => {
                              const primary = w.activeSites.find(s => s.isPrimary)
                              if (primary) return <div className="text-[12px] text-[#374151] truncate">{primary.name}{w.activeSites.length > 1 && <span className="text-[10px] text-[#9CA3AF] ml-1">+{w.activeSites.length - 1}</span>}</div>
                              if (w.activeSites.length > 0) return <div className="text-[12px] text-[#374151] truncate">{w.activeSites[0].name}{w.activeSites.length > 1 && <span className="text-[10px] text-[#9CA3AF] ml-1">+{w.activeSites.length - 1}</span>}</div>
                              return <span className="text-[11px] font-semibold text-[#D97706] bg-[#FEF3C7] px-[6px] py-[1px] rounded">미배정</span>
                            })()}
                          </td>
                          {/* 오늘 출근 */}
                          <td className="px-3 py-2.5">
                            {w.todayAttendance ? (
                              <div>
                                <span className="text-[11px] font-semibold text-[#16A34A] bg-[#DCFCE7] px-[6px] py-[1px] rounded">출근</span>
                                <div className="text-[10px] text-[#6B7280] mt-[2px] truncate max-w-[80px]">{w.todayAttendance.siteName}</div>
                              </div>
                            ) : w.activeSites.length === 0 ? (
                              <span className="text-[11px] text-[#D1D5DB]">-</span>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#9CA3AF] bg-[#F3F4F6] px-[6px] py-[1px] rounded">미출근</span>
                            )}
                          </td>
                          {/* 상태 */}
                          <td className="px-3 py-2.5">
                            <StatusBadge status={w.isActive ? 'ACTIVE' : 'INACTIVE'} label={w.isActive ? '재직중' : '비활성'} />
                          </td>
                          {/* 투입가능 */}
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                              style={{ color: ELIGIBILITY_LABEL[elig].color, backgroundColor: ELIGIBILITY_LABEL[elig].bg }}>
                              {ELIGIBILITY_LABEL[elig].label}
                            </span>
                          </td>
                          {/* 근로계약서 */}
                          <td className="px-3 py-2.5">
                            <DocBadge has={w.hasContract} yesLabel="교부" noLabel="미교부" />
                          </td>
                          {/* 안전교육 */}
                          <td className="px-3 py-2.5">
                            <DocBadge has={w.hasSafetyEducation} yesLabel="이수" noLabel="미이수" />
                          </td>
                          {/* 안전교육증 */}
                          <td className="px-3 py-2.5">
                            <DocBadge has={w.hasSafetyCert} yesLabel="등록" noLabel="미등록" />
                          </td>
                          {/* 일당 */}
                          <td className="px-3 py-2.5 text-right tabular-nums text-[12px] text-[#6B7280]">
                            {w.dailyWage > 0 ? fmtWage(w.dailyWage) : '-'}
                          </td>
                          {/* 월 누계 */}
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {w.monthWage > 0
                              ? <span className="font-semibold text-[#374151]">{fmtWage(w.monthWage)}</span>
                              : <span className="text-[#D1D5DB]">-</span>}
                          </td>
                          {/* 확인상태 */}
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                              style={{ color: cs.color, backgroundColor: cs.bg }}>
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
              <div className="h-1 bg-[#F97316]" />

              {/* 패널 헤더 */}
              <div className="px-5 py-3.5 flex items-start justify-between border-b border-[#E5E7EB]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-[#0F172A]">{selected.name}</h3>
                    <StatusBadge status={selected.isActive ? 'ACTIVE' : 'INACTIVE'} label={selected.isActive ? '재직중' : '비활성'} />
                    {(() => {
                      const elig = getEligibility(selected)
                      const e = ELIGIBILITY_LABEL[elig]
                      return elig !== 'ok' && (
                        <span className="text-[10px] font-bold px-1.5 py-[2px] rounded" style={{ color: e.color, backgroundColor: e.bg }}>
                          {e.label}
                        </span>
                      )
                    })()}
                  </div>
                  <p className="text-[12px] text-[#9CA3AF] mt-0.5">{selected.jobTitle} · {selected.primaryCompany?.companyName ?? '소속없음'}</p>
                </div>
                <button onClick={closePanel}
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors shrink-0 ml-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>

              {/* 패널 본문 */}
              <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>

                {/* A. 기본 정보 */}
                <PanelSection label="A. 기본 정보">
                  <PanelRow label="연락처" value={fmtPhone(selected.phone)} />
                  {selected.birthDate && <PanelRow label="생년월일" value={selected.birthDate} />}
                  <PanelRow label="고용형태" value={EMP_LABELS[selected.employmentType] ?? selected.employmentType} />
                  {selected.foreignerYn && <PanelRow label="국적" value="외국인" />}
                  <PanelRow label="일당" value={selected.dailyWage > 0 ? fmtWageFull(selected.dailyWage) : '미입력'} warn={!selected.dailyWage} />
                  <PanelRow label="등록일" value={fmtDate(selected.createdAt)} />
                  <PanelRow label="소속현장" value={
                    selected.activeSites.length > 0
                      ? selected.activeSites.map(s => s.name).join(', ')
                      : <span className="text-[#D97706]">미배치</span>
                  } warn={selected.activeSites.length === 0} />
                </PanelSection>

                {/* B. 서류 및 교육 상태 */}
                <PanelSection label="B. 서류 및 교육 상태" warn={!selected.hasContract || !selected.hasSafetyEducation || !selected.hasSafetyCert}>
                  <div className="rounded-[8px] border border-[#E5E7EB] overflow-hidden mb-3">
                    {[
                      { label: '근로계약서 교부', has: selected.hasContract, date: selected.contractDate },
                      { label: '안전교육 이수',   has: selected.hasSafetyEducation, date: selected.safetyEducationDate },
                      { label: '안전교육증 등록', has: selected.hasSafetyCert, date: selected.safetyCertDate },
                    ].map((item, i) => (
                      <div key={item.label} className={`flex items-center justify-between px-3 py-2.5 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}>
                        <span className="text-[12px] font-medium text-[#374151]">{item.label}</span>
                        <div className="text-right">
                          <DocBadge has={item.has} yesLabel="완료" noLabel="미완료" />
                          {item.has && item.date && (
                            <div className="text-[10px] text-[#9CA3AF] mt-0.5">{fmtDate(item.date)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </PanelSection>

                {/* C. 노임 정보 */}
                <PanelSection label="C. 노임 정보">
                  <PanelRow label="일당" value={<span className="font-semibold">{fmtWageFull(selected.dailyWage)}</span>} />
                  <PanelRow label="월 누계" value={<span className="font-semibold text-[#F97316]">{fmtWageFull(selected.monthWage)}</span>} />
                  <PanelRow label="전체 누계" value={<span className="text-[#6B7280]">{fmtWageFull(selected.totalWage)}</span>} />
                </PanelSection>

                {/* D. 오늘 출근 */}
                {selected.todayAttendance && (
                  <PanelSection label="D. 오늘 출근">
                    <div className="rounded-[8px] border border-[#DCFCE7] bg-[#F0FDF4] px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-[#16A34A]">{selected.todayAttendance.siteName}</span>
                        <span className="text-[11px] font-bold text-[#16A34A] bg-[#DCFCE7] px-[6px] py-[1px] rounded">
                          {selected.todayAttendance.status === 'WORKING' ? '근무중' : selected.todayAttendance.status === 'COMPLETED' ? '퇴근' : selected.todayAttendance.status}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#374151]">
                        출근 {selected.todayAttendance.checkInAt ? new Date(selected.todayAttendance.checkInAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        {selected.todayAttendance.checkOutAt && (
                          <span className="ml-2">퇴근 {new Date(selected.todayAttendance.checkOutAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                      {/* 주배정과 실제 출근 현장이 다르면 경고 */}
                      {(() => {
                        const primary = selected.activeSites.find(s => s.isPrimary)
                        if (primary && primary.id !== selected.todayAttendance!.siteId) {
                          return <div className="text-[11px] text-[#D97706] mt-1">⚠ 주배정({primary.name})과 다른 현장 출근</div>
                        }
                        return null
                      })()}
                    </div>
                  </PanelSection>
                )}

                {/* E. 현장 배치 */}
                <PanelSection label={selected.todayAttendance ? "E. 현장 배치" : "D. 현장 배치"}>
                  {selected.activeSites.length > 0 ? (
                    selected.activeSites.map(s => (
                      <div key={s.id} className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                        <span className="text-[13px] text-[#374151]">{s.name}</span>
                        {s.isPrimary && <span className="text-[10px] font-bold text-[#F97316] bg-[#FFF7ED] px-[4px] py-[1px] rounded">주</span>}
                        <span className="text-[11px] text-[#9CA3AF]">배치중</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[13px] text-[#D97706] mb-2">현장 미배치 상태</div>
                  )}
                  {canMutate && !showAssign && (
                    <button onClick={() => setShowAssign(true)} className="mt-1 text-[12px] text-[#F97316] font-semibold bg-transparent border border-[#F97316] rounded-[6px] px-3 py-[5px] cursor-pointer hover:bg-[rgba(249,115,22,0.06)]">
                      + 현장 배정
                    </button>
                  )}
                  {showAssign && (
                    <div className="mt-2 p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
                      <select
                        className="w-full h-8 px-2 text-[13px] border border-[#E5E7EB] rounded-[6px] bg-white mb-2 outline-none focus:border-[#F97316]"
                        value={assignSiteId} onChange={e => setAssignSiteId(e.target.value)}
                      >
                        <option value="">현장 선택</option>
                        {siteOptions
                          .filter(s => !selected.activeSites.some(a => a.id === s.id))
                          .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                        }
                      </select>
                      <div className="flex gap-2">
                        <button onClick={saveSiteAssign} disabled={!assignSiteId || assignSaving}
                          className="flex-1 py-[5px] bg-[#F97316] text-white border-none rounded-[6px] text-[12px] font-semibold cursor-pointer disabled:opacity-50">
                          {assignSaving ? '처리중...' : '배정'}
                        </button>
                        <button onClick={() => { setShowAssign(false); setAssignSiteId('') }}
                          className="px-3 py-[5px] bg-white border border-[#E5E7EB] rounded-[6px] text-[12px] text-[#6B7280] cursor-pointer">
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </PanelSection>

                {/* E. 관리자 처리 */}
                <PanelSection label="E. 관리자 처리">

                  {/* 기본정보 수정 폼 */}
                  {editing ? (
                    <div className="rounded-[10px] bg-[#F5F3FF] border border-[#DDD6FE] px-4 py-4 mb-3">
                      <div className="text-[11px] font-bold text-[#7C3AED] mb-3">기본정보 수정</div>
                      {[
                        { label: '이름', key: 'name' as const },
                        { label: '연락처', key: 'phone' as const },
                        { label: '직종', key: 'jobTitle' as const },
                      ].map(f => (
                        <div key={f.key} className="flex items-center gap-2 mb-2">
                          <span className="text-[12px] text-[#6B7280] w-[48px] shrink-0">{f.label}</span>
                          <input type="text" value={editForm[f.key]} onChange={e => setEditForm(ef => ({ ...ef, [f.key]: e.target.value }))}
                            className="h-8 px-2 flex-1 text-[13px] border border-[#E5E7EB] rounded-[6px] outline-none focus:border-[#7C3AED] bg-white" />
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[12px] text-[#6B7280] w-[48px] shrink-0">상태</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(ef => ({ ...ef, isActive: e.target.checked }))} />
                          <span className="text-[13px] text-[#374151]">재직중</span>
                        </label>
                      </div>
                      {editError && <div className="text-[12px] text-[#DC2626] mb-2">{editError}</div>}
                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={editSaving}
                          className="flex-1 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-semibold rounded-[8px] border-none cursor-pointer transition-colors disabled:opacity-50">
                          {editSaving ? '저장 중...' : '저장'}
                        </button>
                        <button onClick={() => setEditing(false)}
                          className="px-4 py-2 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] cursor-pointer bg-white transition-colors">
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={startEdit}
                      className="w-full mb-2 py-2 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#374151] hover:bg-[#F9FAFB] cursor-pointer bg-white transition-colors text-left px-3">
                      기본정보 수정
                    </button>
                  )}

                  {/* 서류/교육 처리 */}
                  {processingDoc ? (
                    <div className="rounded-[10px] bg-[#FFF7ED] border border-[#FED7AA] px-4 py-4 mb-3">
                      <div className="text-[11px] font-bold text-[#F97316] mb-3">
                        {processingDoc === 'contract' && '근로계약서 교부 처리'}
                        {processingDoc === 'safetyEdu' && '안전교육 이수 처리'}
                        {processingDoc === 'safetyCert' && '안전교육증 등록 처리'}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[12px] text-[#6B7280] w-[40px] shrink-0">날짜</span>
                        <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)}
                          className="h-8 px-2 flex-1 text-[13px] border border-[#E5E7EB] rounded-[6px] outline-none focus:border-[#F97316] bg-white" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveDocProcess} disabled={!docDate || docSaving}
                          className="flex-1 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white text-[13px] font-semibold rounded-[8px] border-none cursor-pointer transition-colors disabled:opacity-50">
                          {docSaving ? '처리 중...' : '처리 저장'}
                        </button>
                        <button onClick={() => { setProcessingDoc(null); setDocDate('') }}
                          className="px-4 py-2 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] cursor-pointer bg-white transition-colors">
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 mb-3">
                      {!selected.hasContract && (
                        <button onClick={() => setProcessingDoc('contract')}
                          className="w-full py-2 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] text-[#DC2626] text-[13px] font-semibold rounded-[8px] cursor-pointer transition-colors">
                          근로계약서 교부 처리
                        </button>
                      )}
                      {!selected.hasSafetyEducation && (
                        <button onClick={() => setProcessingDoc('safetyEdu')}
                          className="w-full py-2 bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] text-[13px] font-semibold rounded-[8px] cursor-pointer transition-colors">
                          안전교육 이수 처리
                        </button>
                      )}
                      {!selected.hasSafetyCert && (
                        <button onClick={() => setProcessingDoc('safetyCert')}
                          className="w-full py-2 bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] text-[13px] font-semibold rounded-[8px] cursor-pointer transition-colors">
                          안전교육증 등록 처리
                        </button>
                      )}
                    </div>
                  )}

                  {/* 출퇴근 기록으로 이동 */}
                  <button
                    onClick={() => {
                      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
                      window.location.href = `/admin/attendance?name=${encodeURIComponent(selected.name)}&date=${today}`
                    }}
                    className="flex items-center justify-center w-full py-2 border border-[#E5E7EB] rounded-[8px] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] transition-colors cursor-pointer bg-white"
                  >
                    오늘 출퇴근 기록 보기 →
                  </button>
                </PanelSection>

              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* 등록 모달 */}
      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onSaved={() => { setShowRegister(false); load() }}
        />
      )}

    </PageShell>
  )
}
