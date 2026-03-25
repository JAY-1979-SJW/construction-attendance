'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Site {
  id: string
  name: string
}

export default function NewMaterialRequestPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [title, setTitle] = useState('')
  const [siteId, setSiteId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => {
        if (d.success) setSites(d.data.sites ?? d.data ?? [])
      })
  }, [])

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('제목을 입력하세요.'); return }
    setSubmitting(true)
    setError('')
    try {
      const body: Record<string, unknown> = { title: title.trim() }
      if (siteId) body.siteId = siteId
      if (notes.trim()) body.notes = notes.trim()
      if (deliveryDate) body.deliveryRequestedAt = new Date(deliveryDate).toISOString()

      const res = await fetch('/api/admin/materials/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!d.success) { setError(d.error ?? '생성 실패'); return }
      router.push(`/admin/materials/requests/${d.data.id}`)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-[760px]">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Link href="/admin/materials/requests" style={S.backBtn}>← 목록</Link>
          <div>
            <h1 style={S.pageTitle}>청구서 작성</h1>
            <p style={S.pageDesc}>새 자재청구서를 작성합니다.</p>
          </div>
        </div>

        <div style={S.card}>
          <form onSubmit={handleSubmit}>
            <div style={S.formGrid}>
              <div style={S.formGroup}>
                <label style={S.label}>제목 *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="청구서 제목을 입력하세요"
                  style={S.input}
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>현장</label>
                <select value={siteId} onChange={e => setSiteId(e.target.value)} style={S.select}>
                  <option value="">현장 미지정</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>납품 요청일</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  style={S.input}
                />
              </div>

              <div style={{ ...S.formGroup, gridColumn: '1 / -1' }}>
                <label style={S.label}>비고</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="청구 관련 메모 (선택)"
                  rows={3}
                  style={{ ...S.input, resize: 'vertical' }}
                />
              </div>
            </div>

            {error && <div style={S.errorMsg}>{error}</div>}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <Link href="/admin/materials/requests" style={S.cancelBtn}>취소</Link>
              <button type="submit" disabled={submitting} style={S.primaryBtn}>
                {submitting ? '생성 중...' : '청구서 생성'}
              </button>
            </div>
          </form>
        </div>

        <div style={S.infoBox}>
          <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.8' }}>
            <strong style={{ color: '#111827' }}>작성 순서</strong><br />
            1. 청구서 생성 → 2. 품목 추가 → 3. 검토 후 제출<br />
            <span style={{ fontSize: '12px' }}>생성 후 자재 품목을 추가하고 제출하면 담당자가 검토합니다.</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#F5F7FA', color: '#111827' },
  sidebar: { width: '220px', background: '#FFFFFF', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB' },
  sidebarTitle: { color: '#111827', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid #E5E7EB' },
  navSection: { color: '#9CA3AF', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem: { display: 'block', color: '#374151', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navItemActive: { display: 'block', color: '#111827', padding: '10px 20px', fontSize: '14px', textDecoration: 'none', background: '#FFF7ED', borderLeft: '3px solid #F97316' },
  logoutBtn: { margin: '24px 20px 0', padding: '10px', background: '#F3F4F6', border: 'none', borderRadius: '6px', color: '#6B7280', cursor: 'pointer', fontSize: '13px' },
  main: { flex: 1, padding: '32px', maxWidth: '760px' },
  pageTitle: { fontSize: '24px', fontWeight: 700, margin: '0 0 4px', color: '#111827' },
  pageDesc: { fontSize: '14px', color: '#6B7280', margin: 0 },
  backBtn: { color: '#6B7280', textDecoration: 'none', fontSize: '13px', padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: '4px', whiteSpace: 'nowrap' as const },
  card: { background: '#FFFFFF', borderRadius: '10px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px', border: '1px solid #E5E7EB' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', color: '#6B7280', fontWeight: 500 },
  input: { padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '14px', background: '#FFFFFF', color: '#111827' },
  select: { padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '14px', background: '#FFFFFF', color: '#111827' },
  errorMsg: { marginTop: '12px', padding: '10px 14px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', color: '#dc2626', fontSize: '13px' },
  primaryBtn: { padding: '10px 24px', background: '#F97316', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  cancelBtn: { padding: '10px 20px', background: '#FFFFFF', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
  infoBox: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px 20px' },
}
