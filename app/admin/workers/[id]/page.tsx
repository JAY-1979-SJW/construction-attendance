'use client'

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Company {
  id: string
  companyName: string
  companyType?: string
  businessNumber?: string | null
}

interface CompanyAssignment {
  id: string
  companyId: string
  company: Company
  employmentType: string
  contractorTier: string
  roleTitle?: string | null
  validFrom: string
  validTo?: string | null
  isPrimary: boolean
  notes?: string | null
}

interface SiteAssignment {
  id: string
  siteId: string
  companyId: string
  site: { id: string; name: string; address?: string }
  company: { id: string; companyName: string }
  tradeType?: string | null
  assignedFrom: string
  assignedTo?: string | null
  isActive: boolean
  isPrimary: boolean
  notes?: string | null
}

interface InsuranceStatus {
  id: string
  companyId: string
  company: { id: string; companyName: string }
  nationalPensionStatus: string
  healthInsuranceStatus: string
  employmentInsuranceStatus: string
  industrialAccidentStatus: string
  dailyWorkerFlag: boolean
  constructionWorkerFlag: boolean
  acquisitionDate?: string | null
  lossDate?: string | null
  reportingStatus: string
  verificationDate?: string | null
  notes?: string | null
  updatedAt: string
}

interface WorkerDetail {
  id: string
  name: string
  phone: string
  jobTitle: string
  isActive: boolean
  workerCode?: string | null
  employmentType: string
  incomeType: string
  organizationType: string
  skillLevel?: string | null
  foreignerYn: boolean
  nationalityCode?: string | null
  // 신규 암호화 계좌 (마스킹값) — 레거시 bankName/bankAccount 제거됨
  bankAccountSecure?: { bankName: string | null; accountNumberMasked: string | null } | null
  retirementMutualStatus: string
  retirementMutualTargetYn: boolean
  fourInsurancesEligibleYn: boolean
  idVerificationStatus?: string | null
  accountStatus?: string
  birthDate?: string | null
  subcontractorName?: string | null
  assignmentEligibility?: string  // READY | NEEDS_DOCS | NEEDS_REVISION | EXPIRED_DOCS | NOT_APPROVED
  missingDocs?: { key: string; label: string; actionType: string; docType?: string; status?: string; expiresAt?: string | null }[]
  rejectedDocs?: { key: string; label: string; actionType: string; docType?: string; status?: string; expiresAt?: string | null }[]
  expiredDocs?: { key: string; label: string; actionType: string; docType?: string; status?: string; expiresAt?: string | null }[]
  expiringDocs?: { key: string; label: string; actionType: string; docType?: string; status?: string; expiresAt?: string | null }[]
  nextAction?: string
  createdAt: string
  updatedAt: string
  _count: { devices: number; attendanceLogs: number }
  companyAssignments: CompanyAssignment[]
  siteAssignments: SiteAssignment[]
  insuranceStatuses: InsuranceStatus[]
}

// ─── 탭 종류 ──────────────────────────────────────────────────────────────────

type Tab = 'info' | 'profile' | 'company' | 'site' | 'insurance' | 'docs' | 'contracts' | 'safety' | 'hrActions'

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

