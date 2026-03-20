'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Site {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  allowedRadius: number
  qrToken: string
  isActive: boolean
  createdAt: string
}

export default function SitesPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '', allowedRadius: '100' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newQr, setNewQr] = useState<{ siteName: string; qrToken: string } | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/sites?includeInactive=true')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setSites(data.data)
        setLoading(false)
      })
  }

  useEffect(load, [router])

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    const payload = {
      name: form.name,
      address: form.address,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      allowedRadius: parseInt(form.allowedRadius, 10),
    }
    const res = await fetch('/api/admin/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!data.success) { setFormError(data.message); setSaving(false); return }
    setShowForm(false)
    setNewQr({ siteName: form.name, qrToken: data.data.qrToken })
    setForm({ name: '', address: '', latitude: '', longitude: '', allowedRadius: '100' })
    load()
    setSaving(false)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'],
        ].map(([href, label]) => <Link key={href} href={href} style={styles.navItem}>{label}</Link>)}
      </nav>
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.pageTitle}>현장 관리</h1>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ 현장 등록</button>
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div style={styles.grid}>
            {sites.map((site) => (
              <div key={site.id} style={{ ...styles.siteCard, opacity: site.isActive ? 1 : 0.6 }}>
                <div style={styles.siteName}>{site.name}</div>
                <div style={styles.siteAddress}>{site.address}</div>
                <div style={styles.siteInfo}>GPS 반경: {site.allowedRadius}m</div>
                <div style={styles.siteInfo}>위도: {site.latitude} / 경도: {site.longitude}</div>
                <div style={styles.qrBox}>
                  <div style={styles.qrLabel}>QR URL</div>
                  <div style={styles.qrUrl}>{baseUrl}/qr/{site.qrToken}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${baseUrl}/qr/${site.qrToken}`)}
                      style={styles.copyBtn}
                    >
                      URL 복사
                    </button>
                    <a
                      href={`/api/admin/sites/qr?siteId=${site.id}`}
                      download={`QR_${site.name}.png`}
                      style={{ ...styles.copyBtn, textDecoration: 'none', display: 'inline-block' }}
                    >
                      QR 다운로드
                    </a>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '12px', color: site.isActive ? '#2e7d32' : '#999', fontWeight: 600 }}>
                    {site.isActive ? '활성' : '비활성'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#bbb' }}>{new Date(site.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            ))}
            {sites.length === 0 && (
              <p style={{ color: '#999' }}>등록된 현장이 없습니다.</p>
            )}
          </div>
        )}

        {/* 등록 모달 */}
        {showForm && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={{ margin: '0 0 20px' }}>현장 등록</h3>
              {[
                { label: '현장명', key: 'name', placeholder: '해한 1호 현장' },
                { label: '주소', key: 'address', placeholder: '서울시 강남구 ...' },
                { label: '위도', key: 'latitude', placeholder: '37.5065' },
                { label: '경도', key: 'longitude', placeholder: '127.0536' },
                { label: 'GPS 허용 반경 (m)', key: 'allowedRadius', placeholder: '100' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={styles.input}
                  />
                </div>
              ))}
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 16px' }}>
                위도/경도는 Google Maps 등에서 확인하세요. (예: 37.5065, 127.0536)
              </p>
              {formError && <p style={{ color: '#e53935', fontSize: '13px' }}>{formError}</p>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>{saving ? '저장 중...' : '등록'}</button>
                <button onClick={() => setShowForm(false)} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* QR 발급 완료 모달 */}
        {newQr && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '12px' }}>✅</div>
              <h3 style={{ margin: '0 0 12px', textAlign: 'center' }}>현장 등록 완료</h3>
              <p style={{ fontSize: '14px', color: '#555', textAlign: 'center', marginBottom: '16px' }}>
                {newQr.siteName}의 QR URL이 발급되었습니다.
              </p>
              <div style={styles.qrBox}>
                <div style={{ wordBreak: 'break-all', fontSize: '13px', color: '#1976d2' }}>
                  {baseUrl}/qr/{newQr.qrToken}
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#888', margin: '12px 0' }}>
                이 URL을 QR코드 생성 사이트에서 QR코드로 변환하여 현장에 부착하세요.
              </p>
              <button onClick={() => setNewQr(null)} style={{ ...styles.saveBtn, width: '100%' }}>확인</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar: { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main: { flex: 1, padding: '32px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle: { fontSize: '22px', fontWeight: 700, margin: 0 },
  addBtn: { padding: '10px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' },
  siteCard: { background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  siteName: { fontSize: '18px', fontWeight: 700, marginBottom: '6px' },
  siteAddress: { fontSize: '13px', color: '#666', marginBottom: '12px' },
  siteInfo: { fontSize: '12px', color: '#888', marginBottom: '4px' },
  qrBox: { background: '#f8f9fa', borderRadius: '8px', padding: '12px', marginTop: '12px' },
  qrLabel: { fontSize: '11px', color: '#999', marginBottom: '4px' },
  qrUrl: { fontSize: '12px', color: '#1976d2', wordBreak: 'break-all', marginBottom: '8px' },
  copyBtn: { padding: '4px 10px', fontSize: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'white', borderRadius: '12px', padding: '32px', width: '440px', maxWidth: '90vw' },
  label: { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' },
  input: { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' as const },
  saveBtn: { flex: 1, padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 },
  cancelBtn: { flex: 1, padding: '12px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' },
}
