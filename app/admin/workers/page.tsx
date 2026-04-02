'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { useAdminRole } from '@/lib/hooks/useAdminRole'
import {
  PageShell, SectionCard, PageHeader, PageBadge,
  FilterInput, FilterSelect, FilterPill,
  StatusBadge, Btn, KpiCard,
  AdminTable, AdminTr, AdminTd, EmptyRow,
  FormInput, FormSelect, ModalFooter,
  Modal, Toast, FloatingToast,
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
    ? <span className="text-[11px] font-semibold text-status-working">{yesLabel}</span>
    : <span className="text-[11px] font-semibold text-status-rejected">{noLabel}</span>
}

// ── 패널 섹션/행 ──────────────────────────────────────────────────────────────
function PanelSection({ label, children, warn }: { label: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div className="mb-5">
      <div className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${warn ? 'text-status-rejected' : 'text-muted2-brand'}`}>
        {label}
      </div>
      {children}
    </div>
  )
}

function PanelRow({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <span className="text-[12px] text-muted2-brand w-[88px] shrink-0 pt-[1px]">{label}</span>
      <span className={`text-[13px] font-medium flex-1 ${warn ? 'text-status-rejected' : 'text-body-brand'}`}>{value}</span>
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

  return (
    <Modal open onClose={onClose} title="근로자 등록" width={440}>
      <div className="flex flex-col gap-3">
        <FormInput label="이름" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동" className="!mb-0" />
        <FormInput label="연락처" required helper="010으로 시작 11자리" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="01012345678" className="!mb-0" />
        <FormInput label="직종" required value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="철근공" className="!mb-0" />
        <FormSelect label="고용 형태" value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}
          options={Object.entries(EMP_LABELS).map(([v, l]) => ({ value: v, label: l }))} className="!mb-0" />
        {error && <Toast message={error} variant="error" />}
      </div>
      <ModalFooter>
        <Btn variant="orange" size="md" onClick={handleSave} disabled={saving || !form.name || !form.phone || !form.jobTitle}>
          {saving ? '등록 중...' : '등록'}
        </Btn>
        <Btn variant="secondary" size="md" onClick={onClose}>취소</Btn>
      </ModalFooter>
    </Modal>
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
    <PageShell
      className="flex flex-col gap-4"
      header={
        <div className="flex flex-col gap-4">
          <PageHeader
            title="근로자관리"
            description="등록된 근로자 목록을 관리합니다"
            badge={<PageBadge>{sorted.length}명</PageBadge>}
          />

          {/* ── 저장 토스트 ── */}
          {toast && (
            <FloatingToast message={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />
          )}

          {/* ── 필터 바 ── */}
          <SectionCard padding={false}>
            <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap border-b border-brand">
              <FilterInput
                type="text"
                placeholder="이름/연락처 검색"
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
                className="w-[140px]"
              />
              {/* 현장 필터 */}
              <FilterSelect value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
                <option value="">전체 현장</option>
                <option value="__unassigned__">미배치</option>
                {siteOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FilterSelect>
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
                <>
                  <Btn variant="ghost" size="sm" onClick={() => router.push('/admin/worker-imports')}>엑셀 일괄 등록</Btn>
                  <Btn variant="orange" size="sm" onClick={() => router.push('/admin/workers/new')}>+ 근로자 등록</Btn>
                </>
              )}
            </div>
            {/* 상태 필터 pills */}
            <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-muted2-brand mr-1">상태</span>
              {[
                { v: '',         l: '전체' },
                { v: 'active',   l: '재직중' },
                { v: 'inactive', l: '비활성' },
              ].map(opt => (
                <FilterPill key={opt.v} active={statusFilter === opt.v} onClick={() => setStatusFilter(opt.v)}>
                  {opt.l}
                </FilterPill>
              ))}
              <span className="mx-2 text-brand">|</span>
              <span className="text-[11px] font-semibold text-muted2-brand mr-1">투입</span>
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
              <span className="text-[12px] text-muted-brand ml-1">총 {sorted.length}명</span>
            </div>
          </SectionCard>
        </div>
      }
    >

      {/* ── 요약 KPI 7개 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="전체"          value={statsAll.length}         unit="명" accentColor="#0F172A" />
        <KpiCard label="재직중"         value={statsActive.length}      unit="명" accentColor="#16A34A" />
        <KpiCard label="투입가능"       value={statsEligible.length}    unit="명" accentColor="#2563EB" />
        <KpiCard label="투입불가"       value={statsIneligible.length}  unit="명" accentColor={statsIneligible.length > 0 ? '#DC2626' : '#6B7280'} />
        <KpiCard label="계약서 미교부"  value={statsNoContract.length}  unit="명" accentColor={statsNoContract.length > 0 ? '#D97706' : '#6B7280'} />
        <KpiCard label="교육 미이수"    value={statsNoEdu.length}       unit="명" accentColor={statsNoEdu.length > 0 ? '#D97706' : '#6B7280'} />
        <KpiCard label="교육증 미등록"  value={statsNoCert.length}      unit="명" accentColor={statsNoCert.length > 0 ? '#D97706' : '#6B7280'} />
      </div>

      {/* ── 2-column 본문 ── */}
      <div className="flex gap-4 items-start">

        {/* 근로자 목록 */}
        <div className={`flex-1 min-w-0 transition-all ${hasPanelOpen ? 'max-w-[calc(100%-444px)]' : ''}`}>
          <AdminTable headers={['이름', '직종', '주배정현장', '오늘출근', '상태', '투입가능', '근로계약서', '안전교육', '안전교육증', '일당', '월 누계', '확인상태']}>
            {loading ? (
              <EmptyRow colSpan={12} message="로딩 중..." />
            ) : sorted.length === 0 ? (
              <EmptyRow colSpan={12} message="조회된 근로자가 없습니다" />
            ) : (
              sorted.map(w => {
                const elig = getEligibility(w)
                const cs = getConfirmStatus(w)
                const isSelected = w.id === selectedId
                const rowBg =
                  isSelected ? 'bg-accent-light' :
                  elig === 'blocked' ? 'bg-red-light hover:bg-red-light' :
                  (elig === 'docs_missing' || elig === 'edu_missing') ? 'bg-yellow-light hover:bg-yellow-light' :
                  ''
                return (
                  <AdminTr
                    key={w.id}
                    onClick={() => openDetail(w.id)}
                    highlighted={isSelected}
                    className={rowBg}
                  >
                    {/* 이름 */}
                    <AdminTd>
                      <div className="font-semibold text-fore-brand whitespace-nowrap">{w.name}</div>
                      {w.foreignerYn && <div className="text-[10px] text-muted-brand">외국인</div>}
                    </AdminTd>
                    {/* 직종 */}
                    <AdminTd className="text-[12px] text-muted-brand">{w.jobTitle}</AdminTd>
                    {/* 주배정 현장 */}
                    <AdminTd className="max-w-[110px]">
                      {(() => {
                        const primary = w.activeSites.find(s => s.isPrimary)
                        if (primary) return <div className="text-[12px] text-body-brand truncate">{primary.name}{w.activeSites.length > 1 && <span className="text-[10px] text-muted2-brand ml-1">+{w.activeSites.length - 1}</span>}</div>
                        if (w.activeSites.length > 0) return <div className="text-[12px] text-body-brand truncate">{w.activeSites[0].name}{w.activeSites.length > 1 && <span className="text-[10px] text-muted2-brand ml-1">+{w.activeSites.length - 1}</span>}</div>
                        return <StatusBadge status="PENDING" label="미배정" />
                      })()}
                    </AdminTd>
                    {/* 오늘 출근 */}
                    <AdminTd>
                      {w.todayAttendance ? (
                        <div>
                          <StatusBadge status="WORKING" label="출근" />
                          <div className="text-[10px] text-muted-brand mt-[2px] truncate max-w-[80px]">{w.todayAttendance.siteName}</div>
                        </div>
                      ) : w.activeSites.length === 0 ? (
                        <span className="text-[11px] text-[#D1D5DB]">-</span>
                      ) : (
                        <StatusBadge status="INACTIVE" label="미출근" />
                      )}
                    </AdminTd>
                    {/* 상태 */}
                    <AdminTd>
                      <StatusBadge status={w.isActive ? 'ACTIVE' : 'INACTIVE'} label={w.isActive ? '재직중' : '비활성'} />
                    </AdminTd>
                    {/* 투입가능 */}
                    <AdminTd>
                      <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                        style={{ color: ELIGIBILITY_LABEL[elig].color, backgroundColor: ELIGIBILITY_LABEL[elig].bg }}>
                        {ELIGIBILITY_LABEL[elig].label}
                      </span>
                    </AdminTd>
                    {/* 근로계약서 */}
                    <AdminTd>
                      <DocBadge has={w.hasContract} yesLabel="교부" noLabel="미교부" />
                    </AdminTd>
                    {/* 안전교육 */}
                    <AdminTd>
                      <DocBadge has={w.hasSafetyEducation} yesLabel="이수" noLabel="미이수" />
                    </AdminTd>
                    {/* 안전교육증 */}
                    <AdminTd>
                      <DocBadge has={w.hasSafetyCert} yesLabel="등록" noLabel="미등록" />
                    </AdminTd>
                    {/* 일당 */}
                    <AdminTd className="text-right tabular-nums text-[12px] text-muted-brand">
                      {w.dailyWage > 0 ? fmtWage(w.dailyWage) : '-'}
                    </AdminTd>
                    {/* 월 누계 */}
                    <AdminTd className="text-right tabular-nums">
                      {w.monthWage > 0
                        ? <span className="font-semibold text-body-brand">{fmtWage(w.monthWage)}</span>
                        : <span className="text-[#D1D5DB]">-</span>}
                    </AdminTd>
                    {/* 확인상태 */}
                    <AdminTd>
                      <span className="text-[11px] font-semibold px-2 py-[2px] rounded-full whitespace-nowrap"
                        style={{ color: cs.color, backgroundColor: cs.bg }}>
                        {cs.label}
                      </span>
                    </AdminTd>
                  </AdminTr>
                )
              })
            )}
          </AdminTable>
        </div>

        {/* 상세 패널 (sticky) */}
        {hasPanelOpen && selected && (
          <div className="w-[420px] shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <SectionCard padding={false} className="overflow-hidden">
              <div className="h-1 bg-brand-accent" />

              {/* 패널 헤더 */}
              <div className="px-5 py-3.5 flex items-start justify-between border-b border-brand">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-title-brand">{selected.name}</h3>
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
                  <p className="text-[12px] text-muted2-brand mt-0.5">{selected.jobTitle} · {selected.primaryCompany?.companyName ?? '소속없음'}</p>
                </div>
                <button onClick={closePanel}
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted2-brand hover:bg-footer transition-colors shrink-0 ml-2">
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
                      : <span className="text-status-exception">미배치</span>
                  } warn={selected.activeSites.length === 0} />
                </PanelSection>

                {/* B. 서류 및 교육 상태 */}
                <PanelSection label="B. 서류 및 교육 상태" warn={!selected.hasContract || !selected.hasSafetyEducation || !selected.hasSafetyCert}>
                  <div className="rounded-[8px] border border-brand overflow-hidden mb-3">
                    {[
                      { label: '근로계약서 교부', has: selected.hasContract, date: selected.contractDate },
                      { label: '안전교육 이수',   has: selected.hasSafetyEducation, date: selected.safetyEducationDate },
                      { label: '안전교육증 등록', has: selected.hasSafetyCert, date: selected.safetyCertDate },
                    ].map((item, i) => (
                      <div key={item.label} className={`flex items-center justify-between px-3 py-2.5 ${i > 0 ? 'border-t border-brand' : ''}`}>
                        <span className="text-[12px] font-medium text-body-brand">{item.label}</span>
                        <div className="text-right">
                          <DocBadge has={item.has} yesLabel="완료" noLabel="미완료" />
                          {item.has && item.date && (
                            <div className="text-[10px] text-muted2-brand mt-0.5">{fmtDate(item.date)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </PanelSection>

                {/* C. 노임 정보 */}
                <PanelSection label="C. 노임 정보">
                  <PanelRow label="일당" value={<span className="font-semibold">{fmtWageFull(selected.dailyWage)}</span>} />
                  <PanelRow label="월 누계" value={<span className="font-semibold text-accent">{fmtWageFull(selected.monthWage)}</span>} />
                  <PanelRow label="전체 누계" value={<span className="text-muted-brand">{fmtWageFull(selected.totalWage)}</span>} />
                </PanelSection>

                {/* D. 오늘 출근 */}
                {selected.todayAttendance && (
                  <PanelSection label="D. 오늘 출근">
                    <div className="rounded-[8px] border border-[#DCFCE7] bg-[#F0FDF4] px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-status-working">{selected.todayAttendance.siteName}</span>
                        <span className="text-[11px] font-bold text-status-working bg-[#DCFCE7] px-[6px] py-[1px] rounded">
                          {selected.todayAttendance.status === 'WORKING' ? '근무중' : selected.todayAttendance.status === 'COMPLETED' ? '퇴근' : selected.todayAttendance.status}
                        </span>
                      </div>
                      <div className="text-[12px] text-body-brand">
                        출근 {selected.todayAttendance.checkInAt ? new Date(selected.todayAttendance.checkInAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        {selected.todayAttendance.checkOutAt && (
                          <span className="ml-2">퇴근 {new Date(selected.todayAttendance.checkOutAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                      {/* 주배정과 실제 출근 현장이 다르면 경고 */}
                      {(() => {
                        const primary = selected.activeSites.find(s => s.isPrimary)
                        if (primary && primary.id !== selected.todayAttendance!.siteId) {
                          return <div className="text-[11px] text-status-exception mt-1">⚠ 주배정({primary.name})과 다른 현장 출근</div>
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
                        <span className="text-[13px] text-body-brand">{s.name}</span>
                        {s.isPrimary && <span className="text-[10px] font-bold text-accent bg-accent-light px-[4px] py-[1px] rounded">주</span>}
                        <span className="text-[11px] text-muted2-brand">배치중</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[13px] text-status-exception mb-2">현장 미배치 상태</div>
                  )}
                  {canMutate && !showAssign && (
                    <button onClick={() => setShowAssign(true)} className="mt-1 text-[12px] text-accent font-semibold bg-transparent border border-accent rounded-[6px] px-3 py-[5px] cursor-pointer hover:bg-[rgba(249,115,22,0.06)]">
                      + 현장 배정
                    </button>
                  )}
                  {showAssign && (
                    <div className="mt-2 p-3 bg-yellow-light border border-yellow rounded-lg">
                      <FormSelect
                        value={assignSiteId} onChange={e => setAssignSiteId(e.target.value)}
                        placeholder="현장 선택"
                        options={siteOptions
                          .filter(s => !selected.activeSites.some(a => a.id === s.id))
                          .map(s => ({ value: s.id, label: s.name }))}
                        className="mb-2"
                      />
                      <div className="flex gap-2">
                        <Btn variant="orange" size="sm" onClick={saveSiteAssign} disabled={!assignSiteId || assignSaving} className="flex-1">
                          {assignSaving ? '처리중...' : '배정'}
                        </Btn>
                        <Btn variant="secondary" size="sm" onClick={() => { setShowAssign(false); setAssignSiteId('') }}>
                          취소
                        </Btn>
                      </div>
                    </div>
                  )}
                </PanelSection>

                {/* E. 관리자 처리 */}
                <PanelSection label="E. 관리자 처리">

                  {/* 기본정보 수정 폼 */}
                  {editing ? (
                    <div className="rounded-[10px] bg-[#F5F3FF] border border-purple px-4 py-4 mb-3">
                      <div className="text-[11px] font-bold text-status-adjusted mb-3">기본정보 수정</div>
                      <FormInput label="이름" value={editForm.name} onChange={e => setEditForm(ef => ({ ...ef, name: e.target.value }))} className="mb-2" />
                      <FormInput label="연락처" value={editForm.phone} onChange={e => setEditForm(ef => ({ ...ef, phone: e.target.value }))} className="mb-2" />
                      <FormInput label="직종" value={editForm.jobTitle} onChange={e => setEditForm(ef => ({ ...ef, jobTitle: e.target.value }))} className="mb-2" />
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[12px] text-muted-brand w-[48px] shrink-0">상태</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(ef => ({ ...ef, isActive: e.target.checked }))} />
                          <span className="text-[13px] text-body-brand">재직중</span>
                        </label>
                      </div>
                      {editError && <div className="text-[12px] text-status-rejected mb-2">{editError}</div>}
                      <div className="flex gap-2">
                        <Btn variant="primary" size="sm" onClick={saveEdit} disabled={editSaving} className="flex-1">
                          {editSaving ? '저장 중...' : '저장'}
                        </Btn>
                        <Btn variant="secondary" size="sm" onClick={() => setEditing(false)}>
                          취소
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <button onClick={startEdit}
                      className="w-full mb-2 py-2 border border-brand rounded-[8px] text-[13px] text-body-brand hover:bg-surface cursor-pointer bg-card transition-colors text-left px-3">
                      기본정보 수정
                    </button>
                  )}

                  {/* 서류/교육 처리 */}
                  {processingDoc ? (
                    <div className="rounded-[10px] bg-accent-light border border-accent-light px-4 py-4 mb-3">
                      <div className="text-[11px] font-bold text-accent mb-3">
                        {processingDoc === 'contract' && '근로계약서 교부 처리'}
                        {processingDoc === 'safetyEdu' && '안전교육 이수 처리'}
                        {processingDoc === 'safetyCert' && '안전교육증 등록 처리'}
                      </div>
                      <FormInput label="날짜" type="date" value={docDate} onChange={e => setDocDate(e.target.value)} className="mb-3" />
                      <div className="flex gap-2">
                        <Btn variant="orange" size="sm" onClick={saveDocProcess} disabled={!docDate || docSaving} className="flex-1">
                          {docSaving ? '처리 중...' : '처리 저장'}
                        </Btn>
                        <Btn variant="secondary" size="sm" onClick={() => { setProcessingDoc(null); setDocDate('') }}>
                          취소
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 mb-3">
                      {!selected.hasContract && (
                        <button onClick={() => setProcessingDoc('contract')}
                          className="w-full py-2 bg-red-light hover:bg-red-light border border-[#FCA5A5] text-status-rejected text-[13px] font-semibold rounded-[8px] cursor-pointer transition-colors">
                          근로계약서 교부 처리
                        </button>
                      )}
                      {!selected.hasSafetyEducation && (
                        <button onClick={() => setProcessingDoc('safetyEdu')}
                          className="w-full py-2 bg-yellow-light hover:bg-yellow-light border border-yellow text-status-exception text-[13px] font-semibold rounded-[8px] cursor-pointer transition-colors">
                          안전교육 이수 처리
                        </button>
                      )}
                      {!selected.hasSafetyCert && (
                        <button onClick={() => setProcessingDoc('safetyCert')}
                          className="w-full py-2 bg-yellow-light hover:bg-yellow-light border border-yellow text-status-exception text-[13px] font-semibold rounded-[8px] cursor-pointer transition-colors">
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
                    className="flex items-center justify-center w-full py-2 border border-brand rounded-[8px] text-[13px] text-muted-brand hover:bg-surface transition-colors cursor-pointer bg-card"
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
