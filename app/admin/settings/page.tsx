'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface Settings {
  planType: string
  updatedAt: string | null
  // 출퇴근 기준
  checkInStart: string
  checkOutEnd: string
  tardyMinutes: number
  earlyLeaveMinutes: number
  absentMarkHour: string
  reviewOnException: boolean
  // 체류 확인
  presenceCheckFeatureAvailable: boolean
  presenceCheckEnabled: boolean
  presenceCheckAmEnabled: boolean
  presenceCheckPmEnabled: boolean
  presenceCheckRadiusMeters: number
  presenceCheckResponseLimitMinutes: number
  presenceCheckFailureNeedsReview: boolean
  presenceCheckAmStart: string
  presenceCheckAmEnd: string
  presenceCheckPmStart: string
  presenceCheckPmEnd: string
  // 공수 기준
  mandayFullMinutes: number
  mandayPartialOk: boolean
  mandayManualOk: boolean
  mandayAutoReview: boolean
  // 노임 기준
  wageByManday: boolean
  wageMonthly: boolean
  wageTotal: boolean
  wageManualOk: boolean
  // 관리자 설정
  adminDisplayName: string
  adminContact: string
  requireReasonOnEdit: boolean
  keepEditHistory: boolean
  confirmBeforeSave: boolean
  // 현장 운영
  siteDefaultStatus: string
  siteEndingWarnDays: number
  siteDefaultSort: string
  siteAutoReview: boolean
  // 미출근 기준 (임시값 → 추후 sites 화면과 자동 연동 예정)
  absentAlertThreshold: number
  // 기기 승인
  deviceApprovalMode: string
}

type CategoryKey = 'attendance' | 'manday' | 'wage' | 'admin_cfg' | 'site' | 'device'

const CATEGORIES: { key: CategoryKey; label: string; subLabel: string }[] = [
  { key: 'attendance', label: '출퇴근 기준',    subLabel: '출퇴근 시간·판정 기준' },
  { key: 'manday',     label: '공수 기준',       subLabel: '공수 인정·계산 기준' },
  { key: 'wage',       label: '노임 기준',       subLabel: '임금 계산·누계 기준' },
  { key: 'admin_cfg',  label: '관리자 설정',     subLabel: '승인·이력·기본 옵션' },
  { key: 'site',       label: '현장 운영 기본값', subLabel: '신규 현장·정렬·기준' },
  { key: 'device',     label: '기기 승인 정책',   subLabel: '기기 등록·승인 방식' },
]

const CATEGORY_FIELDS: Record<CategoryKey, (keyof Settings)[]> = {
  attendance: [
    'checkInStart', 'checkOutEnd', 'tardyMinutes', 'earlyLeaveMinutes',
    'absentMarkHour', 'reviewOnException',
    'presenceCheckEnabled', 'presenceCheckAmEnabled', 'presenceCheckPmEnabled',
    'presenceCheckRadiusMeters', 'presenceCheckResponseLimitMinutes',
    'presenceCheckFailureNeedsReview', 'presenceCheckAmStart', 'presenceCheckAmEnd',
    'presenceCheckPmStart', 'presenceCheckPmEnd',
  ],
  manday:    ['mandayFullMinutes', 'mandayPartialOk', 'mandayManualOk', 'mandayAutoReview'],
  wage:      ['wageByManday', 'wageMonthly', 'wageTotal', 'wageManualOk'],
  admin_cfg: ['adminDisplayName', 'adminContact', 'requireReasonOnEdit', 'keepEditHistory', 'confirmBeforeSave'],
  site:      ['siteDefaultStatus', 'siteEndingWarnDays', 'siteDefaultSort', 'siteAutoReview', 'absentAlertThreshold'],
  device:    ['deviceApprovalMode'],
}

// ── 공통 UI 컴포넌트 ─────────────────────────────────────────────────────────

function FSec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted2-brand mb-2">{title}</div>
      <div className="border border-brand rounded-[10px] overflow-hidden divide-y divide-brand">
        {children}
      </div>
    </div>
  )
}

function FRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-card">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-title-brand">{label}</div>
        {desc && <div className="text-[11px] text-muted2-brand mt-[1px] leading-[1.5]">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function FNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5 bg-accent-light border-t border-brand">
      <div className="text-[12px] text-status-exception leading-[1.7]">{children}</div>
    </div>
  )
}

function Toggle({ checked, disabled, onChange }: {
  checked: boolean; disabled: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none',
        position: 'relative', transition: 'background 0.2s',
        background: checked ? '#F97316' : '#D1D5DB',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        width: 18, height: 18,
        background: '#fff', borderRadius: '50%',
        transition: 'transform 0.2s', display: 'block',
        transform: checked ? 'translateX(20px)' : 'translateX(2px)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function TimeInput({ value, disabled, onChange }: {
  value: string; disabled: boolean; onChange: (v: string) => void
}) {
  return (
    <input
      type="time"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-[5px] text-[13px] font-semibold border border-brand rounded-[8px] text-title-brand bg-card outline-none focus:border-accent disabled:opacity-50"
    />
  )
}

function NumInput({ value, min, max, unit, disabled, onChange }: {
  value: number; min: number; max: number; unit: string;
  disabled: boolean; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        min={min} max={max}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-[72px] px-2 py-[5px] text-[13px] font-semibold border border-brand rounded-[8px] text-center text-title-brand bg-card outline-none focus:border-accent disabled:opacity-50"
      />
      {unit && <span className="text-[12px] text-muted2-brand">{unit}</span>}
    </div>
  )
}

function TextInput({ value, placeholder, maxLength, disabled, onChange }: {
  value: string; placeholder?: string; maxLength?: number;
  disabled: boolean; onChange: (v: string) => void
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-[200px] px-3 py-[5px] text-[13px] border border-brand rounded-[8px] text-title-brand bg-card outline-none focus:border-accent disabled:opacity-50"
    />
  )
}

