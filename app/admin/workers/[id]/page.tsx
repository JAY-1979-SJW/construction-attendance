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
  bankName?: string | null
  bankAccount?: string | null
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

type Tab = 'info' | 'company' | 'site' | 'insurance'

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
          {([['info', '기본정보'], ['company', '회사배정'], ['site', '현장배정'], ['insurance', '보험상태']] as [Tab, string][]).map(([key, label]) => (
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
    ['은행', worker.bankName ? `${worker.bankName} / ${worker.bankAccount ?? '—'}` : '—'],
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
