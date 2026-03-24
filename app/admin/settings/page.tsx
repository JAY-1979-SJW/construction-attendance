'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

interface AttendanceSettings {
  planType: string
  featureAvailable: boolean
  enabled: boolean
  amEnabled: boolean
  pmEnabled: boolean
  radiusMeters: number
  responseLimitMinutes: number
  failureNeedsReview: boolean
  amStart: string
  amEnd: string
  pmStart: string
  pmEnd: string
}

export default function AttendanceSettingsPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'

  const [settings, setSettings] = useState<AttendanceSettings | null>(null)
  const [form, setForm] = useState<AttendanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' | 'warn' } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings/attendance')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setSettings(data.data)
        setForm(data.data)
        setLoading(false)
      })
  }, [router])

  const isPro = settings?.featureAvailable ?? false

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/settings/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          amEnabled: form.amEnabled,
          pmEnabled: form.pmEnabled,
          radiusMeters: form.radiusMeters,
          responseLimitMinutes: form.responseLimitMinutes,
          failureNeedsReview: form.failureNeedsReview,
          amStart: form.amStart,
          amEnd: form.amEnd,
          pmStart: form.pmStart,
          pmEnd: form.pmEnd,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
        setForm(data.data)
        setMsg({ text: data.data.warning ?? '설정이 저장되었습니다.', type: data.data.warning ? 'warn' : 'success' })
      } else {
        setMsg({ text: data.message, type: 'error' })
      }
    } catch {
      setMsg({ text: '저장 중 오류가 발생했습니다.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const update = (patch: Partial<AttendanceSettings>) => setForm((f) => f ? { ...f, ...patch } : f)

  return (
    <div className="flex min-h-screen bg-brand">
      <nav className="w-[220px] bg-brand-deeper py-6 shrink-0">
        <div className="text-white text-base font-bold px-5 pb-6">해한 출퇴근</div>
        {[
          { href: '/admin',                  label: '대시보드' },
          { href: '/admin/workers',          label: '근로자 관리' },
          { href: '/admin/companies',        label: '회사 관리' },
          { href: '/admin/sites',            label: '현장 관리' },
          { href: '/admin/attendance',       label: '출퇴근 조회' },
          { href: '/admin/presence-checks',  label: '체류확인 현황' },
          { href: '/admin/labor',            label: '투입현황/노임서류' },
          { href: '/admin/exceptions',       label: '예외 승인' },
          { href: '/admin/device-requests',  label: '기기 승인' },
          { href: '/admin/settings',         label: '⚙️ 시스템 설정', active: true },
        ].map(({ href, label, active }) => (
          <Link key={href} href={href} className={`block text-white/80 px-5 py-[10px] text-sm no-underline${active ? ' bg-[rgba(244,121,32,0.15)] text-white font-semibold' : ''}`}>{label}</Link>
        ))}
      </nav>

      <main className="flex-1 p-8">
        <h1 className="text-[22px] font-bold mt-0 mb-6">시스템 설정</h1>

        {loading || !form ? <p>로딩 중...</p> : (
          <>
            {/* 플랜 상태 카드 */}
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="bg-card rounded-[10px] px-5 py-4 flex-[1_1_160px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <div className="text-[12px] text-muted-brand mb-[6px]">현재 플랜</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: isPro ? '#2e7d32' : '#888' }}>
                  {settings?.planType === 'PRO' ? '⭐ Pro' : '무료 (Free)'}
                </div>
              </div>
              <div className="bg-card rounded-[10px] px-5 py-4 flex-[1_1_160px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <div className="text-[12px] text-muted-brand mb-[6px]">중간 체류 확인</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: isPro ? (form.enabled ? '#2e7d32' : '#e65100') : '#aaa' }}>
                  {!isPro ? '사용 불가' : form.enabled ? '● 활성화' : '○ 비활성화'}
                </div>
              </div>
              <div className="bg-card rounded-[10px] px-5 py-4 flex-[1_1_160px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <div className="text-[12px] text-muted-brand mb-[6px]">알림 시간대</div>
                <div className="text-base font-bold">
                  {!isPro || !form.enabled ? '-' : [form.amEnabled && '오전', form.pmEnabled && '오후'].filter(Boolean).join(' · ') || '없음'}
                </div>
              </div>
            </div>

            {/* 설정 카드 */}
            <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] mb-5 overflow-hidden">
              <div className="flex justify-between items-start px-6 py-5 border-b border-[#f0f0f0]">
                <div>
                  <div className="text-base font-bold">중간 체류 확인 기능</div>
                  <div className="text-[12px] text-muted-brand mt-[2px]">유료 전용 옵션 기능</div>
                </div>
                {!isPro && <span className="bg-[#fff3e0] text-[#e65100] text-[11px] font-bold px-2 py-[3px] rounded border border-[#ffcc80]">유료 전용</span>}
              </div>

              {!isPro ? (
                <div className="py-10 text-center text-muted-brand">
                  <div className="text-[32px] mb-3">🔒</div>
                  <div className="text-[15px] font-bold mb-[6px]">유료 플랜 전용 기능입니다.</div>
                  <div className="text-[13px] text-muted-brand">플랜 업그레이드 후 사용할 수 있습니다.</div>
                </div>
              ) : (
                <div className="py-2">
                  {/* 기능 ON/OFF */}
                  <ToggleRow
                    label="기능 사용"
                    desc="오전/오후 랜덤 체류 확인 알림을 발송합니다."
                    checked={form.enabled}
                    disabled={!canMutate}
                    onChange={(v) => update({ enabled: v })}
                  />

                  {form.enabled && (
                    <>
                      <div className="border-t border-[#f5f5f5] mx-6" />

                      {/* 오전 설정 */}
                      <ToggleRow
                        label="오전 랜덤 확인"
                        desc={`${form.amStart} ~ ${form.amEnd} 구간에서 랜덤 1회 알림`}
                        checked={form.amEnabled}
                        disabled={!canMutate}
                        onChange={(v) => update({ amEnabled: v })}
                      />
                      {form.amEnabled && (
                        <TimeRangeRow
                          label="오전 시간대"
                          desc="오전 체류 확인 랜덤 발생 구간 (HH:mm)"
                          startVal={form.amStart}
                          endVal={form.amEnd}
                          disabled={!canMutate}
                          onChangeStart={(v) => update({ amStart: v })}
                          onChangeEnd={(v) => update({ amEnd: v })}
                        />
                      )}

                      <div className="border-t border-[#f5f5f5] mx-6" />

                      {/* 오후 설정 */}
                      <ToggleRow
                        label="오후 랜덤 확인"
                        desc={`${form.pmStart} ~ ${form.pmEnd} 구간에서 랜덤 1회 알림`}
                        checked={form.pmEnabled}
                        disabled={!canMutate}
                        onChange={(v) => update({ pmEnabled: v })}
                      />
                      {form.pmEnabled && (
                        <TimeRangeRow
                          label="오후 시간대"
                          desc="오후 체류 확인 랜덤 발생 구간 (HH:mm)"
                          startVal={form.pmStart}
                          endVal={form.pmEnd}
                          disabled={!canMutate}
                          onChangeStart={(v) => update({ pmStart: v })}
                          onChangeEnd={(v) => update({ pmEnd: v })}
                        />
                      )}

                      <div className="border-t border-[#f5f5f5] mx-6" />

                      <NumberRow
                        label="체류 확인 반경"
                        desc="현장 중심점 기준 (10~100m)"
                        value={form.radiusMeters}
                        unit="m"
                        min={10} max={100}
                        disabled={!canMutate}
                        onChange={(v) => update({ radiusMeters: v })}
                      />

                      <NumberRow
                        label="응답 제한 시간"
                        desc="알림 수신 후 응답 가능 시간 (5~60분)"
                        value={form.responseLimitMinutes}
                        unit="분"
                        min={5} max={60}
                        disabled={!canMutate}
                        onChange={(v) => update({ responseLimitMinutes: v })}
                      />

                      <div className="border-t border-[#f5f5f5] mx-6" />

                      <ToggleRow
                        label="실패/미응답 검토 처리"
                        desc="실패 또는 미응답 건을 자동으로 검토 대상으로 분류합니다."
                        checked={form.failureNeedsReview}
                        disabled={!canMutate}
                        onChange={(v) => update({ failureNeedsReview: v })}
                      />
                    </>
                  )}
                </div>
              )}

              {isPro && canMutate && (
                <div className="px-6 pb-6">
                  {msg && (
                    <div className={`rounded-lg px-[14px] py-[10px] text-[13px] mb-3 ${
                      msg.type === 'success' ? 'bg-[#e8f5e9] text-[#2e7d32]'
                      : msg.type === 'warn' ? 'bg-[#fff8e1] text-[#e65100]'
                      : 'bg-[#fff5f5] text-[#c62828]'
                    }`}>
                      {msg.text}
                    </div>
                  )}
                  <button onClick={handleSave} disabled={saving} className={`w-full py-[14px] bg-accent text-white border-0 rounded-lg text-[15px] font-bold cursor-pointer ${saving ? 'opacity-60' : ''}`}>
                    {saving ? '저장 중...' : '설정 저장'}
                  </button>
                </div>
              )}
            </div>

            {/* 안내 */}
            <div className="bg-brand rounded-[10px] px-5 py-[18px]">
              <div className="text-sm font-bold mb-[10px] text-[#4A93C8]">💡 기능 안내</div>
              <div className="text-[13px] text-muted-brand leading-[1.8]">· 이 기능은 유료 플랜 전용입니다.</div>
              <div className="text-[13px] text-muted-brand leading-[1.8]">· 오전/오후 설정 시간대 내 랜덤 시각에 체류 확인 알림이 발생합니다.</div>
              <div className="text-[13px] text-muted-brand leading-[1.8]">· 근로자 앱에 FCM 푸시 알림이 발송되며, 버튼 클릭 시 현재 위치가 현장 반경 내인지 검사합니다.</div>
              <div className="text-[13px] text-muted-brand leading-[1.8]">· 실패 또는 미응답 건은 검토 대상으로 분류될 수 있습니다.</div>
              <div className="text-[13px] text-muted-brand leading-[1.8]">· 설정 변경은 다음 스케줄 생성 시점(출근 후)부터 반영됩니다.</div>
              <div className="text-[13px] text-muted-brand leading-[1.8]">· 모든 설정 변경은 관리자 감사로그에 기록됩니다.</div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

/* ── 하위 컴포넌트 ──────────────────────────────────────────── */

function ToggleRow({ label, desc, checked, disabled, onChange }: {
  label: string; desc: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex justify-between items-center px-6 py-[14px] gap-4">
      <div className="flex-1">
        <div className="text-sm font-semibold text-white mb-[2px]">{label}</div>
        <div className="text-[12px] text-muted-brand">{desc}</div>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', position: 'relative', transition: 'background 0.2s', flexShrink: 0, background: checked ? '#2e7d32' : '#ccc', cursor: disabled ? 'default' : 'pointer' }}
        disabled={disabled}
      >
        <span style={{ position: 'absolute', top: '2px', width: '20px', height: '20px', background: '#243144', borderRadius: '50%', transition: 'transform 0.2s', display: 'block', transform: checked ? 'translateX(20px)' : 'translateX(2px)' }} />
      </button>
    </div>
  )
}

function NumberRow({ label, desc, value, unit, min, max, disabled, onChange }: {
  label: string; desc: string; value: number; unit: string; min: number; max: number; disabled: boolean; onChange: (v: number) => void
}) {
  return (
    <div className="flex justify-between items-center px-6 py-[14px] gap-4">
      <div className="flex-1">
        <div className="text-sm font-semibold text-white mb-[2px]">{label}</div>
        <div className="text-[12px] text-muted-brand">{desc}</div>
      </div>
      <div className="flex items-center gap-[6px]">
        <input
          type="number"
          value={value}
          min={min} max={max}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-[72px] px-[10px] py-[6px] text-[15px] font-bold border border-[rgba(91,164,217,0.3)] rounded-md text-center bg-transparent text-white"
        />
        <span className="text-[13px] text-muted-brand">{unit}</span>
      </div>
    </div>
  )
}

function TimeRangeRow({ label, desc, startVal, endVal, disabled, onChangeStart, onChangeEnd }: {
  label: string; desc: string; startVal: string; endVal: string
  disabled: boolean; onChangeStart: (v: string) => void; onChangeEnd: (v: string) => void
}) {
  return (
    <div className="flex justify-between items-center px-6 py-[14px] gap-4 flex-wrap">
      <div className="flex-1">
        <div className="text-sm font-semibold text-white mb-[2px]">{label}</div>
        <div className="text-[12px] text-muted-brand">{desc}</div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={startVal}
          disabled={disabled}
          onChange={(e) => onChangeStart(e.target.value)}
          className="px-[10px] py-[6px] text-sm font-semibold border border-[rgba(91,164,217,0.3)] rounded-md text-white bg-transparent"
        />
        <span className="text-[13px] text-muted-brand">~</span>
        <input
          type="time"
          value={endVal}
          disabled={disabled}
          onChange={(e) => onChangeEnd(e.target.value)}
          className="px-[10px] py-[6px] text-sm font-semibold border border-[rgba(91,164,217,0.3)] rounded-md text-white bg-transparent"
        />
      </div>
    </div>
  )
}
