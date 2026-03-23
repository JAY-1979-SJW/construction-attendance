'use client'

import { useState, useEffect } from 'react'

interface CompanyProfile {
  id: string
  companyName: string
  companyCode: string | null
  businessNumber: string | null
  corpNumber: string | null
  representativeName: string | null
  companyType: string
  contactName: string | null
  contactPhone: string | null
  email: string | null
  address: string | null
  notes: string | null
  status: string
  externalVerificationStatus: string | null
  verifiedAt: string | null
  createdAt: string
}

const COMPANY_TYPE_LABELS: Record<string, string> = {
  SELF: '자사', PARTNER: '협력사', SUBCONTRACTOR: '하청', GENERAL_CONSTRUCTOR: '종합건설',
  SPECIALTY_CONSTRUCTOR: '전문건설', SUPPLIER: '자재납품', INSPECTION: '감리', OTHER: '기타',
}

const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: '미신청', PENDING_VERIFICATION: '검토중', VERIFIED: '인증완료',
  REJECTED: '반려', INACTIVE: '비활성',
}

const VERIFICATION_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-700',
  VERIFIED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
  INACTIVE: 'bg-gray-100 text-gray-400',
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('ko-KR') : '—'
}

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState({
    contactName: '', contactPhone: '', email: '', address: '', notes: '',
  })

  const load = () => {
    setLoading(true)
    fetch('/api/company/profile')
      .then(r => r.json())
      .then(d => {
        if (d.success) setProfile(d.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startEdit = () => {
    if (!profile) return
    setForm({
      contactName:  profile.contactName  ?? '',
      contactPhone: profile.contactPhone ?? '',
      email:        profile.email        ?? '',
      address:      profile.address      ?? '',
      notes:        profile.notes        ?? '',
    })
    setEditing(true)
    setMsg(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/company/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (res.ok) {
        setMsg({ type: 'success', text: '저장되었습니다.' })
        setEditing(false)
        load()
      } else {
        setMsg({ type: 'error', text: d.error ?? '저장 실패' })
      }
    } finally { setSaving(false) }
  }

  if (loading) return <div style={styles.container}><p style={{ color: '#9ca3af' }}>불러오는 중...</p></div>
  if (!profile) return <div style={styles.container}><p style={{ color: '#ef4444' }}>회사 정보를 불러올 수 없습니다.</p></div>

  const vs = profile.externalVerificationStatus

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>내 회사 정보</h1>
        {!editing && (
          <button onClick={startEdit} style={styles.editBtn}>수정</button>
        )}
      </div>

      {msg && (
        <div style={{ ...styles.msg, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b' }}>
          {msg.text}
        </div>
      )}

      {/* 인증 상태 배너 */}
      {vs && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          background: vs === 'VERIFIED' ? '#d1fae5' : vs === 'PENDING_VERIFICATION' ? '#fef3c7' : '#f3f4f6',
          color: vs === 'VERIFIED' ? '#065f46' : vs === 'PENDING_VERIFICATION' ? '#92400e' : '#374151',
          border: `1px solid ${vs === 'VERIFIED' ? '#6ee7b7' : vs === 'PENDING_VERIFICATION' ? '#fde047' : '#d1d5db'}`,
        }}>
          <strong>사업자 인증 상태:</strong> {VERIFICATION_STATUS_LABELS[vs] ?? vs}
          {vs === 'PENDING_VERIFICATION' && ' — 관리자 검토 중입니다.'}
          {vs === 'REJECTED' && ` — 반려 사유를 확인하고 재신청해 주세요.`}
          {vs === 'VERIFIED' && ` (${fmtDate(profile.verifiedAt)})`}
        </div>
      )}

      <div style={styles.card}>
        {editing ? (
          <div>
            <h2 style={styles.sectionTitle}>연락처 정보 수정</h2>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
              회사명·사업자번호 등 공식 정보는 관리자에게 수정을 요청하세요.
            </p>
            <div style={styles.grid}>
              {[
                { key: 'contactName', label: '담당자명' },
                { key: 'contactPhone', label: '담당자 연락처' },
                { key: 'email', label: '이메일' },
                { key: 'address', label: '주소' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={styles.label}>{label}</label>
                  <input
                    style={styles.input}
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={styles.label}>메모</label>
                <textarea
                  rows={3}
                  style={{ ...styles.input, resize: 'vertical' }}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setEditing(false)} style={styles.cancelBtn}>취소</button>
            </div>
          </div>
        ) : (
          <div>
            <h2 style={styles.sectionTitle}>회사 기본정보</h2>
            <div style={styles.infoGrid}>
              <InfoRow label="회사명" value={profile.companyName} />
              <InfoRow label="사업자번호" value={profile.businessNumber} />
              <InfoRow label="법인번호" value={profile.corpNumber} />
              <InfoRow label="대표자" value={profile.representativeName} />
              <InfoRow label="업종" value={COMPANY_TYPE_LABELS[profile.companyType] ?? profile.companyType} />
              <InfoRow label="회사 코드" value={profile.companyCode} />
              <InfoRow label="담당자명" value={profile.contactName} />
              <InfoRow label="담당자 연락처" value={profile.contactPhone} />
              <InfoRow label="이메일" value={profile.email} />
              <InfoRow label="주소" value={profile.address} fullWidth />
              {profile.notes && <InfoRow label="메모" value={profile.notes} fullWidth />}
              <div>
                <span style={styles.infoLabel}>인증 상태</span>
                {vs ? (
                  <span style={{
                    fontSize: '12px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
                    ...vsStyle(vs),
                  }}>
                    {VERIFICATION_STATUS_LABELS[vs] ?? vs}
                  </span>
                ) : <span style={styles.infoValue}>해당 없음</span>}
              </div>
              <InfoRow label="등록일" value={fmtDate(profile.createdAt)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function vsStyle(vs: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    DRAFT:                { background: '#f3f4f6', color: '#6b7280' },
    PENDING_VERIFICATION: { background: '#fef3c7', color: '#92400e' },
    VERIFIED:             { background: '#d1fae5', color: '#065f46' },
    REJECTED:             { background: '#fee2e2', color: '#991b1b' },
    INACTIVE:             { background: '#f3f4f6', color: '#9ca3af' },
  }
  return map[vs] ?? { background: '#f3f4f6', color: '#6b7280' }
}

function InfoRow({ label, value, fullWidth }: { label: string; value: string | null | undefined; fullWidth?: boolean }) {
  return (
    <div style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value ?? '—'}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '32px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 },
  editBtn: {
    padding: '8px 16px', background: '#243144', border: '1px solid rgba(91,164,217,0.3)',
    borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151',
  },
  card: {
    background: '#243144', border: '1px solid #e5e7eb', borderRadius: '12px',
    padding: '24px',
  },
  sectionTitle: { fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px', marginTop: 0 },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  infoLabel: { display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' },
  infoValue: { display: 'block', fontSize: '14px', color: '#374151' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  label: { display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' },
  input: {
    width: '100%', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px',
    padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box',
  },
  saveBtn: {
    padding: '8px 20px', background: '#0f4c75', color: 'white',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
  },
  cancelBtn: {
    padding: '8px 16px', background: '#243144', border: '1px solid rgba(91,164,217,0.3)',
    borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151',
  },
  msg: { padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' },
}
