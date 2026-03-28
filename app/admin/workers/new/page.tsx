'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageShell, SectionCard, PageHeader,
  FormInput, FormSelect, FormGrid,
  Btn, Toast,
} from '@/components/admin/ui'

// ── 고용형태 옵션 ───────────────────────────────────────────────────────────
// 현재는 단일 필드로 운영하되, 추후 근로형태/계약구분/운영분류로 분리 가능하도록
// 라벨과 값을 분리 관리한다.
const EMP_OPTIONS: { value: string; label: string; category: string }[] = [
  // category: 향후 분류 분리용 (labor=근로형태, contract=계약구분, ops=운영분류)
  { value: 'DAILY_CONSTRUCTION', label: '건설일용',   category: 'labor' },
  { value: 'REGULAR',            label: '상용직',     category: 'labor' },
  { value: 'FIXED_TERM',         label: '기간제',     category: 'contract' },
  { value: 'CONTINUOUS_SITE',    label: '계속근로형', category: 'ops' },
  { value: 'BUSINESS_33',        label: '3.3%',       category: 'contract' },
  { value: 'OTHER',              label: '기타',       category: 'labor' },
]

const ORG_OPTIONS = [
  { value: 'DIRECT',        label: '직영' },
  { value: 'DAILY_WORKER',  label: '일용직' },
  { value: 'OUTSOURCED',    label: '외주팀' },
  { value: 'SUBCONTRACTOR', label: '협력업체' },
]

const JOB_PRESETS = [
  '보통인부', '특별인부', '조공', '전공', '기능공', '기사반장',
  '철근공', '형틀목공', '콘크리트공', '방수공', '도장공', '타일공',
  '전기공', '설비공', '용접공', '비계공', '기타',
]

// ── 필수서류 안내 ───────────────────────────────────────────────────────────
const DOC_GUIDE: { name: string; rule: string; timing: 'immediate' | 'before_site' | 'optional' }[] = [
  { name: '개인정보 동의서',      rule: '회사 필수',   timing: 'immediate' },
  { name: '안전교육 확인서',      rule: '회사 필수',   timing: 'immediate' },
  { name: '근로계약서',           rule: '현장 조건부', timing: 'before_site' },
  { name: '건강 각서 또는 건강 진단서', rule: '현장 조건부', timing: 'before_site' },
  { name: '현장 안전수칙 확인서', rule: '현장 조건부', timing: 'before_site' },
  { name: '신분증 사본',         rule: '선택',       timing: 'optional' },
  { name: '보험 증빙',           rule: '선택',       timing: 'optional' },
]

const TIMING_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  immediate:   { label: '즉시 필요',        color: '#DC2626', bg: '#FEF2F2' },
  before_site: { label: '현장 배정 전 필요', color: '#D97706', bg: '#FFFBEB' },
  optional:    { label: '선택 제출',        color: '#6B7280', bg: '#F9FAFB' },
}

// ── 폼 타입 ─────────────────────────────────────────────────────────────────
interface WorkerForm {
  name: string
  phone: string
  birthDate: string
  jobTitle: string
  jobTitleCustom: string
  employmentType: string
  organizationType: string
  subcontractorName: string
  foreignerYn: boolean
  address: string
}

const EMPTY_FORM: WorkerForm = {
  name: '',
  phone: '',
  birthDate: '',
  jobTitle: '',
  jobTitleCustom: '',
  employmentType: 'DAILY_CONSTRUCTION',
  organizationType: 'DIRECT',
  subcontractorName: '',
  foreignerYn: false,
  address: '',
}

// ── 전화번호 포맷 ───────────────────────────────────────────────────────────
function fmtPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

function stripPhone(display: string): string {
  return display.replace(/\D/g, '').slice(0, 11)
}

// ── birthDate 유효성 검사 ───────────────────────────────────────────────────
function validateBirthDate(s: string): string | null {
  if (!s) return null
  if (!/^\d{8}$/.test(s)) return 'YYYYMMDD 8자리 숫자를 입력하세요.'
  const y = parseInt(s.slice(0, 4), 10)
  const m = parseInt(s.slice(4, 6), 10)
  const d = parseInt(s.slice(6, 8), 10)
  const now = new Date()
  if (y < 1930 || y > now.getFullYear()) return `연도 범위: 1930~${now.getFullYear()}`
  if (m < 1 || m > 12) return '월 범위: 01~12'
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return '존재하지 않는 날짜'
  if (date > now) return '미래 날짜 불가'
  return null
}

// ── 유효성 검사 ─────────────────────────────────────────────────────────────
function validate(form: WorkerForm): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!form.name.trim()) errs.name = '이름은 필수입니다.'
  const phone = stripPhone(form.phone)
  if (!/^010\d{8}$/.test(phone)) errs.phone = '010으로 시작하는 11자리 번호를 입력하세요.'
  const birthErr = validateBirthDate(form.birthDate)
  if (birthErr) errs.birthDate = birthErr
  const jt = form.jobTitle === '기타' ? form.jobTitleCustom : form.jobTitle
  if (!jt.trim()) errs.jobTitle = '직종은 필수입니다.'
  if (form.organizationType === 'SUBCONTRACTOR' && !form.subcontractorName.trim()) {
    errs.subcontractorName = '협력사/외주팀명을 입력하세요.'
  }
  return errs
}

