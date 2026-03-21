'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

// ── 전역 타입 선언 ────────────────────────────────────────────────────
declare global {
  interface Window {
    daum: {
      Postcode: new (opts: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string; x: string; y: string }) => void
      }) => { open: () => void }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any
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
const KOREA_CENTER = { lat: 36.5, lng: 127.8 }
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const MARKER_ICON = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png'
const MARKER_ICON2 = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png'
const MARKER_SHADOW = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'

// ── Leaflet 동적 로드 ─────────────────────────────────────────────────
function loadLeaflet(): Promise<void> {
  return new Promise((resolve) => {
    if (window.L) { resolve(); return }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }
    if (document.getElementById('leaflet-js')) {
      document.getElementById('leaflet-js')!.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.id = 'leaflet-js'
    script.src = LEAFLET_JS
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

export default function SitesPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  // ── 등록 모달 상태 ──────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newQr, setNewQr] = useState<{ siteName: string; qrToken: string } | null>(null)

  // ── 수정 모달 상태 ──────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<Site | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editActive, setEditActive] = useState(true)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // ── 지도 refs ───────────────────────────────────────────────────────
  const formMapDiv  = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const editMapDiv  = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formMapInst = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editMapInst = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formMarker  = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editMarker  = useRef<any>(null)

  // ── 외부 스크립트 로드 ──────────────────────────────────────────────
  useEffect(() => {
    // 카카오 우편번호
    if (!document.getElementById('kakao-postcode-script')) {
      const s = document.createElement('script')
      s.id = 'kakao-postcode-script'
      s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      document.head.appendChild(s)
    }
    // Leaflet 미리 로드
    loadLeaflet()
  }, [])

  // ── Leaflet 지도 초기화 헬퍼 ────────────────────────────────────────
  const initMap = useCallback((
    divRef: React.RefObject<HTMLDivElement>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapRef: React.MutableRefObject<any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markerRef: React.MutableRefObject<any>,
    initLat: number,
    initLng: number,
    onPick: (lat: string, lng: string) => void,
  ) => {
    if (!divRef.current || mapRef.current) return
    const L = window.L
    // 마커 아이콘 경로 수동 지정 (Next.js 빌드 오류 방지)
    const icon = L.icon({ iconUrl: MARKER_ICON, iconRetinaUrl: MARKER_ICON2, shadowUrl: MARKER_SHADOW, iconSize: [25, 41], iconAnchor: [12, 41] })
    const map = L.map(divRef.current, { zoomControl: true }).setView([initLat, initLng], initLat === KOREA_CENTER.lat ? 7 : 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // 초기 핀
    if (initLat !== KOREA_CENTER.lat) {
      markerRef.current = L.marker([initLat, initLng], { icon, draggable: true }).addTo(map)
      markerRef.current.on('dragend', () => {
        const { lat, lng } = markerRef.current.getLatLng()
        onPick(lat.toFixed(7), lng.toFixed(7))
      })
    }

    // 클릭으로 핀 이동
    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      const { lat, lng } = e.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map)
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current.getLatLng()
          onPick(pos.lat.toFixed(7), pos.lng.toFixed(7))
        })
      }
      onPick(lat.toFixed(7), lng.toFixed(7))
    })

    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 100)
  }, [])

  const destroyMap = useCallback((
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapRef: React.MutableRefObject<any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markerRef: React.MutableRefObject<any>,
  ) => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    markerRef.current = null
  }, [])

  // ── 등록 모달 지도 초기화 ───────────────────────────────────────────
  useEffect(() => {
    if (!showForm) { destroyMap(formMapInst, formMarker); return }
    loadLeaflet().then(() => {
      initMap(formMapDiv, formMapInst, formMarker, KOREA_CENTER.lat, KOREA_CENTER.lng,
        (lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng })))
    })
    return () => destroyMap(formMapInst, formMarker)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm])

  // ── 수정 모달 지도 초기화 ───────────────────────────────────────────
  useEffect(() => {
    if (!editTarget) { destroyMap(editMapInst, editMarker); return }
    const lat = parseFloat(editTarget.latitude as unknown as string) || KOREA_CENTER.lat
    const lng = parseFloat(editTarget.longitude as unknown as string) || KOREA_CENTER.lng
    loadLeaflet().then(() => {
      initMap(editMapDiv, editMapInst, editMarker, lat, lng,
        (la, lo) => setEditForm((f) => ({ ...f, latitude: la, longitude: lo })))
    })
    return () => destroyMap(editMapInst, editMarker)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget])

  // ── 지도 핀 이동 헬퍼 ───────────────────────────────────────────────
  const flyToOnMap = useCallback((
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapRef: React.MutableRefObject<any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markerRef: React.MutableRefObject<any>,
    lat: number, lng: number,
  ) => {
    if (!mapRef.current || !window.L) return
    const L = window.L
    const icon = L.icon({ iconUrl: MARKER_ICON, iconRetinaUrl: MARKER_ICON2, shadowUrl: MARKER_SHADOW, iconSize: [25, 41], iconAnchor: [12, 41] })
    mapRef.current.flyTo([lat, lng], 16)
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(mapRef.current)
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current.getLatLng()
        return pos
      })
    }
  }, [])

  // ── 주소 검색 ───────────────────────────────────────────────────────
  const openAddressSearch = (target: 'form' | 'edit') => {
    if (!window.daum?.Postcode) { alert('주소 검색 서비스 로딩 중입니다. 잠시 후 다시 시도해 주세요.'); return }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const address = data.roadAddress || data.jibunAddress
        const lat = parseFloat(data.y)
        const lng = parseFloat(data.x)
        const latStr = lat.toFixed(7)
        const lngStr = lng.toFixed(7)
        if (target === 'form') {
          setForm((f) => ({ ...f, address, latitude: latStr, longitude: lngStr }))
          flyToOnMap(formMapInst, formMarker, lat, lng)
        } else {
          setEditForm((f) => ({ ...f, address, latitude: latStr, longitude: lngStr }))
          flyToOnMap(editMapInst, editMarker, lat, lng)
        }
      },
    }).open()
  }

  // ── 현재 위치 ───────────────────────────────────────────────────────
  const [gpsLoading, setGpsLoading] = useState(false)
  const fillCurrentLocation = (target: 'form' | 'edit') => {
    if (!navigator.geolocation) { alert('이 브라우저는 GPS를 지원하지 않습니다.'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const latStr = lat.toFixed(7)
        const lngStr = lng.toFixed(7)
        if (target === 'form') {
          setForm((f) => ({ ...f, latitude: latStr, longitude: lngStr }))
          flyToOnMap(formMapInst, formMarker, lat, lng)
        } else {
          setEditForm((f) => ({ ...f, latitude: latStr, longitude: lngStr }))
          flyToOnMap(editMapInst, editMarker, lat, lng)
        }
        setGpsLoading(false)
      },
      () => { alert('GPS 위치를 가져올 수 없습니다. 위치 권한을 허용해 주세요.'); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // ── 데이터 로드 ─────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/sites?includeInactive=true')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setSites(data.data)
        setLoading(false)
      })
  }, [router])

  useEffect(() => { load() }, [load])

  // ── 등록 저장 ───────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setFormError('')
    const res = await fetch('/api/admin/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, address: form.address,
        latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude),
        allowedRadius: parseInt(form.allowedRadius, 10),
      }),
    })
    const data = await res.json()
    if (!data.success) { setFormError(data.message); setSaving(false); return }
    setShowForm(false)
    setNewQr({ siteName: form.name, qrToken: data.data.qrToken })
    setForm(emptyForm); load(); setSaving(false)
  }

  // ── 수정 모달 열기 ──────────────────────────────────────────────────
  const openEdit = (site: Site) => {
    setEditTarget(site)
    setEditForm({ name: site.name, address: site.address, latitude: String(site.latitude), longitude: String(site.longitude), allowedRadius: String(site.allowedRadius) })
    setEditActive(site.isActive); setEditError('')
  }

  // ── 수정 저장 ───────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editTarget) return
    setEditSaving(true); setEditError('')
    const res = await fetch(`/api/admin/sites/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name, address: editForm.address,
        latitude: parseFloat(editForm.latitude), longitude: parseFloat(editForm.longitude),
        allowedRadius: parseInt(editForm.allowedRadius, 10), isActive: editActive,
      }),
    })
    const data = await res.json()
    if (!data.success) { setEditError(data.message); setEditSaving(false); return }
    setEditTarget(null); load(); setEditSaving(false)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // ── 공통 모달 폼 렌더 ────────────────────────────────────────────────
  const renderFormFields = (
    f: typeof emptyForm,
    target: 'form' | 'edit',
    onChange: (key: string, val: string) => void,
    mapDivRef: React.RefObject<HTMLDivElement>,
  ) => (
    <>
      <div style={styles.fieldRow}>
        <label style={styles.label}>현장명</label>
        <input style={styles.input} value={f.name} placeholder="해한 1호 현장"
          onChange={(e) => onChange('name', e.target.value)} />
      </div>

      <div style={styles.fieldRow}>
        <div style={S.rowBetween}>
          <label style={styles.label}>주소</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" style={styles.addrBtn} onClick={() => openAddressSearch(target)}>🔍 주소 검색</button>
            <button type="button" style={styles.gpsBtn} disabled={gpsLoading} onClick={() => fillCurrentLocation(target)}>
              {gpsLoading ? '확인 중...' : '📍 현재 위치'}
            </button>
          </div>
        </div>
        <input style={styles.input} value={f.address} placeholder="주소 검색 또는 지도에서 직접 선택"
          onChange={(e) => onChange('address', e.target.value)} />
      </div>

      {/* 지도 */}
      <div style={styles.fieldRow}>
        <label style={styles.label}>지도에서 위치 선택 <span style={S.mapHint}>지도를 클릭하거나 핀을 드래그하세요</span></label>
        <div ref={mapDivRef} style={styles.mapBox} />
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>GPS 좌표 (자동 입력됨)</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input style={{ ...styles.input, flex: 1 }} placeholder="위도" value={f.latitude}
            onChange={(e) => onChange('latitude', e.target.value)} />
          <input style={{ ...styles.input, flex: 1 }} placeholder="경도" value={f.longitude}
            onChange={(e) => onChange('longitude', e.target.value)} />
        </div>
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>GPS 허용 반경 (m)</label>
        <input style={styles.input} value={f.allowedRadius} placeholder="100"
          onChange={(e) => onChange('allowedRadius', e.target.value)} />
      </div>
    </>
  )

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
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
                    <button onClick={() => navigator.clipboard.writeText(`${baseUrl}/qr/${site.qrToken}`)} style={styles.copyBtn}>URL 복사</button>
                    <a href={`/api/admin/sites/qr?siteId=${site.id}`} download={`QR_${site.name}.png`}
                      style={{ ...styles.copyBtn, textDecoration: 'none', display: 'inline-block' }}>QR 다운로드</a>
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

        {/* ── 등록 모달 ──────────────────────────────────────── */}
        {showForm && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalWide}>
              <h3 style={styles.modalTitle}>현장 등록</h3>
              {renderFormFields(form, 'form', (k, v) => setForm((f) => ({ ...f, [k]: v })), formMapDiv)}
              {formError && <p style={styles.error}>{formError}</p>}
              <div style={styles.btnRow}>
                <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>{saving ? '저장 중...' : '등록'}</button>
                <button onClick={() => { setShowForm(false); setFormError('') }} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 수정 모달 ──────────────────────────────────────── */}
        {editTarget && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalWide}>
              <h3 style={styles.modalTitle}>현장 수정 — {editTarget.name}</h3>
              {renderFormFields(editForm, 'edit', (k, v) => setEditForm((f) => ({ ...f, [k]: v })), editMapDiv)}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input type="checkbox" id="editActive" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                <label htmlFor="editActive" style={{ fontSize: '14px' }}>현장 활성 상태</label>
              </div>
              {editError && <p style={styles.error}>{editError}</p>}
              <div style={styles.btnRow}>
                <button onClick={handleEdit} disabled={editSaving} style={styles.saveBtn}>{editSaving ? '저장 중...' : '저장'}</button>
                <button onClick={() => setEditTarget(null)} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── QR 발급 완료 ──────────────────────────────────── */}
        {newQr && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '12px' }}>✅</div>
              <h3 style={{ margin: '0 0 12px', textAlign: 'center' }}>현장 등록 완료</h3>
              <p style={{ fontSize: '14px', color: '#555', textAlign: 'center', marginBottom: '16px' }}>{newQr.siteName}의 QR URL이 발급되었습니다.</p>
              <div style={styles.qrBox}>
                <div style={{ wordBreak: 'break-all', fontSize: '13px', color: '#1976d2' }}>{baseUrl}/qr/{newQr.qrToken}</div>
              </div>
              <button onClick={() => setNewQr(null)} style={{ ...styles.saveBtn, width: '100%', marginTop: '16px' }}>확인</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ── 스타일 ────────────────────────────────────────────────────────────
const S = {
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' } as React.CSSProperties,
  mapHint: { fontSize: '11px', color: '#aaa', fontWeight: 400, marginLeft: '6px' } as React.CSSProperties,
}

const styles: Record<string, React.CSSProperties> = {
  layout:      { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:     { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },
  sidebarTitle:{ color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem:     { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main:        { flex: 1, padding: '32px' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle:   { fontSize: '22px', fontWeight: 700, margin: 0 },
  addBtn:      { padding: '10px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' },
  siteCard:    { background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  siteName:    { fontSize: '18px', fontWeight: 700, marginBottom: '6px' },
  siteAddress: { fontSize: '13px', color: '#666', marginBottom: '12px' },
  siteInfo:    { fontSize: '12px', color: '#888', marginBottom: '4px' },
  qrBox:       { background: '#f8f9fa', borderRadius: '8px', padding: '12px', marginTop: '12px' },
  qrLabel:     { fontSize: '11px', color: '#999', marginBottom: '4px' },
  qrUrl:       { fontSize: '12px', color: '#1976d2', wordBreak: 'break-all', marginBottom: '8px' },
  copyBtn:     { padding: '4px 10px', fontSize: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  editBtn:     { padding: '4px 10px', fontSize: '12px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 },
  modalOverlay:{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, overflowY: 'auto' as const, padding: '24px' },
  modal:       { background: 'white', borderRadius: '12px', padding: '32px', width: '440px', maxWidth: '95vw' },
  modalWide:   { background: 'white', borderRadius: '12px', padding: '32px', width: '600px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' as const },
  modalTitle:  { margin: '0 0 20px', fontSize: '18px', fontWeight: 700 },
  fieldRow:    { marginBottom: '14px' },
  label:       { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: 600 },
  input:       { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' as const },
  mapBox:      { width: '100%', height: '280px', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' },
  error:       { color: '#e53935', fontSize: '13px', margin: '0 0 12px' },
  btnRow:      { display: 'flex', gap: '8px', marginTop: '16px' },
  saveBtn:     { flex: 1, padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 },
  cancelBtn:   { flex: 1, padding: '12px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  gpsBtn:      { padding: '6px 12px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' as const },
  addrBtn:     { padding: '6px 12px', background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' as const },
}
