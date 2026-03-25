'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'
import KakaoMap from '@/components/map/KakaoMap'
import {
  PageShell, PageHeader, PageBadge, Btn,
  FilterBar, FilterInput, FilterPill,
  AdminTable, AdminTr, AdminTd, EmptyRow,
  StatusBadge,
} from '@/components/admin/ui'

// ── 전역 타입 선언 ────────────────────────────────────────────────────
declare global {
  interface Window {
    daum: {
      Postcode: new (opts: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void
      }) => { open: () => void }
    }
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

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  PRIME: '원청', SUBCONTRACT: '하도급', JOINT_VENTURE: '공동도급', SPECIALTY: '전문건설',
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('ko-KR') : '—'
}

export default function SitesPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [siteSearch, setSiteSearch] = useState('')
  const [siteFilterActive, setSiteFilterActive] = useState<'' | 'active' | 'inactive'>('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [registered, setRegistered] = useState<string | null>(null)

  const [editTarget, setEditTarget] = useState<Site | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editActive, setEditActive] = useState(true)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [assignSite, setAssignSite] = useState<Site | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [assignForm, setAssignForm] = useState({
    companyId: '', contractType: 'SUBCONTRACT', startDate: '', endDate: '',
    managerName: '', managerPhone: '', notes: '',
  })
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState('')

  const [detailSite, setDetailSite] = useState<Site | null>(null)

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

  // ── geocode 상태 ──────────────────────────────────────────────────────
  type GeoStatus = 'idle' | 'loading' | 'done' | 'error'
  const [formGeoStatus, setFormGeoStatus] = useState<GeoStatus>('idle')
  const [editGeoStatus, setEditGeoStatus] = useState<GeoStatus>('idle')

  // Daum 우편번호 스크립트 로드 (마운트 1회)
  useEffect(() => {
    if (!document.getElementById('kakao-postcode-script')) {
      const s = document.createElement('script')
      s.id = 'kakao-postcode-script'
      s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      document.head.appendChild(s)
    }
  }, [])

  // 주소 선택 → 서버 geocode API로 좌표 변환
  const openAddressSearch = (target: 'form' | 'edit') => {
    if (!window.daum?.Postcode) { alert('주소 검색 서비스 로딩 중입니다. 잠시 후 다시 시도하세요.'); return }
    new window.daum.Postcode({
      oncomplete: async (data) => {
        const address = data.roadAddress || data.jibunAddress
        if (target === 'form') {
          setForm((f) => ({ ...f, address, latitude: '', longitude: '' }))
          setFormGeoStatus('loading')
        } else {
          setEditForm((f) => ({ ...f, address, latitude: '', longitude: '' }))
          setEditGeoStatus('loading')
        }
        try {
          const res = await fetch(`/api/admin/geocode?address=${encodeURIComponent(address)}`)
          const json = await res.json()
          if (json.success && json.data?.lat && json.data?.lng) {
            const latStr = String(json.data.lat)
            const lngStr = String(json.data.lng)
            if (target === 'form') { setForm((f) => ({ ...f, latitude: latStr, longitude: lngStr })); setFormGeoStatus('done') }
            else { setEditForm((f) => ({ ...f, latitude: latStr, longitude: lngStr })); setEditGeoStatus('done') }
          } else {
            if (target === 'form') setFormGeoStatus('error')
            else setEditGeoStatus('error')
          }
        } catch {
          if (target === 'form') setFormGeoStatus('error')
          else setEditGeoStatus('error')
        }
      },
    }).open()
  }

  const [gpsLoading, setGpsLoading] = useState(false)
  const fillCurrentLocation = (target: 'form' | 'edit') => {
    if (!navigator.geolocation) { alert('이 브라우저는 GPS를 지원하지 않습니다.'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude
        const latStr = lat.toFixed(7); const lngStr = lng.toFixed(7)
        if (target === 'form') { setForm((f) => ({ ...f, latitude: latStr, longitude: lngStr })); setFormGeoStatus('done') }
        else { setEditForm((f) => ({ ...f, latitude: latStr, longitude: lngStr })); setEditGeoStatus('done') }
        setGpsLoading(false)
      },
      () => { alert('GPS 위치를 가져올 수 없습니다.'); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/sites?includeInactive=true')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        const items = Array.isArray(data.data) ? data.data : (data.data?.items ?? [])
        setSites(items)
        setLoading(false)
      })
  }, [router])

  useEffect(() => { load() }, [load])

  const loadCompanies = () => {
    fetch('/api/admin/companies?pageSize=200')
      .then(r => r.json())
      .then(d => { if (d.success) setCompanies(d.data?.items ?? []) })
  }

  const handleSave = async () => {
    setSaving(true); setFormError('')
    const lat = parseFloat(form.latitude)
    const lng = parseFloat(form.longitude)
    if (!form.name.trim()) { setFormError('현장명을 입력하세요.'); setSaving(false); return }
    if (!form.address.trim()) { setFormError('주소를 입력하세요.'); setSaving(false); return }
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      setFormError('주소 검색 후 좌표를 확인하세요. 좌표가 없으면 저장할 수 없습니다.')
      setSaving(false); return
    }
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
    setEditGeoStatus(site.latitude && site.longitude ? 'done' : 'idle')
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setEditSaving(true); setEditError('')
    const lat = parseFloat(editForm.latitude)
    const lng = parseFloat(editForm.longitude)
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      setEditError('유효한 좌표가 없습니다. 주소 검색을 다시 시도하세요.')
      setEditSaving(false); return
    }
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

  const handleDeleteAssignment = async (siteId: string, assignmentId: string) => {
    if (!confirm('이 배정을 삭제하시겠습니까?')) return
    await fetch(`/api/admin/sites/${siteId}/company-assignments?assignmentId=${assignmentId}`, { method: 'DELETE' })
    load()
  }

  // shared Tailwind class strings
  const inputCls = "admin-input w-full box-border"
  const labelCls = "block text-[13px] font-semibold text-[#6B7280] mb-1"
  const saveBtnCls = "flex-1 py-3 bg-[#071020] text-white border-none rounded-[8px] cursor-pointer font-bold hover:bg-[#1E293B] transition-colors"
  const cancelBtnCls = "flex-1 py-3 bg-white text-[#6B7280] border border-[#E5E7EB] rounded-[8px] cursor-pointer hover:bg-[#F9FAFB] transition-colors"

  const renderFormFields = (
    f: typeof emptyForm,
    target: 'form' | 'edit',
    onChange: (key: string, val: string) => void,
    geoStatus: 'idle' | 'loading' | 'done' | 'error',
  ) => (
    <>
      <div className="mb-[14px]">
        <label className={labelCls}>현장명 *</label>
        <input className={inputCls} value={f.name} placeholder="해한 1호 현장" onChange={(e) => onChange('name', e.target.value)} />
      </div>
      <div className="mb-[14px]">
        <label className={labelCls}>현장 코드</label>
        <input className={inputCls} value={f.siteCode} placeholder="SITE-001 (선택)" onChange={(e) => onChange('siteCode', e.target.value)} />
      </div>
      <div className="mb-[14px]">
        <div className="flex justify-between items-center mb-1">
          <label className={labelCls}>주소 *</label>
          <div className="flex gap-[6px]">
            <button type="button"
              className="px-3 py-[6px] bg-[rgba(244,121,32,0.12)] text-accent border border-[#90caf9] rounded-md cursor-pointer text-[13px] font-semibold whitespace-nowrap"
              onClick={() => openAddressSearch(target)}>🔍 주소 검색</button>
            <button type="button"
              className="px-3 py-[6px] bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] rounded-md cursor-pointer text-[13px] font-semibold whitespace-nowrap disabled:opacity-50"
              disabled={gpsLoading} onClick={() => fillCurrentLocation(target)}>
              {gpsLoading ? '확인 중...' : '📍 현재 위치'}
            </button>
          </div>
        </div>
        <input className={inputCls} value={f.address} placeholder="주소 검색 또는 지도에서 직접 선택" onChange={(e) => onChange('address', e.target.value)} />
      </div>
      <div className="mb-[14px]">
        <label className={labelCls}>지도 미리보기</label>
        {geoStatus === 'loading' && (
          <div className="text-xs text-[#F59E0B] mb-1">좌표 확인 중...</div>
        )}
        {geoStatus === 'error' && (
          <div className="text-xs text-[#e53935] mb-1">주소는 선택됐지만 좌표를 찾지 못했습니다</div>
        )}
        <KakaoMap lat={f.latitude} lng={f.longitude} height="280px" />
      </div>
      <div className="mb-[14px]">
        <label className={labelCls}>GPS 좌표 (주소 검색 시 자동 입력)</label>
        <div className="flex gap-2">
          <input className={`${inputCls} flex-1`} placeholder="위도" value={f.latitude} onChange={(e) => onChange('latitude', e.target.value)} />
          <input className={`${inputCls} flex-1`} placeholder="경도" value={f.longitude} onChange={(e) => onChange('longitude', e.target.value)} />
        </div>
      </div>
      <div className="mb-[14px]">
        <label className={labelCls}>GPS 허용 반경 (m)</label>
        <input className={inputCls} value={f.allowedRadius} placeholder="100" onChange={(e) => onChange('allowedRadius', e.target.value)} />
      </div>
      <div className="flex gap-3">
        <div className="mb-[14px] flex-1">
          <label className={labelCls}>착공일</label>
          <input type="date" className={inputCls} value={f.openedAt} onChange={(e) => onChange('openedAt', e.target.value)} />
        </div>
        <div className="mb-[14px] flex-1">
          <label className={labelCls}>준공일</label>
          <input type="date" className={inputCls} value={f.closedAt} onChange={(e) => onChange('closedAt', e.target.value)} />
        </div>
      </div>
      <div className="mb-[14px]">
        <label className={labelCls}>메모</label>
        <input className={inputCls} value={f.notes} placeholder="현장 특이사항" onChange={(e) => onChange('notes', e.target.value)} />
      </div>
    </>
  )

  const filteredSites = sites.filter(s =>
    (!siteSearch || s.name.includes(siteSearch) || s.address.includes(siteSearch)) &&
    (siteFilterActive === '' || (siteFilterActive === 'active' ? s.isActive : !s.isActive))
  )

  return (
    <PageShell>
      <PageHeader
        title="현장 관리"
        badge={!loading ? <PageBadge>{filteredSites.length}개</PageBadge> : undefined}
        actions={canMutate ? (
          <Btn variant="orange" onClick={() => { setShowForm(true); setFormGeoStatus('idle'); setForm(emptyForm) }}>+ 현장 등록</Btn>
        ) : undefined}
      />

      <FilterBar>
        <FilterInput
          type="text"
          placeholder="현장명, 주소 검색"
          value={siteSearch}
          onChange={(e) => setSiteSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-[380px]"
        />
        <FilterPill active={siteFilterActive === ''} onClick={() => setSiteFilterActive('')}>전체</FilterPill>
        <FilterPill active={siteFilterActive === 'active'} onClick={() => setSiteFilterActive('active')}>운영중</FilterPill>
        <FilterPill active={siteFilterActive === 'inactive'} onClick={() => setSiteFilterActive('inactive')}>종료</FilterPill>
      </FilterBar>

      {loading ? (
        <p className="text-[#9CA3AF] text-[13px] py-10 text-center">로딩 중...</p>
      ) : (
        <AdminTable headers={['현장명', '코드', '상태', '주소', '반경', '배정업체', '착공일', '']}>
          {filteredSites.length === 0 ? (
            <EmptyRow message="등록된 현장이 없습니다." />
          ) : filteredSites.map((site) => (
            <AdminTr key={site.id} className={!site.isActive ? 'opacity-70' : ''}>
              <AdminTd>
                <Link href={`/admin/sites/${site.id}`} className="font-semibold text-[#111827] no-underline hover:text-[#F97316] transition-colors">
                  {site.name}
                </Link>
              </AdminTd>
              <AdminTd>
                {site.siteCode
                  ? <span className="font-mono text-[11px] text-[#6B7280]">{site.siteCode}</span>
                  : <span className="text-[#D1D5DB]">—</span>
                }
              </AdminTd>
              <AdminTd>
                <StatusBadge status={site.isActive ? 'ACTIVE' : 'INACTIVE'} label={site.isActive ? '운영중' : '종료'} />
              </AdminTd>
              <AdminTd>
                <span className="text-[12px] text-[#6B7280] max-w-[220px] truncate block">{site.address}</span>
              </AdminTd>
              <AdminTd>
                <span className="text-[12px]">{site.allowedRadius}m</span>
              </AdminTd>
              <AdminTd>
                <span className="text-[12px]">
                  {site.companyAssignments.length > 0
                    ? `${site.companyAssignments.length}개사`
                    : <span className="text-[#D1D5DB]">미배정</span>
                  }
                </span>
              </AdminTd>
              <AdminTd>
                <span className="text-[12px] text-[#6B7280]">{fmtDate(site.openedAt)}</span>
              </AdminTd>
              <AdminTd>
                <div className="flex items-center gap-1 flex-nowrap">
                  <Link href="/admin/attendance" className="no-underline">
                    <Btn variant="orange" size="xs">출근현황</Btn>
                  </Link>
                  {canMutate && (
                    <>
                      <Btn variant="secondary" size="xs" onClick={() => openPolicyModal(site)}>근무정책</Btn>
                      <Btn variant="secondary" size="xs" onClick={() => openEdit(site)}>수정</Btn>
                      <Btn variant="secondary" size="xs" onClick={() => {
                        setAssignSite(site); loadCompanies()
                        setAssignForm({ companyId: '', contractType: 'SUBCONTRACT', startDate: '', endDate: '', managerName: '', managerPhone: '', notes: '' })
                        setAssignError('')
                      }}>업체배정</Btn>
                    </>
                  )}
                </div>
              </AdminTd>
            </AdminTr>
          ))}
        </AdminTable>
      )}

        {/* ── 등록 모달 ──────────────────────────────────────── */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] overflow-y-auto py-6 px-6">
            <div className="bg-white rounded-xl p-8 w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#E5E7EB]">
              <h3 className="text-[18px] font-bold mb-5">현장 등록</h3>
              {renderFormFields(form, 'form', (k, v) => setForm((f) => ({ ...f, [k]: v })), formGeoStatus)}
              {formError && <p className="text-[#e53935] text-[13px] mb-3">{formError}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleSave} disabled={saving} className={saveBtnCls}>{saving ? '저장 중...' : '등록'}</button>
                <button onClick={() => { setShowForm(false); setFormError('') }} className={cancelBtnCls}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 수정 모달 ──────────────────────────────────────── */}
        {editTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] overflow-y-auto py-6 px-6">
            <div className="bg-white rounded-xl p-8 w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#E5E7EB]">
              <h3 className="text-[18px] font-bold mb-5">현장 수정 — {editTarget.name}</h3>
              {renderFormFields(editForm, 'edit', (k, v) => setEditForm((f) => ({ ...f, [k]: v })), editGeoStatus)}
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" id="editActive" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                <label htmlFor="editActive" className="text-sm">현장 활성 상태</label>
              </div>
              {editError && <p className="text-[#e53935] text-[13px] mb-3">{editError}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleEdit} disabled={editSaving} className={saveBtnCls}>{editSaving ? '저장 중...' : '저장'}</button>
                <button onClick={() => setEditTarget(null)} className={cancelBtnCls}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 회사 배정 모달 ─────────────────────────────────── */}
        {assignSite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] overflow-y-auto py-6 px-6">
            <div className="bg-white rounded-xl p-8 w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#E5E7EB]">
              <h3 className="text-[18px] font-bold mb-5">회사 배정 — {assignSite.name}</h3>
              <div className="mb-[14px]">
                <label className={labelCls}>회사 *</label>
                <select value={assignForm.companyId} onChange={e => setAssignForm(f => ({ ...f, companyId: e.target.value }))} className={inputCls}>
                  <option value="">선택하세요</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <div className="mb-[14px]">
                <label className={labelCls}>계약 유형</label>
                <select value={assignForm.contractType} onChange={e => setAssignForm(f => ({ ...f, contractType: e.target.value }))} className={inputCls}>
                  <option value="PRIME">원청</option>
                  <option value="SUBCONTRACT">하도급</option>
                  <option value="JOINT_VENTURE">공동도급</option>
                  <option value="SPECIALTY">전문건설</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="mb-[14px] flex-1">
                  <label className={labelCls}>시작일 *</label>
                  <input type="date" className={inputCls} value={assignForm.startDate} onChange={e => setAssignForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="mb-[14px] flex-1">
                  <label className={labelCls}>종료일</label>
                  <input type="date" className={inputCls} value={assignForm.endDate} onChange={e => setAssignForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div className="mb-[14px]">
                <label className={labelCls}>담당자명</label>
                <input className={inputCls} value={assignForm.managerName} onChange={e => setAssignForm(f => ({ ...f, managerName: e.target.value }))} placeholder="홍길동" />
              </div>
              <div className="mb-[14px]">
                <label className={labelCls}>담당자 연락처</label>
                <input className={inputCls} value={assignForm.managerPhone} onChange={e => setAssignForm(f => ({ ...f, managerPhone: e.target.value }))} placeholder="01012345678" />
              </div>
              <div className="mb-[14px]">
                <label className={labelCls}>메모</label>
                <input className={inputCls} value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {assignError && <p className="text-[#e53935] text-[13px] mb-3">{assignError}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleAssign} disabled={assignSaving || !assignForm.companyId || !assignForm.startDate} className={saveBtnCls}>
                  {assignSaving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setAssignSite(null)} className={cancelBtnCls}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 근무시간 정책 모달 ──────────────────────────────── */}
        {policySite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] overflow-y-auto py-6 px-6">
            <div className="bg-white rounded-xl p-8 w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#E5E7EB]">
              <h3 className="text-[18px] font-bold mb-5">근무시간 정책 — {policySite.name}</h3>
              <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
                빈칸 = 회사 기본값 사용 (출근 07:00 / 퇴근 17:00 / 휴게 60분).<br />
                <strong>휴게시간 차감(분)</strong>이 공수 계산에 직접 영향을 줍니다.
              </p>
              {policyLoading ? <p className="text-[#718096] text-center">로딩 중...</p> : (
                <>
                  {policyEffective && (
                    <div className="bg-[#e8f5e9] rounded-md px-3 py-2 text-xs text-[#2e7d32] mb-4 flex items-center gap-2 flex-wrap">
                      실효값: 출근 {policyEffective.workStartTime} / 퇴근 {policyEffective.workEndTime} /
                      휴게 {policyEffective.breakMinutes}분
                      {!policyEffective.isCustom && (
                        <span className="text-[10px] bg-[#c8e6c9] text-[#1b5e20] px-[6px] py-[1px] rounded-lg font-bold">회사 기본값</span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 mb-[14px]">
                    <div className="flex-1">
                      <label className={labelCls}>출근 기준 시각</label>
                      <input type="time" className={inputCls} value={policyForm.workStartTime}
                        onChange={e => setPolicyForm(f => ({ ...f, workStartTime: e.target.value }))} />
                    </div>
                    <div className="flex-1">
                      <label className={labelCls}>퇴근 기준 시각</label>
                      <input type="time" className={inputCls} value={policyForm.workEndTime}
                        onChange={e => setPolicyForm(f => ({ ...f, workEndTime: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2 mb-[14px]">
                    <div className="flex-1">
                      <label className={labelCls}>휴게 시작 (표시용)</label>
                      <input type="time" className={inputCls} value={policyForm.breakStartTime}
                        onChange={e => setPolicyForm(f => ({ ...f, breakStartTime: e.target.value }))} />
                    </div>
                    <div className="flex-1">
                      <label className={labelCls}>휴게 종료 (표시용)</label>
                      <input type="time" className={inputCls} value={policyForm.breakEndTime}
                        onChange={e => setPolicyForm(f => ({ ...f, breakEndTime: e.target.value }))} />
                    </div>
                  </div>
                  <div className="mb-[14px]">
                    <label className={labelCls}>휴게시간 차감 (분) — 공수 계산 적용</label>
                    <input type="number" min="0" max="480" step="5" className={inputCls}
                      placeholder="빈칸 = 회사 기본값 (60분)"
                      value={policyForm.breakMinutes}
                      onChange={e => setPolicyForm(f => ({ ...f, breakMinutes: e.target.value }))} />
                  </div>
                </>
              )}
              {policyError && <p className="text-[#e53935] text-[13px] mb-3">{policyError}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleSavePolicy} disabled={policySaving || policyLoading} className={saveBtnCls}>
                  {policySaving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setPolicySite(null)} className={cancelBtnCls}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 등록 완료 알림 ──────────────────────────────────── */}
        {registered && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-xl p-8 w-[480px] max-w-[95vw] border border-[#E5E7EB] shadow-lg">
              <div className="text-[40px] text-center mb-3">✅</div>
              <h3 className="m-0 mb-3 text-center text-[18px] font-bold text-[#111827]">현장 등록 완료</h3>
              <p className="text-sm text-[#6B7280] text-center mb-4">{registered} 현장이 등록되었습니다.</p>
              <button onClick={() => setRegistered(null)} className="w-full py-3 bg-[#F97316] text-white border-none rounded-[8px] cursor-pointer font-bold mt-4 hover:bg-[#EA580C] transition-colors">확인</button>
            </div>
          </div>
        )}
    </PageShell>
  )
}
