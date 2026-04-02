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

  if (loading) return <div className="p-8 max-w-[800px] mx-auto font-sans"><p className="text-muted2-brand">불러오는 중...</p></div>
  if (!profile) return <div className="p-8 max-w-[800px] mx-auto font-sans"><p className="text-[#ef4444]">회사 정보를 불러올 수 없습니다.</p></div>

  const vs = profile.externalVerificationStatus

  return (
    <div className="p-8 max-w-[800px] mx-auto font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[22px] font-bold text-fore-brand m-0">내 회사 정보</h1>
        {!editing && (
          <button
            onClick={startEdit}
            className="px-4 py-2 bg-card border border-brand rounded-md cursor-pointer text-[13px] text-body-brand"
          >
            수정
          </button>
        )}
      </div>

      {msg && (
        <div
          className="px-[14px] py-[10px] rounded-md mb-4 text-[13px]"
          style={{
            background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: msg.type === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          {msg.text}
        </div>
      )}

      {/* 인증 상태 배너 */}
      {vs && (
        <div
          className="px-4 py-3 rounded-lg mb-5 text-[13px]"
          style={{
            background: vs === 'VERIFIED' ? '#d1fae5' : vs === 'PENDING_VERIFICATION' ? '#fef3c7' : '#f3f4f6',
            color: vs === 'VERIFIED' ? '#065f46' : vs === 'PENDING_VERIFICATION' ? '#92400e' : '#374151',
            border: `1px solid ${vs === 'VERIFIED' ? '#6ee7b7' : vs === 'PENDING_VERIFICATION' ? '#fde047' : '#d1d5db'}`,
          }}
        >
          <strong>사업자 인증 상태:</strong> {VERIFICATION_STATUS_LABELS[vs] ?? vs}
          {vs === 'PENDING_VERIFICATION' && ' — 관리자 검토 중입니다.'}
          {vs === 'REJECTED' && ` — 반려 사유를 확인하고 재신청해 주세요.`}
          {vs === 'VERIFIED' && ` (${fmtDate(profile.verifiedAt)})`}
        </div>
      )}

      <div className="bg-card border border-brand rounded-xl p-6">
        {editing ? (
          <div>
            <h2 className="text-[15px] font-semibold text-fore-brand mb-4 mt-0">연락처 정보 수정</h2>
            <p className="text-[12px] text-muted-brand mb-4">
              회사명·사업자번호 등 공식 정보는 관리자에게 수정을 요청하세요.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'contactName', label: '담당자명' },
                { key: 'contactPhone', label: '담당자 연락처' },
                { key: 'email', label: '이메일' },
                { key: 'address', label: '주소' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[12px] text-muted-brand mb-1">{label}</label>
                  <input
                    className="w-full border border-brand rounded-md px-[10px] py-2 text-[13px] box-border"
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-[12px] text-muted-brand mb-1">메모</label>
                <textarea
                  rows={3}
                  className="w-full border border-brand rounded-md px-[10px] py-2 text-[13px] box-border resize-y"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-brand-accent text-white border-none rounded-md cursor-pointer text-[13px]"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-card border border-brand rounded-md cursor-pointer text-[13px] text-body-brand"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-[15px] font-semibold text-fore-brand mb-4 mt-0">회사 기본정보</h2>
            <div className="grid grid-cols-2 gap-4">
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
                <span className="block text-[11px] text-muted2-brand mb-1">인증 상태</span>
                {vs ? (
                  <span
                    className="text-[12px] px-2 py-[2px] rounded font-semibold"
                    style={vsStyle(vs)}
                  >
                    {VERIFICATION_STATUS_LABELS[vs] ?? vs}
                  </span>
                ) : <span className="block text-[14px] text-body-brand">해당 없음</span>}
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
    <div className={fullWidth ? 'col-span-2' : ''}>
      <span className="block text-[11px] text-muted2-brand mb-1">{label}</span>
      <span className="block text-[14px] text-body-brand">{value ?? '—'}</span>
    </div>
  )
}
