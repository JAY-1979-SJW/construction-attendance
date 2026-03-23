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
  // 레거시 필드 — 신규 계좌는 bankAccountSecure 사용
  bankName?: string | null
  bankAccount?: string | null
  // 신규 암호화 계좌 (마스킹값)
  bankAccountSecure?: { bankName: string | null; accountNumberMasked: string | null } | null
  retirementMutualStatus: string
  retirementMutualTargetYn: boolean
  fourInsurancesEligibleYn: boolean
  idVerificationStatus?: string | null
  createdAt: string
  updatedAt: string
  _count: { devices: number; attendanceLogs: number }
  companyAssignments: CompanyAssignment[]
  siteAssignments: SiteAssignment[]
  insuranceStatuses: InsuranceStatus[]
}

// ─── 탭 종류 ──────────────────────────────────────────────────────────────────

type Tab = 'info' | 'profile' | 'company' | 'site' | 'insurance' | 'docs' | 'contracts' | 'safety'

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

  if (loading) return <div style={s.page}><p style={{ padding: '40px' }}>로딩 중...</p></div>
  if (error) return <div style={s.page}><p style={{ padding: '40px', color: 'red' }}>{error}</p></div>
  if (!worker) return null

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'],
          ['/admin/sites', '현장 관리'], ['/admin/attendance', '출퇴근 조회'],
          ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={s.navItem}>{label}</Link>
        ))}
      </nav>

      <main style={s.main}>
        {/* 헤더 */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push('/admin/workers')} style={s.backBtn}>← 목록</button>
            <h1 style={s.pageTitle}>
              {worker.name}
              <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 400, color: worker.isActive ? '#2e7d32' : '#999' }}>
                {worker.isActive ? '활성' : '비활성'}
              </span>
            </h1>
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            {fmtPhone(worker.phone)} · {worker.jobTitle} · 기기 {worker._count.devices}대 · 출퇴근 {worker._count.attendanceLogs}건
          </div>
        </div>

        {/* 탭 */}
        <div style={s.tabBar}>
          {([['info', '기본정보'], ['profile', '분류정보'], ['company', '회사배정'], ['site', '현장배정'], ['insurance', '보험상태'], ['contracts', '계약서'], ['safety', '안전문서'], ['docs', '문서']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ ...s.tabBtn, ...(tab === key ? s.tabActive : {}) }}>
              {label}
              {key === 'company' && worker.companyAssignments.length > 0 && (
                <span style={s.tabBadge}>{worker.companyAssignments.length}</span>
              )}
              {key === 'site' && worker.siteAssignments.length > 0 && (
                <span style={s.tabBadge}>{worker.siteAssignments.length}</span>
              )}
              {key === 'insurance' && worker.insuranceStatuses.length > 0 && (
                <span style={s.tabBadge}>{worker.insuranceStatuses.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        <div style={s.card}>
          {tab === 'info' && <InfoTab worker={worker} />}
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
          {tab === 'contracts' && <ContractsTab workerId={worker.id} />}
          {tab === 'safety' && <SafetyDocsTab workerId={worker.id} />}
        </div>
      </main>

      {/* ── 회사 배정 모달 ─────────────────────────────────────── */}
      {showCompanyForm && (
        <Modal title="회사 배정 등록" onClose={() => setShowCompanyForm(false)}>
          <Field label="회사 *">
            <select value={companyForm.companyId} onChange={e => setCompanyForm(f => ({ ...f, companyId: e.target.value }))} style={s.input}>
              <option value="">선택하세요</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </Field>
          <Field label="고용형태">
            <select value={companyForm.employmentType} onChange={e => setCompanyForm(f => ({ ...f, employmentType: e.target.value }))} style={s.input}>
              <option value="DAILY">일용직</option>
              <option value="REGULAR">상용직</option>
              <option value="OUTSOURCE">외주</option>
            </select>
          </Field>
          <Field label="계약 단계">
            <select value={companyForm.contractorTier} onChange={e => setCompanyForm(f => ({ ...f, contractorTier: e.target.value }))} style={s.input}>
              <option value="PRIME">원청</option>
              <option value="SUB1">1차 협력</option>
              <option value="SUB2">2차 협력</option>
              <option value="SUB3">3차 이하</option>
            </select>
          </Field>
          <Field label="역할/직책">
            <input value={companyForm.roleTitle} onChange={e => setCompanyForm(f => ({ ...f, roleTitle: e.target.value }))} style={s.input} placeholder="현장 소장" />
          </Field>
          <Field label="시작일 *">
            <input type="date" value={companyForm.validFrom} onChange={e => setCompanyForm(f => ({ ...f, validFrom: e.target.value }))} style={s.input} />
          </Field>
          <Field label="종료일">
            <input type="date" value={companyForm.validTo} onChange={e => setCompanyForm(f => ({ ...f, validTo: e.target.value }))} style={s.input} />
          </Field>
          <Field label="">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={companyForm.isPrimary} onChange={e => setCompanyForm(f => ({ ...f, isPrimary: e.target.checked }))} />
              주 소속 (Primary)
            </label>
          </Field>
          <Field label="메모">
            <input value={companyForm.notes} onChange={e => setCompanyForm(f => ({ ...f, notes: e.target.value }))} style={s.input} />
          </Field>
          {formError && <p style={s.err}>{formError}</p>}
          <div style={s.modalBtns}>
            <button onClick={() => setShowCompanyForm(false)} style={s.cancelBtn}>취소</button>
            <button onClick={saveCompanyAssignment} disabled={formSaving || !companyForm.companyId || !companyForm.validFrom} style={s.saveBtn}>
              {formSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── 현장 배정 모달 ─────────────────────────────────────── */}
      {showSiteForm && (
        <Modal title="현장 배정 등록" onClose={() => setShowSiteForm(false)}>
          <Field label="현장 *">
            <select value={siteForm.siteId} onChange={e => setSiteForm(f => ({ ...f, siteId: e.target.value }))} style={s.input}>
              <option value="">선택하세요</option>
              {sites.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </Field>
          <Field label="소속회사 *">
            <select value={siteForm.companyId} onChange={e => setSiteForm(f => ({ ...f, companyId: e.target.value }))} style={s.input}>
              <option value="">선택하세요</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </Field>
          <Field label="직종/공종">
            <input value={siteForm.tradeType} onChange={e => setSiteForm(f => ({ ...f, tradeType: e.target.value }))} style={s.input} placeholder="형틀목공" />
          </Field>
          <Field label="배정일 *">
            <input type="date" value={siteForm.assignedFrom} onChange={e => setSiteForm(f => ({ ...f, assignedFrom: e.target.value }))} style={s.input} />
          </Field>
          <Field label="종료일">
            <input type="date" value={siteForm.assignedTo} onChange={e => setSiteForm(f => ({ ...f, assignedTo: e.target.value }))} style={s.input} />
          </Field>
          <Field label="">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={siteForm.isPrimary} onChange={e => setSiteForm(f => ({ ...f, isPrimary: e.target.checked }))} />
              주 현장 (Primary)
            </label>
          </Field>
          <Field label="메모">
            <input value={siteForm.notes} onChange={e => setSiteForm(f => ({ ...f, notes: e.target.value }))} style={s.input} />
          </Field>
          {formError && <p style={s.err}>{formError}</p>}
          <div style={s.modalBtns}>
            <button onClick={() => setShowSiteForm(false)} style={s.cancelBtn}>취소</button>
            <button onClick={saveSiteAssignment} disabled={formSaving || !siteForm.siteId || !siteForm.companyId || !siteForm.assignedFrom} style={s.saveBtn}>
              {formSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── 보험 상태 모달 ─────────────────────────────────────── */}
      {showInsuranceForm && (
        <Modal title="보험 상태 등록/수정" onClose={() => setShowInsuranceForm(false)}>
          <Field label="회사 *">
            <select value={insuranceForm.companyId} onChange={e => setInsuranceForm(f => ({ ...f, companyId: e.target.value }))} style={s.input}>
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
              <select value={insuranceForm[key] as string} onChange={e => setInsuranceForm(f => ({ ...f, [key]: e.target.value }))} style={s.input}>
                <option value="UNKNOWN">미확인</option>
                <option value="ENROLLED">가입</option>
                <option value="LOSS">상실</option>
                <option value="EXEMPT">적용제외</option>
              </select>
            </Field>
          ))}
          <Field label="취득일">
            <input type="date" value={insuranceForm.acquisitionDate} onChange={e => setInsuranceForm(f => ({ ...f, acquisitionDate: e.target.value }))} style={s.input} />
          </Field>
          <Field label="상실일">
            <input type="date" value={insuranceForm.lossDate} onChange={e => setInsuranceForm(f => ({ ...f, lossDate: e.target.value }))} style={s.input} />
          </Field>
          <Field label="신고 상태">
            <select value={insuranceForm.reportingStatus} onChange={e => setInsuranceForm(f => ({ ...f, reportingStatus: e.target.value }))} style={s.input}>
              <option value="NOT_CHECKED">미확인</option>
              <option value="REPORTED">신고완료</option>
              <option value="PENDING">신고대기</option>
              <option value="EXEMPTED">면제</option>
            </select>
          </Field>
          <Field label="확인일">
            <input type="date" value={insuranceForm.verificationDate} onChange={e => setInsuranceForm(f => ({ ...f, verificationDate: e.target.value }))} style={s.input} />
          </Field>
          <Field label="메모">
            <input value={insuranceForm.notes} onChange={e => setInsuranceForm(f => ({ ...f, notes: e.target.value }))} style={s.input} />
          </Field>
          {formError && <p style={s.err}>{formError}</p>}
          <div style={s.modalBtns}>
            <button onClick={() => setShowInsuranceForm(false)} style={s.cancelBtn}>취소</button>
            <button onClick={saveInsuranceStatus} disabled={formSaving || !insuranceForm.companyId} style={s.saveBtn}>
              {formSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── 기본정보 탭 ──────────────────────────────────────────────────────────────

function InfoTab({ worker }: { worker: WorkerDetail }) {
  const rows: [string, string][] = [
    ['이름', worker.name],
    ['휴대폰', `${worker.phone.slice(0, 3)}-${worker.phone.slice(3, 7)}-${worker.phone.slice(7)}`],
    ['직종', worker.jobTitle],
    ['근로자 코드', worker.workerCode ?? '—'],
    ['고용형태', EMPLOYMENT_TYPE_LABELS[worker.employmentType] ?? worker.employmentType],
    ['소득구분', worker.incomeType === 'DAILY_WAGE' ? '일당' : worker.incomeType === 'MONTHLY_SALARY' ? '월급' : worker.incomeType],
    ['직접/협력', worker.organizationType === 'DIRECT' ? '직접' : '협력사'],
    ['숙련도', worker.skillLevel ?? '—'],
    ['외국인', worker.foreignerYn ? `예 (${worker.nationalityCode ?? '—'})` : '아니오'],
    ['계좌', worker.bankAccountSecure
      ? `${worker.bankAccountSecure.bankName ?? '—'} / ${worker.bankAccountSecure.accountNumberMasked ?? '****'}`
      : worker.bankName ? `${worker.bankName} / ****` : '미등록 (개인정보 관리에서 입력)'],
    ['퇴직공제 대상', worker.retirementMutualTargetYn ? '대상' : '비대상'],
    ['퇴직공제 상태', worker.retirementMutualStatus],
    ['4대보험 적용', worker.fourInsurancesEligibleYn ? '적용' : '미적용'],
    ['신분증 상태', worker.idVerificationStatus ?? '—'],
    ['등록일', fmtDate(worker.createdAt)],
    ['최근 수정', fmtDate(worker.updatedAt)],
  ]

  return (
    <div>
      <h3 style={s.tabTitle}>기본 정보</h3>
      <table style={s.infoTable}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td style={s.infoLabel}>{label}</td>
              <td style={s.infoValue}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── 회사 배정 탭 ────────────────────────────────────────────────────────────

function CompanyTab({ assignments, onAdd }: { assignments: CompanyAssignment[]; onAdd: () => void }) {
  return (
    <div>
      <div style={s.tabHeader}>
        <h3 style={s.tabTitle}>회사 배정 이력</h3>
        <button onClick={onAdd} style={s.addBtn}>+ 회사 배정</button>
      </div>
      {assignments.length === 0 ? (
        <p style={s.empty}>배정된 회사가 없습니다.</p>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              {['회사명', '유형', '고용형태', '시작일', '종료일', '주소속', '메모'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id}>
                <td style={s.td}>{a.company.companyName}</td>
                <td style={s.td}><span style={s.badge}>{a.company.companyType ?? '—'}</span></td>
                <td style={s.td}>{a.employmentType}</td>
                <td style={s.td}>{fmtDate(a.validFrom)}</td>
                <td style={s.td}>{fmtDate(a.validTo)}</td>
                <td style={s.td}>{a.isPrimary ? <span style={s.badgePrimary}>주소속</span> : '—'}</td>
                <td style={s.td}>{a.notes ?? '—'}</td>
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
      <div style={s.tabHeader}>
        <h3 style={s.tabTitle}>현장 배정 이력</h3>
        <button onClick={onAdd} style={s.addBtn}>+ 현장 배정</button>
      </div>
      {assignments.length === 0 ? (
        <p style={s.empty}>배정된 현장이 없습니다.</p>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              {['현장명', '소속회사', '직종/공종', '배정일', '종료일', '상태', '주현장'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id} style={{ opacity: a.isActive ? 1 : 0.6 }}>
                <td style={s.td}>{a.site.name}</td>
                <td style={s.td}>{a.company.companyName}</td>
                <td style={s.td}>{a.tradeType ?? '—'}</td>
                <td style={s.td}>{fmtDate(a.assignedFrom)}</td>
                <td style={s.td}>{fmtDate(a.assignedTo)}</td>
                <td style={s.td}>
                  <span style={{ color: a.isActive ? '#2e7d32' : '#999', fontSize: '12px', fontWeight: 600 }}>
                    {a.isActive ? '활성' : '비활성'}
                  </span>
                </td>
                <td style={s.td}>{a.isPrimary ? <span style={s.badgePrimary}>주현장</span> : '—'}</td>
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
      <div style={s.tabHeader}>
        <h3 style={s.tabTitle}>4대보험 상태</h3>
        <button onClick={onAdd} style={s.addBtn}>+ 보험 등록/수정</button>
      </div>
      {statuses.length === 0 ? (
        <p style={s.empty}>등록된 보험 정보가 없습니다.</p>
      ) : statuses.map(st => (
        <div key={st.id} style={s.insCard}>
          <div style={s.insHeader}>
            <strong>{st.company.companyName}</strong>
            <span style={{ fontSize: '12px', color: '#666' }}>최종 수정: {fmtDate(st.updatedAt)}</span>
          </div>
          <div style={s.ins4Grid}>
            {ins4(st).map(([label, val]) => (
              <div key={label} style={s.ins4Cell}>
                <div style={s.ins4Label}>{label}</div>
                <div style={{
                  ...s.ins4Value,
                  color: val === 'ENROLLED' ? '#2e7d32' : val === 'LOSS' ? '#c62828' : val === 'EXEMPT' ? '#f57c00' : '#999',
                }}>
                  {INSURANCE_STATUS_LABELS[val] ?? val}
                </div>
              </div>
            ))}
          </div>
          <div style={s.insMeta}>
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
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={s.fieldRow}>
      {label && <label style={s.fieldLabel}>{label}</label>}
      {children}
    </div>
  )
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f5f5f5', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: '200px', background: '#1a1a2e', padding: '20px 0', flexShrink: 0 },
  sidebarTitle: { color: '#fff', fontSize: '14px', fontWeight: 700, padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.75)', padding: '10px 20px', textDecoration: 'none', fontSize: '13px' },
  main: { flex: 1, padding: '28px', maxWidth: '1100px' },
  page: { fontFamily: 'system-ui, sans-serif' },
  header: { marginBottom: '20px' },
  pageTitle: { margin: 0, fontSize: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'baseline', gap: '6px' },
  backBtn: { padding: '6px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  tabBar: { display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #e0e0e0', paddingBottom: '0' },
  tabBtn: { padding: '8px 18px', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#666', display: 'flex', alignItems: 'center', gap: '6px' },
  tabActive: { borderBottom: '2px solid #1976d2', color: '#1976d2', fontWeight: 700 },
  tabBadge: { background: '#1976d2', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px', fontWeight: 700 },
  card: { background: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  tabTitle: { margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#333' },
  tabHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  addBtn: { padding: '7px 14px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  infoTable: { width: '100%', borderCollapse: 'collapse' },
  infoLabel: { padding: '8px 16px 8px 0', fontWeight: 600, fontSize: '13px', color: '#555', width: '140px', verticalAlign: 'top' },
  infoValue: { padding: '8px 0', fontSize: '13px', color: '#333' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', background: '#f8f8f8', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e0e0e0', color: '#555' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f0f0f0', color: '#333' },
  empty: { color: '#999', padding: '24px 0', textAlign: 'center', fontSize: '13px' },
  badge: { background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' },
  badgePrimary: { background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 },
  insCard: { border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', marginBottom: '12px' },
  insHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  ins4Grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' },
  ins4Cell: { background: '#f9f9f9', borderRadius: '6px', padding: '10px', textAlign: 'center' },
  ins4Label: { fontSize: '11px', color: '#888', marginBottom: '4px' },
  ins4Value: { fontSize: '13px', fontWeight: 700 },
  insMeta: { display: 'flex', gap: '16px', fontSize: '12px', color: '#666', flexWrap: 'wrap' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: '12px', padding: '28px', width: '480px', maxHeight: '80vh', overflowY: 'auto' },
  fieldRow: { display: 'flex', alignItems: 'center', marginBottom: '14px', gap: '12px' },
  fieldLabel: { width: '90px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' },
  input: { flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' },
  err: { color: '#c62828', fontSize: '13px', marginBottom: '12px' },
  modalBtns: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' },
  cancelBtn: { padding: '8px 18px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  saveBtn: { padding: '8px 18px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
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
      <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px', color: '#333' }}>문서 업로드</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>문서 유형</div>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} style={s.input}>
              {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>파일</div>
            <input ref={fileInputRef} type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx"
              style={{ fontSize: '13px' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>만료일 (선택)</div>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={{ ...s.input, width: '140px' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>비고 (선택)</div>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="비고" style={{ ...s.input, width: '160px' }} />
          </div>
          <button onClick={handleUpload} disabled={uploading} style={{ ...s.addBtn, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? '업로드 중...' : '업로드'}
          </button>
        </div>
        {uploadMsg && (
          <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 600,
            color: uploadMsg.includes('완료') ? '#2e7d32' : '#b71c1c' }}>
            {uploadMsg}
          </div>
        )}
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#aaa' }}>
          지원 형식: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX · 최대 20MB · 신분증은 SUPER_ADMIN/ADMIN만 열람 가능
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' as const }}>
        <button onClick={() => setFilterType('')} style={{ ...filterBtn, background: filterType === '' ? '#1976d2' : '#f0f0f0', color: filterType === '' ? 'white' : '#666' }}>전체</button>
        {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => (
          <button key={v} onClick={() => setFilterType(v)} style={{ ...filterBtn, background: filterType === v ? '#1976d2' : '#f0f0f0', color: filterType === v ? 'white' : '#666' }}>{l}</button>
        ))}
      </div>

      {/* 문서 목록 */}
      {loading ? <p style={s.empty}>로딩 중...</p> : docs.length === 0 ? (
        <p style={s.empty}>문서가 없습니다.</p>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              {['유형', '파일명', '크기', '업로드일', '만료일', '상태', '검토자/일', '비고', '열람', '다운로드', '상태변경'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td style={s.td}>
                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '8px' }}>
                    {DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                  </span>
                </td>
                <td style={{ ...s.td, maxWidth: '180px', fontSize: '12px', color: '#333', wordBreak: 'break-all' as const }}>
                  {/* 파일명만 노출 — 민감문서는 내용 미노출 */}
                  {doc.file.originalFilename}
                </td>
                <td style={{ ...s.td, fontSize: '11px', color: '#888' }}>{fmtBytes(doc.file.sizeBytes)}</td>
                <td style={{ ...s.td, fontSize: '11px', color: '#888', whiteSpace: 'nowrap' as const }}>
                  {new Date(doc.file.uploadedAt).toLocaleDateString('ko-KR')}
                </td>
                <td style={{ ...s.td, fontSize: '11px', color: doc.expiresAt && new Date(doc.expiresAt) < new Date() ? '#b71c1c' : '#555' }}>
                  {doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString('ko-KR') : '—'}
                </td>
                <td style={s.td}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                    color: DOC_STATUS_COLOR[doc.status], background: DOC_STATUS_BG[doc.status] }}>
                    {DOC_STATUS_LABEL[doc.status] ?? doc.status}
                  </span>
                </td>
                <td style={{ ...s.td, fontSize: '11px', color: '#888', whiteSpace: 'nowrap' as const }}>
                  {doc.reviewedBy ? `${doc.reviewedBy.slice(-6)} / ${doc.reviewedAt ? new Date(doc.reviewedAt).toLocaleDateString('ko-KR') : '—'}` : '—'}
                </td>
                <td style={{ ...s.td, fontSize: '11px', color: '#888', maxWidth: '120px' }}>{doc.notes ?? '—'}</td>
                <td style={s.td}>
                  <a
                    href={`/api/admin/workers/${workerId}/documents/${doc.id}/download?inline=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: '#1976d2', textDecoration: 'underline' }}
                  >
                    열람
                  </a>
                </td>
                <td style={s.td}>
                  <a
                    href={`/api/admin/workers/${workerId}/documents/${doc.id}/download`}
                    style={{ fontSize: '12px', color: '#555', textDecoration: 'underline' }}
                  >
                    다운로드
                  </a>
                </td>
                <td style={s.td}>
                  <select
                    value={doc.status}
                    onChange={(e) => changeStatus(doc.id, e.target.value)}
                    style={{ fontSize: '12px', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px' }}
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

  if (loading) return <div style={{ padding: '32px', color: '#999', textAlign: 'center' }}>로딩 중...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>근로형태 분류정보</h3>
        {!editing && (
          <button onClick={startEdit} style={{ padding: '6px 14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            {profile ? '수정' : '분류 등록'}
          </button>
        )}
      </div>

      {msg && <div style={{ padding: '8px 12px', background: '#e8f5e9', borderRadius: '6px', fontSize: '13px', color: '#2e7d32', marginBottom: '12px' }}>{msg}</div>}

      {!editing && !profile && (
        <div style={{ padding: '32px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
          분류정보가 없습니다. "분류 등록" 버튼으로 등록하세요.
        </div>
      )}

      {!editing && profile && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            ['근로자 구분',  WORKER_CLASS_LABEL[profile.workerClass as string]    || (profile.workerClass as string)],
            ['근무형태',    EMPLOYMENT_MODE_LABEL[profile.employmentMode as string] || (profile.employmentMode as string)],
            ['세무형태',    TAX_MODE_LABEL[profile.taxMode as string]            || (profile.taxMode as string)],
            ['보험형태',    INSURANCE_MODE_LABEL[profile.insuranceMode as string] || (profile.insuranceMode as string)],
            ['사무실 근무', (profile.officeWorkerYn ? '예' : '아니요')],
            ['계속근로 검토', profile.continuousWorkReview === 'REVIEW_REQUIRED'
              ? '⚠️ 검토 필요' : '이상 없음'],
          ].map(([label, value]) => (
            <div key={label as string} style={{ padding: '12px', background: '#f9f9f9', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: profile.continuousWorkReview === 'REVIEW_REQUIRED' && label === '계속근로 검토' ? '#e65100' : '#333' }}>
                {value as string}
              </div>
            </div>
          ))}
          {!!profile.classificationNote && (
            <div style={{ gridColumn: '1/-1', padding: '12px', background: '#fff3e0', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>관리자 메모</div>
              <div style={{ fontSize: '13px' }}>{String(profile.classificationNote)}</div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            { label: '근로자 구분', key: 'workerClass', options: [['EMPLOYEE','근로자'],['CONTRACTOR','외주/용역']] },
            { label: '근무형태', key: 'employmentMode', options: [['DAILY','일용직'],['REGULAR','상용직'],['TEMP','단기계약'],['OFFICE_SUPPORT','사무보조']] },
            { label: '세무형태', key: 'taxMode', options: [['DAILY_WAGE','일용근로소득'],['WAGE','일반 근로소득'],['BIZ_3P3','사업소득 3.3%'],['OTHER_8P8','기타소득 8.8%']] },
            { label: '보험형태', key: 'insuranceMode', options: [['AUTO_RULE','자동 판정'],['EMPLOYEE_4INSURANCE','4대보험 전체'],['EMPLOYMENT_ONLY','고용보험만'],['EXCLUDED','적용 제외'],['MANUAL_OVERRIDE','수동 지정']] },
            { label: '계속근로 검토', key: 'continuousWorkReview', options: [['OK','이상 없음'],['REVIEW_REQUIRED','검토 필요']] },
          ].map(({ label, key, options }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 }}>{label}</label>
              <select value={f(key)} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px' }}>
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px' }}>
            <input type="checkbox" checked={fb('officeWorkerYn')}
              onChange={e => setForm(p => ({ ...p, officeWorkerYn: e.target.checked }))}
              style={{ width: '16px', height: '16px' }} />
            <label style={{ fontSize: '13px', cursor: 'pointer' }}>사무실 근무자</label>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 }}>관리자 메모</label>
            <input value={f('classificationNote')}
              onChange={e => setForm(p => ({ ...p, classificationNote: e.target.value }))}
              placeholder="판단 근거 등 메모"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px' }} />
          </div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '8px 20px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const filterBtn: React.CSSProperties = {
  padding: '4px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
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

function ContractsTab({ workerId }: { workerId: string }) {
  const [contracts, setContracts] = useState<WorkerContractRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/contracts?workerId=${workerId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setContracts(d.data) })
      .finally(() => setLoading(false))
  }, [workerId])

  const CONTRACT_STATUS_LABEL: Record<string, string> = {
    DRAFT: '초안', ACTIVE: '활성', ENDED: '종료', CANCELLED: '취소',
  }
  const CONTRACT_TYPE_LABEL: Record<string, string> = {
    DAILY: '일용직', REGULAR: '상용직', FIXED_TERM: '기간제', SUBCONTRACT: '외주',
  }

  if (loading) return <p style={{ color: '#999', padding: '16px' }}>불러오는 중...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>근로계약서</h3>
        <a href={`/admin/contracts/new?workerId=${workerId}`}
          style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', borderRadius: 6, fontSize: '13px', textDecoration: 'none' }}>
          + 신규 계약
        </a>
      </div>
      {contracts.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>계약 이력이 없습니다.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>유형</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>현장</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>기간</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>일당/월급</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>상태</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>서명</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>교부</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {contracts.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px 12px' }}>
                  {CONTRACT_TYPE_LABEL[c.contractType] || c.contractType}
                  {c.currentVersion && c.currentVersion > 1 && (
                    <span style={{ marginLeft: 4, fontSize: '11px', color: '#888' }}>v{c.currentVersion}</span>
                  )}
                </td>
                <td style={{ padding: '8px 12px', color: '#555' }}>{c.site?.name || '—'}</td>
                <td style={{ padding: '8px 12px', color: '#555' }}>
                  {c.startDate} ~ {c.endDate || '무기한'}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                  {c.dailyWage ? c.dailyWage.toLocaleString() + '원' : c.monthlySalary ? c.monthlySalary.toLocaleString() + '원' : '—'}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 12, fontSize: '11px', fontWeight: 600,
                    background: c.contractStatus === 'ACTIVE' ? '#dcfce7' : c.contractStatus === 'DRAFT' ? '#fef9c3' : '#f3f4f6',
                    color: c.contractStatus === 'ACTIVE' ? '#166534' : c.contractStatus === 'DRAFT' ? '#854d0e' : '#6b7280',
                  }}>
                    {CONTRACT_STATUS_LABEL[c.contractStatus] || c.contractStatus}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: c.signedAt ? '#16a34a' : '#d1d5db' }}>
                  {c.signedAt ? '✓' : '—'}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center', color: c.deliveredAt ? '#16a34a' : '#d1d5db' }}>
                  {c.deliveredAt ? '✓' : '—'}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <a href={`/admin/contracts/${c.id}`} style={{ color: '#2563eb', fontSize: '12px', textDecoration: 'none' }}>상세</a>
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

function SafetyDocsTab({ workerId }: { workerId: string }) {
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
  const [previewDoc, setPreviewDoc] = useState<SafetyDocRow & { contentText?: string } | null>(null)

  const load = () => {
    fetch(`/api/admin/workers/${workerId}/safety-documents`)
      .then(r => r.json())
      .then(d => { if (d.success) setDocs(d.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [workerId])

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
    } catch (e) {
      alert('오류: ' + (e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSign = async (docId: string, signerName: string) => {
    const res = await fetch(`/api/admin/safety-documents/${docId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedBy: signerName }),
    })
    const data = await res.json()
    if (data.success) load()
    else alert(data.error)
  }

  const handlePreview = async (docId: string) => {
    const res = await fetch(`/api/admin/safety-documents/${docId}`)
    const data = await res.json()
    if (data.success) setPreviewDoc(data.data)
  }

  if (loading) return <p style={{ color: '#999', padding: '16px' }}>불러오는 중...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>안전문서</h3>
        <button onClick={() => setShowForm(true)}
          style={{ padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: '13px', cursor: 'pointer' }}>
          + 안전문서 생성
        </button>
      </div>

      {/* 문서 목록 */}
      {docs.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>안전문서 이력이 없습니다.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>문서 종류</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>현장</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>문서일</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>상태</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>서명일</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>동작</th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px 12px' }}>{SAFETY_DOC_LABELS[d.documentType] || d.documentType}</td>
                <td style={{ padding: '8px 12px', color: '#555' }}>{d.site?.name || '—'}</td>
                <td style={{ padding: '8px 12px', color: '#555' }}>{d.educationDate || d.documentDate || '—'}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 12, fontSize: '11px', fontWeight: 600,
                    background: d.status === 'SIGNED' ? '#dcfce7' : d.status === 'ISSUED' ? '#dbeafe' : '#fef9c3',
                    color: d.status === 'SIGNED' ? '#166534' : d.status === 'ISSUED' ? '#1e40af' : '#854d0e',
                  }}>
                    {d.status === 'SIGNED' ? '서명완료' : d.status === 'ISSUED' ? '발행' : '초안'}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#555' }}>
                  {d.signedAt ? new Date(d.signedAt).toLocaleDateString('ko-KR') : '—'}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <button onClick={() => handlePreview(d.id)}
                    style={{ marginRight: 6, padding: '2px 8px', fontSize: '11px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>
                    미리보기
                  </button>
                  {d.status !== 'SIGNED' && (
                    <button onClick={() => {
                      const name = prompt('서명자 이름:')
                      if (name) handleSign(d.id, name)
                    }}
                      style={{ padding: '2px 8px', fontSize: '11px', border: 'none', borderRadius: 4, cursor: 'pointer', background: '#16a34a', color: '#fff' }}>
                      서명처리
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>안전문서 생성</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>문서 종류 *</label>
              <select value={form.documentType} onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }}>
                <option value="SAFETY_EDUCATION_NEW_HIRE">신규채용 안전보건교육 확인서</option>
                <option value="SAFETY_EDUCATION_TASK_CHANGE">작업변경 교육 확인서</option>
                <option value="PPE_PROVISION">보호구 지급 확인서</option>
                <option value="SAFETY_PLEDGE">안전수칙 준수 서약서</option>
                <option value="WORK_CONDITIONS_RECEIPT">근로조건설명 및 계약서수령 확인서</option>
                <option value="PRIVACY_CONSENT">개인정보수집·이용 동의서</option>
                <option value="BASIC_SAFETY_EDU_CONFIRM">건설업 기초안전보건교육 확인서</option>
                <option value="SITE_SAFETY_RULES_CONFIRM">현장 안전수칙 준수 확인서</option>
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>교육/문서 일자 *</label>
              <input type="date" value={form.educationDate}
                onChange={e => setForm(f => ({ ...f, educationDate: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
            </div>

            {(form.documentType === 'SAFETY_EDUCATION_NEW_HIRE' || form.documentType === 'SAFETY_EDUCATION_TASK_CHANGE') && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>교육 시간 (시간)</label>
                  <input type="number" value={form.educationHours} min={0.5} step={0.5}
                    onChange={e => setForm(f => ({ ...f, educationHours: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>교육 장소</label>
                  <input type="text" value={form.educationPlace}
                    onChange={e => setForm(f => ({ ...f, educationPlace: e.target.value }))}
                    placeholder="현장 사무소, 현장 내 교육장 등"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>교육 담당자</label>
                  <input type="text" value={form.educatorName}
                    onChange={e => setForm(f => ({ ...f, educatorName: e.target.value }))}
                    placeholder="현장소장, 안전관리자 등"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
              </>
            )}

            {form.documentType === 'PPE_PROVISION' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 8 }}>보호구 품목별 지급 현황</label>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: 8 }}>지급한 품목에 체크하고 수량·상태·설명 여부를 입력하세요.</div>
                {ppeItems.map((item, idx) => (
                  <div key={item.name} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 12px', marginBottom: 8, background: item.issued ? '#f0fdf4' : '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '13px', cursor: 'pointer', flex: 1 }}>
                        <input type="checkbox" checked={item.issued}
                          onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, issued: e.target.checked } : it))} />
                        {item.name}
                      </label>
                      {item.issued && (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>지급</span>
                      )}
                    </div>
                    {item.issued && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: 2 }}>수량</label>
                          <input type="number" min={1} value={item.qty}
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) } : it))}
                            style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '13px' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: 2 }}>상태</label>
                          <select value={item.condition}
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, condition: e.target.value } : it))}
                            style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '13px' }}>
                            <option value="신품">신품</option>
                            <option value="양호">양호</option>
                            <option value="재사용">재사용</option>
                            <option value="기타">기타</option>
                          </select>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={item.explanationGiven}
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, explanationGiven: e.target.checked } : it))} />
                          착용방법 설명 완료
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={item.needsReplacement}
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, needsReplacement: e.target.checked } : it))} />
                          교체 필요
                        </label>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: 2 }}>비고</label>
                          <input type="text" value={item.note} placeholder="규격, 특이사항 등"
                            onChange={e => setPpeItems(prev => prev.map((it, i) => i === idx ? { ...it, note: e.target.value } : it))}
                            style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '13px' }} />
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
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>근로일 *</label>
                  <input type="date" value={form.workDate}
                    onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>공종</label>
                  <input type="text" value={form.tradeType}
                    onChange={e => setForm(f => ({ ...f, tradeType: e.target.value }))}
                    placeholder="예: 전기, 소방기계"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>직종</label>
                  <input type="text" value={form.jobType}
                    onChange={e => setForm(f => ({ ...f, jobType: e.target.value }))}
                    placeholder="예: 전공, 보통인부"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>현장관리자명</label>
                  <input type="text" value={form.managerName}
                    onChange={e => setForm(f => ({ ...f, managerName: e.target.value }))}
                    placeholder="현장소장, 관리자명"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
              </>
            )}

            {/* 기초안전보건교육 확인서 */}
            {form.documentType === 'BASIC_SAFETY_EDU_CONFIRM' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>근로일 *</label>
                  <input type="date" value={form.workDate}
                    onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.eduCompletedYn}
                      onChange={e => setForm(f => ({ ...f, eduCompletedYn: e.target.checked }))} />
                    기초안전보건교육 이수 완료
                  </label>
                </div>
                {form.eduCompletedYn && (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>이수일</label>
                      <input type="date" value={form.eduCompletedDate}
                        onChange={e => setForm(f => ({ ...f, eduCompletedDate: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>교육기관명</label>
                      <input type="text" value={form.eduOrganization}
                        onChange={e => setForm(f => ({ ...f, eduOrganization: e.target.value }))}
                        placeholder="교육기관명"
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                    </div>
                  </>
                )}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.eduCertConfirmedYn}
                      onChange={e => setForm(f => ({ ...f, eduCertConfirmedYn: e.target.checked }))} />
                    이수증 원본 확인 완료
                  </label>
                </div>
                {form.eduCertConfirmedYn && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>확인일</label>
                    <input type="date" value={form.eduCertConfirmedDate}
                      onChange={e => setForm(f => ({ ...f, eduCertConfirmedDate: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>확인자 (현장관리자)</label>
                  <input type="text" value={form.confirmerName}
                    onChange={e => setForm(f => ({ ...f, confirmerName: e.target.value }))}
                    placeholder="확인자 성명"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
              </>
            )}

            {/* 현장 안전수칙 준수 확인서 */}
            {form.documentType === 'SITE_SAFETY_RULES_CONFIRM' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>근로일 *</label>
                  <input type="date" value={form.workDate}
                    onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>특이 안전수칙 (선택)</label>
                  <textarea value={form.specialSafetyRules}
                    onChange={e => setForm(f => ({ ...f, specialSafetyRules: e.target.value }))}
                    rows={2} placeholder="현장 특이 안전수칙이 있으면 입력"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px', resize: 'none' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>관리자 성명</label>
                  <input type="text" value={form.confirmerName}
                    onChange={e => setForm(f => ({ ...f, confirmerName: e.target.value }))}
                    placeholder="관리자 성명"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 6, background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {submitting ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 700, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>{SAFETY_DOC_LABELS[previewDoc.documentType] || previewDoc.documentType}</h3>
              <button onClick={() => setPreviewDoc(null)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', background: '#f8f9fa', padding: 16, borderRadius: 6, lineHeight: 1.7 }}>
              {previewDoc.contentText || '내용 없음'}
            </pre>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => {
                const blob = new Blob([previewDoc.contentText || ''], { type: 'text/plain;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${SAFETY_DOC_LABELS[previewDoc.documentType]}.txt`
                a.click()
                URL.revokeObjectURL(url)
              }}
                style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '13px' }}>
                다운로드
              </button>
              <button onClick={() => setPreviewDoc(null)}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: '13px' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
