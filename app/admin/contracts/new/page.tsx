'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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
    { value: 'DAILY_EMPLOYMENT',           label: '일용직 근로계약서' },
    { value: 'MONTHLY_FIXED_EMPLOYMENT',   label: '월단위 기간제 근로계약서' },
    { value: 'CONTINUOUS_EMPLOYMENT',      label: '계속근로형 근로계약서' },
    { value: 'REGULAR_EMPLOYMENT',         label: '상용직 근로계약서' },
    { value: 'FIXED_TERM_EMPLOYMENT',      label: '기간제 근로계약서' },
    { value: 'OFFICE_SERVICE',             label: '사무보조 용역계약서' },
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

interface Worker { id: string; name: string; phone: string; jobTitle: string }
interface Site   { id: string; name: string }

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

  const [workers, setWorkers] = useState<Worker[]>([])
  const [sites, setSites]     = useState<Site[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

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
    workerId:             preWorkerId,
    siteId:               '',
    contractKind:         'EMPLOYMENT',
    contractTemplateType: 'DAILY_EMPLOYMENT',
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
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/workers?pageSize=200').then(r => r.json()),
      fetch('/api/admin/sites').then(r => r.json()),
    ]).then(([w, s]) => {
      if (w.success) setWorkers(w.data?.items || w.data || [])
      if (s.success) setSites(s.data?.items || s.data || [])
    })
  }, [])

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
    setForm(f => ({
      ...f,
      contractTemplateType: tmpl,
      contractKind: CONTRACT_KIND_BY_TEMPLATE[tmpl] || f.contractKind,
    }))
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
  const isDailyType = ['DAILY_EMPLOYMENT', 'MONTHLY_FIXED_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT'].includes(form.contractTemplateType)

  async function handleSave() {
    setError('')
    if (blockReason) { setError(blockReason); return }
    if (!form.workerId || !form.startDate || !form.contractTemplateType) {
      setError('근로자, 시작일, 계약서 유형은 필수입니다.'); return
    }
    if (isDirectEmployment && isEmployment && !form.dailyWage && !form.monthlySalary) {
      setError('근로계약에는 일당 또는 월급을 입력하세요.'); return
    }
    if (!isDirectEmployment && !form.serviceFee && !form.dailyWage) {
      setError('외주/용역 계약에는 계약 금액을 입력하세요.'); return
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
            <label className="text-xs font-medium text-gray-600 block mb-1">
              {isSubcontractBiz || isTeamReview ? '팀장·담당자 *' : '근로자 *'}
            </label>
            <select value={form.workerId} onChange={e => set('workerId', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="">선택</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name} — {w.jobTitle} ({w.phone})</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">현장 (선택)</label>
            <select value={form.siteId} onChange={e => set('siteId', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="">현장 미지정</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">계약서 유형 *</label>
            <select value={form.contractTemplateType} onChange={e => handleTemplateChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              {(TEMPLATE_BY_RELATION[laborRelation] || []).map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
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
            <label className="text-xs font-medium text-gray-600 block mb-1">종료일 (무기한이면 비워두기)</label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" />
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
              <div className="col-span-3">
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {isDailyType ? '일당 (원) *' : '월급 (원) *'}
                </label>
                <input type="number" value={form.dailyWage} onChange={e => set('dailyWage', e.target.value)}
                  placeholder="예: 250000"
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              {/* 자동계산 참고값 */}
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
              {(!isDailyType) && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">월급 (기본급, 원)</label>
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
    </div>
  )
}
