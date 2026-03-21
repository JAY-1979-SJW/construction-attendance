'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

declare global {
  interface Window {
    daum: {
      Postcode: new (opts: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string; x: string; y: string }) => void
      }) => { open: () => void }
    }
  }
}

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

const emptyForm = { name: '', address: '', latitude: '', longitude: '', allowedRadius: '100' }

export default function SitesPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  // 등록 모달
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newQr, setNewQr] = useState<{ siteName: string; qrToken: string } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  // 카카오 우편번호 스크립트 로드
  useEffect(() => {
    if (document.getElementById('kakao-postcode-script')) return
    const script = document.createElement('script')
    script.id = 'kakao-postcode-script'
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    document.head.appendChild(script)
  }, [])

  const openAddressSearch = (target: 'form' | 'edit') => {
    if (!window.daum?.Postcode) { alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.'); return }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const address = data.roadAddress || data.jibunAddress
        const lat = data.y   // 위도
        const lng = data.x   // 경도
        if (target === 'form') setForm((f) => ({ ...f, address, latitude: lat, longitude: lng }))
        else setEditForm((f) => ({ ...f, address, latitude: lat, longitude: lng }))
      },
    }).open()
  }

  const fillCurrentLocation = (target: 'form' | 'edit') => {
    if (!navigator.geolocation) { alert('이 브라우저는 GPS를 지원하지 않습니다.'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = String(pos.coords.latitude.toFixed(7))
        const lng = String(pos.coords.longitude.toFixed(7))
        if (target === 'form') setForm((f) => ({ ...f, latitude: lat, longitude: lng }))
        else setEditForm((f) => ({ ...f, latitude: lat, longitude: lng }))
        setGpsLoading(false)
      },
      () => { alert('GPS 위치를 가져올 수 없습니다. 위치 권한을 허용해 주세요.'); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // 수정 모달
  const [editTarget, setEditTarget] = useState<Site | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editActive, setEditActive] = useState(true)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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

  // ── 등록 ─────────────────────────────────────────────────────
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
    setForm(emptyForm)
    load()
    setSaving(false)
  }

  // ── 수정 모달 열기 ────────────────────────────────────────────
  const openEdit = (site: Site) => {
    setEditTarget(site)
    setEditForm({
      name: site.name,
      address: site.address,
      latitude: String(site.latitude),
      longitude: String(site.longitude),
      allowedRadius: String(site.allowedRadius),
    })
    setEditActive(site.isActive)
    setEditError('')
  }

  // ── 수정 저장 ─────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editTarget) return
    setEditSaving(true)
    setEditError('')
    const payload = {
      name: editForm.name,
      address: editForm.address,
      latitude: parseFloat(editForm.latitude),
      longitude: parseFloat(editForm.longitude),
      allowedRadius: parseInt(editForm.allowedRadius, 10),
      isActive: editActive,
    }
    const res = await fetch(`/api/admin/sites/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!data.success) { setEditError(data.message); setEditSaving(false); return }
    setEditTarget(null)
    load()
    setEditSaving(false)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={styles.navItem}>{label}</Link>
        ))}
      </nav>

      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.pageTitle}>현장 관리</h1>
          {canMutate && <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ 현장 등록</button>}
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div style={styles.grid}>
            {sites.map((site) => (
              <div key={site.id} style={{ ...styles.siteCard, opacity: site.isActive ? 1 : 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={styles.siteName}>{site.name}</div>
                  {canMutate && <button onClick={() => openEdit(site)} style={styles.editBtn}>수정</button>}
                </div>
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
            {sites.length === 0 && <p style={{ color: '#999' }}>등록된 현장이 없습니다.</p>}
          </div>
        )}

        {/* ── 등록 모달 ─────────────────────────────────────── */}
        {showForm && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={styles.modalTitle}>현장 등록</h3>
              <div style={styles.fieldRow}>
                <label style={styles.label}>현장명</label>
                <input
                  type="text"
                  placeholder="해한 1호 현장"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.fieldRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={styles.label}>주소</label>
                  <button type="button" onClick={() => openAddressSearch('form')} style={styles.addrBtn}>
                    🔍 주소 검색
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="주소 검색 버튼을 눌러주세요"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={styles.input}
                />
                <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0' }}>
                  주소 검색 시 위도/경도가 자동으로 채워집니다.
                </p>
              </div>
              <div style={styles.fieldRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={styles.label}>GPS 좌표 (위도 / 경도)</label>
                  <button
                    type="button"
                    onClick={() => fillCurrentLocation('form')}
                    disabled={gpsLoading}
                    style={styles.gpsBtn}
                  >
                    {gpsLoading ? '위치 확인 중...' : '📍 현재 위치 자동 입력'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="위도 37.5065"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    style={{ ...styles.input, flex: 1 }}
                  />
                  <input
                    type="text"
                    placeholder="경도 127.0536"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    style={{ ...styles.input, flex: 1 }}
                  />
                </div>
                <p style={{ fontSize: '12px', color: '#888', margin: '6px 0 0' }}>
                  현장에서 "현재 위치 자동 입력" 버튼을 누르면 자동으로 채워집니다.
                </p>
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>GPS 허용 반경 (m)</label>
                <input
                  type="text"
                  placeholder="100"
                  value={form.allowedRadius}
                  onChange={(e) => setForm({ ...form, allowedRadius: e.target.value })}
                  style={styles.input}
                />
              </div>
              {formError && <p style={styles.error}>{formError}</p>}
              <div style={styles.btnRow}>
                <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
                  {saving ? '저장 중...' : '등록'}
                </button>
                <button onClick={() => { setShowForm(false); setFormError('') }} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 수정 모달 ─────────────────────────────────────── */}
        {editTarget && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={styles.modalTitle}>현장 수정 — {editTarget.name}</h3>
              <div style={styles.fieldRow}>
                <label style={styles.label}>현장명</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.fieldRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={styles.label}>주소</label>
                  <button type="button" onClick={() => openAddressSearch('edit')} style={styles.addrBtn}>
                    🔍 주소 검색
                  </button>
                </div>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.fieldRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={styles.label}>GPS 좌표 (위도 / 경도)</label>
                  <button
                    type="button"
                    onClick={() => fillCurrentLocation('edit')}
                    disabled={gpsLoading}
                    style={styles.gpsBtn}
                  >
                    {gpsLoading ? '위치 확인 중...' : '📍 현재 위치 자동 입력'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={editForm.latitude}
                    onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                    style={{ ...styles.input, flex: 1 }}
                  />
                  <input
                    type="text"
                    value={editForm.longitude}
                    onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                    style={{ ...styles.input, flex: 1 }}
                  />
                </div>
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>GPS 허용 반경 (m)</label>
                <input
                  type="text"
                  value={editForm.allowedRadius}
                  onChange={(e) => setEditForm({ ...editForm, allowedRadius: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  id="editSiteActive"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                <label htmlFor="editSiteActive" style={{ fontSize: '14px' }}>현장 활성 상태</label>
              </div>
              {editError && <p style={styles.error}>{editError}</p>}
              <div style={styles.btnRow}>
                <button onClick={handleEdit} disabled={editSaving} style={styles.saveBtn}>
                  {editSaving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setEditTarget(null)} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── QR 발급 완료 모달 ─────────────────────────────── */}
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
  editBtn: { padding: '4px 10px', fontSize: '12px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 },
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'white', borderRadius: '12px', padding: '32px', width: '440px', maxWidth: '90vw' },
  modalTitle: { margin: '0 0 20px', fontSize: '18px', fontWeight: 700 },
  fieldRow: { marginBottom: '12px' },
  label: { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' },
  input: { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' as const },
  error: { color: '#e53935', fontSize: '13px', margin: '0 0 12px' },
  btnRow: { display: 'flex', gap: '8px', marginTop: '16px' },
  saveBtn: { flex: 1, padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 },
  cancelBtn: { flex: 1, padding: '12px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  gpsBtn: { padding: '6px 12px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' as const },
  addrBtn: { padding: '6px 12px', background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' as const },
}
