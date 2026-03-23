'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ADMIN_TYPE_GUIDES,
  ADMIN_TYPE_WARNINGS,
  detectWorkerContractMismatch,
} from '@/lib/policies/worker-type-ui-policy'
import { getDocumentSet } from '@/lib/policies/document-set-policy'
import { validateForGenerate, STAGE_LABELS, type ValidationError } from '@/lib/policies/contract-save-policy'
import FaqChatWidget from '@/components/labor-faq/FaqChatWidget'

// ─── 계약 유형 분류 ───────────────────────────────────────────

type LaborRelationType = 'DIRECT_EMPLOYEE' | 'SUBCONTRACT_BIZ' | 'TEAM_NONBIZ_REVIEW'

const LABOR_RELATION_OPTIONS: { value: LaborRelationType; label: string; desc: string; color: string }[] = [
  {
    value: 'DIRECT_EMPLOYEE',
    label: '직접고용',
    desc: '회사가 출퇴근·공수·급여를 직접 관리하는 근로자',
    color: 'border-blue-500 bg-blue-50',
  },
  {
    value: 'SUBCONTRACT_BIZ',
    label: '외주팀 (사업자 있음)',
    desc: '사업자등록이 있는 외주업체·팀. 공정·성과 기준 정산.',
    color: 'border-green-500 bg-green-50',
  },
  {
    value: 'TEAM_NONBIZ_REVIEW',
    label: '팀장형 (사업자 없음) ⚠',
    desc: '사업자 없는 팀장·조장. 검토 필요 상태로 등록됩니다.',
    color: 'border-amber-500 bg-amber-50',
  },
]

const TEMPLATE_BY_RELATION: Record<LaborRelationType, { value: string; label: string }[]> = {
  DIRECT_EMPLOYEE: [
    { value: 'DAILY_EMPLOYMENT',           label: '건설 일용근로자 근로계약서 (기본)' },
    { value: 'REGULAR_EMPLOYMENT',         label: '상용직 근로계약서' },
    { value: 'FIXED_TERM_EMPLOYMENT',      label: '기간제 근로계약서' },
    { value: 'OFFICE_SERVICE',             label: '사무보조 용역계약서' },
    // 관리자 전용 (운영 정책상 기본 숨김)
    { value: 'MONTHLY_FIXED_EMPLOYMENT',   label: '[관리자] 월단위 기간제 근로계약서' },
    { value: 'CONTINUOUS_EMPLOYMENT',      label: '[관리자] 계속근로형 근로계약서' },
  ],
  SUBCONTRACT_BIZ: [
    { value: 'SUBCONTRACT_WITH_BIZ', label: '도급·용역계약서 (사업자 있음)' },
    { value: 'FREELANCER_SERVICE',   label: '프리랜서 용역계약서' },
  ],
  TEAM_NONBIZ_REVIEW: [
    { value: 'NONBUSINESS_TEAM_REVIEW', label: '팀장 책임확인서 세트 (검토 필요)' },
  ],
}

const CONTRACT_KIND_BY_TEMPLATE: Record<string, string> = {
  DAILY_EMPLOYMENT:          'EMPLOYMENT',
  MONTHLY_FIXED_EMPLOYMENT:  'EMPLOYMENT',
  CONTINUOUS_EMPLOYMENT:     'EMPLOYMENT',
  REGULAR_EMPLOYMENT:        'EMPLOYMENT',
  FIXED_TERM_EMPLOYMENT:     'EMPLOYMENT',
  OFFICE_SERVICE:            'SERVICE',
  SUBCONTRACT_WITH_BIZ:      'OUTSOURCING',
  FREELANCER_SERVICE:        'SERVICE',
  NONBUSINESS_TEAM_REVIEW:   'OUTSOURCING',
}

// 공종 드롭다운
const WORK_TYPE_OPTIONS = [
  '전기', '소방전기', '소방기계', '기계설비', '통신', '토목', '조경', '기타',
]

// 직종 드롭다운
const JOB_CATEGORY_OPTIONS = [
  '보통인부', '특별인부', '조공', '전공', '기능공', '기사반장', '기타',
]

interface Worker { id: string; name: string; phone: string; jobTitle: string; birthDate?: string; employmentType?: string; bankAccountSecure?: { bankName: string | null; accountNumberMasked: string | null } | null }
interface Site   { id: string; name: string; address?: string }
interface CompanyOpt { id: string; companyName: string; representativeName?: string | null; businessNumber?: string | null; address?: string | null; contactPhone?: string | null }

// ─── 차단 규칙 ────────────────────────────────────────────────
function getBlockReason(
  relation: LaborRelationType,
  form: {
    attendanceControlledByCompany: boolean
    payDecidedByCompany: boolean
    directPaymentByCompany: boolean
    businessRegistrationNo: string
  }
): string | null {
  if (relation === 'TEAM_NONBIZ_REVIEW') {
    if (form.attendanceControlledByCompany)
      return '회사가 개인별 출퇴근을 직접 관리하는 경우 외주팀 계약을 사용할 수 없습니다. 직접고용(일용직 근로계약서)으로 처리하세요.'
    if (form.payDecidedByCompany)
      return '회사가 개인별 금액을 직접 결정하는 경우 외주팀 계약을 사용할 수 없습니다. 직접고용으로 전환하세요.'
    if (form.directPaymentByCompany)
      return '회사가 개인에게 직접 지급하는 경우 외주팀 계약을 사용할 수 없습니다. 직접고용으로 전환하세요.'
  }
  if (relation === 'SUBCONTRACT_BIZ' && !form.businessRegistrationNo.trim()) {
    return '사업자 있는 외주팀은 사업자등록번호를 반드시 입력해야 합니다.'
  }
  return null
}