// ── 페이지 ──────────────────────────────────────────────────────────────────
export default function WorkersNewPage() {
  const router = useRouter()
  const [form, setForm] = useState<WorkerForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [dupWarnings, setDupWarnings] = useState<string[]>([])

  const set = <K extends keyof WorkerForm>(key: K, val: WorkerForm[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  // ── 중복 검사 (디바운스) ───────────────────────────────────────────────
  const checkDuplicate = useCallback(async (phone: string, name: string, birthDate: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 11 && !name) return
    const params = new URLSearchParams()
    if (digits) params.set('phone', digits)
    if (name) params.set('name', name)
    if (birthDate) params.set('birthDate', birthDate)
    try {
      const res = await fetch(`/api/admin/workers/check-duplicate?${params}`)
      const data = await res.json()
      if (data.success) setDupWarnings(data.data.warnings)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      checkDuplicate(form.phone, form.name, form.birthDate)
    }, 500)
    return () => clearTimeout(timer)
  }, [form.phone, form.name, form.birthDate, checkDuplicate])

  // ── 저장 ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const jobTitle = form.jobTitle === '기타' ? form.jobTitleCustom : form.jobTitle
      const phone = stripPhone(form.phone)
      const res = await fetch('/api/admin/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone,
          jobTitle: jobTitle.trim(),
          employmentType: form.employmentType,
          organizationType: form.organizationType,
          foreignerYn: form.foreignerYn,
          birthDate: form.birthDate || undefined,
          subcontractorName: form.organizationType === 'SUBCONTRACTOR' ? form.subcontractorName.trim() : undefined,
          address: form.address.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setToast({ ok: false, msg: data.message || '등록 실패' })
        setSaving(false)
        return
      }
      // 중복 경고가 있으면 토스트로 표시 후 이동
      if (data.data.duplicateWarning) {
        setToast({ ok: true, msg: `등록 성공 (경고: ${data.data.duplicateWarning})` })
        setTimeout(() => router.push(`/admin/workers/${data.data.id}`), 1500)
      } else {
        router.push(`/admin/workers/${data.data.id}`)
      }
    } catch {
      setToast({ ok: false, msg: '네트워크 오류' })
      setSaving(false)
    }
  }

  const isSubcontractor = form.organizationType === 'SUBCONTRACTOR'
  const canSubmit = form.name && stripPhone(form.phone).length === 11 && (form.jobTitle === '기타' ? form.jobTitleCustom : form.jobTitle)

  return (
    <PageShell>
      <PageHeader title="근로자 등록" description="신규 근로자를 직접 등록합니다. 등록 후 서류 제출 및 현장 배정을 진행합니다." />

      {toast && (
        <div className="mb-4">
          <Toast message={toast.msg} variant={toast.ok ? 'success' : 'error'} />
        </div>
      )}

      {/* ── 중복 경고 ───────────────────────────────────────────── */}
      {dupWarnings.length > 0 && (
        <div className="max-w-[720px] mb-4">
          <div className="bg-[#FFFBEB] border border-[#F59E0B] rounded-[8px] px-4 py-3">
            <div className="text-[12px] font-bold text-[#92400E] mb-1">중복 의심</div>
            {dupWarnings.map((w, i) => (
              <div key={i} className="text-[12px] text-[#92400E]">{w}</div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-[720px]">
        {/* ── 기본정보 ─────────────────────────────────────────── */}
        <SectionCard>
          <h3 className="text-[14px] font-bold text-[#111827] mb-4">기본정보</h3>
          <FormGrid cols={2}>
            <FormInput
              label="이름" required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="홍길동"
              error={errors.name}
            />
            <FormInput
              label="연락처" required
              value={fmtPhoneDisplay(form.phone)}
              onChange={e => set('phone', stripPhone(e.target.value))}
              placeholder="010-1234-5678"
              helper="숫자만 입력하면 자동 포맷됩니다"
              error={errors.phone}
            />
            <FormInput
              label="생년월일"
              value={form.birthDate}
              onChange={e => set('birthDate', e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="19850315"
              helper="YYYYMMDD 8자리"
              error={errors.birthDate}
            />
            <FormSelect
              label="외국인 여부"
              value={form.foreignerYn ? 'true' : 'false'}
              onChange={e => set('foreignerYn', e.target.value === 'true')}
              options={[
                { value: 'false', label: '내국인' },
                { value: 'true', label: '외국인' },
              ]}
            />
          </FormGrid>
          <FormInput
            label="주소"
            placeholder="시/군/구 까지 입력 (선택)"
            value={form.address}
            onChange={e => set('address', e.target.value)}
          />
        </SectionCard>

        {/* ── 근무정보 ─────────────────────────────────────────── */}
        <SectionCard>
          <h3 className="text-[14px] font-bold text-[#111827] mb-4">근무정보</h3>
          <FormGrid cols={2}>
            <div>
              <FormSelect
                label="직종" required
                value={form.jobTitle}
                onChange={e => { set('jobTitle', e.target.value); if (e.target.value !== '기타') set('jobTitleCustom', '') }}
                options={JOB_PRESETS.map(j => ({ value: j, label: j }))}
                placeholder="직종 선택"
                error={errors.jobTitle}
              />
              {form.jobTitle === '기타' && (
                <FormInput
                  value={form.jobTitleCustom}
                  onChange={e => set('jobTitleCustom', e.target.value)}
                  placeholder="직종 직접 입력"
                  className="!mt-2"
                />
              )}
            </div>
            <FormSelect
              label="고용형태"
              value={form.employmentType}
              onChange={e => set('employmentType', e.target.value)}
              options={EMP_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            />
          </FormGrid>
          <p className="text-[11px] text-[#9CA3AF] mt-2">
            고용형태는 근로형태·계약구분·운영분류를 통합한 값입니다. 추후 세분화됩니다.
          </p>
        </SectionCard>

        {/* ── 소속정보 ─────────────────────────────────────────── */}
        <SectionCard>
          <h3 className="text-[14px] font-bold text-[#111827] mb-4">소속정보</h3>
          <FormGrid cols={2}>
            <FormSelect
              label="소속 구분" required
              value={form.organizationType}
              onChange={e => { set('organizationType', e.target.value); if (e.target.value !== 'SUBCONTRACTOR') set('subcontractorName', '') }}
              options={ORG_OPTIONS}
            />
            {isSubcontractor && (
              <FormInput
                label="협력사/외주팀명" required
                value={form.subcontractorName}
                onChange={e => set('subcontractorName', e.target.value)}
                placeholder="(주)OO건설 / 철근팀"
                helper="DB에 저장되며 검색·필터에 사용됩니다"
                error={errors.subcontractorName}
              />
            )}
          </FormGrid>
          {isSubcontractor && (
            <p className="text-[11px] text-[#9CA3AF] mt-2">
              추후 회사 관리에서 정식 등록하면 자동으로 연결됩니다.
            </p>
          )}
        </SectionCard>

        {/* ── 필수서류 안내 ────────────────────────────────────── */}
        <SectionCard>
          <h3 className="text-[14px] font-bold text-[#111827] mb-4">필수서류 안내</h3>
          <p className="text-[12px] text-[#6B7280] mb-3">
            등록 후 아래 서류를 제출해야 현장 투입이 가능합니다. 승인(APPROVED)과 투입 가능은 별도로 관리됩니다.
          </p>
          <div className="border border-[#E5E7EB] rounded-[8px] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F9FAFB]">
                  <th className="text-left px-3 py-2 font-semibold text-[#6B7280]">서류명</th>
                  <th className="text-left px-3 py-2 font-semibold text-[#6B7280]">구분</th>
                  <th className="text-left px-3 py-2 font-semibold text-[#6B7280]">제출 시점</th>
                </tr>
              </thead>
              <tbody>
                {DOC_GUIDE.map(d => {
                  const t = TIMING_LABELS[d.timing]
                  return (
                    <tr key={d.name} className="border-t border-[#F3F4F6]">
                      <td className="px-3 py-2 text-[#374151]">{d.name}</td>
                      <td className="px-3 py-2 text-[#9CA3AF]">{d.rule}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium" style={{ color: t.color, backgroundColor: t.bg }}>
                          {t.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ── 상태 초기값 안내 ─────────────────────────────────── */}
        <SectionCard>
          <h3 className="text-[14px] font-bold text-[#111827] mb-3">등록 후 상태</h3>
          <div className="flex flex-col gap-2.5 text-[12px]">
            <div className="flex items-start gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#16A34A] mt-1 shrink-0" />
              <div>
                <span className="text-[#374151] font-semibold">계정 상태: APPROVED</span>
                <span className="text-[#9CA3AF] ml-1">— 관리자 직접 등록이므로 별도 승인 불필요</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#D97706] mt-1 shrink-0" />
              <div>
                <span className="text-[#374151] font-semibold">투입 가능: 서류미비</span>
                <span className="text-[#9CA3AF] ml-1">— 계약서 + 건강서류 + 안전교육 완료 후 전환</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#6B7280] mt-1 shrink-0" />
              <div>
                <span className="text-[#374151] font-semibold">다음 액션</span>
                <span className="text-[#9CA3AF] ml-1">— 상세 페이지에서 서류 제출, 현장 배정, 회사 배정 진행</span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── 액션 ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 mt-6 mb-10">
          <Btn variant="secondary" size="md" onClick={() => router.push('/admin/workers')}>
            취소
          </Btn>
          <Btn variant="orange" size="md" onClick={handleSave} disabled={saving || !canSubmit}>
            {saving ? '등록 중...' : '근로자 등록'}
          </Btn>
        </div>
      </div>
    </PageShell>
  )
}