function SelectInput({ value, options, disabled, onChange }: {
  value: string
  options: { value: string; label: string }[]
  disabled: boolean
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-[5px] text-[13px] border border-brand rounded-[8px] text-title-brand bg-card outline-none focus:border-accent disabled:opacity-50"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── 카테고리별 폼 ─────────────────────────────────────────────────────────────

function AttendanceForm({ form, canMutate, update }: {
  form: Settings; canMutate: boolean; update: (patch: Partial<Settings>) => void
}) {
  const isPro = form.presenceCheckFeatureAvailable

  return (
    <div>
      <FSec title="기본 운영 시간">
        <FRow label="출근 기준 시간" desc="출퇴근 판정 및 공수 계산의 기준 시작 시각">
          <TimeInput value={form.checkInStart} disabled={!canMutate} onChange={(v) => update({ checkInStart: v })} />
        </FRow>
        <FRow label="퇴근 기준 시간" desc="공수 1.0 인정 기준 종료 시각">
          <TimeInput value={form.checkOutEnd} disabled={!canMutate} onChange={(v) => update({ checkOutEnd: v })} />
        </FRow>
        <FNote>
          · 현재 기준: {form.checkInStart} ~ {form.checkOutEnd} = {(form.mandayFullMinutes / 60).toFixed(1)}시간 = 1.0공수
          <br />· 공수 기준값은 &ldquo;공수 기준&rdquo; 탭에서 별도 관리합니다.
        </FNote>
      </FSec>

      <FSec title="판정 기준">
        <FRow label="지각 판정 기준" desc={`출근 기준시간(${form.checkInStart}) + N분 초과 시 지각`}>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-muted2-brand">기준시간 +</span>
            <NumInput value={form.tardyMinutes} min={0} max={120} unit="분" disabled={!canMutate} onChange={(v) => update({ tardyMinutes: v })} />
          </div>
        </FRow>
        <FRow label="조기퇴근 판정 기준" desc={`퇴근 기준시간(${form.checkOutEnd}) - N분 전 퇴근 시 조기퇴근`}>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-muted2-brand">기준시간 -</span>
            <NumInput value={form.earlyLeaveMinutes} min={0} max={120} unit="분" disabled={!canMutate} onChange={(v) => update({ earlyLeaveMinutes: v })} />
          </div>
        </FRow>
        <FRow label="미출근 판정 시각" desc="이 시각까지 체크인이 없으면 미출근으로 판정">
          <TimeInput value={form.absentMarkHour} disabled={!canMutate} onChange={(v) => update({ absentMarkHour: v })} />
        </FRow>
        <FRow label="예외 자동 확인필요 처리" desc="지각·조기퇴근·미출근 발생 시 자동으로 확인필요 분류">
          <Toggle checked={form.reviewOnException} disabled={!canMutate} onChange={(v) => update({ reviewOnException: v })} />
        </FRow>
      </FSec>

      <FSec title={`중간 체류 확인${isPro ? '' : ' (유료 전용)'}`}>
        {!isPro ? (
          <div className="px-4 py-5 bg-surface text-center">
            <div className="text-[13px] text-muted2-brand">유료 플랜에서만 사용 가능한 기능입니다.</div>
          </div>
        ) : (
          <>
            <FRow label="기능 활성화" desc="오전/오후 랜덤 체류 확인 알림 활성화">
              <Toggle checked={form.presenceCheckEnabled} disabled={!canMutate} onChange={(v) => update({ presenceCheckEnabled: v })} />
            </FRow>
            {form.presenceCheckEnabled && (
              <>
                <FRow label="오전 확인 활성화" desc={`${form.presenceCheckAmStart} ~ ${form.presenceCheckAmEnd} 구간 랜덤`}>
                  <Toggle checked={form.presenceCheckAmEnabled} disabled={!canMutate} onChange={(v) => update({ presenceCheckAmEnabled: v })} />
                </FRow>
                {form.presenceCheckAmEnabled && (
                  <FRow label="오전 시간대" desc="오전 체류 확인 랜덤 발생 구간">
                    <div className="flex items-center gap-1.5">
                      <TimeInput value={form.presenceCheckAmStart} disabled={!canMutate} onChange={(v) => update({ presenceCheckAmStart: v })} />
                      <span className="text-[12px] text-muted2-brand">~</span>
                      <TimeInput value={form.presenceCheckAmEnd} disabled={!canMutate} onChange={(v) => update({ presenceCheckAmEnd: v })} />
                    </div>
                  </FRow>
                )}
                <FRow label="오후 확인 활성화" desc={`${form.presenceCheckPmStart} ~ ${form.presenceCheckPmEnd} 구간 랜덤`}>
                  <Toggle checked={form.presenceCheckPmEnabled} disabled={!canMutate} onChange={(v) => update({ presenceCheckPmEnabled: v })} />
                </FRow>
                {form.presenceCheckPmEnabled && (
                  <FRow label="오후 시간대" desc="오후 체류 확인 랜덤 발생 구간">
                    <div className="flex items-center gap-1.5">
                      <TimeInput value={form.presenceCheckPmStart} disabled={!canMutate} onChange={(v) => update({ presenceCheckPmStart: v })} />
                      <span className="text-[12px] text-muted2-brand">~</span>
                      <TimeInput value={form.presenceCheckPmEnd} disabled={!canMutate} onChange={(v) => update({ presenceCheckPmEnd: v })} />
                    </div>
                  </FRow>
                )}
                <FRow label="체류 확인 반경" desc="현장 중심점 기준 허용 반경 (10~100m)">
                  <NumInput value={form.presenceCheckRadiusMeters} min={10} max={100} unit="m" disabled={!canMutate} onChange={(v) => update({ presenceCheckRadiusMeters: v })} />
                </FRow>
                <FRow label="응답 제한 시간" desc="알림 수신 후 응답 가능 시간 (5~60분)">
                  <NumInput value={form.presenceCheckResponseLimitMinutes} min={5} max={60} unit="분" disabled={!canMutate} onChange={(v) => update({ presenceCheckResponseLimitMinutes: v })} />
                </FRow>
                <FRow label="실패/미응답 확인필요 처리" desc="실패 또는 미응답 건을 자동으로 확인필요 분류">
                  <Toggle checked={form.presenceCheckFailureNeedsReview} disabled={!canMutate} onChange={(v) => update({ presenceCheckFailureNeedsReview: v })} />
                </FRow>
              </>
            )}
          </>
        )}
      </FSec>
    </div>
  )
}

function MandayForm({ form, canMutate, update }: {
  form: Settings; canMutate: boolean; update: (patch: Partial<Settings>) => void
}) {
  const hours = (form.mandayFullMinutes / 60).toFixed(1)

  return (
    <div>
      <FSec title="공수 인정 기준">
        <FRow label="1.0공수 인정 기준 시간" desc="이 분수 이상 근무해야 1.0공수로 인정 (60~1200분)">
          <NumInput value={form.mandayFullMinutes} min={60} max={1200} unit="분" disabled={!canMutate} onChange={(v) => update({ mandayFullMinutes: v })} />
        </FRow>
        <FNote>
          · 현재 기준: {form.mandayFullMinutes}분 = {hours}시간 = 1.0공수
          <br />· 출퇴근 기준 탭의 운영 시간(07:00~17:00)과 연동됩니다.
        </FNote>
        <FRow label="부분 공수 허용" desc="기준 시간 미달 시에도 0.5공수 등 부분 인정 허용">
          <Toggle checked={form.mandayPartialOk} disabled={!canMutate} onChange={(v) => update({ mandayPartialOk: v })} />
        </FRow>
      </FSec>

      <FSec title="관리 기준">
        <FRow label="공수 수동 수정 허용" desc="관리자가 출퇴근 기록의 공수를 직접 수정할 수 있습니다">
          <Toggle checked={form.mandayManualOk} disabled={!canMutate} onChange={(v) => update({ mandayManualOk: v })} />
        </FRow>
        <FRow label="기준 미달 자동 확인필요" desc="공수 기준 시간 미달 건을 자동으로 확인필요로 분류">
          <Toggle checked={form.mandayAutoReview} disabled={!canMutate} onChange={(v) => update({ mandayAutoReview: v })} />
        </FRow>
      </FSec>
    </div>
  )
}

function WageForm({ form, canMutate, update }: {
  form: Settings; canMutate: boolean; update: (patch: Partial<Settings>) => void
}) {
  return (
    <div>
      <FSec title="계산 기준">
        <FRow label="공수 기반 노임 계산" desc="공수에 비례하여 노임을 자동 계산합니다">
          <Toggle checked={form.wageByManday} disabled={!canMutate} onChange={(v) => update({ wageByManday: v })} />
        </FRow>
        <FRow label="월 누계 표시" desc="당월 누계 노임을 각 화면에 표시합니다">
          <Toggle checked={form.wageMonthly} disabled={!canMutate} onChange={(v) => update({ wageMonthly: v })} />
        </FRow>
        <FRow label="총 누계 표시" desc="전체 누계 노임을 각 화면에 표시합니다">
          <Toggle checked={form.wageTotal} disabled={!canMutate} onChange={(v) => update({ wageTotal: v })} />
        </FRow>
      </FSec>

      <FSec title="보정 옵션">
        <FRow label="수동 보정 허용" desc="관리자가 노임을 직접 수동 보정할 수 있습니다">
          <Toggle checked={form.wageManualOk} disabled={!canMutate} onChange={(v) => update({ wageManualOk: v })} />
        </FRow>
      </FSec>

      <div className="px-1 mt-1">
        <div className="text-[12px] text-muted2-brand leading-[1.7]">
          · 노임 기준 단가(일당)는 근로자별 계약 정보에서 별도 관리합니다.<br />
          · 이 화면에서는 계산 방식과 누계 표시 여부만 설정합니다.
        </div>
      </div>
    </div>
  )
}

function AdminCfgForm({ form, canMutate, update }: {
  form: Settings; canMutate: boolean; update: (patch: Partial<Settings>) => void
}) {
  return (
    <div>
      <FSec title="표시 정보">
        <FRow label="관리자 표시 이름" desc="시스템 내 관리자 이름으로 표시됩니다">
          <TextInput value={form.adminDisplayName} placeholder="이름 입력" maxLength={50} disabled={!canMutate} onChange={(v) => update({ adminDisplayName: v })} />
        </FRow>
        <FRow label="연락처 / 이메일" desc="문의 또는 안내에 사용되는 연락처">
          <TextInput value={form.adminContact} placeholder="010-0000-0000" maxLength={100} disabled={!canMutate} onChange={(v) => update({ adminContact: v })} />
        </FRow>
      </FSec>

      <FSec title="처리 옵션">
        <FRow label="수정 시 사유 입력 강제" desc="근로자 정보 수정 시 사유 입력을 필수로 요구합니다">
          <Toggle checked={form.requireReasonOnEdit} disabled={!canMutate} onChange={(v) => update({ requireReasonOnEdit: v })} />
        </FRow>
        <FRow label="수정 이력 보관" desc="모든 수정 내역을 감사로그로 보관합니다">
          <Toggle checked={form.keepEditHistory} disabled={!canMutate} onChange={(v) => update({ keepEditHistory: v })} />
        </FRow>
        <FRow label="저장 전 확인 다이얼로그" desc="중요 설정 저장 전 확인 창을 표시합니다">
          <Toggle checked={form.confirmBeforeSave} disabled={!canMutate} onChange={(v) => update({ confirmBeforeSave: v })} />
        </FRow>
      </FSec>
    </div>
  )
}

function SiteForm({ form, canMutate, update }: {
  form: Settings; canMutate: boolean; update: (patch: Partial<Settings>) => void
}) {
  return (
    <div>
      <FSec title="신규 현장 기본값">
        <FRow label="신규 현장 기본 상태" desc="현장 등록 시 초기 활성 상태">
          <SelectInput
            value={form.siteDefaultStatus}
            options={[
              { value: 'ACTIVE',   label: '활성 (운영 중)' },
              { value: 'INACTIVE', label: '비활성 (준비 중)' },
            ]}
            disabled={!canMutate}
            onChange={(v) => update({ siteDefaultStatus: v })}
          />
        </FRow>
        <FRow label="기본 정렬 기준" desc="현장 목록 기본 정렬 방식">
          <SelectInput
            value={form.siteDefaultSort}
            options={[
              { value: 'endDate_asc',    label: '계약 종료일 순' },
              { value: 'createdAt_desc', label: '최근 등록 순' },
              { value: 'name_asc',       label: '이름 순 (가나다)' },
            ]}
            disabled={!canMutate}
            onChange={(v) => update({ siteDefaultSort: v })}
          />
        </FRow>
      </FSec>

      <FSec title="확인필요 기본 조건">
        <FRow label="종료임박 기준" desc="계약 종료 N일 전부터 종료임박으로 표시 (0~90일)">
          <NumInput value={form.siteEndingWarnDays} min={0} max={90} unit="일 전" disabled={!canMutate} onChange={(v) => update({ siteEndingWarnDays: v })} />
        </FRow>
        <FRow label="계약기간 미입력 시 확인필요" desc="계약기간이 입력되지 않은 현장을 확인필요로 분류">
          <Toggle checked={form.siteAutoReview} disabled={!canMutate} onChange={(v) => update({ siteAutoReview: v })} />
        </FRow>
        <FRow label="미출근 확인필요 기준" desc="배정 인원 대비 미출근이 N명 이상이면 확인필요 처리 (1~50명)">
          <NumInput value={form.absentAlertThreshold} min={1} max={50} unit="명 이상" disabled={!canMutate} onChange={(v) => update({ absentAlertThreshold: v })} />
        </FRow>
        <FNote>
          · 현재 기준: 배정 인원 중 {form.absentAlertThreshold}명 이상 미출근 시 현장 확인필요로 분류됩니다.
          <br />· 이 값은 현장관리 화면의 확인필요 판정에 자동 반영됩니다.
        </FNote>
      </FSec>
    </div>
  )
}

// ── 기기 승인 설정 ────────────────────────────────────────────────────────────
function DeviceForm({ form, canMutate, update }: {
  form: Settings; canMutate: boolean; update: (patch: Partial<Settings>) => void
}) {
  return (
    <div>
      <FSec title="기기 승인 방식">
        <FRow label="기기 승인 모드" desc="MANUAL: 모든 기기 관리자 수동 승인 / AUTO_FIRST: 첫 기기 자동 승인">
          <select
            value={form.deviceApprovalMode}
            disabled={!canMutate}
            onChange={(e) => update({ deviceApprovalMode: e.target.value })}
            className="px-3 py-2 border border-[#d1d5db] rounded-[6px] text-[13px] bg-card"
          >
            <option value="MANUAL">MANUAL — 관리자 수동 승인</option>
            <option value="AUTO_FIRST">AUTO_FIRST — 첫 기기 자동 승인</option>
          </select>
        </FRow>
        <FNote>
          · MANUAL: 근로자가 기기를 등록하면 관리자가 승인해야 출근 가능합니다.
          <br />· AUTO_FIRST: 근로자의 첫 기기는 자동 승인되고, 추가 기기는 관리자 승인이 필요합니다.
        </FNote>
      </FSec>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'

  const [settings, setSettings] = useState<Settings | null>(null)
  const [form, setForm]         = useState<Settings | null>(null)
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('attendance')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setSettings(data.data)
        setForm(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  const update = useCallback((patch: Partial<Settings>) => {
    setForm((f) => f ? { ...f, ...patch } : f)
    setMsg(null)
  }, [])

  // 현재 카테고리 변경사항 감지
  const isDirty = useMemo(() => {
    if (!settings || !form) return false
    return CATEGORY_FIELDS[activeCategory].some(
      (k) => (form as unknown as Record<string, unknown>)[k] !== (settings as unknown as Record<string, unknown>)[k]
    )
  }, [settings, form, activeCategory])

  // 카테고리별 변경사항 감지 (사이드바 점 표시용)
  const dirtyMap = useMemo(() => {
    if (!settings || !form) return {} as Record<CategoryKey, boolean>
    const result = {} as Record<CategoryKey, boolean>
    for (const cat of CATEGORIES) {
      result[cat.key] = CATEGORY_FIELDS[cat.key].some(
        (k) => (form as unknown as Record<string, unknown>)[k] !== (settings as unknown as Record<string, unknown>)[k]
      )
    }
    return result
  }, [settings, form])

  const handleSave = async () => {
    if (!form || !isDirty || saving) return
    setSaving(true)
    setMsg(null)

    // 현재 카테고리의 필드만 전송
    const body: Partial<Settings> = {}
    for (const k of CATEGORY_FIELDS[activeCategory]) {
      body[k] = form[k] as never
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
        setForm(data.data)
        setMsg({ text: '저장되었습니다.', type: 'success' })
      } else {
        setMsg({ text: data.message || '저장 중 오류가 발생했습니다.', type: 'error' })
      }
    } catch {
      setMsg({ text: '저장 중 오류가 발생했습니다.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = () => {
    if (!settings) return
    setForm({ ...settings })
    setMsg(null)
  }

  const handleCategoryChange = (key: CategoryKey) => {
    setActiveCategory(key)
    setMsg(null)
  }

  const fmtDate = (s: string | null) => {
    if (!s) return '없음'
    return new Date(s).toLocaleString('ko-KR', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading || !form) {
    return (
      <div className="p-6 bg-brand min-h-screen">
        <div className="text-[13px] text-muted2-brand">설정을 불러오는 중...</div>
      </div>
    )
  }

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)!

  return (
    <div className="bg-brand min-h-screen flex flex-col">
      {/* ── 상단 헤더 ── */}
      <div className="bg-card border-b border-brand px-6 py-[14px] flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[17px] font-bold text-title-brand">설정</h1>
          {isDirty && (
            <span className="px-2 py-[2px] bg-accent-light border border-accent-light rounded-[6px] text-[11px] font-semibold text-accent-hover">
              ● 변경사항 있음
            </span>
          )}
          <span className="text-[12px] text-muted2-brand">
            마지막 저장: {fmtDate(settings?.updatedAt ?? null)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleRevert}
              className="px-3 py-2.5 border border-brand rounded-[8px] text-[13px] text-muted-brand hover:bg-surface cursor-pointer bg-card transition-colors"
            >
              되돌리기
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving || !canMutate}
            className="px-4 py-2.5 rounded-[8px] text-[13px] font-semibold border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
            style={{
              background: isDirty && canMutate ? '#F97316' : '#E5E7EB',
              color:      isDirty && canMutate ? '#fff'    : '#9CA3AF',
            }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* ── 모바일 카테고리 선택 (lg 미만에서만) ── */}
      <div className="lg:hidden px-4 py-2 bg-card border-b border-brand">
        <select
          value={activeCategory}
          onChange={(e) => handleCategoryChange(e.target.value as CategoryKey)}
          className="w-full h-10 px-3 text-[13px] border border-brand rounded-[8px] bg-card text-title-brand"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* ── 메인 레이아웃 ── */}
      <div className="flex flex-1">
        {/* 좌측 카테고리 목록 (lg 이상에서만) */}
        <div className="hidden lg:flex lg:flex-col w-[200px] shrink-0 bg-card border-r border-brand py-3">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.key
            const hasDirty = dirtyMap[cat.key] && !active
            return (
              <button
                key={cat.key}
                onClick={() => handleCategoryChange(cat.key)}
                className="w-full text-left px-4 py-[10px] cursor-pointer border-none transition-colors"
                style={{
                  background:  active ? '#FFF7ED' : 'transparent',
                  borderLeft:  active ? '3px solid #F97316' : '3px solid transparent',
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: active ? '#F97316' : '#374151' }}
                  >
                    {cat.label}
                  </span>
                  {hasDirty && (
                    <span className="w-[6px] h-[6px] rounded-full bg-brand-accent shrink-0" />
                  )}
                </div>
                <div
                  className="text-[11px] mt-[1px]"
                  style={{ color: active ? '#D97706' : '#9CA3AF' }}
                >
                  {cat.subLabel}
                </div>
              </button>
            )
          })}
        </div>

        {/* 우측 폼 영역 */}
        <div className="flex-1 p-6 min-w-0 max-w-[640px]">
          {/* 저장/오류 메시지 */}
          {msg && (
            <div
              className={`mb-4 px-4 py-3 rounded-[8px] text-[13px] border ${
                msg.type === 'success'
                  ? 'bg-green-light border-[#A7F3D0] text-status-approved'
                  : 'bg-red-light border-[#FECACA] text-status-rejected'
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* 카테고리 제목 */}
          <div className="mb-5">
            <h2 className="text-[15px] font-bold text-title-brand">{activeCat.label}</h2>
            <div className="text-[12px] text-muted2-brand mt-[2px]">{activeCat.subLabel}</div>
          </div>

          {/* 카테고리별 폼 렌더링 */}
          {activeCategory === 'attendance' && (
            <AttendanceForm form={form} canMutate={canMutate} update={update} />
          )}
          {activeCategory === 'manday' && (
            <MandayForm form={form} canMutate={canMutate} update={update} />
          )}
          {activeCategory === 'wage' && (
            <WageForm form={form} canMutate={canMutate} update={update} />
          )}
          {activeCategory === 'admin_cfg' && (
            <AdminCfgForm form={form} canMutate={canMutate} update={update} />
          )}
          {activeCategory === 'site' && (
            <SiteForm form={form} canMutate={canMutate} update={update} />
          )}
          {activeCategory === 'device' && (
            <DeviceForm form={form} canMutate={canMutate} update={update} />
          )}

          {/* VIEWER 안내 */}
          {!canMutate && (
            <div className="mt-4 px-4 py-3 bg-surface border border-brand rounded-[8px]">
              <div className="text-[12px] text-muted2-brand">조회 전용 계정입니다. 설정을 변경하려면 관리자 권한이 필요합니다.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
