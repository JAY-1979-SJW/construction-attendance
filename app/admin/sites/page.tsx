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

// ── 타입 ──────────────────────────────────────────────────────────────

interface SiteCompanyAssignment {
  id: string
  companyId: string
  company: { id: string; companyName: string; companyType?: string }
  contractType: string
  startDate: string
  endDate?: string | null
  managerName?: string | null
  managerPhone?: string | null
  notes?: string | null
}

interface Site {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  allowedRadius: number
  isActive: boolean
  siteCode?: string | null
  openedAt?: string | null
  closedAt?: string | null
  notes?: string | null
  createdAt: string
  companyAssignments: SiteCompanyAssignment[]
}

interface Company {
  id: string
  companyName: string
  companyType?: string
}

const emptyForm = { name: '', address: '', latitude: '', longitude: '', allowedRadius: '100', siteCode: '', openedAt: '', closedAt: '', notes: '' }
const KOREA_CENTER = { lat: 36.5, lng: 127.8 }
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const MARKER_ICON = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png'
const MARKER_ICON2 = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png'
const MARKER_SHADOW = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  PRIME: '원청', SUBCONTRACT: '하도급', JOINT_VENTURE: '공동도급', SPECIALTY: '전문건설',
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('ko-KR') : '—'
}

// ── Leaflet 동적 로드 ─────────────────────────────────────────────────
function loadLeaflet(): Promise<void> {
  return new Promise((resolve) => {
    if (window.L) { resolve(); return }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }
    if (document.getElementById('leaflet-js')) {
      document.getElementById('leaflet-js')!.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.id = 'leaflet-js'; script.src = LEAFLET_JS
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

  // ── 등록 모달 ──────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [registered, setRegistered] = useState<string | null>(null)

  // ── 수정 모달 ──────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<Site | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editActive, setEditActive] = useState(true)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // ── 회사 배정 모달 ─────────────────────────────────────────────────
  const [assignSite, setAssignSite] = useState<Site | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [assignForm, setAssignForm] = useState({
    companyId: '', contractType: 'SUBCONTRACT', startDate: '', endDate: '',
    managerName: '', managerPhone: '', notes: '',
  })
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState('')

  // ── 현장 상세 패널 ─────────────────────────────────────────────────
  const [detailSite, setDetailSite] = useState<Site | null>(null)

  // ── 근무시간 정책 모달 ─────────────────────────────────────────────
  const [policySite, setPolicySite] = useState<Site | null>(null)
  const [policyEffective, setPolicyEffective] = useState<{
    workStartTime: string; workEndTime: string
    breakStartTime: string | null; breakEndTime: string | null
    breakMinutes: number; isCustom: boolean
  } | null>(null)
  const [policyForm, setPolicyForm] = useState({
    workStartTime: '', workEndTime: '', breakStartTime: '', breakEndTime: '', breakMinutes: '',
  })
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policySaving, setPolicySaving] = useState(false)
  const [policyError, setPolicyError] = useState('')

  const openPolicyModal = async (site: Site) => {
    setPolicySite(site); setPolicyError(''); setPolicyEffective(null)
    setPolicyLoading(true)
    const res = await fetch(`/api/admin/sites/${site.id}/policy`)
    const data = await res.json()
    if (data.success) {
      const c = data.data.custom
      setPolicyEffective({ ...data.data.effective, isCustom: data.data.isCustom })
      setPolicyForm({
        workStartTime:  c?.workStartTime  ?? '',
        workEndTime:    c?.workEndTime    ?? '',
        breakStartTime: c?.breakStartTime ?? '',
        breakEndTime:   c?.breakEndTime   ?? '',
        breakMinutes:   c?.breakMinutes != null ? String(c.breakMinutes) : '',
      })
    }
    setPolicyLoading(false)
  }

  const handleSavePolicy = async () => {
    if (!policySite) return
    setPolicySaving(true); setPolicyError('')
    const body: Record<string, unknown> = {
      workStartTime:  policyForm.workStartTime  || null,
      workEndTime:    policyForm.workEndTime    || null,
      breakStartTime: policyForm.breakStartTime || null,
      breakEndTime:   policyForm.breakEndTime   || null,
      breakMinutes:   policyForm.breakMinutes !== '' ? parseInt(policyForm.breakMinutes, 10) : null,
    }
    const res = await fetch(`/api/admin/sites/${policySite.id}/policy`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.success) { setPolicyError(data.message ?? '저장 실패'); setPolicySaving(false); return }
    setPolicySite(null); setPolicySaving(false)
  }

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
    if (!document.getElementById('kakao-postcode-script')) {
      const s = document.createElement('script')
      s.id = 'kakao-postcode-script'
      s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      document.head.appendChild(s)
    }
    loadLeaflet()
  }, [])

  // ── Leaflet 지도 초기화 헬퍼 ────────────────────────────────────────
  const initMap = useCallback((
    divRef: React.RefObject<HTMLDivElement>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapRef: React.MutableRefObject<any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markerRef: React.MutableRefObject<any>,
    initLat: number, initLng: number,
    onPick: (lat: string, lng: string) => void,
  ) => {
    if (!divRef.current || mapRef.current) return
    const L = window.L
    const icon = L.icon({ iconUrl: MARKER_ICON, iconRetinaUrl: MARKER_ICON2, shadowUrl: MARKER_SHADOW, iconSize: [25, 41], iconAnchor: [12, 41] })
    const map = L.map(divRef.current, { zoomControl: true }).setView([initLat, initLng], initLat === KOREA_CENTER.lat ? 7 : 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
    if (initLat !== KOREA_CENTER.lat) {
      markerRef.current = L.marker([initLat, initLng], { icon, draggable: true }).addTo(map)
      markerRef.current.on('dragend', () => {
        const { lat, lng } = markerRef.current.getLatLng()
        onPick(lat.toFixed(7), lng.toFixed(7))
      })
    }
    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      const { lat, lng } = e.latlng
      if (markerRef.current) { markerRef.current.setLatLng([lat, lng]) }
      else {
        markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map)
        markerRef.current.on('dragend', () => { const pos = markerRef.current.getLatLng(); onPick(pos.lat.toFixed(7), pos.lng.toFixed(7)) })
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

  useEffect(() => {
    if (!showForm) { destroyMap(formMapInst, formMarker); return }
    loadLeaflet().then(() => initMap(formMapDiv, formMapInst, formMarker, KOREA_CENTER.lat, KOREA_CENTER.lng,
      (lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))))
    return () => destroyMap(formMapInst, formMarker)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm])

  useEffect(() => {
    if (!editTarget) { destroyMap(editMapInst, editMarker); return }
    const lat = parseFloat(editTarget.latitude as unknown as string) || KOREA_CENTER.lat
    const lng = parseFloat(editTarget.longitude as unknown as string) || KOREA_CENTER.lng
    loadLeaflet().then(() => initMap(editMapDiv, editMapInst, editMarker, lat, lng,
      (la, lo) => setEditForm((f) => ({ ...f, latitude: la, longitude: lo }))))
    return () => destroyMap(editMapInst, editMarker)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget])

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
    if (markerRef.current) { markerRef.current.setLatLng([lat, lng]) }
    else {
      markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(mapRef.current)
      markerRef.current.on('dragend', () => { const pos = markerRef.current.getLatLng(); return pos })
    }
  }, [])

  const [gpsLoading, setGpsLoading] = useState(false)
  const openAddressSearch = (target: 'form' | 'edit') => {
    if (!window.daum?.Postcode) { alert('주소 검색 서비스 로딩 중입니다.'); return }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const address = data.roadAddress || data.jibunAddress
        const lat = parseFloat(data.y); const lng = parseFloat(data.x)
        const latStr = lat.toFixed(7); const lngStr = lng.toFixed(7)
        if (target === 'form') { setForm((f) => ({ ...f, address, latitude: latStr, longitude: lngStr })); flyToOnMap(formMapInst, formMarker, lat, lng) }
        else { setEditForm((f) => ({ ...f, address, latitude: latStr, longitude: lngStr })); flyToOnMap(editMapInst, editMarker, lat, lng) }
      },
    }).open()
  }

  const fillCurrentLocation = (target: 'form' | 'edit') => {
    if (!navigator.geolocation) { alert('이 브라우저는 GPS를 지원하지 않습니다.'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude
        const latStr = lat.toFixed(7); const lngStr = lng.toFixed(7)
        if (target === 'form') { setForm((f) => ({ ...f, latitude: latStr, longitude: lngStr })); flyToOnMap(formMapInst, formMarker, lat, lng) }
        else { setEditForm((f) => ({ ...f, latitude: latStr, longitude: lngStr })); flyToOnMap(editMapInst, editMarker, lat, lng) }
        setGpsLoading(false)
      },
      () => { alert('GPS 위치를 가져올 수 없습니다.'); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // ── 데이터 로드 ──────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/sites?includeInactive=true')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        // v2 응답: { items: [...] } 또는 레거시 배열 모두 처리
        const items = Array.isArray(data.data) ? data.data : (data.data?.items ?? [])
        setSites(items)
        setLoading(false)
      })
  }, [router])

  useEffect(() => { load() }, [load])

  // ── 회사 목록 로드 ────────────────────────────────────────────────────
  const loadCompanies = () => {
    fetch('/api/admin/companies?pageSize=200')
      .then(r => r.json())
      .then(d => { if (d.success) setCompanies(d.data?.items ?? []) })
  }

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
        siteCode: form.siteCode || undefined,
        openedAt: form.openedAt || undefined,
        closedAt: form.closedAt || undefined,
        notes: form.notes || undefined,
      }),
    })
    const data = await res.json()
    if (!data.success) { setFormError(data.message); setSaving(false); return }
    setShowForm(false)
    setRegistered(form.name)
    setForm(emptyForm); load(); setSaving(false)
  }

  // ── 수정 모달 열기 ────────────────────────────────────────────────────
  const openEdit = (site: Site) => {
    setEditTarget(site)
    setEditForm({
      name: site.name, address: site.address,
      latitude: String(site.latitude), longitude: String(site.longitude),
      allowedRadius: String(site.allowedRadius),
      siteCode: site.siteCode ?? '',
      openedAt: site.openedAt ? site.openedAt.substring(0, 10) : '',
      closedAt: site.closedAt ? site.closedAt.substring(0, 10) : '',
      notes: site.notes ?? '',
    })
    setEditActive(site.isActive); setEditError('')
  }

  // ── 수정 저장 ─────────────────────────────────────────────────────────
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
        siteCode: editForm.siteCode || null,
        openedAt: editForm.openedAt || null,
        closedAt: editForm.closedAt || null,
        notes: editForm.notes || null,
      }),
    })
    const data = await res.json()
    if (!data.success) { setEditError(data.message); setEditSaving(false); return }
    setEditTarget(null); load(); setEditSaving(false)
  }

  // ── 회사 배정 저장 ────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!assignSite) return
    setAssignSaving(true); setAssignError('')
    const res = await fetch(`/api/admin/sites/${assignSite.id}/company-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: assignForm.companyId,
        contractType: assignForm.contractType,
        startDate: assignForm.startDate,
        endDate: assignForm.endDate || null,
        managerName: assignForm.managerName || null,
        managerPhone: assignForm.managerPhone || null,
        notes: assignForm.notes || null,
      }),
    })
    const data = await res.json()
    if (!data.success) { setAssignError(data.error ?? data.message ?? '저장 실패'); setAssignSaving(false); return }
    setAssignSite(null); load(); setAssignSaving(false)
  }

  // ── 배정 삭제 ─────────────────────────────────────────────────────────
  const handleDeleteAssignment = async (siteId: string, assignmentId: string) => {
    if (!confirm('이 배정을 삭제하시겠습니까?')) return
    await fetch(`/api/admin/sites/${siteId}/company-assignments?assignmentId=${assignmentId}`, { method: 'DELETE' })
    load()
  }

  // ── 공통 모달 폼 렌더 ─────────────────────────────────────────────────
  const renderFormFields = (
    f: typeof emptyForm,
    target: 'form' | 'edit',
    onChange: (key: string, val: string) => void,
    mapDivRef: React.RefObject<HTMLDivElement>,
  ) => (
    <>
      <div style={styles.fieldRow}>
        <label style={styles.label}>현장명 *</label>
        <input style={styles.input} value={f.name} placeholder="해한 1호 현장" onChange={(e) => onChange('name', e.target.value)} />
      </div>
      <div style={styles.fieldRow}>
        <label style={styles.label}>현장 코드</label>
        <input style={styles.input} value={f.siteCode} placeholder="SITE-001 (선택)" onChange={(e) => onChange('siteCode', e.target.value)} />
      </div>
      <div style={styles.fieldRow}>
        <div style={S.rowBetween}>
          <label style={styles.label}>주소 *</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" style={styles.addrBtn} onClick={() => openAddressSearch(target)}>🔍 주소 검색</button>
            <button type="button" style={styles.gpsBtn} disabled={gpsLoading} onClick={() => fillCurrentLocation(target)}>
              {gpsLoading ? '확인 중...' : '📍 현재 위치'}
            </button>
          </div>
        </div>
        <input style={styles.input} value={f.address} placeholder="주소 검색 또는 지도에서 직접 선택" onChange={(e) => onChange('address', e.target.value)} />
      </div>
      <div style={styles.fieldRow}>
        <label style={styles.label}>지도에서 위치 선택 <span style={S.mapHint}>지도를 클릭하거나 핀을 드래그하세요</span></label>
        <div ref={mapDivRef} style={styles.mapBox} />
      </div>
      <div style={styles.fieldRow}>
        <label style={styles.label}>GPS 좌표 (자동 입력됨)</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input style={{ ...styles.input, flex: 1 }} placeholder="위도" value={f.latitude} onChange={(e) => onChange('latitude', e.target.value)} />
          <input style={{ ...styles.input, flex: 1 }} placeholder="경도" value={f.longitude} onChange={(e) => onChange('longitude', e.target.value)} />
        </div>
      </div>
      <div style={styles.fieldRow}>
        <label style={styles.label}>GPS 허용 반경 (m)</label>
        <input style={styles.input} value={f.allowedRadius} placeholder="100" onChange={(e) => onChange('allowedRadius', e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ ...styles.fieldRow, flex: 1 }}>
          <label style={styles.label}>착공일</label>
          <input type="date" style={styles.input} value={f.openedAt} onChange={(e) => onChange('openedAt', e.target.value)} />
        </div>
        <div style={{ ...styles.fieldRow, flex: 1 }}>
          <label style={styles.label}>준공일</label>
          <input type="date" style={styles.input} value={f.closedAt} onChange={(e) => onChange('closedAt', e.target.value)} />
        </div>
      </div>
      <div style={styles.fieldRow}>
        <label style={styles.label}>메모</label>
        <input style={styles.input} value={f.notes} placeholder="현장 특이사항" onChange={(e) => onChange('notes', e.target.value)} />
      </div>
    </>
  )

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'], ['/admin/audit-logs', '감사 로그'], ['/admin/site-imports', '현장 엑셀 업로드'],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={styles.navItem}>{label}</Link>
        ))}
      </nav>

      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.pageTitle}>현장 관리 {!loading && <span style={{ fontSize: '16px', fontWeight: 400, color: '#666' }}>({sites.length}개)</span>}</h1>
          {canMutate && <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ 현장 등록</button>}
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div style={styles.grid}>
            {sites.length === 0 && <p style={{ color: '#999' }}>등록된 현장이 없습니다.</p>}
            {sites.map((site) => (
              <div key={site.id} style={{ ...styles.siteCard, opacity: site.isActive ? 1 : 0.6 }}>

                {/* 헤더 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <div style={styles.siteName}>
                      {site.name}
                      <span style={{ ...styles.statusBadge, background: site.isActive ? '#e8f5e9' : '#f5f5f5', color: site.isActive ? '#2e7d32' : '#999' }}>
                        {site.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                    {site.siteCode && <div style={styles.siteCode}>{site.siteCode}</div>}
                  </div>
                  {canMutate && (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={() => { setDetailSite(detailSite?.id === site.id ? null : site) }} style={styles.detailBtn}>
                        {detailSite?.id === site.id ? '닫기' : '상세'}
                      </button>
                      <button onClick={() => openPolicyModal(site)} style={styles.policyBtn}>근무정책</button>
                      <button onClick={() => openEdit(site)} style={styles.editBtn}>수정</button>
                    </div>
                  )}
                </div>

                {/* 주소 + 기간 */}
                <div style={styles.siteAddress}>{site.address}</div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={styles.metaChip}>반경 {site.allowedRadius}m</span>
                  {site.openedAt && <span style={styles.metaChip}>착공 {fmtDate(site.openedAt)}</span>}
                  {site.closedAt && <span style={styles.metaChip}>준공 {fmtDate(site.closedAt)}</span>}
                </div>
                {site.notes && <div style={styles.notesText}>{site.notes}</div>}

                {/* 배정 회사 섹션 */}
                <div style={styles.companySection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={styles.companySectionLabel}>배정 회사</div>
                    {canMutate && (
                      <button onClick={() => { setAssignSite(site); loadCompanies(); setAssignForm({ companyId: '', contractType: 'SUBCONTRACT', startDate: '', endDate: '', managerName: '', managerPhone: '', notes: '' }); setAssignError('') }}
                        style={styles.assignBtn}>+ 회사 배정</button>
                    )}
                  </div>
                  {site.companyAssignments.length === 0 ? (
                    <div style={styles.emptyCompany}>배정된 회사가 없습니다</div>
                  ) : site.companyAssignments.map(a => (
                    <div key={a.id} style={styles.companyRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={styles.companyName}>{a.company.companyName}</span>
                          <span style={styles.contractBadge}>{CONTRACT_TYPE_LABELS[a.contractType] ?? a.contractType}</span>
                          {a.company.companyType && <span style={styles.typeBadge}>{a.company.companyType}</span>}
                        </div>
                        <div style={styles.companyMeta}>
                          {fmtDate(a.startDate)} ~ {fmtDate(a.endDate)}
                          {a.managerName && <span style={{ marginLeft: '8px' }}>담당: {a.managerName}{a.managerPhone ? ` (${a.managerPhone})` : ''}</span>}
                        </div>
                        {a.notes && <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{a.notes}</div>}
                      </div>
                      {canMutate && (
                        <button onClick={() => handleDeleteAssignment(site.id, a.id)} style={styles.delAssignBtn} title="배정 삭제">✕</button>
                      )}
                    </div>
                  ))}
                </div>

                {/* 상세 패널 (토글) */}
                {detailSite?.id === site.id && (
                  <div style={styles.detailPanel}>
                    <div style={styles.detailRow}><span style={styles.detailLabel}>위도</span><span>{site.latitude}</span></div>
                    <div style={styles.detailRow}><span style={styles.detailLabel}>경도</span><span>{site.longitude}</span></div>
                    <div style={styles.detailRow}><span style={styles.detailLabel}>등록일</span><span>{fmtDate(site.createdAt)}</span></div>
                  </div>
                )}
              </div>
            ))}
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

        {/* ── 회사 배정 모달 ─────────────────────────────────── */}
        {assignSite && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={styles.modalTitle}>회사 배정 — {assignSite.name}</h3>
              <div style={styles.fieldRow}>
                <label style={styles.label}>회사 *</label>
                <select value={assignForm.companyId} onChange={e => setAssignForm(f => ({ ...f, companyId: e.target.value }))} style={styles.input}>
                  <option value="">선택하세요</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>계약 유형</label>
                <select value={assignForm.contractType} onChange={e => setAssignForm(f => ({ ...f, contractType: e.target.value }))} style={styles.input}>
                  <option value="PRIME">원청</option>
                  <option value="SUBCONTRACT">하도급</option>
                  <option value="JOINT_VENTURE">공동도급</option>
                  <option value="SPECIALTY">전문건설</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ ...styles.fieldRow, flex: 1 }}>
                  <label style={styles.label}>시작일 *</label>
                  <input type="date" style={styles.input} value={assignForm.startDate} onChange={e => setAssignForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div style={{ ...styles.fieldRow, flex: 1 }}>
                  <label style={styles.label}>종료일</label>
                  <input type="date" style={styles.input} value={assignForm.endDate} onChange={e => setAssignForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>담당자명</label>
                <input style={styles.input} value={assignForm.managerName} onChange={e => setAssignForm(f => ({ ...f, managerName: e.target.value }))} placeholder="홍길동" />
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>담당자 연락처</label>
                <input style={styles.input} value={assignForm.managerPhone} onChange={e => setAssignForm(f => ({ ...f, managerPhone: e.target.value }))} placeholder="01012345678" />
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>메모</label>
                <input style={styles.input} value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {assignError && <p style={styles.error}>{assignError}</p>}
              <div style={styles.btnRow}>
                <button onClick={handleAssign} disabled={assignSaving || !assignForm.companyId || !assignForm.startDate} style={styles.saveBtn}>
                  {assignSaving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setAssignSite(null)} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 근무시간 정책 모달 ──────────────────────────────── */}
        {policySite && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={styles.modalTitle}>근무시간 정책 — {policySite.name}</h3>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px', lineHeight: '1.5' }}>
                빈칸 = 회사 기본값 사용 (출근 07:00 / 퇴근 17:00 / 휴게 60분).<br />
                <strong>휴게시간 차감(분)</strong>이 공수 계산에 직접 영향을 줍니다.
              </p>
              {policyLoading ? <p style={{ color: '#999', textAlign: 'center' }}>로딩 중...</p> : (
                <>
                  {policyEffective && (
                    <div style={S.effectiveBanner}>
                      실효값: 출근 {policyEffective.workStartTime} / 퇴근 {policyEffective.workEndTime} /
                      휴게 {policyEffective.breakMinutes}분
                      {!policyEffective.isCustom && <span style={S.defaultBadge}>회사 기본값</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>출근 기준 시각</label>
                      <input type="time" style={styles.input} value={policyForm.workStartTime}
                        onChange={e => setPolicyForm(f => ({ ...f, workStartTime: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>퇴근 기준 시각</label>
                      <input type="time" style={styles.input} value={policyForm.workEndTime}
                        onChange={e => setPolicyForm(f => ({ ...f, workEndTime: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>휴게 시작 (표시용)</label>
                      <input type="time" style={styles.input} value={policyForm.breakStartTime}
                        onChange={e => setPolicyForm(f => ({ ...f, breakStartTime: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>휴게 종료 (표시용)</label>
                      <input type="time" style={styles.input} value={policyForm.breakEndTime}
                        onChange={e => setPolicyForm(f => ({ ...f, breakEndTime: e.target.value }))} />
                    </div>
                  </div>
                  <div style={styles.fieldRow}>
                    <label style={styles.label}>휴게시간 차감 (분) — 공수 계산 적용</label>
                    <input type="number" min="0" max="480" step="5" style={styles.input}
                      placeholder="빈칸 = 회사 기본값 (60분)"
                      value={policyForm.breakMinutes}
                      onChange={e => setPolicyForm(f => ({ ...f, breakMinutes: e.target.value }))} />
                  </div>
                </>
              )}
              {policyError && <p style={styles.error}>{policyError}</p>}
              <div style={styles.btnRow}>
                <button onClick={handleSavePolicy} disabled={policySaving || policyLoading} style={styles.saveBtn}>
                  {policySaving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setPolicySite(null)} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 등록 완료 알림 ──────────────────────────────────── */}
        {registered && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '12px' }}>✅</div>
              <h3 style={{ margin: '0 0 12px', textAlign: 'center' }}>현장 등록 완료</h3>
              <p style={{ fontSize: '14px', color: '#555', textAlign: 'center', marginBottom: '16px' }}>{registered} 현장이 등록되었습니다.</p>
              <button onClick={() => setRegistered(null)} style={{ ...styles.saveBtn, width: '100%', marginTop: '16px' }}>확인</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ── 스타일 ────────────────────────────────────────────────────────────
const S = {
  rowBetween:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' } as React.CSSProperties,
  mapHint:        { fontSize: '11px', color: '#aaa', fontWeight: 400, marginLeft: '6px' } as React.CSSProperties,
  effectiveBanner:{ background: '#e8f5e9', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#2e7d32', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const },
  defaultBadge:   { fontSize: '10px', background: '#c8e6c9', color: '#1b5e20', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 } as React.CSSProperties,
}

const styles: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#f5f5f5', fontFamily: 'system-ui, sans-serif' },
  sidebar:      { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main:         { flex: 1, padding: '32px' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle:    { fontSize: '22px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'baseline', gap: '6px' },
  addBtn:       { padding: '10px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' },
  siteCard:     { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '0' },
  siteName:     { fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  siteCode:     { fontSize: '11px', color: '#999', marginTop: '2px', fontFamily: 'monospace' },
  statusBadge:  { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px' },
  siteAddress:  { fontSize: '13px', color: '#666', margin: '6px 0 8px' },
  metaChip:     { fontSize: '11px', color: '#555', background: '#f0f0f0', padding: '2px 8px', borderRadius: '10px' },
  notesText:    { fontSize: '12px', color: '#777', margin: '4px 0 8px', fontStyle: 'italic' },
  companySection: { background: '#f8f9fa', borderRadius: '8px', padding: '12px', margin: '10px 0' },
  companySectionLabel: { fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  emptyCompany: { fontSize: '12px', color: '#bbb', textAlign: 'center' as const, padding: '8px 0' },
  companyRow:   { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 0', borderTop: '1px solid #eee' },
  companyName:  { fontSize: '13px', fontWeight: 600, color: '#333' },
  contractBadge:{ fontSize: '11px', background: '#e3f2fd', color: '#1565c0', padding: '1px 6px', borderRadius: '4px' },
  typeBadge:    { fontSize: '11px', background: '#f3e5f5', color: '#6a1b9a', padding: '1px 6px', borderRadius: '4px' },
  companyMeta:  { fontSize: '11px', color: '#777', marginTop: '3px' },
  assignBtn:    { fontSize: '11px', padding: '3px 8px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  delAssignBtn: { fontSize: '11px', padding: '2px 6px', background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', flexShrink: 0 },
  editBtn:      { padding: '4px 10px', fontSize: '12px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer' },
  policyBtn:    { padding: '4px 10px', fontSize: '12px', background: '#fff8e1', color: '#f57f17', border: '1px solid #ffe082', borderRadius: '4px', cursor: 'pointer' },
  detailBtn:    { padding: '4px 10px', fontSize: '12px', background: '#f5f5f5', color: '#555', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' },
  detailPanel:  { borderTop: '1px solid #f0f0f0', marginTop: '10px', paddingTop: '10px' },
  detailRow:    { display: 'flex', gap: '8px', fontSize: '12px', color: '#555', marginBottom: '4px' },
  detailLabel:  { width: '70px', flexShrink: 0, fontWeight: 600, color: '#888' },
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, overflowY: 'auto' as const, padding: '24px' },
  modal:        { background: 'white', borderRadius: '12px', padding: '32px', width: '480px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' as const },
  modalWide:    { background: 'white', borderRadius: '12px', padding: '32px', width: '600px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' as const },
  modalTitle:   { margin: '0 0 20px', fontSize: '18px', fontWeight: 700 },
  fieldRow:     { marginBottom: '14px' },
  label:        { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: 600 },
  input:        { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' as const },
  mapBox:       { width: '100%', height: '280px', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' },
  error:        { color: '#e53935', fontSize: '13px', margin: '0 0 12px' },
  btnRow:       { display: 'flex', gap: '8px', marginTop: '16px' },
  saveBtn:      { flex: 1, padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 },
  cancelBtn:    { flex: 1, padding: '12px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  gpsBtn:       { padding: '6px 12px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' as const },
  addrBtn:      { padding: '6px 12px', background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' as const },
}