const fmtPhone = (p: string) =>
  p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('ko-KR') : '—'

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  DAILY_CONSTRUCTION: '건설일용',
  REGULAR: '상용',
  BUSINESS_33: '3.3%',
  OTHER: '기타',
}
const INSURANCE_STATUS_LABELS: Record<string, string> = {
  ENROLLED: '가입',
  LOSS: '상실',
  EXEMPT: '적용제외',
  UNKNOWN: '미확인',
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('info')
  const [worker, setWorker] = useState<WorkerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 서류 생성 연동: 부족 서류 클릭 시 탭 전환 + 문서 타입 전달
  const [pendingDocType, setPendingDocType] = useState<string | null>(null)

  // 회사 목록 (배정 폼용)
  const [companies, setCompanies] = useState<Company[]>([])
  // 현장 목록 (배정 폼용)
  const [sites, setSites] = useState<{ id: string; name: string }[]>([])

  // 모달/폼 상태
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [showInsuranceForm, setShowInsuranceForm] = useState(false)
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // 회사 배정 폼
  const [companyForm, setCompanyForm] = useState({
    companyId: '', employmentType: 'DAILY', contractorTier: 'PRIME',
    roleTitle: '', validFrom: '', validTo: '', isPrimary: false, notes: '',
  })

  // 현장 배정 폼
  const [siteForm, setSiteForm] = useState({
    siteId: '', companyId: '', tradeType: '', assignedFrom: '',
    assignedTo: '', isPrimary: false, notes: '',
  })

  // 보험 상태 폼
  const [insuranceForm, setInsuranceForm] = useState({
    companyId: '',
    nationalPensionStatus: 'UNKNOWN', healthInsuranceStatus: 'UNKNOWN',
    employmentInsuranceStatus: 'UNKNOWN', industrialAccidentStatus: 'UNKNOWN',
    dailyWorkerFlag: true, constructionWorkerFlag: true,
    acquisitionDate: '', lossDate: '', reportingStatus: 'NOT_CHECKED',
    verificationDate: '', notes: '',
  })

  const load = () => {
    setLoading(true)
    fetch(`/api/admin/workers/${id}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setError(d.message ?? '근로자를 찾을 수 없습니다.'); setLoading(false); return }
        setWorker(d.data)
        setLoading(false)
      })
      .catch(() => { setError('로딩 실패'); setLoading(false) })
  }

  const loadCompanies = () => {
    fetch('/api/admin/companies?pageSize=200')
      .then(r => r.json())
      .then(d => { if (d.success) setCompanies(d.data.items) })
  }

  const loadSites = () => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => { if (d.success) setSites(d.data?.items ?? d.data ?? []) })
  }

  useEffect(() => { load() }, [id])

  const openCompanyForm = () => {
    loadCompanies()
    setCompanyForm({ companyId: '', employmentType: 'DAILY', contractorTier: 'PRIME', roleTitle: '', validFrom: '', validTo: '', isPrimary: false, notes: '' })
    setFormError('')
    setShowCompanyForm(true)
  }

  const openSiteForm = () => {
    loadCompanies()
    loadSites()
    setSiteForm({ siteId: '', companyId: '', tradeType: '', assignedFrom: '', assignedTo: '', isPrimary: false, notes: '' })
    setFormError('')
    setShowSiteForm(true)
  }

  const openInsuranceForm = () => {
    loadCompanies()
    setInsuranceForm({
      companyId: '', nationalPensionStatus: 'UNKNOWN', healthInsuranceStatus: 'UNKNOWN',
      employmentInsuranceStatus: 'UNKNOWN', industrialAccidentStatus: 'UNKNOWN',
      dailyWorkerFlag: true, constructionWorkerFlag: true,
      acquisitionDate: '', lossDate: '', reportingStatus: 'NOT_CHECKED', verificationDate: '', notes: '',
    })
    setFormError('')
    setShowInsuranceForm(true)
  }

  const saveCompanyAssignment = async () => {
    setFormSaving(true); setFormError('')
    const res = await fetch(`/api/admin/workers/${id}/company-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...companyForm,
        validTo: companyForm.validTo || null,
        roleTitle: companyForm.roleTitle || null,
        notes: companyForm.notes || null,
      }),
    })
    const d = await res.json()
    if (!d.success) { setFormError(d.error ?? d.message ?? '저장 실패'); setFormSaving(false); return }
    setShowCompanyForm(false); load(); setFormSaving(false)
  }

  const saveSiteAssignment = async () => {
    setFormSaving(true); setFormError('')
    const res = await fetch(`/api/admin/workers/${id}/site-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...siteForm,
        assignedTo: siteForm.assignedTo || null,
        tradeType: siteForm.tradeType || null,
        notes: siteForm.notes || null,
      }),
    })
    const d = await res.json()
    if (!d.success) { setFormError(d.error ?? d.message ?? '저장 실패'); setFormSaving(false); return }
    setShowSiteForm(false); load(); setFormSaving(false)
  }

  const saveInsuranceStatus = async () => {
    setFormSaving(true); setFormError('')
    const res = await fetch(`/api/admin/workers/${id}/insurance-statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...insuranceForm,
        acquisitionDate: insuranceForm.acquisitionDate || null,
        lossDate: insuranceForm.lossDate || null,
        verificationDate: insuranceForm.verificationDate || null,
        notes: insuranceForm.notes || null,
      }),
    })
    const d = await res.json()
    if (!d.success) { setFormError(d.error ?? d.message ?? '저장 실패'); setFormSaving(false); return }
    setShowInsuranceForm(false); load(); setFormSaving(false)
  }

  if (loading) return <div className="font-sans"><p className="p-10">로딩 중...</p></div>
  if (error) return <div className="font-sans"><p className="p-10 text-red-600">{error}</p></div>
  if (!worker) return null

  return (
    <div className="font-sans">
      <div className="p-7 max-w-[1100px]">
        {/* 헤더 */}
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/admin/workers')} className="px-3 py-1.5 bg-white border border-secondary-brand/30 rounded-md cursor-pointer text-[13px]">← 목록</button>
            <h1 className="m-0 text-xl font-bold inline-flex items-baseline gap-1.5">
              {worker.name}
              <span className={`ml-2 text-sm font-normal ${worker.isActive ? 'text-[#2e7d32]' : 'text-[#999]'}`}>
                {worker.isActive ? '활성' : '비활성'}
              </span>
            </h1>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[13px] text-muted-brand">
              {fmtPhone(worker.phone)} · {worker.jobTitle} · 기기 {worker._count.devices}대 · 출퇴근 {worker._count.attendanceLogs}건
            </div>
            <Link
              href={`/admin/workers/${worker.id}/dispute-panel`}
              className="text-[13px] font-bold text-[#c62828] bg-[#fff3e0] border border-[#ffcc80] rounded-lg px-3.5 py-1.5 no-underline flex-shrink-0"
            >
              분쟁방어 패널 →
            </Link>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-4 border-b border-[#e0e0e0] pb-0">
          {([['info', '기본정보'], ['profile', '분류정보'], ['company', '회사배정'], ['site', '현장배정'], ['insurance', '보험상태'], ['contracts', '계약서'], ['safety', '안전문서'], ['docs', '문서'], ['hrActions', '경고·소명']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`px-[18px] py-2 bg-transparent border-none border-b-2 cursor-pointer text-[13px] font-medium flex items-center gap-1.5 -mb-px ${tab === key ? 'border-[#1976d2] text-secondary-brand font-bold' : 'border-transparent text-muted-brand'}`}>
              {label}
              {key === 'company' && worker.companyAssignments.length > 0 && (
                <span className="bg-accent text-white rounded-[10px] px-1.5 py-px text-[11px] font-bold">{worker.companyAssignments.length}</span>
              )}
              {key === 'site' && worker.siteAssignments.length > 0 && (
                <span className="bg-accent text-white rounded-[10px] px-1.5 py-px text-[11px] font-bold">{worker.siteAssignments.length}</span>
              )}
              {key === 'insurance' && worker.insuranceStatuses.length > 0 && (
                <span className="bg-accent text-white rounded-[10px] px-1.5 py-px text-[11px] font-bold">{worker.insuranceStatuses.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        <div className="bg-white rounded-lg p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          {tab === 'info' && <InfoTab worker={worker} onRefresh={load} onNavigateDoc={(doc) => {
            if (doc.actionType === 'CONTRACT_NEW') {
              router.push(`/admin/contracts/new?workerId=${worker.id}`)
            } else if (doc.actionType === 'SAFETY_DOC' && doc.docType) {
              setPendingDocType(doc.docType)
              setTab('safety')
            }
          }} />}
          {tab === 'profile' && <ProfileTab workerId={worker.id} />}
          {tab === 'company' && (
            <CompanyTab
              assignments={worker.companyAssignments}
              onAdd={openCompanyForm}
            />
          )}
          {tab === 'site' && (
            <SiteTab
              assignments={worker.siteAssignments}
              onAdd={openSiteForm}
            />
          )}
          {tab === 'insurance' && (
            <InsuranceTab
              statuses={worker.insuranceStatuses}
              onAdd={openInsuranceForm}
            />
          )}
          {tab === 'docs' && <DocsTab workerId={worker.id} />}
          {tab === 'contracts' && <ContractsTab workerId={worker.id} onDocChange={load} />}
          {tab === 'safety' && <SafetyDocsTab workerId={worker.id} initialDocType={pendingDocType} onInitialDocTypeConsumed={() => setPendingDocType(null)} onDocChange={load} onNavigateDoc={(doc) => { if (doc.docType) { setPendingDocType(doc.docType); setTab('safety') } }} />}
          {tab === 'hrActions' && <HrActionsTab workerId={worker.id} workerName={worker.name} />}
        </div>

        {/* 종료 처리 */}
        {worker.isActive && (
          <div className="bg-[#fff3e0] border border-[#ffcc80] rounded-xl px-5 py-4 flex items-center justify-between mt-4">
            <div>
              <div className="text-sm font-bold text-[#e65100]">종료 처리</div>
              <div className="text-xs text-[#718096] mt-0.5">체크리스트 완료 후 종료 확정이 가능합니다. 단순 상태 변경은 허용되지 않습니다.</div>
            </div>
            <Link
              href={`/admin/workers/${worker.id}/termination`}
              className="px-5 py-2.5 bg-[#e65100] text-white rounded-lg text-[13px] font-bold no-underline flex-shrink-0"
            >
              종료 처리 시작 →
            </Link>
          </div>
        )}
        {!worker.isActive && (
          <div className="bg-brand border border-[#bdbdbd] rounded-xl px-5 py-3.5 mt-4 text-[13px] text-[#718096] text-center">
            이 근로자는 이미 종료(비활성화) 처리되었습니다.
          </div>
        )}
      </div>

      {/* ── 회사 배정 모달 ─────────────────────────────────────── */}
      {showCompanyForm && (
        <Modal title="회사 배정 등록" onClose={() => setShowCompanyForm(false)}>
          <Field label="회사 *">
            <select value={companyForm.companyId} onChange={e => setCompanyForm(f => ({ ...f, companyId: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]">
              <option value="">선택하세요</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </Field>
          <Field label="고용형태">
            <select value={companyForm.employmentType} onChange={e => setCompanyForm(f => ({ ...f, employmentType: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]">
              <option value="DAILY">일용직</option>
              <option value="REGULAR">상용직</option>
              <option value="OUTSOURCE">외주</option>
            </select>
          </Field>
          <Field label="계약 단계">
            <select value={companyForm.contractorTier} onChange={e => setCompanyForm(f => ({ ...f, contractorTier: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]">
              <option value="PRIME">원청</option>
              <option value="SUB1">1차 협력</option>
              <option value="SUB2">2차 협력</option>
              <option value="SUB3">3차 이하</option>
            </select>
          </Field>
          <Field label="역할/직책">
            <input value={companyForm.roleTitle} onChange={e => setCompanyForm(f => ({ ...f, roleTitle: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" placeholder="현장 소장" />
          </Field>
          <Field label="시작일 *">
            <input type="date" value={companyForm.validFrom} onChange={e => setCompanyForm(f => ({ ...f, validFrom: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          <Field label="종료일">
            <input type="date" value={companyForm.validTo} onChange={e => setCompanyForm(f => ({ ...f, validTo: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          <Field label="">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={companyForm.isPrimary} onChange={e => setCompanyForm(f => ({ ...f, isPrimary: e.target.checked }))} />
              주 소속 (Primary)
            </label>
          </Field>
          <Field label="메모">
            <input value={companyForm.notes} onChange={e => setCompanyForm(f => ({ ...f, notes: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          {formError && <p className="text-[#c62828] text-[13px] mb-3">{formError}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowCompanyForm(false)} className="px-[18px] py-2 bg-brand border border-secondary-brand/30 rounded-md cursor-pointer text-[13px]">취소</button>
            <button onClick={saveCompanyAssignment} disabled={formSaving || !companyForm.companyId || !companyForm.validFrom} className="px-[18px] py-2 bg-accent text-white border-none rounded-md cursor-pointer text-[13px] font-semibold">
              {formSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── 현장 배정 모달 ─────────────────────────────────────── */}
      {showSiteForm && (
        <Modal title="현장 배정 등록" onClose={() => setShowSiteForm(false)}>
          <Field label="현장 *">
            <select value={siteForm.siteId} onChange={e => setSiteForm(f => ({ ...f, siteId: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]">
              <option value="">선택하세요</option>
              {sites.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </Field>
          <Field label="소속회사 *">
            <select value={siteForm.companyId} onChange={e => setSiteForm(f => ({ ...f, companyId: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]">
              <option value="">선택하세요</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </Field>
          <Field label="직종/공종">
            <input value={siteForm.tradeType} onChange={e => setSiteForm(f => ({ ...f, tradeType: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" placeholder="형틀목공" />
          </Field>
          <Field label="배정일 *">
            <input type="date" value={siteForm.assignedFrom} onChange={e => setSiteForm(f => ({ ...f, assignedFrom: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          <Field label="종료일">
            <input type="date" value={siteForm.assignedTo} onChange={e => setSiteForm(f => ({ ...f, assignedTo: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          <Field label="">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={siteForm.isPrimary} onChange={e => setSiteForm(f => ({ ...f, isPrimary: e.target.checked }))} />
              주 현장 (Primary)
            </label>
          </Field>
          <Field label="메모">
            <input value={siteForm.notes} onChange={e => setSiteForm(f => ({ ...f, notes: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          {formError && <p className="text-[#c62828] text-[13px] mb-3">{formError}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowSiteForm(false)} className="px-[18px] py-2 bg-brand border border-secondary-brand/30 rounded-md cursor-pointer text-[13px]">취소</button>
            <button onClick={saveSiteAssignment} disabled={formSaving || !siteForm.siteId || !siteForm.companyId || !siteForm.assignedFrom} className="px-[18px] py-2 bg-accent text-white border-none rounded-md cursor-pointer text-[13px] font-semibold">
              {formSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── 보험 상태 모달 ─────────────────────────────────────── */}
      {showInsuranceForm && (
        <Modal title="보험 상태 등록/수정" onClose={() => setShowInsuranceForm(false)}>
          <Field label="회사 *">
            <select value={insuranceForm.companyId} onChange={e => setInsuranceForm(f => ({ ...f, companyId: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]">
              <option value="">선택하세요</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </Field>
          {([
            ['nationalPensionStatus', '국민연금'],
            ['healthInsuranceStatus', '건강보험'],
            ['employmentInsuranceStatus', '고용보험'],
            ['industrialAccidentStatus', '산재보험'],
          ] as [keyof typeof insuranceForm, string][]).map(([key, label]) => (
            <Field key={key} label={label}>
              <select value={insuranceForm[key] as string} onChange={e => setInsuranceForm(f => ({ ...f, [key]: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]">
                <option value="UNKNOWN">미확인</option>
                <option value="ENROLLED">가입</option>
                <option value="LOSS">상실</option>
                <option value="EXEMPT">적용제외</option>
              </select>
            </Field>
          ))}
          <Field label="취득일">
            <input type="date" value={insuranceForm.acquisitionDate} onChange={e => setInsuranceForm(f => ({ ...f, acquisitionDate: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          <Field label="상실일">
            <input type="date" value={insuranceForm.lossDate} onChange={e => setInsuranceForm(f => ({ ...f, lossDate: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          <Field label="신고 상태">
            <select value={insuranceForm.reportingStatus} onChange={e => setInsuranceForm(f => ({ ...f, reportingStatus: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]">
              <option value="NOT_CHECKED">미확인</option>
              <option value="REPORTED">신고완료</option>
              <option value="PENDING">신고대기</option>
              <option value="EXEMPTED">면제</option>
            </select>
          </Field>
          <Field label="확인일">
            <input type="date" value={insuranceForm.verificationDate} onChange={e => setInsuranceForm(f => ({ ...f, verificationDate: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          <Field label="메모">
            <input value={insuranceForm.notes} onChange={e => setInsuranceForm(f => ({ ...f, notes: e.target.value }))} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]" />
          </Field>
          {formError && <p className="text-[#c62828] text-[13px] mb-3">{formError}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowInsuranceForm(false)} className="px-[18px] py-2 bg-brand border border-secondary-brand/30 rounded-md cursor-pointer text-[13px]">취소</button>
            <button onClick={saveInsuranceStatus} disabled={formSaving || !insuranceForm.companyId} className="px-[18px] py-2 bg-accent text-white border-none rounded-md cursor-pointer text-[13px] font-semibold">
              {formSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── 기본정보 탭 ──────────────────────────────────────────────────────────────

function InfoTab({ worker, onRefresh, onNavigateDoc }: { worker: WorkerDetail; onRefresh: () => void; onNavigateDoc?: (doc: { key: string; label: string; actionType: string; docType?: string }) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')

  const [editName, setEditName] = React.useState(worker.name)
  const [editPhone, setEditPhone] = React.useState(worker.phone)
  const [editJobTitle, setEditJobTitle] = React.useState(worker.jobTitle)
  const [editIsActive, setEditIsActive] = React.useState(worker.isActive)

  const openEdit = () => {
    setEditName(worker.name)
    setEditPhone(worker.phone)
    setEditJobTitle(worker.jobTitle)
    setEditIsActive(worker.isActive)
    setSaveError('')
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    const body: Record<string, unknown> = {}
    if (editName !== worker.name) body.name = editName
    if (editPhone !== worker.phone) body.phone = editPhone
    if (editJobTitle !== worker.jobTitle) body.jobTitle = editJobTitle
    if (editIsActive !== worker.isActive) body.isActive = editIsActive
    if (Object.keys(body).length === 0) { setEditing(false); setSaving(false); return }

    const res = await fetch(`/api/admin/workers/${worker.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    setSaving(false)
    if (!d.success) { setSaveError(d.error ?? d.message ?? '저장 실패'); return }
    setEditing(false)
    onRefresh()
  }

  const ELIG_STYLE: Record<string, { label: string; color: string }> = {
    READY:          { label: '투입 가능', color: '#16A34A' },
    NEEDS_DOCS:     { label: '서류 미비', color: '#D97706' },
    NEEDS_REVISION: { label: '보완 필요', color: '#DC2626' },
    EXPIRED_DOCS:   { label: '만료 서류', color: '#DC2626' },
    NOT_APPROVED:   { label: '승인 필요', color: '#DC2626' },
  }
  const eligStyle = ELIG_STYLE[worker.assignmentEligibility ?? ''] ?? { label: '—', color: '#9CA3AF' }

  const ACCOUNT_STATUS_LABELS: Record<string, string> = {
    PENDING: '승인 대기', APPROVED: '승인', REJECTED: '반려', SUSPENDED: '정지', ACTIVE: '활성',
  }

  const readonlyRows: [string, string | React.ReactNode][] = [
    ['근로자 코드', worker.workerCode ?? '—'],
    ['계정 상태', ACCOUNT_STATUS_LABELS[worker.accountStatus ?? ''] ?? worker.accountStatus ?? '—'],
    ['고용형태', EMPLOYMENT_TYPE_LABELS[worker.employmentType] ?? worker.employmentType],
    ['소득구분', worker.incomeType === 'DAILY_WAGE' ? '일당' : worker.incomeType === 'MONTHLY_SALARY' ? '월급' : worker.incomeType],
    ['직접/협력', worker.organizationType === 'DIRECT' ? '직영' : `협력사${worker.subcontractorName ? ` (${worker.subcontractorName})` : ''}`],
    ['생년월일', worker.birthDate ? `${worker.birthDate.slice(0, 4)}.${worker.birthDate.slice(4, 6)}.${worker.birthDate.slice(6, 8)}` : '—'],
    ['숙련도', worker.skillLevel ?? '—'],
    ['외국인', worker.foreignerYn ? `예 (${worker.nationalityCode ?? '—'})` : '아니오'],
    ['계좌', worker.bankAccountSecure
      ? `${worker.bankAccountSecure.bankName ?? '—'} / ${worker.bankAccountSecure.accountNumberMasked ?? '****'}`
      : '미등록 (개인정보 관리에서 입력)'],
    ['퇴직공제 대상', worker.retirementMutualTargetYn ? '대상' : '비대상'],
    ['퇴직공제 상태', worker.retirementMutualStatus],
    ['4대보험 적용', worker.fourInsurancesEligibleYn ? '적용' : '미적용'],
    ['신분증 상태', worker.idVerificationStatus ?? '—'],
    ['등록일', fmtDate(worker.createdAt)],
    ['최근 수정', fmtDate(worker.updatedAt)],
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="mt-0 mb-0 text-sm font-bold text-[#CBD5E0]">기본 정보</h3>
        {!editing && (
          <button
            onClick={openEdit}
            className="px-3.5 py-1.5 bg-accent text-white border-none rounded-md cursor-pointer text-[13px] font-semibold"
          >
            수정
          </button>
        )}
      </div>

      {/* 편집 모드 */}
      {editing ? (
        <div className="bg-[#f8f9fa] border border-[#e0e0e0] rounded-lg p-5">
          <div className="text-[12px] text-muted-brand font-semibold mb-4 uppercase">편집 항목</div>
          {[
            { label: '이름 *', value: editName, set: setEditName, type: 'text', placeholder: '홍길동' },
            { label: '휴대폰 *', value: editPhone, set: setEditPhone, type: 'text', placeholder: '01012345678' },
            { label: '직종 *', value: editJobTitle, set: setEditJobTitle, type: 'text', placeholder: '형틀목공' },
          ].map(({ label, value, set, type, placeholder }) => (
            <div key={label} className="flex items-center mb-3 gap-3">
              <label className="w-[90px] flex-shrink-0 text-[13px] font-semibold text-muted-brand">{label}</label>
              <input
                type={type}
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px] bg-white"
              />
            </div>
          ))}
          <div className="flex items-center mb-3 gap-3">
            <label className="w-[90px] flex-shrink-0 text-[13px] font-semibold text-muted-brand">활성 상태</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editIsActive}
                onChange={e => setEditIsActive(e.target.checked)}
              />
              <span className={`text-[13px] font-semibold ${editIsActive ? 'text-[#2e7d32]' : 'text-[#999]'}`}>
                {editIsActive ? '활성' : '비활성'}
              </span>
            </label>
          </div>
          {saveError && <p className="text-[#c62828] text-[13px] mb-3">{saveError}</p>}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving || !editName || !editPhone || !editJobTitle}
              className="px-5 py-2 bg-accent text-white border-none rounded-md cursor-pointer text-[13px] font-semibold disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-5 py-2 bg-white border border-secondary-brand/30 rounded-md cursor-pointer text-[13px]"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        /* 읽기 모드 */
        <>
        {/* 투입 가능 상태 카드 */}
        <div className={`mb-5 p-4 rounded-lg border ${
          worker.assignmentEligibility === 'READY' ? 'bg-[#F0FDF4] border-[#BBF7D0]' :
          worker.assignmentEligibility === 'NEEDS_DOCS' ? 'bg-[#FFFBEB] border-[#FDE68A]' :
          'bg-[#FEF2F2] border-[#FECACA]'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: eligStyle.color }} />
            <span className="text-[13px] font-bold" style={{ color: eligStyle.color }}>{eligStyle.label}</span>
            {worker.nextAction && worker.assignmentEligibility !== 'READY' && (
              <span className="text-[11px] text-gray-500 ml-1">— {worker.nextAction}</span>
            )}
          </div>
          {worker.expiredDocs && worker.expiredDocs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[12px] text-[#DC2626] mr-1 pt-0.5">만료 서류:</span>
              {worker.expiredDocs.map(doc => (
                <button
                  key={doc.key}
                  onClick={() => onNavigateDoc?.(doc)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer bg-white border-[#EF4444] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                >
                  {doc.label}{doc.expiresAt ? ` (${doc.expiresAt.slice(0, 10)} 만료)` : ' (만료)'}
                  <span className="text-[10px]">&rarr;</span>
                </button>
              ))}
            </div>
          )}
          {worker.expiringDocs && worker.expiringDocs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[12px] text-[#D97706] mr-1 pt-0.5">만료 예정:</span>
              {worker.expiringDocs.map(doc => {
                const daysLeft = doc.expiresAt ? Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0
                return (
                  <button
                    key={doc.key}
                    onClick={() => onNavigateDoc?.(doc)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer bg-white border-[#F59E0B] text-[#D97706] hover:bg-[#FEF3C7] transition-colors"
                  >
                    {doc.label} ({doc.expiresAt?.slice(0, 10)}, {daysLeft}일 남음)
                    <span className="text-[10px]">&rarr;</span>
                  </button>
                )
              })}
            </div>
          )}
          {worker.rejectedDocs && worker.rejectedDocs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[12px] text-[#DC2626] mr-1 pt-0.5">보완 필요:</span>
              {worker.rejectedDocs.map(doc => (
                <button
                  key={doc.key}
                  onClick={() => onNavigateDoc?.(doc)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer bg-white border-[#EF4444] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                >
                  {doc.label} (반려)
                  <span className="text-[10px]">&rarr;</span>
                </button>
              ))}
            </div>
          )}
          {worker.missingDocs && worker.missingDocs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[12px] text-[#92400E] mr-1 pt-0.5">부족 서류:</span>
              {worker.missingDocs.map(doc => {
                const STATUS_HINT: Record<string, string> = {
                  NOT_SUBMITTED: '', SUBMITTED: '작성됨', REVIEW_REQUESTED: '검토중',
                }
                const hint = STATUS_HINT[doc.status ?? ''] ?? ''
                return (
                  <button
                    key={doc.key}
                    onClick={() => onNavigateDoc?.(doc)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer bg-white border-[#F59E0B] text-[#92400E] hover:bg-[#FEF3C7] transition-colors"
                  >
                    {doc.label}{hint ? ` (${hint})` : ''}
                    <span className="text-[10px]">&rarr;</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="py-2 pr-4 font-semibold text-[13px] text-muted-brand w-[140px]">이름</td>
              <td className="py-2 text-[13px] text-[#CBD5E0]">{worker.name}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-semibold text-[13px] text-muted-brand w-[140px]">휴대폰</td>
              <td className="py-2 text-[13px] text-[#CBD5E0]">{fmtPhone(worker.phone)}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-semibold text-[13px] text-muted-brand w-[140px]">직종</td>
              <td className="py-2 text-[13px] text-[#CBD5E0]">{worker.jobTitle}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-semibold text-[13px] text-muted-brand w-[140px]">활성 상태</td>
              <td className="py-2 text-[13px]">
                <span className={`font-semibold ${worker.isActive ? 'text-[#2e7d32]' : 'text-[#999]'}`}>
                  {worker.isActive ? '활성' : '비활성'}
                </span>
              </td>
            </tr>
            {readonlyRows.map(([label, value]) => (
              <tr key={String(label)}>
                <td className="py-2 pr-4 font-semibold text-[13px] text-muted-brand w-[140px] align-top">{label}</td>
                <td className="py-2 text-[13px] text-[#CBD5E0]">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </>
      )}
    </div>
  )
}

// ─── 회사 배정 탭 ────────────────────────────────────────────────────────────

function CompanyTab({ assignments, onAdd }: { assignments: CompanyAssignment[]; onAdd: () => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="mt-0 mb-0 text-sm font-bold text-[#CBD5E0]">회사 배정 이력</h3>
        <button onClick={onAdd} className="px-3.5 py-1.5 bg-accent text-white border-none rounded-md cursor-pointer text-[13px] font-semibold">+ 회사 배정</button>
      </div>
      {assignments.length === 0 ? (
        <p className="text-[#718096] py-6 text-center text-[13px]">배정된 회사가 없습니다.</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['회사명', '유형', '고용형태', '시작일', '종료일', '주소속', '메모'].map(h => (
                <th key={h} className="px-3 py-2.5 bg-[#f8f8f8] text-left font-semibold border-b border-[#e0e0e0] text-muted-brand">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id}>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{a.company.companyName}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]"><span className="bg-accent/12 text-accent px-2 py-0.5 rounded text-[11px]">{a.company.companyType ?? '—'}</span></td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{a.employmentType}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{fmtDate(a.validFrom)}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{fmtDate(a.validTo)}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{a.isPrimary ? <span className="bg-[#e8f5e9] text-[#2e7d32] px-2 py-0.5 rounded text-[11px] font-semibold">주소속</span> : '—'}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{a.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── 현장 배정 탭 ────────────────────────────────────────────────────────────

function SiteTab({ assignments, onAdd }: { assignments: SiteAssignment[]; onAdd: () => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="mt-0 mb-0 text-sm font-bold text-[#CBD5E0]">현장 배정 이력</h3>
        <button onClick={onAdd} className="px-3.5 py-1.5 bg-accent text-white border-none rounded-md cursor-pointer text-[13px] font-semibold">+ 현장 배정</button>
      </div>
      {assignments.length === 0 ? (
        <p className="text-[#718096] py-6 text-center text-[13px]">배정된 현장이 없습니다.</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['현장명', '소속회사', '직종/공종', '배정일', '종료일', '상태', '주현장'].map(h => (
                <th key={h} className="px-3 py-2.5 bg-[#f8f8f8] text-left font-semibold border-b border-[#e0e0e0] text-muted-brand">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id} style={{ opacity: a.isActive ? 1 : 0.6 }}>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{a.site.name}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{a.company.companyName}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{a.tradeType ?? '—'}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{fmtDate(a.assignedFrom)}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{fmtDate(a.assignedTo)}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">
                  <span className={`text-xs font-semibold ${a.isActive ? 'text-[#2e7d32]' : 'text-[#999]'}`}>
                    {a.isActive ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">{a.isPrimary ? <span className="bg-[#e8f5e9] text-[#2e7d32] px-2 py-0.5 rounded text-[11px] font-semibold">주현장</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── 보험 상태 탭 ────────────────────────────────────────────────────────────

function InsuranceTab({ statuses, onAdd }: { statuses: InsuranceStatus[]; onAdd: () => void }) {
  const ins4 = (st: InsuranceStatus) => [
    ['국민연금', st.nationalPensionStatus],
    ['건강보험', st.healthInsuranceStatus],
    ['고용보험', st.employmentInsuranceStatus],
    ['산재보험', st.industrialAccidentStatus],
  ] as [string, string][]

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="mt-0 mb-0 text-sm font-bold text-[#CBD5E0]">4대보험 상태</h3>
        <button onClick={onAdd} className="px-3.5 py-1.5 bg-accent text-white border-none rounded-md cursor-pointer text-[13px] font-semibold">+ 보험 등록/수정</button>
      </div>
      {statuses.length === 0 ? (
        <p className="text-[#718096] py-6 text-center text-[13px]">등록된 보험 정보가 없습니다.</p>
      ) : statuses.map(st => (
        <div key={st.id} className="border border-white/12 rounded-lg p-4 mb-3">
          <div className="flex justify-between items-center mb-3">
            <strong>{st.company.companyName}</strong>
            <span className="text-xs text-muted-brand">최종 수정: {fmtDate(st.updatedAt)}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-2.5">
            {ins4(st).map(([label, val]) => (
              <div key={label} className="bg-[#f9f9f9] rounded-md p-2.5 text-center">
                <div className="text-[11px] text-muted-brand mb-1">{label}</div>
                <div className={`text-[13px] font-bold ${val === 'ENROLLED' ? 'text-[#2e7d32]' : val === 'LOSS' ? 'text-[#c62828]' : val === 'EXEMPT' ? 'text-[#f57c00]' : 'text-[#999]'}`}>
                  {INSURANCE_STATUS_LABELS[val] ?? val}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-muted-brand flex-wrap">
            <span>취득일: {fmtDate(st.acquisitionDate)}</span>
            <span>상실일: {fmtDate(st.lossDate)}</span>
            <span>신고: {st.reportingStatus}</span>
            {st.notes && <span>메모: {st.notes}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 공통 서브컴포넌트 ────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
      <div className="bg-white rounded-xl p-7 w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="m-0 text-base">{title}</h3>
          <button onClick={onClose} className="bg-transparent border-none text-lg cursor-pointer text-muted-brand">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center mb-3.5 gap-3">
      {label && <label className="w-[90px] flex-shrink-0 text-[13px] font-semibold text-muted-brand">{label}</label>}
      {children}
    </div>
  )
}


// ─── 문서 탭 ─────────────────────────────────────────────────────────────────

interface WorkerDoc {
  id: string
  documentType: string
  status: string
  expiresAt: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  notes: string | null
  createdAt: string
  file: {
    id: string
    originalFilename: string
    mimeType: string
    sizeBytes: number
    uploadedAt: string
  }
}

const DOC_TYPE_LABEL: Record<string, string> = {
  ID_CARD: '신분증', INSURANCE_DOC: '4대보험증빙', CONTRACT: '근로계약서',
  SAFETY_CERT: '안전교육이수증', OTHER: '기타',
}
const DOC_STATUS_LABEL: Record<string, string> = {
  UPLOADED: '업로드완료', REVIEW_PENDING: '검토대기', APPROVED: '승인',
  NEEDS_SUPPLEMENT: '보완필요', EXPIRED: '만료',
}
const DOC_STATUS_COLOR: Record<string, string> = {
  UPLOADED: '#555', REVIEW_PENDING: '#e65100', APPROVED: '#2e7d32',
  NEEDS_SUPPLEMENT: '#b71c1c', EXPIRED: '#888',
}
const DOC_STATUS_BG: Record<string, string> = {
  UPLOADED: '#f5f5f5', REVIEW_PENDING: '#fff3e0', APPROVED: '#e8f5e9',
  NEEDS_SUPPLEMENT: '#ffebee', EXPIRED: '#f5f5f5',
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`
  return `${(b / 1024 / 1024).toFixed(1)}MB`
}

function DocsTab({ workerId }: { workerId: string }) {
  const [docs, setDocs]           = useState<WorkerDoc[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [filterType, setFilterType] = useState('')

  // 업로드 폼 상태
  const [docType, setDocType]     = useState('OTHER')
  const [notes, setNotes]         = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    const q = filterType ? `?documentType=${filterType}` : ''
    fetch(`/api/admin/workers/${workerId}/documents${q}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setDocs(data.data.items)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(load, [workerId, filterType]) // eslint-disable-line

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) { setUploadMsg('파일을 선택하세요.'); return }
    setUploading(true)
    setUploadMsg('')
    const form = new FormData()
    form.append('file', file)
    form.append('documentType', docType)
    if (notes) form.append('notes', notes)
    if (expiresAt) form.append('expiresAt', expiresAt)
    const res = await fetch(`/api/admin/workers/${workerId}/documents`, { method: 'POST', body: form })
    const data = await res.json()
    setUploading(false)
    if (data.success) {
      setUploadMsg('업로드 완료')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setNotes(''); setExpiresAt('')
      load()
    } else {
      setUploadMsg(data.error ?? data.message ?? '업로드 실패')
    }
  }

  const changeStatus = async (docId: string, status: string) => {
    const res = await fetch(`/api/admin/workers/${workerId}/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) load()
    else alert('상태 변경 실패')
  }

  return (
    <div>
      {/* 업로드 폼 */}
      <div className="bg-brand rounded-lg p-4 mb-5">
        <div className="font-bold text-[13px] mb-3 text-[#CBD5E0]">문서 업로드</div>
        <div className="flex gap-2.5 flex-wrap items-end">
          <div>
            <div className="text-[11px] text-muted-brand mb-1">문서 유형</div>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="flex-1 px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px]">
              {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-muted-brand mb-1">파일</div>
            <input ref={fileInputRef} type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx"
              className="text-[13px]"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted-brand mb-1">만료일 (선택)</div>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px] w-[140px]" />
          </div>
          <div>
            <div className="text-[11px] text-muted-brand mb-1">비고 (선택)</div>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="비고" className="px-3 py-2 border border-secondary-brand/30 rounded-md text-[13px] w-[160px]" />
          </div>
          <button onClick={handleUpload} disabled={uploading} className="px-3.5 py-1.5 bg-accent text-white border-none rounded-md cursor-pointer text-[13px] font-semibold" style={{ opacity: uploading ? 0.6 : 1 }}>
            {uploading ? '업로드 중...' : '업로드'}
          </button>
        </div>
        {uploadMsg && (
          <div className={`mt-2 text-[13px] font-semibold ${uploadMsg.includes('완료') ? 'text-[#2e7d32]' : 'text-[#b71c1c]'}`}>
            {uploadMsg}
          </div>
        )}
        <div className="mt-2 text-[11px] text-[#aaa]">
          지원 형식: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX · 최대 20MB · 신분증은 SUPER_ADMIN/ADMIN만 열람 가능
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-3.5 flex-wrap">
        <button onClick={() => setFilterType('')} className={`px-3 py-1 rounded-2xl border-none cursor-pointer text-xs font-semibold ${filterType === '' ? 'bg-[#1976d2] text-white' : 'bg-[#f0f0f0] text-[#666]'}`}>전체</button>
        {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => (
          <button key={v} onClick={() => setFilterType(v)} className={`px-3 py-1 rounded-2xl border-none cursor-pointer text-xs font-semibold ${filterType === v ? 'bg-[#1976d2] text-white' : 'bg-[#f0f0f0] text-[#666]'}`}>{l}</button>
        ))}
      </div>

      {/* 문서 목록 */}
      {loading ? <p className="text-[#718096] py-6 text-center text-[13px]">로딩 중...</p> : docs.length === 0 ? (
        <p className="text-[#718096] py-6 text-center text-[13px]">문서가 없습니다.</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['유형', '파일명', '크기', '업로드일', '만료일', '상태', '검토자/일', '비고', '열람', '다운로드', '상태변경'].map((h) => (
                <th key={h} className="px-3 py-2.5 bg-[#f8f8f8] text-left font-semibold border-b border-[#e0e0e0] text-muted-brand">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">
                  <span className="text-[11px] font-bold bg-accent/12 text-accent px-2 py-0.5 rounded-lg">
                    {DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] max-w-[180px] text-xs text-[#CBD5E0] break-all">
                  {/* 파일명만 노출 — 민감문서는 내용 미노출 */}
                  {doc.file.originalFilename}
                </td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[11px] text-muted-brand">{fmtBytes(doc.file.sizeBytes)}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[11px] text-muted-brand whitespace-nowrap">
                  {new Date(doc.file.uploadedAt).toLocaleDateString('ko-KR')}
                </td>
                <td className={`px-3 py-2.5 border-b border-[#f0f0f0] text-[11px] ${doc.expiresAt && new Date(doc.expiresAt) < new Date() ? 'text-[#b71c1c]' : 'text-[#555]'}`}>
                  {doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString('ko-KR') : '—'}
                </td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-[10px]"
                    style={{ color: DOC_STATUS_COLOR[doc.status], background: DOC_STATUS_BG[doc.status] }}>
                    {DOC_STATUS_LABEL[doc.status] ?? doc.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[11px] text-muted-brand whitespace-nowrap">
                  {doc.reviewedBy ? `${doc.reviewedBy.slice(-6)} / ${doc.reviewedAt ? new Date(doc.reviewedAt).toLocaleDateString('ko-KR') : '—'}` : '—'}
                </td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[11px] text-muted-brand max-w-[120px]">{doc.notes ?? '—'}</td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">
                  <a
                    href={`/api/admin/workers/${workerId}/documents/${doc.id}/download?inline=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-secondary-brand underline"
                  >
                    열람
                  </a>
                </td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">
                  <a
                    href={`/api/admin/workers/${workerId}/documents/${doc.id}/download`}
                    className="text-xs text-muted-brand underline"
                  >
                    다운로드
                  </a>
                </td>
                <td className="px-3 py-2.5 border-b border-[#f0f0f0] text-[#CBD5E0]">
                  <select
                    value={doc.status}
                    onChange={(e) => changeStatus(doc.id, e.target.value)}
                    className="text-xs px-1.5 py-1 border border-secondary-brand/30 rounded"
                  >
                    {Object.entries(DOC_STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── 분류정보 탭 (v3) ─────────────────────────────────────────────────────────

const WORKER_CLASS_LABEL: Record<string, string> = { EMPLOYEE: '근로자', CONTRACTOR: '외주/용역' }
const EMPLOYMENT_MODE_LABEL: Record<string, string> = { DAILY: '일용직', REGULAR: '상용직', TEMP: '단기계약', OFFICE_SUPPORT: '사무보조' }
const TAX_MODE_LABEL: Record<string, string> = { DAILY_WAGE: '일용근로소득(6%)', WAGE: '일반 근로소득', BIZ_3P3: '사업소득 3.3%', OTHER_8P8: '기타소득 8.8%' }
const INSURANCE_MODE_LABEL: Record<string, string> = {
  AUTO_RULE: '자동 판정', EMPLOYEE_4INSURANCE: '4대보험 전체',
  EMPLOYMENT_ONLY: '고용보험만', EXCLUDED: '적용 제외', MANUAL_OVERRIDE: '수동 지정',
}

function ProfileTab({ workerId }: { workerId: string }) {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState<Record<string, unknown>>({})
  const [msg,     setMsg]     = useState('')

  useEffect(() => {
    fetch(`/api/admin/workers/${workerId}/profile`)
      .then(r => r.json())
      .then(d => { setProfile(d.data); setLoading(false) })
  }, [workerId])

  function startEdit() {
    if (profile) {
      setForm({ ...profile })
    } else {
      setForm({
        workerClass: 'EMPLOYEE', employmentMode: 'DAILY', taxMode: 'DAILY_WAGE',
        insuranceMode: 'AUTO_RULE', officeWorkerYn: false,
        continuousWorkReview: 'OK', classificationNote: '',
      })
    }
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true); setMsg('')
    const method = profile ? 'PATCH' : 'POST'
    const res  = await fetch(`/api/admin/workers/${workerId}/profile`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSaving(false)
    if (json.success) { setProfile(json.data); setEditing(false); setMsg('저장됨') }
    else setMsg(json.error || '저장 실패')
  }

  const f = (key: string) => (form[key] as string) || ''
  const fb = (key: string) => !!(form[key])

  if (loading) return <div className="py-8 text-[#718096] text-center">로딩 중...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h3 className="m-0 text-[15px] font-bold">근로형태 분류정보</h3>
        {!editing && (
          <button onClick={startEdit} className="px-3.5 py-1.5 bg-accent text-white border-none rounded-md cursor-pointer text-[13px]">
            {profile ? '수정' : '분류 등록'}
          </button>
        )}
      </div>

      {msg && <div className="px-3 py-2 bg-[#e8f5e9] rounded-md text-[13px] text-[#2e7d32] mb-3">{msg}</div>}

      {!editing && !profile && (
        <div className="py-8 text-center text-[#718096] text-sm">
          분류정보가 없습니다. "분류 등록" 버튼으로 등록하세요.
        </div>
      )}

      {!editing && profile && (
        <div className="grid grid-cols-2 gap-4">
          {[
            ['근로자 구분',  WORKER_CLASS_LABEL[profile.workerClass as string]    || (profile.workerClass as string)],
            ['근무형태',    EMPLOYMENT_MODE_LABEL[profile.employmentMode as string] || (profile.employmentMode as string)],
            ['세무형태',    TAX_MODE_LABEL[profile.taxMode as string]            || (profile.taxMode as string)],
            ['보험형태',    INSURANCE_MODE_LABEL[profile.insuranceMode as string] || (profile.insuranceMode as string)],
            ['사무실 근무', (profile.officeWorkerYn ? '예' : '아니요')],
            ['계속근로 검토', profile.continuousWorkReview === 'REVIEW_REQUIRED'
              ? '⚠️ 검토 필요' : '이상 없음'],
          ].map(([label, value]) => (
            <div key={label as string} className="p-3 bg-[#f9f9f9] rounded-lg">
              <div className="text-[11px] text-muted-brand mb-1">{label}</div>
              <div className={`text-sm font-semibold ${profile.continuousWorkReview === 'REVIEW_REQUIRED' && label === '계속근로 검토' ? 'text-[#e65100]' : 'text-[#333]'}`}>
                {value as string}
              </div>
            </div>
          ))}
          {!!profile.classificationNote && (
            <div className="col-span-2 p-3 bg-[#fff3e0] rounded-lg">
              <div className="text-[11px] text-muted-brand mb-1">관리자 메모</div>
              <div className="text-[13px]">{String(profile.classificationNote)}</div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: '근로자 구분', key: 'workerClass', options: [['EMPLOYEE','근로자'],['CONTRACTOR','외주/용역']] },
            { label: '근무형태', key: 'employmentMode', options: [['DAILY','일용직'],['REGULAR','상용직'],['TEMP','단기계약'],['OFFICE_SUPPORT','사무보조']] },
            { label: '세무형태', key: 'taxMode', options: [['DAILY_WAGE','일용근로소득'],['WAGE','일반 근로소득'],['BIZ_3P3','사업소득 3.3%'],['OTHER_8P8','기타소득 8.8%']] },
            { label: '보험형태', key: 'insuranceMode', options: [['AUTO_RULE','자동 판정'],['EMPLOYEE_4INSURANCE','4대보험 전체'],['EMPLOYMENT_ONLY','고용보험만'],['EXCLUDED','적용 제외'],['MANUAL_OVERRIDE','수동 지정']] },
            { label: '계속근로 검토', key: 'continuousWorkReview', options: [['OK','이상 없음'],['REVIEW_REQUIRED','검토 필요']] },
          ].map(({ label, key, options }) => (
            <div key={key}>
              <label className="block text-xs text-muted-brand mb-1 font-semibold">{label}</label>
              <select value={f(key)} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-full px-2.5 py-2 border border-secondary-brand/20 rounded-md text-[13px]">
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-center gap-2 p-2">
            <input type="checkbox" checked={fb('officeWorkerYn')}
              onChange={e => setForm(p => ({ ...p, officeWorkerYn: e.target.checked }))}
              className="w-4 h-4" />
            <label className="text-[13px] cursor-pointer">사무실 근무자</label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-brand mb-1 font-semibold">관리자 메모</label>
            <input value={f('classificationNote')}
              onChange={e => setForm(p => ({ ...p, classificationNote: e.target.value }))}
              placeholder="판단 근거 등 메모"
              className="w-full px-2.5 py-2 border border-secondary-brand/20 rounded-md text-[13px]" />
          </div>
          <div className="col-span-2 flex gap-2 justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-[#2e7d32] text-white border-none rounded-md cursor-pointer text-[13px]">
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 py-2 bg-brand border border-secondary-brand/20 rounded-md cursor-pointer text-[13px]">
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 계약서 탭 ────────────────────────────────────────────────────────────────

interface WorkerContractRow {
  id: string
  contractType: string
  contractStatus: string
  contractTemplateType?: string
  startDate: string
  endDate?: string
  dailyWage?: number
  monthlySalary?: number
  signedAt?: string
  deliveredAt?: string
  currentVersion?: number
  site?: { name: string }
}

function ContractsTab({ workerId, onDocChange }: { workerId: string; onDocChange?: () => void }) {
  const [contracts, setContracts] = useState<WorkerContractRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/contracts?workerId=${workerId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setContracts(d.data) })
      .finally(() => setLoading(false))
  }, [workerId])

  const CONTRACT_STATUS_LABEL: Record<string, string> = {
    DRAFT: '작성됨 (승인대기)', SIGNED: '서명완료 (검토대기)', ACTIVE: '승인 (이행중)', ENDED: '종료', CANCELLED: '취소',
  }
  const CONTRACT_TYPE_LABEL: Record<string, string> = {
    DAILY: '일용직', REGULAR: '상용직', FIXED_TERM: '기간제', SUBCONTRACT: '외주',
  }

  if (loading) return <p className="text-[#718096] px-4 py-4">불러오는 중...</p>

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="m-0 text-[15px] font-bold">근로계약서</h3>
        <a href={`/admin/contracts/new?workerId=${workerId}`}
          className="px-3.5 py-1.5 bg-[#2563eb] text-white rounded-md text-[13px] no-underline">
          + 신규 계약
        </a>
      </div>
      {contracts.length === 0 ? (
        <p className="text-[#aaa] text-[14px] text-center py-8">계약 이력이 없습니다.</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-brand border-b border-[#e5e7eb]">
              <th className="px-3 py-2 text-left">유형</th>
              <th className="px-3 py-2 text-left">현장</th>
              <th className="px-3 py-2 text-left">기간</th>
              <th className="px-3 py-2 text-right">일당/월급</th>
              <th className="px-3 py-2 text-center">상태</th>
              <th className="px-3 py-2 text-center">서명</th>
              <th className="px-3 py-2 text-center">교부</th>
              <th className="px-3 py-2 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {contracts.map(c => (
              <tr key={c.id} className="border-b border-[#f0f0f0]">
                <td className="px-3 py-2">
                  {CONTRACT_TYPE_LABEL[c.contractType] || c.contractType}
                  {c.currentVersion && c.currentVersion > 1 && (
                    <span className="ml-1 text-[11px] text-muted-brand">v{c.currentVersion}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-brand">{c.site?.name || '—'}</td>
                <td className="px-3 py-2 text-muted-brand">
                  {c.startDate} ~ {c.endDate || '무기한'}
                </td>
                <td className="px-3 py-2 text-right">
                  {c.dailyWage ? c.dailyWage.toLocaleString() + '원' : c.monthlySalary ? c.monthlySalary.toLocaleString() + '원' : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-xl text-[11px] font-semibold ${
                    c.contractStatus === 'ACTIVE' ? 'bg-[#dcfce7] text-[#166534]'
                    : c.contractStatus === 'DRAFT' ? 'bg-[#fef9c3] text-[#854d0e]'
                    : 'bg-[#f3f4f6] text-[#6b7280]'
                  }`}>
                    {CONTRACT_STATUS_LABEL[c.contractStatus] || c.contractStatus}
                  </span>
                </td>
                <td className={`px-3 py-2 text-center ${c.signedAt ? 'text-[#16a34a]' : 'text-[#d1d5db]'}`}>
                  {c.signedAt ? '✓' : '—'}
                </td>
                <td className={`px-3 py-2 text-center ${c.deliveredAt ? 'text-[#16a34a]' : 'text-[#d1d5db]'}`}>
                  {c.deliveredAt ? '✓' : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <a href={`/admin/contracts/${c.id}`} className="text-[#2563eb] text-[12px] no-underline">상세</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── 안전문서 탭 ──────────────────────────────────────────────────────────────

interface SafetyDocRow {
  id: string
  documentType: string
  status: string
  documentDate?: string
  educationDate?: string
  signedAt?: string
  site?: { name: string }
}

const SAFETY_DOC_LABELS: Record<string, string> = {
  SAFETY_EDUCATION_NEW_HIRE:    '신규채용 안전보건교육',
  SAFETY_EDUCATION_TASK_CHANGE: '작업변경 교육',
  PPE_PROVISION:                '보호구 지급',
  SAFETY_PLEDGE:                '안전수칙 서약',
  WORK_CONDITIONS_RECEIPT:      '근로조건설명·계약서수령',
  PRIVACY_CONSENT:              '개인정보수집·이용동의',
  BASIC_SAFETY_EDU_CONFIRM:     '기초안전보건교육 확인서',
  SITE_SAFETY_RULES_CONFIRM:    '현장 안전수칙 준수 확인서',
  HEALTH_DECLARATION:           '건강 이상 없음 각서',
  HEALTH_CERTIFICATE:           '건강 증명서',
}

const PPE_ITEM_DEFAULTS = [
  { name: '안전모',       qty: 1, condition: '신품', issued: true,  explanationGiven: true,  needsReplacement: false, note: '' },
  { name: '안전화',       qty: 1, condition: '신품', issued: true,  explanationGiven: true,  needsReplacement: false, note: '' },
  { name: '안전대',       qty: 1, condition: '신품', issued: false, explanationGiven: false, needsReplacement: false, note: '' },
  { name: '방진마스크',   qty: 1, condition: '신품', issued: true,  explanationGiven: true,  needsReplacement: false, note: '' },
  { name: '귀마개',       qty: 1, condition: '신품', issued: false, explanationGiven: false, needsReplacement: false, note: '' },
  { name: '보안경',       qty: 1, condition: '신품', issued: false, explanationGiven: false, needsReplacement: false, note: '' },
  { name: '용접 차광면',  qty: 1, condition: '신품', issued: false, explanationGiven: false, needsReplacement: false, note: '' },
  { name: '안전장갑',     qty: 1, condition: '신품', issued: true,  explanationGiven: true,  needsReplacement: false, note: '' },
  { name: '방수·방한복',  qty: 1, condition: '신품', issued: false, explanationGiven: false, needsReplacement: false, note: '' },
  { name: '형광조끼',     qty: 1, condition: '신품', issued: true,  explanationGiven: true,  needsReplacement: false, note: '' },
  { name: '구명조끼',     qty: 1, condition: '신품', issued: false, explanationGiven: false, needsReplacement: false, note: '' },
]

type PpeItem = typeof PPE_ITEM_DEFAULTS[number]

function SafetyDocsTab({ workerId, initialDocType, onInitialDocTypeConsumed, onDocChange, onNavigateDoc }: {
  workerId: string
  initialDocType?: string | null
  onInitialDocTypeConsumed?: () => void
  onDocChange?: () => void
  onNavigateDoc?: (doc: { key: string; label: string; actionType: string; docType?: string }) => void
}) {
  const [docs, setDocs] = useState<SafetyDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    documentType: 'SAFETY_EDUCATION_NEW_HIRE',
    educationDate: new Date().toISOString().slice(0, 10),
    educationHours: 1,
    educationPlace: '',
    educatorName: '',
    siteId: '',
    contractId: '',
    // v3.6 공통
    workDate: new Date().toISOString().slice(0, 10),
    tradeType: '',
    jobType: '',
    workPlace: '',
    managerName: '',
    // v3.6 기초안전보건교육
    eduCompletedYn: true,
    eduCompletedDate: '',
    eduOrganization: '',
    eduCertConfirmedYn: false,
    eduCertConfirmedDate: '',
    confirmerName: '',
    // v3.6 현장 안전수칙
    specialSafetyRules: '',
  })
  const [ppeItems, setPpeItems] = useState<PpeItem[]>(PPE_ITEM_DEFAULTS.map(i => ({ ...i })))
  const [submitting, setSubmitting] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<SafetyDocRow & { contentText?: string; rejectReason?: string; history?: { id: string; status: string; rejectReason: string | null; createdAt: string; reviewedAt: string | null }[] } | null>(null)

  const load = () => {
    fetch(`/api/admin/workers/${workerId}/safety-documents`)
      .then(r => r.json())
      .then(d => { if (d.success) setDocs(d.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [workerId])

  // 부족 서류 클릭으로 탭 전환 시 자동 폼 오픈
  useEffect(() => {
    if (initialDocType) {
      setForm(f => ({ ...f, documentType: initialDocType }))
      setShowForm(true)
      onInitialDocTypeConsumed?.()
    }
  }, [initialDocType]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const payload = form.documentType === 'PPE_PROVISION'
        ? { ...form, ppeItems }
        : form
      const res = await fetch(`/api/admin/workers/${workerId}/safety-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setShowForm(false)
      load()
      onDocChange?.()
    } catch (e) {
      alert('오류: ' + (e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReview = async (docId: string, action: 'APPROVE' | 'REJECT', rejectReason?: string) => {
    const res = await fetch(`/api/admin/safety-documents/${docId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rejectReason }),
    })
    const data = await res.json()
    if (data.success) { load(); onDocChange?.() }
    else alert(data.message || data.error || '처리 실패')
  }

  const handleSign = async (docId: string, signerName: string) => {
    const res = await fetch(`/api/admin/safety-documents/${docId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedBy: signerName }),
    })
    const data = await res.json()
    if (data.success) { load(); onDocChange?.() }
    else alert(data.error)
  }

  const handlePreview = async (docId: string) => {
    const res = await fetch(`/api/admin/safety-documents/${docId}`)
    const data = await res.json()
    if (data.success) setPreviewDoc(data.data)
  }

  if (loading) return <p className="text-[#718096] px-4 py-4">불러오는 중...</p>

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="m-0 text-[15px] font-bold">안전문서</h3>
        <button onClick={() => setShowForm(true)}
          className="px-3.5 py-1.5 bg-[#16a34a] text-white border-none rounded-md text-[13px] cursor-pointer">
          + 안전문서 생성
        </button>
      </div>

      {/* 문서 목록 */}
      {docs.length === 0 ? (
        <p className="text-[#aaa] text-[14px] text-center py-8">안전문서 이력이 없습니다.</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-brand border-b border-[#e5e7eb]">
              <th className="px-3 py-2 text-left">문서 종류</th>
              <th className="px-3 py-2 text-left">현장</th>
              <th className="px-3 py-2 text-left">문서일</th>
              <th className="px-3 py-2 text-center">상태</th>
              <th className="px-3 py-2 text-center">서명일</th>
              <th className="px-3 py-2 text-center">동작</th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id} className="border-b border-[#f0f0f0]">
                <td className="px-3 py-2">{SAFETY_DOC_LABELS[d.documentType] || d.documentType}</td>
                <td className="px-3 py-2 text-muted-brand">{d.site?.name || '—'}</td>
                <td className="px-3 py-2 text-muted-brand">{d.educationDate || d.documentDate || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-xl text-[11px] font-semibold ${
                    d.status === 'APPROVED' ? 'bg-[#dcfce7] text-[#166534]'
                    : d.status === 'REJECTED' ? 'bg-[#fee2e2] text-[#991b1b]'
                    : d.status === 'REVIEW_REQUESTED' || d.status === 'SIGNED' ? 'bg-[#dbeafe] text-[#1e40af]'
                    : d.status === 'ISSUED' ? 'bg-[#f3f4f6] text-[#6b7280]'
                    : 'bg-[#fef9c3] text-[#854d0e]'
                  }`}>
                    {d.status === 'APPROVED' ? '승인' : d.status === 'REJECTED' ? '반려' : d.status === 'REVIEW_REQUESTED' || d.status === 'SIGNED' ? '검토대기' : d.status === 'ISSUED' ? '발행' : '초안'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-[12px] text-muted-brand">
                  {d.signedAt ? new Date(d.signedAt).toLocaleDateString('ko-KR') : '—'}
                </td>
                <td className="px-3 py-2 text-center flex flex-wrap gap-1 justify-center">
                  <button onClick={() => handlePreview(d.id)}
                    className="px-2 py-0.5 text-[11px] border border-secondary-brand/30 rounded cursor-pointer bg-white">
                    미리보기
                  </button>
                  {(d.status === 'DRAFT' || d.status === 'ISSUED') && (
                    <button onClick={() => {
                      if (confirm(`"${SAFETY_DOC_LABELS[d.documentType] || d.documentType}" 문서에 서명 처리하시겠습니까?`)) {
                        handleSign(d.id, '')
                      }
                    }}
                      className="px-2 py-0.5 text-[11px] border-none rounded cursor-pointer bg-[#2563eb] text-white">
                      서명처리
                    </button>
                  )}
                  {(d.status === 'REVIEW_REQUESTED' || d.status === 'SIGNED') && (
                    <>
                      <button onClick={() => handleReview(d.id, 'APPROVE')}
                        className="px-2 py-0.5 text-[11px] border-none rounded cursor-pointer bg-[#16a34a] text-white">
                        승인
                      </button>
                      <button onClick={() => {
                        const reason = prompt('반려 사유:')
                        if (reason) handleReview(d.id, 'REJECT', reason)
                      }}
                        className="px-2 py-0.5 text-[11px] border-none rounded cursor-pointer bg-[#dc2626] text-white">
                        반려
                      </button>
                    </>
                  )}
                  {d.status === 'REJECTED' && (
                    <button onClick={() => onNavigateDoc?.({ key: '', label: '', actionType: 'SAFETY_DOC', docType: d.documentType })}
                      className="px-2 py-0.5 text-[11px] border-none rounded cursor-pointer bg-[#d97706] text-white">
                      재작성
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 생성 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-xl p-7 w-[480px] max-h-[80vh] overflow-y-auto">
            <h3 className="mt-0 mb-5 text-[16px]">안전문서 생성</h3>

            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold mb-1">문서 종류 *</label>
              <select value={form.documentType} onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))}
                className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]">
                <option value="SAFETY_EDUCATION_NEW_HIRE">신규채용 안전보건교육 확인서</option>
                <option value="SAFETY_EDUCATION_TASK_CHANGE">작업변경 교육 확인서</option>
                <option value="PPE_PROVISION">보호구 지급 확인서</option>
                <option value="SAFETY_PLEDGE">안전수칙 준수 서약서</option>
                <option value="WORK_CONDITIONS_RECEIPT">근로조건설명 및 계약서수령 확인서</option>
                <option value="PRIVACY_CONSENT">개인정보수집·이용 동의서</option>
                <option value="BASIC_SAFETY_EDU_CONFIRM">건설업 기초안전보건교육 확인서</option>
                <option value="SITE_SAFETY_RULES_CONFIRM">현장 안전수칙 준수 확인서</option>
                <option value="HEALTH_DECLARATION">건강 이상 없음 각서</option>
                <option value="HEALTH_CERTIFICATE">건강 증명서</option>
              </select>
            </div>

            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold mb-1">교육/문서 일자 *</label>
              <input type="date" value={form.educationDate}
                onChange={e => setForm(f => ({ ...f, educationDate: e.target.value }))}
                className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
            </div>

            {(form.documentType === 'SAFETY_EDUCATION_NEW_HIRE' || form.documentType === 'SAFETY_EDUCATION_TASK_CHANGE') && (
              <>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">교육 시간 (시간)</label>
                  <input type="number" value={form.educationHours} min={0.5} step={0.5}
                    onChange={e => setForm(f => ({ ...f, educationHours: Number(e.target.value) }))}
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">교육 장소</label>
                  <input type="text" value={form.educationPlace}
                    onChange={e => setForm(f => ({ ...f, educationPlace: e.target.value }))}
                    placeholder="현장 사무소, 현장 내 교육장 등"
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">교육 담당자</label>
                  <input type="text" value={form.educatorName}
                    onChange={e => setForm(f => ({ ...f, educatorName: e.target.value }))}
                    placeholder="현장소장, 안전관리자 등"
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
              </>
            )}

            {form.documentType === 'PPE_PROVISION' && (
              <div className="mb-3.5">
                <label className="block text-[13px] font-semibold mb-2">보호구 품목별 지급 현황</label>
                <div className="text-[11px] text-[#6b7280] mb-2">지급한 품목에 체크하고 수량·상태·설명 여부를 입력하세요.</div>
                {ppeItems.map((item, idx) => (
                  <div key={item.name} className={`border border-[#e5e7eb] rounded-md px-3 py-2.5 mb-2 ${item.issued ? 'bg-[#f0fdf4]' : 'bg-[#fafafa]'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="flex items-center gap-1.5 font-semibold text-[13px] cursor-pointer flex-1">
                        <input type="checkbox" checked={item.issued}
                          onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, issued: e.target.checked } : it))} />
                        {item.name}
                      </label>
                      {item.issued && (
                        <span className="text-[11px] text-[#16a34a] font-semibold">지급</span>
                      )}
                    </div>
                    {item.issued && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                        <div>
                          <label className="text-[11px] text-[#6b7280] block mb-0.5">수량</label>
                          <input type="number" min={1} value={item.qty}
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) } : it))}
                            className="w-full px-2 py-1 border border-secondary-brand/30 rounded text-[13px]" />
                        </div>
                        <div>
                          <label className="text-[11px] text-[#6b7280] block mb-0.5">상태</label>
                          <select value={item.condition}
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, condition: e.target.value } : it))}
                            className="w-full px-2 py-1 border border-secondary-brand/30 rounded text-[13px]">
                            <option value="신품">신품</option>
                            <option value="양호">양호</option>
                            <option value="재사용">재사용</option>
                            <option value="기타">기타</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                          <input type="checkbox" checked={item.explanationGiven}
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, explanationGiven: e.target.checked } : it))} />
                          착용방법 설명 완료
                        </label>
                        <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                          <input type="checkbox" checked={item.needsReplacement}
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, needsReplacement: e.target.checked } : it))} />
                          교체 필요
                        </label>
                        <div className="col-span-2">
                          <label className="text-[11px] text-[#6b7280] block mb-0.5">비고</label>
                          <input type="text" value={item.note} placeholder="규격, 특이사항 등"
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, note: e.target.value } : it))}
                            className="w-full px-2 py-1 border border-secondary-brand/30 rounded text-[13px]" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 근로조건설명 확인서 */}
            {form.documentType === 'WORK_CONDITIONS_RECEIPT' && (
              <>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">근로일 *</label>
                  <input type="date" value={form.workDate}
                    onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">공종</label>
                  <input type="text" value={form.tradeType}
                    onChange={e => setForm(f => ({ ...f, tradeType: e.target.value }))}
                    placeholder="예: 전기, 소방기계"
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">직종</label>
                  <input type="text" value={form.jobType}
                    onChange={e => setForm(f => ({ ...f, jobType: e.target.value }))}
                    placeholder="예: 전공, 보통인부"
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">현장관리자명</label>
                  <input type="text" value={form.managerName}
                    onChange={e => setForm(f => ({ ...f, managerName: e.target.value }))}
                    placeholder="현장소장, 관리자명"
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
              </>
            )}

            {/* 기초안전보건교육 확인서 */}
            {form.documentType === 'BASIC_SAFETY_EDU_CONFIRM' && (
              <>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">근로일 *</label>
                  <input type="date" value={form.workDate}
                    onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
                <div className="mb-3.5">
                  <label className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer">
                    <input type="checkbox" checked={form.eduCompletedYn}
                      onChange={e => setForm(f => ({ ...f, eduCompletedYn: e.target.checked }))} />
                    기초안전보건교육 이수 완료
                  </label>
                </div>
                {form.eduCompletedYn && (
                  <>
                    <div className="mb-3.5">
                      <label className="block text-[13px] font-semibold mb-1">이수일</label>
                      <input type="date" value={form.eduCompletedDate}
                        onChange={e => setForm(f => ({ ...f, eduCompletedDate: e.target.value }))}
                        className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                    </div>
                    <div className="mb-3.5">
                      <label className="block text-[13px] font-semibold mb-1">교육기관명</label>
                      <input type="text" value={form.eduOrganization}
                        onChange={e => setForm(f => ({ ...f, eduOrganization: e.target.value }))}
                        placeholder="교육기관명"
                        className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                    </div>
                  </>
                )}
                <div className="mb-3.5">
                  <label className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer">
                    <input type="checkbox" checked={form.eduCertConfirmedYn}
                      onChange={e => setForm(f => ({ ...f, eduCertConfirmedYn: e.target.checked }))} />
                    이수증 원본 확인 완료
                  </label>
                </div>
                {form.eduCertConfirmedYn && (
                  <div className="mb-3.5">
                    <label className="block text-[13px] font-semibold mb-1">확인일</label>
                    <input type="date" value={form.eduCertConfirmedDate}
                      onChange={e => setForm(f => ({ ...f, eduCertConfirmedDate: e.target.value }))}
                      className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                  </div>
                )}
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">확인자 (현장관리자)</label>
                  <input type="text" value={form.confirmerName}
                    onChange={e => setForm(f => ({ ...f, confirmerName: e.target.value }))}
                    placeholder="확인자 성명"
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
              </>
            )}

            {/* 현장 안전수칙 준수 확인서 */}
            {form.documentType === 'SITE_SAFETY_RULES_CONFIRM' && (
              <>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">근로일 *</label>
                  <input type="date" value={form.workDate}
                    onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">특이 안전수칙 (선택)</label>
                  <textarea value={form.specialSafetyRules}
                    onChange={e => setForm(f => ({ ...f, specialSafetyRules: e.target.value }))}
                    rows={2} placeholder="현장 특이 안전수칙이 있으면 입력"
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px] resize-none" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-[13px] font-semibold mb-1">관리자 성명</label>
                  <input type="text" value={form.confirmerName}
                    onChange={e => setForm(f => ({ ...f, confirmerName: e.target.value }))}
                    placeholder="관리자 성명"
                    className="w-full px-2.5 py-2 border border-secondary-brand/30 rounded-md text-[14px]" />
                </div>
              </>
            )}

            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-secondary-brand/30 rounded-md bg-white cursor-pointer">
                취소
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-2.5 border-none rounded-md bg-[#16a34a] text-white cursor-pointer font-semibold">
                {submitting ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-xl p-7 w-[700px] max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="m-0 text-[16px]">{SAFETY_DOC_LABELS[previewDoc.documentType] || previewDoc.documentType}</h3>
              <button onClick={() => setPreviewDoc(null)} className="border-none bg-transparent text-[20px] cursor-pointer">✕</button>
            </div>
            {/* 현재 반려 사유 */}
            {previewDoc.status === 'REJECTED' && previewDoc.rejectReason && (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 mb-3">
                <div className="text-[12px] font-bold text-[#991b1b] mb-1">반려 사유</div>
                <div className="text-[13px] text-[#dc2626]">{previewDoc.rejectReason}</div>
              </div>
            )}
            {/* 이전 반려 이력 */}
            {previewDoc.history && previewDoc.history.length > 0 && (
              <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-md p-3 mb-3">
                <div className="text-[12px] font-bold text-[#6b7280] mb-2">이전 이력 ({previewDoc.history.length}건)</div>
                {previewDoc.history.map((h, i) => (
                  <div key={h.id} className="flex items-start gap-2 mb-1.5 text-[12px]">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${h.status === 'REJECTED' ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
                      {i + 1}차 {h.status === 'REJECTED' ? '반려' : h.status}
                    </span>
                    {h.rejectReason && <span className="text-[#9ca3af]">{h.rejectReason}</span>}
                    <span className="text-[#d1d5db] ml-auto shrink-0">{new Date(h.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                ))}
              </div>
            )}
            <pre className="whitespace-pre-wrap font-mono text-[12px] bg-brand p-4 rounded-md leading-[1.7]">
              {previewDoc.contentText || '내용 없음'}
            </pre>
            <div className="flex gap-2.5 mt-4">
              <button onClick={() => {
                const blob = new Blob([previewDoc.contentText || ''], { type: 'text/plain;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${SAFETY_DOC_LABELS[previewDoc.documentType]}.txt`
                a.click()
                URL.revokeObjectURL(url)
              }}
                className="px-4 py-2 bg-[#2563eb] text-white border-none rounded-md cursor-pointer text-[13px]">
                다운로드
              </button>
              <button onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 border border-secondary-brand/30 rounded-md bg-white cursor-pointer text-[13px]">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── HrActionsTab: 경고·소명·통지 ─────────────────────────────────────────────

function HrActionsTab({ workerId, workerName }: { workerId: string; workerName: string }) {
  const [warnings,      setWarnings]      = React.useState<Record<string, unknown>[]>([])
  const [explanations,  setExplanations]  = React.useState<Record<string, unknown>[]>([])
  const [notices,       setNotices]       = React.useState<Record<string, unknown>[]>([])
  const [loading,       setLoading]       = React.useState(true)
  const [showWarning,   setShowWarning]   = React.useState(false)
  const [showNotice,    setShowNotice]    = React.useState(false)
  const [showExplain,   setShowExplain]   = React.useState(false)

  // 경고 작성 form
  const [wForm, setWForm] = React.useState({ warningLevel: 'WRITTEN', reason: '', detailMemo: '' })
  // 통지 작성 form
  const [nForm, setNForm] = React.useState({ noticeType: 'TERMINATION', title: '', content: '', effectiveDate: '' })
  // 소명 작성 form
  const [eForm, setEForm] = React.useState({ subject: '', reason: '', deadline: '' })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    Promise.all([
      fetch(`/api/admin/workers/${workerId}/warnings`).then(r => r.json()),
      fetch(`/api/admin/workers/${workerId}/explanations`).then(r => r.json()),
      fetch(`/api/admin/workers/${workerId}/notices`).then(r => r.json()),
    ]).then(([w, e, n]) => {
      setWarnings(w.warnings ?? [])
      setExplanations(e.explanations ?? [])
      setNotices(n.notices ?? [])
      setLoading(false)
    })
  }, [workerId])

  async function submitWarning() {
    if (!wForm.reason.trim()) return
    setSaving(true)
    await fetch(`/api/admin/workers/${workerId}/warnings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wForm),
    })
    const res = await fetch(`/api/admin/workers/${workerId}/warnings`).then(r => r.json())
    setWarnings(res.warnings ?? [])
    setShowWarning(false)
    setWForm({ warningLevel: 'WRITTEN', reason: '', detailMemo: '' })
    setSaving(false)
  }

  async function submitNotice() {
    if (!nForm.title.trim() || !nForm.content.trim()) return
    setSaving(true)
    await fetch(`/api/admin/workers/${workerId}/notices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nForm),
    })
    const res = await fetch(`/api/admin/workers/${workerId}/notices`).then(r => r.json())
    setNotices(res.notices ?? [])
    setShowNotice(false)
    setNForm({ noticeType: 'TERMINATION', title: '', content: '', effectiveDate: '' })
    setSaving(false)
  }

  async function submitExplanation() {
    if (!eForm.subject.trim() || !eForm.reason.trim()) return
    setSaving(true)
    await fetch(`/api/admin/workers/${workerId}/explanations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eForm),
    })
    const res = await fetch(`/api/admin/workers/${workerId}/explanations`).then(r => r.json())
    setExplanations(res.explanations ?? [])
    setShowExplain(false)
    setEForm({ subject: '', reason: '', deadline: '' })
    setSaving(false)
  }

  const WARNING_LEVEL_LABEL: Record<string, string> = { VERBAL: '구두', WRITTEN: '서면', FINAL: '최종' }
  const WARNING_LEVEL_COLOR: Record<string, string> = { VERBAL: '#ff9800', WRITTEN: '#e65100', FINAL: '#c62828' }
  const NOTICE_TYPE_LABEL: Record<string, string>   = { CONTRACT_END: '계약만료', TERMINATION: '종료통지', SUSPENSION: '업무정지', WARNING: '경고통지', OTHER: '기타' }
  const EXPL_STATUS_LABEL: Record<string, string>   = { PENDING: '요청됨', SUBMITTED: '제출됨', REVIEWED: '검토완료', CLOSED: '종결' }

  const fmtDate = (d: unknown) => d ? new Date(d as string).toLocaleDateString('ko-KR') : '-'

  if (loading) return <div className="py-10 text-center text-[#999]">로딩 중...</div>

  return (
    <div className="flex flex-col gap-6">
      {/* ── 경고 ─── */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="m-0 text-[14px] font-bold">경고 기록 ({warnings.length}건)</h3>
          <button onClick={() => setShowWarning(true)}
            className="px-3.5 py-1.5 bg-[#e65100] text-white border-none rounded-md text-[12px] font-bold cursor-pointer">
            + 경고 발행
          </button>
        </div>
        {warnings.length === 0 ? (
          <div className="text-[#718096] text-[13px]">경고 기록이 없습니다.</div>
        ) : (
          warnings.map((w: Record<string, unknown>) => (
            <div key={w.id as string}
              className="border border-[#f0f0f0] rounded-lg px-3.5 py-2.5 mb-2"
              style={{ borderLeft: `4px solid ${WARNING_LEVEL_COLOR[w.warningLevel as string] ?? '#e0e0e0'}` }}>
              <div className="flex justify-between mb-1">
                <span className="text-[12px] font-bold" style={{ color: WARNING_LEVEL_COLOR[w.warningLevel as string] ?? '#666' }}>
                  {WARNING_LEVEL_LABEL[w.warningLevel as string] ?? w.warningLevel as string} 경고
                </span>
                <span className="text-[11px] text-[#bbb]">{fmtDate(w.createdAt)}</span>
              </div>
              <div className="text-[13px] text-[#444]">{w.reason as string}</div>
            </div>
          ))
        )}

        {showWarning && (
          <div className="bg-[#fff8e1] border border-[#ffe082] rounded-[10px] p-4 mt-3">
            <h4 className="mt-0 mb-3 text-[13px] font-bold">경고장 발행 — {workerName}</h4>
            <select value={wForm.warningLevel} onChange={e => setWForm(f => ({ ...f, warningLevel: e.target.value }))}
              className="w-full px-2 py-2 mb-2 border border-secondary-brand/20 rounded-md text-[13px]">
              <option value="VERBAL">구두 경고</option>
              <option value="WRITTEN">서면 경고</option>
              <option value="FINAL">최종 경고</option>
            </select>
            <textarea value={wForm.reason} onChange={e => setWForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="경고 사유 *" rows={3}
              className="w-full px-2 py-2 mb-2 border border-secondary-brand/20 rounded-md text-[13px] resize-y box-border" />
            <textarea value={wForm.detailMemo} onChange={e => setWForm(f => ({ ...f, detailMemo: e.target.value }))}
              placeholder="상세 메모 (선택)" rows={2}
              className="w-full px-2 py-2 mb-2.5 border border-secondary-brand/20 rounded-md text-[13px] resize-y box-border" />
            <div className="flex gap-2">
              <button onClick={() => setShowWarning(false)}
                className="px-4 py-2 border border-secondary-brand/20 rounded-md bg-white cursor-pointer text-[13px]">취소</button>
              <button onClick={submitWarning} disabled={saving || !wForm.reason.trim()}
                className="px-4 py-2 text-white border-none rounded-md text-[13px] font-bold cursor-pointer"
                style={{ background: saving ? '#bdbdbd' : '#e65100' }}>
                {saving ? '처리 중...' : '발행'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── 소명 요청 ─── */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="m-0 text-[14px] font-bold">소명 요청 ({explanations.length}건)</h3>
          <button onClick={() => setShowExplain(true)}
            className="px-3.5 py-1.5 bg-[#E06810] text-white border-none rounded-md text-[12px] font-bold cursor-pointer">
            + 소명 요청
          </button>
        </div>
        {explanations.length === 0 ? (
          <div className="text-[#718096] text-[13px]">소명 요청 내역이 없습니다.</div>
        ) : (
          explanations.map((e: Record<string, unknown>) => (
            <div key={e.id as string} className="border border-[#f0f0f0] rounded-lg px-3.5 py-2.5 mb-2">
              <div className="flex justify-between mb-1">
                <span className="text-[13px] font-semibold">{e.subject as string}</span>
                <span className="text-[11px] text-[#4A93C8] bg-secondary-brand/10 px-2 py-px rounded-[20px] font-bold">
                  {EXPL_STATUS_LABEL[e.status as string] ?? e.status as string}
                </span>
              </div>
              <div className="text-[12px] text-muted-brand">{fmtDate(e.createdAt)}{e.deadline ? ` · 기한: ${fmtDate(e.deadline)}` : ''}</div>
            </div>
          ))
        )}

        {showExplain && (
          <div className="bg-secondary-brand/10 border border-[#90caf9] rounded-[10px] p-4 mt-3">
            <h4 className="mt-0 mb-3 text-[13px] font-bold">소명 요청 — {workerName}</h4>
            <input value={eForm.subject} onChange={e => setEForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="소명 요청 제목 *"
              className="w-full px-2 py-2 mb-2 border border-secondary-brand/20 rounded-md text-[13px] box-border" />
            <textarea value={eForm.reason} onChange={e => setEForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="소명 요청 사유 *" rows={3}
              className="w-full px-2 py-2 mb-2 border border-secondary-brand/20 rounded-md text-[13px] resize-y box-border" />
            <input type="date" value={eForm.deadline} onChange={e => setEForm(f => ({ ...f, deadline: e.target.value }))}
              placeholder="기한 (선택)"
              className="w-full px-2 py-2 mb-2.5 border border-secondary-brand/20 rounded-md text-[13px] box-border" />
            <div className="flex gap-2">
              <button onClick={() => setShowExplain(false)}
                className="px-4 py-2 border border-secondary-brand/20 rounded-md bg-white cursor-pointer text-[13px]">취소</button>
              <button onClick={submitExplanation} disabled={saving || !eForm.subject.trim() || !eForm.reason.trim()}
                className="px-4 py-2 text-white border-none rounded-md text-[13px] font-bold cursor-pointer"
                style={{ background: saving ? '#bdbdbd' : '#1565c0' }}>
                {saving ? '처리 중...' : '요청 전송'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── 통지 ─── */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="m-0 text-[14px] font-bold">통지 기록 ({notices.length}건)</h3>
          <button onClick={() => setShowNotice(true)}
            className="px-3.5 py-1.5 bg-[#37474f] text-white border-none rounded-md text-[12px] font-bold cursor-pointer">
            + 통지서 발행
          </button>
        </div>
        {notices.length === 0 ? (
          <div className="text-[#718096] text-[13px]">통지 기록이 없습니다.</div>
        ) : (
          notices.map((n: Record<string, unknown>) => (
            <div key={n.id as string} className="border border-[#f0f0f0] rounded-lg px-3.5 py-2.5 mb-2">
              <div className="flex justify-between mb-1">
                <span className="text-[13px] font-semibold">{n.title as string}</span>
                <span className="text-[11px] text-muted-brand bg-brand px-2 py-px rounded-[20px]">
                  {NOTICE_TYPE_LABEL[n.noticeType as string] ?? n.noticeType as string}
                </span>
              </div>
              <div className="text-[12px] text-muted-brand">발행일: {fmtDate(n.createdAt)}{n.effectiveDate ? ` · 효력일: ${n.effectiveDate}` : ''}</div>
            </div>
          ))
        )}

        {showNotice && (
          <div className="bg-brand border border-white/[0.12] rounded-[10px] p-4 mt-3">
            <h4 className="mt-0 mb-3 text-[13px] font-bold">통지서 발행 — {workerName}</h4>
            <select value={nForm.noticeType} onChange={e => setNForm(f => ({ ...f, noticeType: e.target.value }))}
              className="w-full px-2 py-2 mb-2 border border-secondary-brand/20 rounded-md text-[13px]">
              <option value="CONTRACT_END">계약만료 통지</option>
              <option value="TERMINATION">종료/해고 통지</option>
              <option value="SUSPENSION">업무 정지 통지</option>
              <option value="WARNING">경고 통지</option>
              <option value="OTHER">기타</option>
            </select>
            <input value={nForm.title} onChange={e => setNForm(f => ({ ...f, title: e.target.value }))}
              placeholder="통지서 제목 *"
              className="w-full px-2 py-2 mb-2 border border-secondary-brand/20 rounded-md text-[13px] box-border" />
            <textarea value={nForm.content} onChange={e => setNForm(f => ({ ...f, content: e.target.value }))}
              placeholder="통지 내용 *" rows={4}
              className="w-full px-2 py-2 mb-2 border border-secondary-brand/20 rounded-md text-[13px] resize-y box-border" />
            <input type="date" value={nForm.effectiveDate} onChange={e => setNForm(f => ({ ...f, effectiveDate: e.target.value }))}
              placeholder="효력 발생일 (선택)"
              className="w-full px-2 py-2 mb-2.5 border border-secondary-brand/20 rounded-md text-[13px] box-border" />
            <div className="flex gap-2">
              <button onClick={() => setShowNotice(false)}
                className="px-4 py-2 border border-secondary-brand/20 rounded-md bg-white cursor-pointer text-[13px]">취소</button>
              <button onClick={submitNotice} disabled={saving || !nForm.title.trim() || !nForm.content.trim()}
                className="px-4 py-2 text-white border-none rounded-md text-[13px] font-bold cursor-pointer"
                style={{ background: saving ? '#bdbdbd' : '#37474f' }}>
                {saving ? '처리 중...' : '발행'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
