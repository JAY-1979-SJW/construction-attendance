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
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        {[
          { href: '/admin',                  label: '대시보드' },
          { href: '/admin/workers',          label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
          { href: '/admin/sites',            label: '현장 관리' },
          { href: '/admin/attendance',       label: '출퇴근 조회' },
          { href: '/admin/presence-checks',  label: '체류확인 현황' },
          { href: '/admin/labor',            label: '투입현황/노임서류' },
          { href: '/admin/exceptions',       label: '예외 승인' },
          { href: '/admin/device-requests',  label: '기기 승인' },
          { href: '/admin/settings',         label: '⚙️ 시스템 설정', active: true },
        ].map(({ href, label, active }) => (
          <Link key={href} href={href} style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}>{label}</Link>
        ))}
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>시스템 설정</h1>

        {loading || !form ? <p>로딩 중...</p> : (
          <>
            {/* 플랜 상태 카드 */}
            <div style={s.statusRow}>
              <div style={s.statusCard}>
                <div style={s.statusLabel}>현재 플랜</div>
                <div style={{ ...s.statusValue, color: isPro ? '#2e7d32' : '#888' }}>
                  {settings?.planType === 'PRO' ? '⭐ Pro' : '무료 (Free)'}
                </div>
              </div>
              <div style={s.statusCard}>
                <div style={s.statusLabel}>중간 체류 확인</div>
                <div style={{ ...s.statusValue, color: isPro ? (form.enabled ? '#2e7d32' : '#e65100') : '#aaa' }}>
                  {!isPro ? '사용 불가' : form.enabled ? '● 활성화' : '○ 비활성화'}
                </div>
              </div>
              <div style={s.statusCard}>
                <div style={s.statusLabel}>알림 시간대</div>
                <div style={s.statusValue}>
                  {!isPro || !form.enabled ? '-' : [form.amEnabled && '오전', form.pmEnabled && '오후'].filter(Boolean).join(' · ') || '없음'}
                </div>
              </div>
            </div>

            {/* 설정 카드 */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div>
                  <div style={s.cardTitle}>중간 체류 확인 기능</div>
                  <div style={s.cardSub}>유료 전용 옵션 기능</div>
                </div>
                {!isPro && <span style={s.proBadge}>유료 전용</span>}
              </div>

              {!isPro ? (
                <div style={s.lockedBox}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>유료 플랜 전용 기능입니다.</div>
                  <div style={{ fontSize: '13px', color: '#888' }}>플랜 업그레이드 후 사용할 수 있습니다.</div>
                </div>
              ) : (
                <div style={s.fieldList}>
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
                      <div style={s.divider} />

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

                      <div style={s.divider} />

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

                      <div style={s.divider} />

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

                      <div style={s.divider} />

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
                <div style={{ padding: '0 24px 24px' }}>
                  {msg && (
                    <div style={{
                      ...s.msgBox,
                      background: msg.type === 'success' ? '#e8f5e9' : msg.type === 'warn' ? '#fff8e1' : '#fff5f5',
                      color: msg.type === 'success' ? '#2e7d32' : msg.type === 'warn' ? '#e65100' : '#c62828',
                    }}>
                      {msg.text}
                    </div>
                  )}
                  <button onClick={handleSave} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }}>
                    {saving ? '저장 중...' : '설정 저장'}
                  </button>
                </div>
              )}
            </div>

            {/* 안내 */}
            <div style={s.helpCard}>
              <div style={s.helpTitle}>💡 기능 안내</div>
              <div style={s.helpItem}>· 이 기능은 유료 플랜 전용입니다.</div>
              <div style={s.helpItem}>· 오전/오후 설정 시간대 내 랜덤 시각에 체류 확인 알림이 발생합니다.</div>
              <div style={s.helpItem}>· 근로자 앱에 FCM 푸시 알림이 발송되며, 버튼 클릭 시 현재 위치가 현장 반경 내인지 검사합니다.</div>
              <div style={s.helpItem}>· 실패 또는 미응답 건은 검토 대상으로 분류될 수 있습니다.</div>
              <div style={s.helpItem}>· 설정 변경은 다음 스케줄 생성 시점(출근 후)부터 반영됩니다.</div>
              <div style={s.helpItem}>· 모든 설정 변경은 관리자 감사로그에 기록됩니다.</div>
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
    <div style={s.fieldRow}>
      <div style={s.fieldInfo}>
        <div style={s.fieldLabel}>{label}</div>
        <div style={s.fieldDesc}>{desc}</div>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        style={{ ...s.toggle, background: checked ? '#2e7d32' : '#ccc', cursor: disabled ? 'default' : 'pointer' }}
        disabled={disabled}
      >
        <span style={{ ...s.toggleKnob, transform: checked ? 'translateX(20px)' : 'translateX(2px)' }} />
      </button>
    </div>
  )
}

