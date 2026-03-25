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
  SELF: '?êÏÇ¨', PARTNER: '?ëÎ†•??, SUBCONTRACTOR: '?òÏ≤≠', GENERAL_CONSTRUCTOR: 'Ï¢ÖÌï©Í±¥ÏÑ§',
  SPECIALTY_CONSTRUCTOR: '?ÑÎ¨∏Í±¥ÏÑ§', SUPPLIER: '?êÏû¨?©Ìíà', INSPECTION: 'Í∞êÎ¶¨', OTHER: 'Í∏∞Ì?',
}

const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'ÎØ∏Ïã†Ï≤?, PENDING_VERIFICATION: 'Í≤Ä?†Ï§ë', VERIFIED: '?∏Ï¶ù?ÑÎ£å',
  REJECTED: 'Î∞òÎ†§', INACTIVE: 'ÎπÑÌôú??,
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('ko-KR') : '??
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
        setMsg({ type: 'success', text: '?Ä?•Îêò?àÏäµ?àÎã§.' })
        setEditing(false)
        load()
      } else {
        setMsg({ type: 'error', text: d.error ?? '?Ä???§Ìå®' })
      }
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 max-w-[800px] mx-auto font-sans"><p className="text-[#9ca3af]">Î∂àÎü¨?§Îäî Ï§?..</p></div>
  if (!profile) return <div className="p-8 max-w-[800px] mx-auto font-sans"><p className="text-[#ef4444]">?åÏÇ¨ ?ïÎ≥¥Î•?Î∂àÎü¨?????ÜÏäµ?àÎã§.</p></div>

  const vs = profile.externalVerificationStatus

  return (
    <div className="p-8 max-w-[800px] mx-auto font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[22px] font-bold text-[#111827] m-0">???åÏÇ¨ ?ïÎ≥¥</h1>
        {!editing && (
          <button
            onClick={startEdit}
            className="px-4 py-2 bg-card border border-[rgba(91,164,217,0.3)] rounded-md cursor-pointer text-[13px] text-[#374151]"
          >
            ?òÏ†ï
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

      {/* ?∏Ï¶ù ?ÅÌÉú Î∞∞ÎÑà */}
      {vs && (
        <div
          className="px-4 py-3 rounded-lg mb-5 text-[13px]"
          style={{
            background: vs === 'VERIFIED' ? '#d1fae5' : vs === 'PENDING_VERIFICATION' ? '#fef3c7' : '#f3f4f6',
            color: vs === 'VERIFIED' ? '#065f46' : vs === 'PENDING_VERIFICATION' ? '#92400e' : '#374151',
            border: `1px solid ${vs === 'VERIFIED' ? '#6ee7b7' : vs === 'PENDING_VERIFICATION' ? '#fde047' : '#d1d5db'}`,
          }}
        >
          <strong>?¨ÏóÖ???∏Ï¶ù ?ÅÌÉú:</strong> {VERIFICATION_STATUS_LABELS[vs] ?? vs}
          {vs === 'PENDING_VERIFICATION' && ' ??Í¥ÄÎ¶¨Ïûê Í≤Ä??Ï§ëÏûÖ?àÎã§.'}
          {vs === 'REJECTED' && ` ??Î∞òÎ†§ ?¨Ïú†Î•??ïÏù∏?òÍ≥† ?¨Ïã†Ï≤?ï¥ Ï£ºÏÑ∏??`}
          {vs === 'VERIFIED' && ` (${fmtDate(profile.verifiedAt)})`}
        </div>
      )}

      <div className="bg-card border border-[#e5e7eb] rounded-xl p-6">
        {editing ? (
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827] mb-4 mt-0">?∞ÎùΩÏ≤??ïÎ≥¥ ?òÏ†ï</h2>
            <p className="text-[12px] text-[#6b7280] mb-4">
              ?åÏÇ¨Î™Ö¬∑ÏÇ¨?ÖÏûêÎ≤àÌò∏ ??Í≥µÏãù ?ïÎ≥¥??Í¥ÄÎ¶¨Ïûê?êÍ≤å ?òÏ†ï???îÏ≤≠?òÏÑ∏??
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'contactName', label: '?¥Îãπ?êÎ™Ö' },
                { key: 'contactPhone', label: '?¥Îãπ???∞ÎùΩÏ≤? },
                { key: 'email', label: '?¥Î©î?? },
                { key: 'address', label: 'Ï£ºÏÜå' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[12px] text-[#6b7280] mb-1">{label}</label>
                  <input
                    className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-[12px] text-[#6b7280] mb-1">Î©îÎ™®</label>
                <textarea
                  rows={3}
                  className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border resize-y"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-[#F97316] text-white border-none rounded-md cursor-pointer text-[13px]"
              >
                {saving ? '?Ä??Ï§?..' : '?Ä??}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-card border border-[rgba(91,164,217,0.3)] rounded-md cursor-pointer text-[13px] text-[#374151]"
              >
                Ï∑®ÏÜå
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827] mb-4 mt-0">?åÏÇ¨ Í∏∞Î≥∏?ïÎ≥¥</h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="?åÏÇ¨Î™? value={profile.companyName} />
              <InfoRow label="?¨ÏóÖ?êÎ≤à?? value={profile.businessNumber} />
              <InfoRow label="Î≤ïÏù∏Î≤àÌò∏" value={profile.corpNumber} />
              <InfoRow label="?Ä?úÏûê" value={profile.representativeName} />
              <InfoRow label="?ÖÏ¢Ö" value={COMPANY_TYPE_LABELS[profile.companyType] ?? profile.companyType} />
              <InfoRow label="?åÏÇ¨ ÏΩîÎìú" value={profile.companyCode} />
              <InfoRow label="?¥Îãπ?êÎ™Ö" value={profile.contactName} />
              <InfoRow label="?¥Îãπ???∞ÎùΩÏ≤? value={profile.contactPhone} />
              <InfoRow label="?¥Î©î?? value={profile.email} />
              <InfoRow label="Ï£ºÏÜå" value={profile.address} fullWidth />
              {profile.notes && <InfoRow label="Î©îÎ™®" value={profile.notes} fullWidth />}
              <div>
                <span className="block text-[11px] text-[#9ca3af] mb-1">?∏Ï¶ù ?ÅÌÉú</span>
                {vs ? (
                  <span
                    className="text-[12px] px-2 py-[2px] rounded font-semibold"
                    style={vsStyle(vs)}
                  >
                    {VERIFICATION_STATUS_LABELS[vs] ?? vs}
                  </span>
                ) : <span className="block text-[14px] text-[#374151]">?¥Îãπ ?ÜÏùå</span>}
              </div>
              <InfoRow label="?±Î°ù?? value={fmtDate(profile.createdAt)} />
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
      <span className="block text-[11px] text-[#9ca3af] mb-1">{label}</span>
      <span className="block text-[14px] text-[#374151]">{value ?? '??}</span>
    </div>
  )
}