function getAutoReviewFlags(
  relation: LaborRelationType,
  form: {
    attendanceControlledByCompany: boolean
    payDecidedByCompany: boolean
    directPaymentByCompany: boolean
    businessRegistrationNo: string
  }
): string[] {
  const flags: string[] = []
  if (relation === 'TEAM_NONBIZ_REVIEW') {
    flags.push('NO_BUSINESS_REGISTRATION')
    flags.push('REVIEW_REQUIRED')
    if (form.attendanceControlledByCompany || form.payDecidedByCompany || form.directPaymentByCompany) {
      flags.push('DIRECT_EMPLOYMENT_RECOMMENDED')
    }
  }
  if (relation === 'SUBCONTRACT_BIZ' && !form.businessRegistrationNo.trim()) {
    flags.push('NO_BUSINESS_REGISTRATION')
  }
  return flags
}

// ─── 메인 페이지 ──────────────────────────────────────────────

export default function NewContractPageWrapper() {
  return <Suspense><NewContractPage /></Suspense>
}

function NewContractPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const preWorkerId  = searchParams.get('workerId') || ''

  const [workers, setWorkers]   = useState<Worker[]>([])
  const [sites, setSites]       = useState<Site[]>([])
  const [companies, setCompanies] = useState<CompanyOpt[]>([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [showGuide, setShowGuide] = useState(true)
  const [pendingTypeChange, setPendingTypeChange] = useState<{ laborRelation: string; templateType: string; label: string } | null>(null)
  const [showFaqChat, setShowFaqChat] = useState(false)

  // 계약 유형 분류
  const [laborRelation, setLaborRelation] = useState<LaborRelationType>('DIRECT_EMPLOYEE')

  // 외주 차단 체크
  const [biz, setBiz] = useState({
    attendanceControlledByCompany: false,
    payDecidedByCompany:           false,
    directPaymentByCompany:        false,
    businessRegistrationNo:        '',
    contractorName:                '',
  })

  const [form, setForm] = useState({
    // 회사 정보 (스냅샷)
    companyName:          '',
    companyPhone:         '',
    companyBizNo:         '',
    companyAddress:       '',
    companyRepName:       '',
    // 근로자
    workerId:             preWorkerId,
    workerBirthDate:      '',
    workerBankName:       '',
    workerAccountNumber:  '',
    workerAccountHolder:  '',
    // 현장
    siteId:               '',
    // 계약
    contractKind:         'EMPLOYMENT',
    contractTemplateType: 'DAILY_EMPLOYMENT',
    workDate:             '',
    startDate:            '',
    endDate:              '',
    checkInTime:          '08:00',
    checkOutTime:         '17:00',
    breakStartTime:       '12:00',
    breakEndTime:         '13:00',
    workDays:             '현장 여건에 따름',
    paymentMethod:        '계좌이체',
    dailyWage:            '',
    monthlySalary:        '',
    serviceFee:           '',
    paymentDay:           '',
    standardWorkHours:    '8',
    breakHours:           '1',
    weeklyWorkDays:       '',
    weeklyWorkHours:      '',
    safetyClauseYn:       true,
    nationalPensionYn:    false,
    healthInsuranceYn:    false,
    employmentInsuranceYn: false,
    industrialAccidentYn: true,
    retirementMutualYn:   false,
    specialTerms:         '',
    notes:                '',
    // v3.4
    projectName:          '',
    workType:             '',
    workTypeSub:          '',
    jobCategory:          '',
    jobCategorySub:       '',
    contractForm:         'MONTHLY_FIXED',
    taskDescription:      '',
    // v3.5
    siteAddress:          '',
    attendanceVerificationMethod: 'GPS앱',
    workUnitRule:         '1일 출근 시 1공수로 인정하며, 오전 또는 오후 반일 출근 시 0.5공수로 인정한다.',
    rainDayRule:          '기상청 강수 예보 또는 현장소장 판단에 따라 작업 중단 시, 당일 실근로에 비례하여 공수를 인정한다.',
    // 상용직 전용
    probationYn:          false,
    probationMonths:      '',
    annualLeaveRule:      '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/workers?pageSize=200').then(r => r.json()),
      fetch('/api/admin/sites').then(r => r.json()),
      fetch('/api/admin/companies?pageSize=100').then(r => r.json()),
    ]).then(([w, s, c]) => {
      if (w.success) setWorkers(w.data?.items || w.data || [])
      if (s.success) setSites(s.data?.items || s.data || [])
      if (c.success) setCompanies(c.data?.items || c.data || [])
    })
  }, [])

  // 회사 선택 → 회사 정보 자동 채움
  function handleCompanyChange(companyId: string) {
    setSelectedCompanyId(companyId)
    const co = companies.find(c => c.id === companyId)
    if (co) {
      setForm(f => ({
        ...f,
        companyName:    co.companyName,
        companyPhone:   co.contactPhone || '',
        companyBizNo:   co.businessNumber || f.companyBizNo,
        companyAddress: co.address || f.companyAddress,
        companyRepName: co.representativeName || f.companyRepName,
      }))
    }
  }

  // 근로자 선택 → 근로자 정보 자동 채움
  function handleWorkerChange(workerId: string) {
    set('workerId', workerId)
    const w = workers.find(w => w.id === workerId)
    if (w) {
      setForm(f => ({
        ...f,
        workerId,
        workerBirthDate: w.birthDate || '',
        workerBankName:  w.bankAccountSecure?.bankName || '',
        workerAccountNumber: w.bankAccountSecure?.accountNumberMasked || '',
        workerAccountHolder: w.name,
      }))
    }
  }

  // 현장 선택 → 현장 주소 자동 채움
  function handleSiteChange(siteId: string) {
    set('siteId', siteId)
    const s = sites.find(s => s.id === siteId)
    if (s?.address) set('siteAddress', s.address)
  }

  // 유형 변경 시 template 자동 선택
  function handleRelationChange(rel: LaborRelationType) {
    setLaborRelation(rel)
    const templates = TEMPLATE_BY_RELATION[rel] || []
    const tmpl = templates[0]?.value || ''
    setForm(f => ({
      ...f,
      contractTemplateType: tmpl,
      contractKind: CONTRACT_KIND_BY_TEMPLATE[tmpl] || 'EMPLOYMENT',
      nationalPensionYn: false,
      healthInsuranceYn: false,
      employmentInsuranceYn: rel === 'DIRECT_EMPLOYEE',
      industrialAccidentYn: true,
    }))
  }

  function handleTemplateChange(tmpl: string) {
    const isRegular = ['REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT'].includes(tmpl)
    setForm(f => ({
      ...f,
      contractTemplateType: tmpl,
      contractKind: CONTRACT_KIND_BY_TEMPLATE[tmpl] || f.contractKind,
      // 상용직 선택 시 4대보험 전체 ON 자동 설정
      ...(isRegular ? {
        nationalPensionYn:     true,
        healthInsuranceYn:     true,
        employmentInsuranceYn: true,
        industrialAccidentYn:  true,
      } : {}),
    }))
  }

  function handleAdminTypeSelect(guide: { contractMapping: { laborRelation: string; templateType: string }; label: string }) {
    const m = guide.contractMapping
    const hasData = !!(form.workerId || form.startDate || form.dailyWage || form.monthlySalary || form.serviceFee)
    const isSameType = laborRelation === m.laborRelation && form.contractTemplateType === m.templateType
    if (hasData && !isSameType) {
      setPendingTypeChange({ laborRelation: m.laborRelation, templateType: m.templateType, label: guide.label })
    } else {
      handleRelationChange(m.laborRelation as LaborRelationType)
      handleTemplateChange(m.templateType)
      setShowGuide(false)
    }
  }

  const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }))

  // 실근로시간 자동계산
  const actualWorkHours = useMemo(() => {
    if (!form.checkInTime || !form.checkOutTime) return parseFloat(form.standardWorkHours) || 8
    const [inH, inM] = form.checkInTime.split(':').map(Number)
    const [outH, outM] = form.checkOutTime.split(':').map(Number)
    const totalMin = (outH * 60 + outM) - (inH * 60 + inM)
    const breakMin = parseFloat(form.breakHours) * 60 || 60
    return Math.max(0, (totalMin - breakMin) / 60)
  }, [form.checkInTime, form.checkOutTime, form.breakHours, form.standardWorkHours])

  // 반공수/시간 자동계산
  const halfDayWage = form.dailyWage ? Math.floor(parseInt(form.dailyWage) * 0.5) : 0
  const hourlyRef   = form.dailyWage && actualWorkHours > 0
    ? Math.floor(parseInt(form.dailyWage) / actualWorkHours)
    : 0

  // 휴게 시간(시간) 자동계산 from breakStartTime/breakEndTime
  useEffect(() => {
    if (!form.breakStartTime || !form.breakEndTime) return
    const [sh, sm] = form.breakStartTime.split(':').map(Number)
    const [eh, em] = form.breakEndTime.split(':').map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins > 0) set('breakHours', String(mins / 60))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.breakStartTime, form.breakEndTime])

  const blockReason = getBlockReason(laborRelation, biz)
  const reviewFlags = getAutoReviewFlags(laborRelation, biz)

  const isDirectEmployment = laborRelation === 'DIRECT_EMPLOYEE'
  const isSubcontractBiz   = laborRelation === 'SUBCONTRACT_BIZ'
  const isTeamReview       = laborRelation === 'TEAM_NONBIZ_REVIEW'
  const isEmployment       = form.contractKind === 'EMPLOYMENT'
  const isDailyType    = ['DAILY_EMPLOYMENT', 'MONTHLY_FIXED_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT'].includes(form.contractTemplateType)
  const isRegularType  = ['REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT'].includes(form.contractTemplateType)

  async function handleSave() {
    setError('')
    if (blockReason) { setError(blockReason); return }

    // 3단계 저장 검증 (document-set + type 기반)
    const genErrors = validateForGenerate({
      laborRelation:           laborRelation,
      contractTemplateType:    form.contractTemplateType,
      workerId:                form.workerId,
      startDate:               form.startDate,
      endDate:                 form.endDate,
      dailyWage:               form.dailyWage,
      monthlySalary:           form.monthlySalary,
      serviceFee:              form.serviceFee,
      checkInTime:             form.checkInTime,
      checkOutTime:            form.checkOutTime,
      businessRegistrationNo:  biz.businessRegistrationNo,
      contractorName:          biz.contractorName,
      workerViewConfirmed:     false,
      workerPresignConfirmed:  false,
    })
    const blockingErrors = genErrors.filter((e: ValidationError) => e.blocking)
    if (blockingErrors.length > 0) {
      setError(blockingErrors.map((e: ValidationError) => e.message).join('\n'))
      return
    }

    setSaving(true)
    const payload = {
      workerId:             form.workerId,
      siteId:               form.siteId || null,
      contractKind:         form.contractKind,
      contractTemplateType: form.contractTemplateType,
      startDate:            form.startDate,
      endDate:              form.endDate || null,
      checkInTime:          form.checkInTime || null,
      checkOutTime:         form.checkOutTime || null,
      breakStartTime:       form.breakStartTime || null,
      breakEndTime:         form.breakEndTime || null,
      workDays:             form.workDays || null,
      paymentMethod:        form.paymentMethod || null,
      dailyWage:            parseInt(form.dailyWage)         || 0,
      monthlySalary:        parseInt(form.monthlySalary)     || null,
      serviceFee:           parseInt(form.serviceFee)        || null,
      paymentDay:           parseInt(form.paymentDay)        || null,
      standardWorkHours:    parseFloat(form.standardWorkHours) || null,
      breakHours:           parseFloat(form.breakHours)        || null,
      weeklyWorkDays:       parseInt(form.weeklyWorkDays)    || null,
      weeklyWorkHours:      parseFloat(form.weeklyWorkHours) || null,
      safetyClauseYn:       form.safetyClauseYn,
      nationalPensionYn:    form.nationalPensionYn,
      healthInsuranceYn:    form.healthInsuranceYn,
      employmentInsuranceYn: form.employmentInsuranceYn,
      industrialAccidentYn: form.industrialAccidentYn,
      retirementMutualYn:   form.retirementMutualYn,
      specialTerms:         form.specialTerms || null,
      notes:                form.notes || null,
      laborRelationType:    laborRelation,
      companyBizNo:         form.companyBizNo || null,
      companyAddress:       form.companyAddress || null,
      companyRepName:       form.companyRepName || null,
      businessRegistrationNo: biz.businessRegistrationNo || null,
      contractorName:       biz.contractorName || null,
      attendanceControlledByCompany: biz.attendanceControlledByCompany,
      payDecidedByCompany:  biz.payDecidedByCompany,
      directPaymentByCompany: biz.directPaymentByCompany,
      reviewFlags:          reviewFlags.join(',') || null,
      // v3.4
      projectName:          form.projectName || null,
      workType:             form.workType || null,
      workTypeSub:          form.workTypeSub || null,
      jobCategory:          form.jobCategory || null,
      jobCategorySub:       form.jobCategorySub || null,
      contractForm:         form.contractForm || null,
      taskDescription:      form.taskDescription || null,
      // v3.5
      siteAddress:          form.siteAddress || null,
      attendanceVerificationMethod: form.attendanceVerificationMethod || null,
      workUnitRule:         form.workUnitRule || null,
      rainDayRule:          form.rainDayRule || null,
      // v3.6
      companyName:          form.companyName || null,
      companyPhone:         form.companyPhone || null,
      workDate:             form.workDate || null,
      workerBirthDate:      form.workerBirthDate || null,
      workerBankName:       form.workerBankName || null,
      workerAccountNumber:  form.workerAccountNumber || null,
      workerAccountHolder:  form.workerAccountHolder || null,
      // 상용직 전용
      probationYn:          form.probationYn,
      probationMonths:      parseInt(form.probationMonths) || null,
      annualLeaveRule:      form.annualLeaveRule || null,
    }

    const res  = await fetch('/api/admin/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)
    if (json.success) {
      router.push(`/admin/contracts/${json.data.id}`)
    } else {
      setError(json.error || '저장 실패')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">← 뒤로</button>
        <h1 className="text-2xl font-bold">신규 계약 등록</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm whitespace-pre-wrap">{error}</div>
      )}

      {/* 계약 유형 변경 확인 다이얼로그 */}
      {pendingTypeChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-base text-gray-900 mb-2">계약 유형 변경</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-semibold text-orange-700">{pendingTypeChange.label}</span> 유형으로 변경하시겠습니까?
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-4">
              선택한 유형이 변경되면 일부 입력값이 초기화되거나 적용 기준이 달라질 수 있습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPendingTypeChange(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRelationChange(pendingTypeChange.laborRelation as LaborRelationType)
                  handleTemplateChange(pendingTypeChange.templateType)
                  setShowGuide(false)
                  setPendingTypeChange(null)
                }}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700"
              >
                변경하고 진행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 근로유형 / 계약유형 선택 안내 — 기본 노출 */}
      <div className="bg-white border-2 border-blue-200 rounded-lg overflow-hidden">
        {/* 헤더 (항상 표시) */}
        <div className="bg-blue-50 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-blue-900">근로유형 / 계약유형 선택 안내</h2>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              근로유형에 따라 계약서 종류, 입력 항목, 근태 기준, 정산 방식이 달라집니다.
              유형을 잘못 선택하면 문서·근태·정산 처리에 오류가 생길 수 있으므로, 아래 설명을 먼저 확인한 후 진행하세요.
            </p>
          </div>
          <button type="button" onClick={() => setShowGuide(v => !v)}
            className="shrink-0 text-xs text-blue-600 border border-blue-300 rounded px-3 py-1 hover:bg-blue-100">
            {showGuide ? '▲ 닫기' : '▼ 펼치기'}
          </button>
        </div>

        {showGuide && (
          <div className="p-5 space-y-5">
            {/* 비교표 */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {['유형', '이런 경우 선택', '계약 종료일', '근태/계산 기준', '생성 문서/처리'].map(h => (
                      <th key={h} className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ADMIN_TYPE_GUIDES.map(g => (
                    <tr key={g.code} className="align-top">
                      <td className="border border-gray-200 px-3 py-2 font-bold whitespace-nowrap" style={{ color: g.accentColor }}>{g.icon} {g.label}</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600">{g.tableRow.whenToSelect}</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600 whitespace-nowrap">{g.tableRow.endDateConcept}</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600">{g.tableRow.calcBasis}</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-600">{g.tableRow.documents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 오선택 방지 경고 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="text-xs font-bold text-amber-800 mb-2">⚠ 오선택 방지 — 반드시 확인하세요</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {ADMIN_TYPE_WARNINGS.map((w, i) => (
                  <div key={i} className="text-xs text-amber-700">• {w}</div>
                ))}
              </div>
            </div>

            {/* 유형별 카드 + 진행 버튼 */}
            {(() => {
              const selectedContractType = (() => {
                const matched = ADMIN_TYPE_GUIDES.find(g =>
                  g.contractMapping.laborRelation === laborRelation &&
                  g.contractMapping.templateType === form.contractTemplateType
                )
                return matched?.code ?? null
              })()
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ADMIN_TYPE_GUIDES.map(guide => {
                    const isSelected = guide.code === selectedContractType
                    return (
                      <div
                        key={guide.code}
                        className="border-2 rounded-lg p-4 flex flex-col cursor-pointer transition-all"
                        style={{
                          borderColor: isSelected ? guide.accentColor : guide.accentColor + '50',
                          background: isSelected ? guide.accentColor + '08' : undefined,
                        }}
                        onClick={() => handleAdminTypeSelect(guide)}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{guide.icon}</span>
                          <span className="font-bold text-sm" style={{ color: guide.accentColor }}>{guide.label}</span>
                          {isSelected && (
                            <span className="ml-auto text-xs font-bold rounded-full px-2 py-0.5" style={{ color: guide.accentColor, background: guide.accentColor + '18' }}>
                              ✓ 선택됨
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-3 leading-relaxed flex-grow">{guide.detail}</p>
                        <div className="text-xs text-gray-500 mb-3 space-y-1">
                          <div className="font-medium text-green-700">✅ 이 유형이 맞는 경우</div>
                          {guide.whenItFits.map((w, i) => <div key={i}>• {w}</div>)}
                        </div>
                        <div className="text-xs text-orange-700 bg-orange-50 rounded p-2 mb-3">⚠ {guide.caution}</div>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleAdminTypeSelect(guide) }}
                          className="w-full py-2 rounded text-sm font-bold transition-opacity hover:opacity-90"
                          style={{
                            background: isSelected ? guide.accentColor : 'white',
                            color: isSelected ? 'white' : guide.accentColor,
                            border: `1.5px solid ${guide.accentColor}`,
                          }}
                        >
                          {isSelected ? '✓ 선택됨 — 이 유형으로 진행' : guide.buttonLabel}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Step 1: 계약 유형 분류 */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">1단계: 계약 유형 분류</h2>
        <p className="text-xs text-gray-500">
          가장 중요한 첫 단계입니다. 실제 운영 구조에 맞는 유형을 선택하세요.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {LABOR_RELATION_OPTIONS.map(opt => (
            <label key={opt.value}
              className={`flex items-start gap-3 border-2 rounded-lg p-4 cursor-pointer transition-all
                ${laborRelation === opt.value ? opt.color + ' border-opacity-100' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="laborRelation" value={opt.value}
                checked={laborRelation === opt.value}
                onChange={() => handleRelationChange(opt.value)}
                className="mt-0.5" />
              <div>
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 외주팀 사업자 유무 체크 */}
      {(isSubcontractBiz || isTeamReview) && (
        <div className="bg-white border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">외주팀 분류 확인</h2>

          {isSubcontractBiz && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">사업자등록번호 *</label>
                <input type="text" value={biz.businessRegistrationNo}
                  onChange={e => setBiz(b => ({ ...b, businessRegistrationNo: e.target.value }))}
                  placeholder="000-00-00000"
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">수급인 상호</label>
                <input type="text" value={biz.contractorName}
                  onChange={e => setBiz(b => ({ ...b, contractorName: e.target.value }))}
                  placeholder="업체명 또는 팀명"
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          {isTeamReview && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-300 rounded p-3 text-amber-800 text-xs space-y-1">
                <div className="font-semibold">⚠ 아래 항목에 해당하면 직접고용으로 전환해야 합니다</div>
              </div>
              {[
                { key: 'attendanceControlledByCompany', label: '회사가 팀원 개인별 출퇴근을 직접 관리한다' },
                { key: 'payDecidedByCompany',           label: '회사가 팀원 개인별 일당·금액을 직접 결정한다' },
                { key: 'directPaymentByCompany',        label: '회사가 팀원 개인에게 직접 송금한다' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={(biz as Record<string, unknown>)[key] as boolean}
                    onChange={e => setBiz(b => ({ ...b, [key]: e.target.checked }))}
                    className="w-4 h-4" />
                  {label}
                </label>
              ))}
              {(biz.attendanceControlledByCompany || biz.payDecidedByCompany || biz.directPaymentByCompany) && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-xs font-medium">
                  ⛔ 직접고용 전환 필요 — 위 항목에 해당하면 일용직 근로계약서로 개별 등록하세요.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 생성 예정 문서 미리보기 */}
      {(() => {
        const docSet = getDocumentSet(laborRelation, form.contractTemplateType)
        if (!docSet) return null
        const genErrors = validateForGenerate({
          laborRelation, contractTemplateType: form.contractTemplateType,
          workerId: form.workerId, startDate: form.startDate, endDate: form.endDate,
          dailyWage: form.dailyWage, monthlySalary: form.monthlySalary, serviceFee: form.serviceFee,
          checkInTime: form.checkInTime, checkOutTime: form.checkOutTime,
          businessRegistrationNo: biz.businessRegistrationNo, contractorName: biz.contractorName,
          workerViewConfirmed: false, workerPresignConfirmed: false,
        })
        const blockingErrors = genErrors.filter((e: ValidationError) => e.blocking)
        const warnErrors     = genErrors.filter((e: ValidationError) => !e.blocking)
        const stageKey = blockingErrors.length > 0 ? 'SAVEABLE' : 'GENERATABLE'
        const stageInfo = STAGE_LABELS[stageKey]
        return (
          <div className="bg-white border rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">생성 예정 문서</h2>
              <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: stageInfo.color + '18', color: stageInfo.color }}>
                {stageInfo.label}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              현재 선택된 유형 <strong>{docSet.typeLabel}</strong> 으로 등록 시 아래 문서가 생성됩니다.
            </p>
            <ul className="space-y-1">
              {docSet.documents.map((doc, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={doc.required ? 'text-blue-600' : 'text-gray-400'}>
                    {doc.required ? '●' : '○'}
                  </span>
                  <span className={doc.required ? 'text-gray-800' : 'text-gray-400'}>
                    {doc.label}
                    {doc.required ? <span className="ml-1 text-xs text-blue-600 font-medium">필수</span> : null}
                    {doc.note ? <span className="ml-1 text-xs text-gray-400">({doc.note})</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {blockingErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
                {blockingErrors.map((e: ValidationError, i: number) => (
                  <div key={i} className="text-xs text-red-700">⛔ {e.message}</div>
                ))}
              </div>
            )}
            {warnErrors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
                {warnErrors.map((e: ValidationError, i: number) => (
                  <div key={i} className="text-xs text-amber-700">⚠ {e.message}</div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Step 2: 공사 및 직종 정보 (직접고용만) */}
      {isDirectEmployment && (
        <div className="bg-white border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">2단계: 공사 및 직종 정보</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">공사명</label>
              <input type="text" value={form.projectName} onChange={e => set('projectName', e.target.value)}
                placeholder="예: ○○빌딩 신축공사"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">공종</label>
              <select value={form.workType} onChange={e => set('workType', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="">선택</option>
                {WORK_TYPE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">세부공종</label>
              <input type="text" value={form.workTypeSub} onChange={e => set('workTypeSub', e.target.value)}
                placeholder="예: 동력반, 소화배관"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">직종</label>
              <select value={form.jobCategory} onChange={e => set('jobCategory', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="">선택</option>
                {JOB_CATEGORY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">세부직종</label>
              <input type="text" value={form.jobCategorySub} onChange={e => set('jobCategorySub', e.target.value)}
                placeholder="예: 전기기능사, 용접공"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">담당업무</label>
              <input type="text" value={form.taskDescription} onChange={e => set('taskDescription', e.target.value)}
                placeholder="예: 전기 배관 및 케이블 포설"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 계약서 기본 정보 */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">3단계: 기본 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">회사 (자동채움용)</label>
            <select value={selectedCompanyId} onChange={e => handleCompanyChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="">선택하면 회사 정보 자동 채움</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}{c.businessNumber ? ` (${c.businessNumber})` : ''}</option>
              ))}
            </select>
            {form.companyName && (
              <div className="mt-1 text-xs text-gray-500 bg-gray-50 rounded p-2">
                {form.companyName} · {form.companyRepName || '대표자미입력'} · {form.companyBizNo || '사업자번호미입력'}
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              {isSubcontractBiz || isTeamReview ? '팀장·담당자 *' : '근로자 *'}
            </label>
            <select value={form.workerId} onChange={e => handleWorkerChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="">선택</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name} — {w.jobTitle} ({w.phone})</option>
              ))}
            </select>
            {/* 근로자 등록 유형 vs 계약 템플릿 유형 불일치 경고 */}
            {form.workerId && (() => {
              const w = workers.find(w => w.id === form.workerId)
              if (!w?.employmentType) return null
              const msg = detectWorkerContractMismatch(w.employmentType, form.contractTemplateType)
              return msg ? (
                <div className="mt-1 bg-amber-50 border border-amber-300 rounded p-2 text-xs text-amber-800">
                  ⚠ {msg}
                </div>
              ) : null
            })()}
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">현장 (선택)</label>
            <select value={form.siteId} onChange={e => handleSiteChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="">현장 미지정</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.address ? ` — ${s.address}` : ''}</option>
              ))}
            </select>
          </div>

          {/* 근로일 (일용직 전용) */}
          {isDirectEmployment && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">근로일 (일용직: 해당 날짜)</label>
              <input type="date" value={form.workDate} onChange={e => set('workDate', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          )}

          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">계약서 유형 *</label>
            <select value={form.contractTemplateType} onChange={e => handleTemplateChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              {(TEMPLATE_BY_RELATION[laborRelation] || []).map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {/* 외주 선택 시 직접 근로계약 경고 */}
            {(isSubcontractBiz || isTeamReview) && form.contractKind === 'EMPLOYMENT' && (
              <div className="mt-1 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                ⛔ 외주/협력팀은 자사 직접 근로계약 대상이 아닙니다. 계약서 유형을 다시 확인하세요.
              </div>
            )}
          </div>

          {/* 계약형태 (월단위/계속근로 — 직접고용 일용직 계열만) */}
          {isDirectEmployment && isDailyType && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">계약형태</label>
              <div className="flex gap-4">
                {[
                  { value: 'MONTHLY_FIXED', label: '월단위 기간제' },
                  { value: 'CONTINUOUS',    label: '계속근로형' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="contractForm" value={opt.value}
                      checked={form.contractForm === opt.value}
                      onChange={() => set('contractForm', opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">시작일 *</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className={`text-xs font-medium block mb-1 ${form.contractTemplateType === 'FIXED_TERM_EMPLOYMENT' ? 'text-orange-600 font-bold' : 'text-gray-600'}`}>
              종료일 {form.contractTemplateType === 'FIXED_TERM_EMPLOYMENT' ? '* (기간제 필수 입력)' : '(무기한이면 비워두기)'}
            </label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
              className={`w-full border rounded px-3 py-2 text-sm ${form.contractTemplateType === 'FIXED_TERM_EMPLOYMENT' && !form.endDate ? 'border-orange-400 ring-1 ring-orange-300' : ''}`} />
            {form.contractTemplateType === 'FIXED_TERM_EMPLOYMENT' && !form.endDate && (
              <div className="mt-1 text-xs text-orange-600">기간제는 계약 종료일 입력이 필요합니다.</div>
            )}
            {form.contractTemplateType === 'REGULAR_EMPLOYMENT' && form.endDate && (
              <div className="mt-1 text-xs text-amber-600">⚠ 상용직은 일반적으로 종료일이 없는 형태입니다. 입력값을 다시 확인하세요.</div>
            )}
          </div>
        </div>
      </div>

      {/* Step 4: 근무 조건 (직접고용만) */}
      {isDirectEmployment && (
        <div className="bg-white border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">4단계: 근무 조건</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">시업 시각</label>
              <input type="time" value={form.checkInTime} onChange={e => set('checkInTime', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">종업 시각</label>
              <input type="time" value={form.checkOutTime} onChange={e => set('checkOutTime', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">휴게 시작</label>
              <input type="time" value={form.breakStartTime} onChange={e => set('breakStartTime', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">휴게 종료</label>
              <input type="time" value={form.breakEndTime} onChange={e => set('breakEndTime', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">휴게시간 (시간)</label>
              <input type="number" step="0.5" value={form.breakHours} onChange={e => set('breakHours', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">소정근로시간 (일)</label>
              <input type="number" step="0.5" value={form.standardWorkHours} onChange={e => set('standardWorkHours', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">주 소정근로일 (일)</label>
              <input type="number" min="1" max="7" value={form.weeklyWorkDays} onChange={e => set('weeklyWorkDays', e.target.value)}
                placeholder="예: 5"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">주 소정근로시간 (시간)</label>
              <input type="number" step="0.5" value={form.weeklyWorkHours} onChange={e => set('weeklyWorkHours', e.target.value)}
                placeholder="예: 40"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">근무 요일</label>
              <input type="text" value={form.workDays} onChange={e => set('workDays', e.target.value)}
                placeholder="예: 월~금, 현장 여건에 따름"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">현장 주소</label>
              <input type="text" value={form.siteAddress} onChange={e => set('siteAddress', e.target.value)}
                placeholder="예: 서울특별시 강남구 ○○동 123"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">출퇴근 인증 방식</label>
              <select value={form.attendanceVerificationMethod} onChange={e => set('attendanceVerificationMethod', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="GPS앱">GPS 앱</option>
                <option value="관리자확인">관리자 확인</option>
                <option value="수기/기타">수기/기타</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">공수 산정 기준</label>
              <textarea value={form.workUnitRule} onChange={e => set('workUnitRule', e.target.value)}
                rows={2} className="w-full border rounded px-3 py-2 text-sm resize-none" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">우천·작업 중단 처리 기준</label>
              <textarea value={form.rainDayRule} onChange={e => set('rainDayRule', e.target.value)}
                rows={2} className="w-full border rounded px-3 py-2 text-sm resize-none" />
            </div>
          </div>
        </div>
      )}

      {/* Step 5: 금액 및 지급 조건 */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">5단계: 금액 및 지급 조건</h2>
        <div className="grid grid-cols-3 gap-4">
          {isDirectEmployment && isEmployment && (
            <>
              {/* 일용직: 일당 */}
              {isDailyType && (
                <div className="col-span-3">
                  <label className="text-xs font-medium text-gray-600 block mb-1">일당 (원) *</label>
                  <input type="number" value={form.dailyWage} onChange={e => set('dailyWage', e.target.value)}
                    placeholder="예: 250000"
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              )}
              {/* 일용직: 자동계산 참고값 */}
              {isDailyType && form.dailyWage && (
                <div className="col-span-3 bg-blue-50 border border-blue-100 rounded p-3 text-sm text-blue-800 grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-blue-500">반공수</div>
                    <div className="font-semibold">{halfDayWage.toLocaleString('ko-KR')}원</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-500">시간환산 (참고)</div>
                    <div className="font-semibold">{hourlyRef.toLocaleString('ko-KR')}원/h</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-500">실근로시간</div>
                    <div className="font-semibold">{actualWorkHours}h</div>
                  </div>
                </div>
              )}
              {/* 상용직: 기본급 */}
              {isRegularType && (
                <div className="col-span-3">
                  <label className="text-xs font-medium text-gray-600 block mb-1">기본급 (월, 원) *</label>
                  <input type="number" value={form.monthlySalary} onChange={e => set('monthlySalary', e.target.value)}
                    placeholder="예: 3000000"
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              )}
            </>
          )}
          {(!isDirectEmployment || !isEmployment) && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">계약 금액 (원) *</label>
              <input type="number" value={form.serviceFee} onChange={e => set('serviceFee', e.target.value)}
                placeholder="예: 2000000"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">지급일 (매월)</label>
            <input type="number" min="1" max="31" value={form.paymentDay} onChange={e => set('paymentDay', e.target.value)}
              placeholder="예: 25"
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">지급 방법</label>
            <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="계좌이체">계좌이체</option>
              <option value="현금">현금</option>
              <option value="기타">기타</option>
            </select>
          </div>
        </div>
      </div>

      {/* Step 6: 4대보험 */}
      <div className="bg-white border rounded-lg p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">6단계: 4대보험 적용</h2>
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-blue-800 text-xs">
          <strong>중요:</strong> 법정 가입요건에 해당하면 체크 여부와 무관하게 법령에 따라 처리됩니다.
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'nationalPensionYn',     label: '국민연금' },
            { key: 'healthInsuranceYn',     label: '건강보험' },
            { key: 'employmentInsuranceYn', label: '고용보험' },
            { key: 'industrialAccidentYn',  label: '산재보험' },
            { key: 'retirementMutualYn',    label: '건설업 퇴직공제' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox"
                checked={(form as Record<string, unknown>)[key] as boolean}
                onChange={e => set(key, e.target.checked)}
                className="w-4 h-4" />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Step 6.5: 상용직 전용 — 시용기간 및 연차 */}
      {isDirectEmployment && isRegularType && (
        <div className="bg-white border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">상용직 추가 조건</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.probationYn}
                  onChange={e => set('probationYn', e.target.checked)}
                  className="w-4 h-4" />
                <span className="text-sm font-medium">시용기간 적용</span>
              </label>
            </div>
            {form.probationYn && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">시용기간 (개월)</label>
                <input type="number" min="1" max="6" value={form.probationMonths}
                  onChange={e => set('probationMonths', e.target.value)}
                  placeholder="예: 3"
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">연차유급휴가 적용 방식</label>
              <select value={form.annualLeaveRule} onChange={e => set('annualLeaveRule', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="">선택 (미입력 시 근로기준법 기준 적용)</option>
                <option value="근로기준법 제60조에 따라 연차유급휴가를 부여한다.">근로기준법 제60조 기준</option>
                <option value="1년 미만 근로자는 매월 1일의 연차를 부여하며, 1년 이상 근로자는 근로기준법 제60조에 따른다.">1년 미만 월 1일 + 이후 법정기준</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 7: 안전보건 조항 */}
      <div className="bg-white border rounded-lg p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">7단계: 안전보건 조항</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.safetyClauseYn}
            onChange={e => set('safetyClauseYn', e.target.checked)}
            className="w-4 h-4" />
          <div>
            <div className="text-sm font-medium">안전보건 조항 포함 (권장)</div>
            <div className="text-xs text-gray-500">
              산업안전보건법상 의무사항을 계약서에 명시합니다.
            </div>
          </div>
        </label>
      </div>

      {/* Step 8: 특약사항 */}
      <div className="bg-white border rounded-lg p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">8단계: 특약사항 및 메모</h2>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">특약사항</label>
          <textarea value={form.specialTerms} onChange={e => set('specialTerms', e.target.value)}
            rows={3} placeholder="계약서에 포함할 특약사항을 입력하세요"
            className="w-full border rounded px-3 py-2 text-sm resize-none" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">내부 메모</label>
          <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="내부 메모 (계약서에 포함되지 않음)"
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {/* 검토 필요 경고 */}
      {reviewFlags.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded p-4 text-amber-800 text-sm">
          <div className="font-semibold mb-1">⚠ 저장 시 자동 플래그 적용</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {reviewFlags.includes('NO_BUSINESS_REGISTRATION') && <li>NO_BUSINESS_REGISTRATION — 사업자등록 없음</li>}
            {reviewFlags.includes('REVIEW_REQUIRED')          && <li>REVIEW_REQUIRED — 관리자 검토 필요</li>}
            {reviewFlags.includes('DIRECT_EMPLOYMENT_RECOMMENDED') && <li>DIRECT_EMPLOYMENT_RECOMMENDED — 직접고용 전환 권고</li>}
          </ul>
        </div>
      )}

      {/* 저장 버튼 */}
      <div className="flex justify-end gap-3">
        <button onClick={() => router.back()}
          className="px-5 py-2 border rounded text-gray-600 hover:bg-gray-50 text-sm">
          취소
        </button>
        <button onClick={handleSave} disabled={saving || !!blockReason}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {saving ? '저장 중...' : isTeamReview ? '검토 필요로 저장' : '계약 저장'}
        </button>
      </div>

      {/* FAQ 도우미 플로팅 버튼 */}
      <button
        onClick={() => setShowFaqChat(v => !v)}
        title="노동법 FAQ 도우미"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center text-xl"
      >
        ⚖️
      </button>

      {/* FAQ 챗 위젯 오버레이 */}
      {showFaqChat && (
        <div className="fixed bottom-24 right-6 z-50 w-96 shadow-2xl" style={{ height: '560px' }}>
          <FaqChatWidget
            contractType={form.contractTemplateType}
            page="contract-new"
            formContext={{
              hasEndDate:              !!form.endDate,
              isRepeatedRegistration:  false,
            }}
            onClose={() => setShowFaqChat(false)}
          />
        </div>
      )}
    </div>
  )
}