function NumberRow({ label, desc, value, unit, min, max, disabled, onChange }: {
  label: string; desc: string; value: number; unit: string; min: number; max: number; disabled: boolean; onChange: (v: number) => void
}) {
  return (
    <div style={s.fieldRow}>
      <div style={s.fieldInfo}>
        <div style={s.fieldLabel}>{label}</div>
        <div style={s.fieldDesc}>{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="number"
          value={value}
          min={min} max={max}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          style={s.numInput}
        />
        <span style={{ fontSize: '13px', color: '#666' }}>{unit}</span>
      </div>
    </div>
  )
}

function TimeRangeRow({ label, desc, startVal, endVal, disabled, onChangeStart, onChangeEnd }: {
  label: string; desc: string; startVal: string; endVal: string
  disabled: boolean; onChangeStart: (v: string) => void; onChangeEnd: (v: string) => void
}) {
  return (
    <div style={{ ...s.fieldRow, flexWrap: 'wrap' as const }}>
      <div style={s.fieldInfo}>
        <div style={s.fieldLabel}>{label}</div>
        <div style={s.fieldDesc}>{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="time"
          value={startVal}
          disabled={disabled}
          onChange={(e) => onChangeStart(e.target.value)}
          style={s.timeInput}
        />
        <span style={{ fontSize: '13px', color: '#888' }}>~</span>
        <input
          type="time"
          value={endVal}
          disabled={disabled}
          onChange={(e) => onChangeEnd(e.target.value)}
          style={s.timeInput}
        />
      </div>
    </div>
  )
}

/* ── 스타일 ──────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:      { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navItemActive: { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 600 },
  main:         { flex: 1, padding: '32px' },
  pageTitle:    { fontSize: '22px', fontWeight: 700, margin: '0 0 24px' },

  statusRow:   { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' as const },
  statusCard:  { background: 'white', borderRadius: '10px', padding: '16px 20px', flex: '1 1 160px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  statusLabel: { fontSize: '12px', color: '#888', marginBottom: '6px' },
  statusValue: { fontSize: '16px', fontWeight: 700 },

  card:       { background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '20px', overflow: 'hidden' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid #f0f0f0' },
  cardTitle:  { fontSize: '16px', fontWeight: 700 },
  cardSub:    { fontSize: '12px', color: '#888', marginTop: '2px' },
  proBadge:   { background: '#fff3e0', color: '#e65100', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', border: '1px solid #ffcc80' },

  lockedBox:  { padding: '40px', textAlign: 'center' as const, color: '#666' },
  fieldList:  { padding: '8px 0' },
  fieldRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', gap: '16px' },
  fieldInfo:  { flex: 1 },
  fieldLabel: { fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginBottom: '2px' },
  fieldDesc:  { fontSize: '12px', color: '#888' },
  divider:    { borderTop: '1px solid #f5f5f5', margin: '0 24px' },

  toggle:     { width: '44px', height: '24px', borderRadius: '12px', border: 'none', position: 'relative' as const, transition: 'background 0.2s', flexShrink: 0 },
  toggleKnob: { position: 'absolute' as const, top: '2px', width: '20px', height: '20px', background: 'white', borderRadius: '50%', transition: 'transform 0.2s', display: 'block' },

  numInput:   { width: '72px', padding: '6px 10px', fontSize: '15px', fontWeight: 700, border: '1px solid #ddd', borderRadius: '6px', textAlign: 'center' as const },
  timeInput:  { padding: '6px 10px', fontSize: '14px', fontWeight: 600, border: '1px solid #ddd', borderRadius: '6px', color: '#1a1a2e' },

  msgBox:     { borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '12px' },
  saveBtn:    { width: '100%', padding: '14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' },

  helpCard:   { background: '#f8f9fa', borderRadius: '10px', padding: '18px 20px' },
  helpTitle:  { fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: '#1565c0' },
  helpItem:   { fontSize: '13px', color: '#555', lineHeight: 1.8 },
}
