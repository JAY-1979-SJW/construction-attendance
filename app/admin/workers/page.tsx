'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'
import { PageShell, PageHeader, PageBadge } from '@/components/admin/ui'
import {
  ADMIN_TYPE_GUIDES,
  ADMIN_TYPE_WARNINGS,
  detectEmploymentMismatch,
} from '@/lib/policies/worker-type-ui-policy'

interface Worker {
  id: string
  name: string
  phone: string
  jobTitle: string
  isActive: boolean
  deviceCount: number
  createdAt: string
  retirementMutualStatus?: string
  idVerificationStatus?: string | null
  foreignerYn?: boolean
  employmentType?: string
  organizationType?: string
  primaryCompany?: { id: string; companyName: string } | null
  activeSites?: { id: string; name: string }[]
}

interface ScanResult {
  documentId: string
  reviewStatus: string
  scanStatus: string
  parsed: {
    documentType: string
    name?: string
    birthDate?: string
    nationality?: string
    address?: string
    issueDate?: string
    expiryDate?: string
    foreignerYn?: boolean
    residentType?: string
    confidence?: Record<string, number>
    rawText?: string
  }
}

const emptyForm = { name: '', phone: '', jobTitle: '', employmentType: 'DAILY_CONSTRUCTION', organizationType: 'DIRECT', foreignerYn: false }

const EMP_LABELS: Record<string, string> = {
  DAILY_CONSTRUCTION: '건설일용',
  REGULAR:            '상용직',
  FIXED_TERM:         '기간제',
  CONTINUOUS_SITE:    '계속근로형',
  BUSINESS_33:        '3.3%사업소득',
  OTHER:              '기타',
}

export default function WorkersPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [workers, setWorkers] = useState<Worker[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filterEmpType, setFilterEmpType] = useState('')
  const [filterOrgType, setFilterOrgType] = useState('')
  const [filterActive, setFilterActive] = useState<'' | 'active' | 'inactive'>('')
  const [loading, setLoading] = useState(true)

  // 등록 모달
  const [showForm, setShowForm] = useState(false)
  const [guideStep, setGuideStep] = useState<'guide' | 'form'>('guide')
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // 수정 모달
  const [editTarget, setEditTarget] = useState<Worker | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editActive, setEditActive] = useState(true)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // 신분증 업로드
  const [showUpload, setShowUpload] = useState(false)
  const [uploadWorkerId, setUploadWorkerId] = useState('')
  const [uploadWorkerName, setUploadWorkerName] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [showScanResult, setShowScanResult] = useState(false)

  const load = (s = search) => {
    setLoading(true)
    fetch(`/api/admin/workers?search=${encodeURIComponent(s)}&pageSize=50`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setWorkers(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [router])

  const closeRegModal = () => {
    setShowForm(false)
    setGuideStep('guide')
    setFormError('')
  }

  // ── 등록 ─────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/admin/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!data.success) { setFormError(data.message); setSaving(false); return }
    closeRegModal()
    setForm(emptyForm)
    load()
    setSaving(false)
  }

  // ── 수정 ─────────────────────────────────────────────────────
  const openEdit = (w: Worker) => {
    setEditTarget(w)
    setEditForm({ name: w.name, phone: w.phone, jobTitle: w.jobTitle, employmentType: w.employmentType ?? 'DAILY_CONSTRUCTION', organizationType: w.organizationType ?? 'DIRECT', foreignerYn: w.foreignerYn ?? false })
    setEditActive(w.isActive)
    setEditError('')
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setEditSaving(true)
    setEditError('')
    const res = await fetch(`/api/admin/workers/${editTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, isActive: editActive }),
    })
    const data = await res.json()
    if (!data.success) { setEditError(data.message); setEditSaving(false); return }
    setEditTarget(null)
    load()
    setEditSaving(false)
  }

  // ── 신분증 업로드/검토 ─────────────────────────────────────
  const handleUploadSuccess = (result: ScanResult) => {
    setShowUpload(false)
    setScanResult(result)
    setShowScanResult(true)
    load()
  }

  const handleVerify = async () => {
    if (!scanResult || !uploadWorkerId) return
    await fetch(`/api/admin/workers/${uploadWorkerId}/identity-documents/${scanResult.documentId}/verify`, { method: 'POST' })
    setShowScanResult(false)
    setScanResult(null)
    load()
  }

  const handleReject = async (status: string, reason: string) => {
    if (!scanResult || !uploadWorkerId) return
    await fetch(`/api/admin/workers/${uploadWorkerId}/identity-documents/${scanResult.documentId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewStatus: status, reason }),
    })
    setShowScanResult(false)
    setScanResult(null)
    load()
  }

  // ── 삭제(비활성화) ────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    const res = await fetch(`/api/admin/workers/${deleteTarget.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!data.success) { setDeleteError(data.message); setDeleting(false); return }
    setDeleteTarget(null)
    load()
    setDeleting(false)
  }

  const formatPhone = (p: string) =>
    p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p

  return (
    <PageShell>
      <PageHeader
        title="근로자 관리"
        badge={<PageBadge>{total}명</PageBadge>}
        actions={canMutate ? (
          <button onClick={() => setShowForm(true)} className="px-4 py-[7px] bg-[#F97316] text-white border-none rounded-[8px] cursor-pointer text-[13px] font-semibold hover:bg-[#EA580C] transition-colors">+ 근로자 등록</button>
        ) : undefined}
      />

        <div className="flex gap-2 mb-3 flex-wrap">
          <input
            type="text"
            placeholder="이름, 연락처, 회사 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            className="admin-input flex-1 min-w-[200px] max-w-[480px]"
          />
          <select value={filterEmpType} onChange={e => setFilterEmpType(e.target.value)} className="admin-select">
            <option value="">전체 고용형태</option>
            <option value="DAILY_CONSTRUCTION">건설일용</option>
            <option value="REGULAR">상용직</option>
            <option value="FIXED_TERM">기간제</option>
            <option value="CONTINUOUS_SITE">계속근로형</option>
            <option value="BUSINESS_33">3.3%사업소득</option>
            <option value="OTHER">기타</option>
          </select>
          <select value={filterOrgType} onChange={e => setFilterOrgType(e.target.value)} className="admin-select">
            <option value="">전체 소속</option>
            <option value="DIRECT">직영</option>
            <option value="SUBCONTRACTOR">협력사</option>
          </select>
          <button onClick={() => load()} className="px-4 py-2 bg-[#071020] hover:bg-[#1E293B] border-none rounded-[8px] cursor-pointer text-[13px] text-white font-semibold transition-colors">검색</button>
        </div>
        {/* 재직 상태 필터 pills */}
        <div className="flex gap-2 mb-4 items-center">
          {([
            { value: '' as const,        label: '전체' },
            { value: 'active' as const,   label: '재직중' },
            { value: 'inactive' as const, label: '퇴사' },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterActive(opt.value)}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border cursor-pointer transition-colors ${
                filterActive === opt.value
                  ? 'bg-[#F97316] border-[#F97316] text-white'
                  : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB] hover:text-[#374151]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? <p className="text-[#9CA3AF] text-sm py-10 text-center">로딩 중...</p> : (
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F3F4F6]">
                  {['이름', '연락처', '소속회사', '직종', '고용형태', '소속구분', '기기', '퇴직공제', '신분증', '상태', '등록일', ''].map((h) => (
                    <th key={h} className="admin-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.filter(w =>
                  (!filterEmpType || w.employmentType === filterEmpType) &&
                  (!filterOrgType || w.organizationType === filterOrgType) &&
                  (filterActive === '' || (filterActive === 'active' ? w.isActive : !w.isActive))
                ).length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-6 text-[#999]">조건에 맞는 근로자가 없습니다.</td></tr>
                ) : workers.filter(w =>
                  (!filterEmpType || w.employmentType === filterEmpType) &&
                  (!filterOrgType || w.organizationType === filterOrgType) &&
                  (filterActive === '' || (filterActive === 'active' ? w.isActive : !w.isActive))
                ).map((w) => (
                  <tr key={w.id} style={{ opacity: w.isActive ? 1 : 0.6 }} className={!w.isActive ? 'bg-[#FFF5F5]' : ''}>
                    <td className="admin-td">{w.name}</td>
                    <td className="admin-td">{formatPhone(w.phone)}</td>
                    <td className="admin-td">{w.primaryCompany?.companyName ?? <span className="text-[#bbb]">—</span>}</td>
                    <td className="admin-td">{w.jobTitle}</td>
                    <td className="admin-td">
                      <span className="text-xs text-muted-brand">
                        {EMP_LABELS[w.employmentType ?? ''] ?? w.employmentType ?? '—'}
                        {w.foreignerYn && <span className="ml-1 text-[#f57c00]">외</span>}
                      </span>
                    </td>
                    <td className="admin-td">
                      <span style={{
                        fontSize: '11px',
                        color: w.organizationType === 'SUBCONTRACTOR' ? '#e65100' : '#555',
                        background: w.organizationType === 'SUBCONTRACTOR' ? '#fff3e0' : '#f5f5f5',
                        padding: '1px 6px', borderRadius: '8px'
                      }}>
                        {w.organizationType === 'SUBCONTRACTOR' ? '협력사' : '직영'}
                      </span>
                    </td>
                    <td className="admin-td">{w.deviceCount > 0 ? `${w.deviceCount}대` : '미등록'}</td>
                    <td className="admin-td">
                      {w.retirementMutualStatus === 'TARGET' && (
                        <span className="inline-block px-2 py-[2px] rounded text-[11px] font-semibold bg-[rgba(244,121,32,0.12)] text-[#F47920]">대상</span>
                      )}
                      {w.retirementMutualStatus === 'NOT_TARGET' && (
                        <span className="inline-block px-2 py-[2px] rounded text-[11px] font-semibold bg-brand text-[#757575]">비대상</span>
                      )}
                      {w.retirementMutualStatus === 'PENDING_REVIEW' && (
                        <span className="inline-block px-2 py-[2px] rounded text-[11px] font-semibold bg-[#fff3e0] text-[#e65100]">확인필요</span>
                      )}
                      {!w.retirementMutualStatus && (
                        <span className="text-xs text-[#bbb]">—</span>
                      )}
                    </td>
                    <td className="admin-td">
                      <div className="flex items-center gap-[6px]">
                        <IdVerificationBadge status={w.idVerificationStatus} />
                        <button
                          onClick={() => { setUploadWorkerId(w.id); setUploadWorkerName(w.name); setShowUpload(true) }}
                          className="text-xs text-secondary-brand bg-none border-none cursor-pointer p-0 underline"
                        >
                          업로드
                        </button>
                      </div>
                    </td>
                    <td className="admin-td">
                      {w.isActive
                        ? <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#16A34A] border border-[#A7F3D0]">재직중</span>
                        : <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] border border-[#F87171]">퇴사</span>
                      }
                    </td>
                    <td className="admin-td">{new Date(w.createdAt).toLocaleDateString('ko-KR')}</td>
                    <td className="px-3 py-3 text-sm border-b border-[#f5f5f5] text-white whitespace-nowrap">
                      <Link href={`/admin/workers/${w.id}`} className="text-xs text-secondary-brand no-underline mr-[6px]">상세</Link>
                      {canMutate && <button onClick={() => openEdit(w)} className="px-[10px] py-1 text-xs bg-[rgba(91,164,217,0.12)] text-secondary-brand border border-[#90caf9] rounded cursor-pointer mr-1">수정</button>}
                      {canMutate && w.isActive && (
                        <button
                          onClick={() => { setDeleteTarget(w); setDeleteError('') }}
                          className="px-[10px] py-1 text-xs bg-[#ffebee] text-[#c62828] border border-[#ef9a9a] rounded cursor-pointer"
                        >
                          비활성화
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>{/* overflow-x-auto */}
          </div>
        )}

        {/* ── 등록 모달 ─────────────────────────────────────── */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
            {guideStep === 'guide' ? (
              /* ─ 안내 단계 ─ */
              <div className="bg-white rounded-xl p-8 w-[740px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#E5E7EB]">
                <div className="flex justify-between items-center mb-[6px]">
                  <h3 className="text-lg font-bold m-0 text-[#111827]">근로유형 / 계약유형 선택 안내</h3>
                  <button onClick={closeRegModal} className="bg-none border-none text-[20px] cursor-pointer text-[#999]">✕</button>
                </div>
                <p className="text-[13px] text-muted-brand mb-4 leading-[1.6]">
                  근로유형에 따라 계약서 종류, 입력 항목, 근태 기준, 정산 방식이 달라집니다.
                  유형을 잘못 선택하면 문서·근태·정산 처리에 오류가 생길 수 있으므로, 아래 설명을 먼저 확인한 후 진행하세요.
                  근로자 등록 시 선택한 유형에 따라 이후 계약서 종류와 입력 항목이 달라집니다.
                </p>

                {/* 비교표 */}
                <div className="overflow-x-auto mb-[14px]">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F3F4F6]">
                        {['유형', '이런 경우 선택', '계약 종료일', '근태/계산 기준', '생성 문서/처리'].map(h => (
                          <th key={h} className="px-[10px] py-[7px] border border-[#E5E7EB] text-left text-[#4B5563] font-bold whitespace-nowrap text-[11px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ADMIN_TYPE_GUIDES.map(g => (
                        <tr key={g.code} className="align-top">
                          <td style={{ padding: '7px 10px', border: '1px solid #E5E7EB', fontWeight: 700, color: g.accentColor, whiteSpace: 'nowrap' }}>{g.icon} {g.label}</td>
                          <td className="px-[10px] py-[7px] border border-[#E5E7EB] text-[#374151] text-[11px]">{g.tableRow.whenToSelect}</td>
                          <td className="px-[10px] py-[7px] border border-[#E5E7EB] text-[#374151] text-[11px] whitespace-nowrap">{g.tableRow.endDateConcept}</td>
                          <td className="px-[10px] py-[7px] border border-[#E5E7EB] text-[#374151] text-[11px]">{g.tableRow.calcBasis}</td>
                          <td className="px-[10px] py-[7px] border border-[#E5E7EB] text-[#374151] text-[11px]">{g.tableRow.documents}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 오선택 방지 경고 */}
                <div className="bg-[#fff8e1] border border-[#ffe082] rounded-lg px-[14px] py-[10px] mb-4">
                  <div className="text-xs font-bold text-[#795548] mb-[6px]">⚠ 오선택 방지 — 반드시 확인하세요</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-[2px]">
                    {ADMIN_TYPE_WARNINGS.map((w, i) => (
                      <div key={i} className="text-[11px] text-[#795548]">• {w}</div>
                    ))}
                  </div>
                </div>

                {/* 유형별 카드 (2×2 그리드) */}
                {(() => {
                  const selectedGuideCode = form.organizationType === 'SUBCONTRACTOR'
                    ? 'SUBCONTRACTOR'
                    : form.employmentType || null
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-[10px] mb-[14px]">
                        {ADMIN_TYPE_GUIDES.map(guide => {
                          const isSelected = guide.code === selectedGuideCode
                          return (
                            <div
                              key={guide.code}
                              onClick={() => {
                                if (guide.code === 'SUBCONTRACTOR') {
                                  setForm(f => ({ ...f, organizationType: 'SUBCONTRACTOR', employmentType: '' }))
                                } else {
                                  setForm(f => ({ ...f, employmentType: guide.code, organizationType: 'DIRECT' }))
                                }
                              }}
                              style={{
                                border: `2px solid ${isSelected ? guide.accentColor : guide.accentColor + '30'}`,
                                borderRadius: '8px', padding: '14px', background: isSelected ? guide.accentColor + '08' : 'white',
                                display: 'flex', flexDirection: 'column', cursor: 'pointer',
                                transition: 'border-color 0.15s, background 0.15s',
                              }}
                            >
                              <div className="flex items-center gap-[6px] mb-[6px]">
                                <span className="text-lg">{guide.icon}</span>
                                <span style={{ fontWeight: 700, fontSize: '14px', color: guide.accentColor }}>{guide.label}</span>
                                {isSelected && (
                                  <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: guide.accentColor, background: guide.accentColor + '18', borderRadius: '10px', padding: '2px 8px' }}>
                                    ✓ 선택됨
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-brand mb-2 leading-[1.5] grow">{guide.detail}</p>
                              <div className="text-[11px] text-muted-brand mb-2">
                                <div className="font-semibold mb-[3px] text-[#2e7d32]">✅ 이 유형이 맞는 경우</div>
                                {guide.whenItFits.map((w, i) => <div key={i} className="mb-[2px]">• {w}</div>)}
                              </div>
                              <div className="text-[11px] text-[#9a4a00] bg-[#fff3e0] rounded px-2 py-[6px]">
                                ⚠ {guide.caution}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="border-t border-[#f0f0f0] pt-3 flex justify-between items-center gap-[10px]">
                        <button onClick={closeRegModal} className="flex-none px-5 py-2 bg-white text-[#6B7280] border border-[#E5E7EB] rounded-[8px] cursor-pointer text-[13px] hover:bg-[#F9FAFB] transition-colors">취소</button>
                        <button
                          disabled={!selectedGuideCode}
                          onClick={() => setGuideStep('form')}
                          style={{
                            padding: '9px 24px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: selectedGuideCode ? 'pointer' : 'not-allowed',
                            background: selectedGuideCode
                              ? (ADMIN_TYPE_GUIDES.find(g => g.code === selectedGuideCode)?.accentColor || '#1976d2')
                              : '#ccc',
                            color: 'white', opacity: selectedGuideCode ? 1 : 0.6,
                          }}
                        >
                          {selectedGuideCode
                            ? `${ADMIN_TYPE_GUIDES.find(g => g.code === selectedGuideCode)?.label} 으로 등록 진행 →`
                            : '유형을 선택하세요'}
                        </button>
                      </div>
                    </>
                  )
                })()}
              </div>
            ) : (
              /* ─ 등록 폼 단계 ─ */
              <div className="bg-white rounded-xl p-8 w-[400px] max-w-[90vw] shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#E5E7EB]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold m-0 text-[#111827]">근로자 등록</h3>
                  <button onClick={() => setGuideStep('guide')} className="bg-none border-none text-[13px] cursor-pointer text-secondary-brand underline">← 유형 안내</button>
                </div>
                {[
                  { label: '이름', key: 'name', placeholder: '홍길동' },
                  { label: '휴대폰', key: 'phone', placeholder: '01012345678 (숫자만)' },
                  { label: '직종/역할', key: 'jobTitle', placeholder: '형틀목공' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} className="mb-3">
                    <label className="block text-[12px] font-semibold text-[#6B7280] mb-1">{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={form[key as keyof typeof form] as string}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="admin-input w-full box-border"
                    />
                  </div>
                ))}
                <div className="mb-3">
                  <label className="block text-[12px] font-semibold text-[#6B7280] mb-1">고용형태</label>
                  <select
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className="admin-input w-full box-border"
                  >
                    <option value="DAILY_CONSTRUCTION">건설일용 (일 단위 공수)</option>
                    <option value="REGULAR">상용직 (근태 관리)</option>
                    <option value="FIXED_TERM">기간제 (계약기간 필수)</option>
                    <option value="CONTINUOUS_SITE">계속근로형 현장근로자</option>
                    <option value="BUSINESS_33">3.3% 사업소득 (용역)</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-[12px] font-semibold text-[#6B7280] mb-1">소속구분</label>
                  <select
                    value={form.organizationType}
                    onChange={(e) => setForm({ ...form, organizationType: e.target.value })}
                    className="admin-input w-full box-border"
                  >
                    <option value="DIRECT">직영</option>
                    <option value="SUBCONTRACTOR">협력사 소속</option>
                  </select>
                </div>
                {detectEmploymentMismatch(form.employmentType, form.organizationType) && (
                  <div className="bg-[#fff8e1] border border-[#ffe082] rounded-md px-3 py-[10px] mb-3 text-xs text-[#795548]">
                    ⚠ {detectEmploymentMismatch(form.employmentType, form.organizationType)!.message}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="foreignerYn"
                    checked={form.foreignerYn as boolean}
                    onChange={(e) => setForm({ ...form, foreignerYn: e.target.checked })}
                  />
                  <label htmlFor="foreignerYn" className="text-sm text-[#374151]">외국인 근로자</label>
                </div>
                {formError && <p className="text-[#e53935] text-[13px] m-0 mb-3">{formError}</p>}
                <div className="flex gap-2 mt-4">
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-[#F47920] text-white border-none rounded-md cursor-pointer font-bold">
                    {saving ? '저장 중...' : '등록'}
                  </button>
                  <button onClick={closeRegModal} className="flex-1 py-3 bg-white text-[#6B7280] border border-[#E5E7EB] rounded-[8px] cursor-pointer hover:bg-[#F9FAFB] transition-colors">취소</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 수정 모달 ─────────────────────────────────────── */}
        {editTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-xl p-8 w-[400px] max-w-[90vw] shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#E5E7EB]">
              <h3 className="text-lg font-bold m-0 mb-5 text-[#111827]">근로자 수정 — {editTarget.name}</h3>
              {[
                { label: '이름', key: 'name', placeholder: '' },
                { label: '휴대폰', key: 'phone', placeholder: '01012345678' },
                { label: '직종/역할', key: 'jobTitle', placeholder: '' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="mb-3">
                  <label className="block text-[12px] font-semibold text-[#6B7280] mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={editForm[key as keyof typeof editForm] as string}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="admin-input w-full box-border"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="editActive"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                <label htmlFor="editActive" className="text-sm text-[#374151]">활성 상태</label>
              </div>
              {editError && <p className="text-[#e53935] text-[13px] m-0 mb-3">{editError}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleEdit} disabled={editSaving} className="flex-1 py-3 bg-[#F47920] text-white border-none rounded-md cursor-pointer font-bold">
                  {editSaving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setEditTarget(null)} className="flex-1 py-3 bg-white text-[#6B7280] border border-[#E5E7EB] rounded-[8px] cursor-pointer hover:bg-[#F9FAFB] transition-colors">취소</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 비활성화 확인 모달 ────────────────────────────── */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-xl p-8 max-w-[360px] w-full shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#E5E7EB]">
              <h3 className="text-lg font-bold m-0 mb-5 text-[#c62828]">근로자 비활성화</h3>
              <p className="text-sm text-muted-brand mb-2">
                <strong>{deleteTarget.name}</strong> ({formatPhone(deleteTarget.phone)}) 을 비활성화합니다.
              </p>
              <p className="text-[13px] text-muted-brand mb-5">
                출퇴근 이력은 보존되며, 기존 기기는 모두 비활성화됩니다.
              </p>
              {deleteError && <p className="text-[#e53935] text-[13px] m-0 mb-3">{deleteError}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 bg-[#c62828] text-white border-none rounded-md cursor-pointer font-bold">
                  {deleting ? '처리 중...' : '비활성화'}
                </button>
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 bg-white text-[#6B7280] border border-[#E5E7EB] rounded-[8px] cursor-pointer hover:bg-[#F9FAFB] transition-colors">취소</button>
              </div>
            </div>
          </div>
        )}
        {/* ── 신분증 업로드 모달 ────────────────────────────── */}
        {showUpload && (
          <IdentityUploadModal
            workerId={uploadWorkerId}
            workerName={uploadWorkerName}
            onClose={() => setShowUpload(false)}
            onSuccess={handleUploadSuccess}
          />
        )}
        {/* ── AI 분석 결과 모달 ─────────────────────────────── */}
        {showScanResult && scanResult && (
          <ScanResultModal
            workerId={uploadWorkerId}
            result={scanResult}
            onClose={() => { setShowScanResult(false); setScanResult(null) }}
            onVerify={handleVerify}
            onReject={handleReject}
          />
        )}
    </PageShell>
  )
}

// ── 신분증 관련 하위 컴포넌트 ─────────────────────────────────────────

function IdVerificationBadge({ status }: { status?: string | null }) {
  const styleMap: Record<string, React.CSSProperties> = {
    VERIFIED: { background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
    PENDING_REVIEW: { background: '#fef9c3', color: '#a16207', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
    REJECTED: { background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
    RESCAN_REQUIRED: { background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
    ARCHIVED: { background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
  }
  const labelMap: Record<string, string> = {
    VERIFIED: '검토완료', PENDING_REVIEW: '검토대기', REJECTED: '반려',
    RESCAN_REQUIRED: '재스캔', ARCHIVED: '보관',
  }
  if (!status) return <span className="text-xs text-[#bbb]">미제출</span>
  const label = labelMap[status] ?? status
  const s = styleMap[status] ?? { background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }
  return <span style={s}>{label}</span>
}

function IdentityUploadModal({ workerId, workerName, onClose, onSuccess }: {
  workerId: string; workerName: string; onClose: () => void; onSuccess: (r: ScanResult) => void
}) {
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  const handleUpload = async () => {
    if (!file) { setError('파일을 선택해주세요.'); return }
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/admin/workers/${workerId}/identity-documents/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '업로드 실패'); return }
      onSuccess(data as ScanResult)
    } catch { setError('오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] w-full max-w-[480px] border border-[#E5E7EB]">
        <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between">
          <h2 className="m-0 text-base font-semibold text-[#111827]">신분증 업로드 — {workerName}</h2>
          <button onClick={onClose} className="bg-none border-none cursor-pointer text-[20px] text-[#9CA3AF] hover:text-[#374151] leading-none">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <label className="block">
            <span className="text-[13px] font-medium text-[#6B7280] block mb-[6px]">신분증 이미지 (JPG/PNG, 최대 10MB)</span>
            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleFile}
              className="block w-full text-[13px] text-[#374151]" />
          </label>
          {preview && (
            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="미리보기" className="w-full max-h-[192px] object-contain bg-[#F9FAFB] block" />
            </div>
          )}
          {error && <p className="text-[13px] text-[#DC2626] m-0">{error}</p>}
          <div className="text-xs text-[#6B7280] bg-[#F9FAFB] border border-[#F3F4F6] rounded-md px-3 py-[10px]">
            ⚠️ 원본 이미지는 암호화 저장되며 관리자만 열람 가능합니다.
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#F3F4F6] flex gap-[10px] justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#6B7280] bg-white border border-[#E5E7EB] rounded-[8px] cursor-pointer hover:bg-[#F9FAFB] transition-colors">취소</button>
          <button onClick={handleUpload} disabled={!file || loading}
            className="px-5 py-2 text-[13px] bg-[#F97316] hover:bg-[#EA580C] text-white border-none rounded-[8px] cursor-pointer disabled:opacity-50 transition-colors">
            {loading ? 'AI 분석 중...' : '업로드 + AI 분석'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ScanResultModal({ workerId, result, onClose, onVerify, onReject }: {
  workerId: string; result: ScanResult; onClose: () => void
  onVerify: () => void; onReject: (s: string, r: string) => void
}) {
  const [showReject, setShowReject] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState('')
  const [rejectStatus, setRejectStatus] = React.useState('REJECTED')
  const [applying, setApplying] = React.useState(false)
  const [applyMsg, setApplyMsg] = React.useState('')

  const docTypeLabel: Record<string, string> = {
    NATIONAL_ID: '주민등록증', DRIVER_LICENSE: '운전면허증',
    ALIEN_REGISTRATION: '외국인등록증', UNKNOWN: '미분류',
  }
  const reviewLabel: Record<string, string> = {
    PENDING_REVIEW: '검토대기', VERIFIED: '검토완료',
    REJECTED: '반려', RESCAN_REQUIRED: '재스캔필요',
  }
  const p = result.parsed

  const handleApply = async () => {
    setApplying(true)
    try {
      const res = await fetch(`/api/admin/workers/${workerId}/identity-documents/${result.documentId}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwritePolicy: 'FILL_EMPTY_ONLY' }),
      })
      const data = await res.json()
      setApplyMsg(res.ok ? `반영 완료 (${(data.applied ?? []).join(', ') || '없음'})` : `실패: ${data.error}`)
    } finally { setApplying(false) }
  }

  const fields: { label: string; value: string | undefined }[] = [
    { label: '이름', value: p.name },
    { label: '생년월일', value: p.birthDate },
    { label: '국적', value: p.nationality },
    { label: '발급일', value: p.issueDate },
    { label: '만료일', value: p.expiryDate },
    { label: '외국인', value: p.foreignerYn !== undefined ? (p.foreignerYn ? '외국인' : '내국인') : undefined },
    { label: '거주자구분', value: p.residentType },
    { label: '주소', value: p.address },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] w-full max-w-[680px] max-h-[90vh] overflow-y-auto border border-[#E5E7EB]">
        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-start justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="m-0 mb-1 text-base font-semibold text-[#111827]">AI 분석 결과</h2>
            <p className="m-0 text-xs text-[#6B7280]">
              상태: <span className="font-medium">{reviewLabel[result.reviewStatus] ?? result.reviewStatus}</span> · 스캔: {result.scanStatus}
            </p>
          </div>
          <button onClick={onClose} className="bg-none border-none cursor-pointer text-[20px] text-[#9CA3AF] hover:text-[#374151] leading-none">✕</button>
        </div>
        {/* 본문 */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[#374151]">문서 종류:</span>
            <span className="px-[10px] py-[2px] text-xs bg-[#DBEAFE] text-[#1D4ED8] rounded-full font-medium">
              {docTypeLabel[p.documentType] ?? p.documentType}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            {fields.filter(item => item.value).map(item => (
              <div key={item.label} className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-lg px-3 py-[10px]">
                <div className="text-[11px] text-[#9CA3AF] mb-[2px]">{item.label}</div>
                <div className="text-[13px] font-medium text-[#111827] break-all">{item.value}</div>
              </div>
            ))}
          </div>
          {p.confidence && Object.keys(p.confidence).length > 0 && (
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3">
              <div className="text-xs font-medium text-[#2563EB] mb-[6px]">AI 신뢰도</div>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(p.confidence).map(([k, v]) => (
                  <span key={k} className="text-xs text-[#374151]">{k}: <strong>{Math.round(Number(v) * 100)}%</strong></span>
                ))}
              </div>
            </div>
          )}
          <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/admin/identity-documents/${result.documentId}/file?variant=masked`}
              alt="마스킹본"
              className="w-full max-h-[224px] object-contain bg-[#F9FAFB] block"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="px-2 py-2 text-xs text-[#6B7280] text-center">마스킹본 (민감정보 가림)</div>
          </div>
          <a
            href={`/api/admin/identity-documents/${result.documentId}/file?variant=original`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-[#6B7280] underline"
          >
            원본 보기 (관리자 전용)
          </a>
          <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-lg p-[14px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium text-[#374151]">근로자 데이터 자동 반영</span>
              <button onClick={handleApply} disabled={applying}
                className="text-xs px-3 py-1 bg-[#4F46E5] hover:bg-[#4338CA] text-white border-none rounded-[6px] cursor-pointer disabled:opacity-50 transition-colors">
                {applying ? '반영 중...' : '빈 필드에 반영'}
              </button>
            </div>
            {applyMsg && <p className="text-xs text-[#15803D] m-0 mb-1">{applyMsg}</p>}
            <p className="text-xs text-[#6B7280] m-0">기존 데이터가 있는 필드는 덮어쓰지 않습니다.</p>
          </div>
          {showReject && (
            <div className="border border-[#F87171] rounded-lg p-[14px] bg-[#FFF5F5] flex flex-col gap-2">
              <select value={rejectStatus} onChange={e => setRejectStatus(e.target.value)}
                className="admin-select w-full">
                <option value="REJECTED">반려</option>
                <option value="RESCAN_REQUIRED">재스캔 요청</option>
              </select>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="사유 입력 (필수)" rows={2}
                className="admin-input w-full resize-none box-border" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowReject(false)}
                  className="text-xs bg-transparent border-none cursor-pointer text-[#6B7280] underline">취소</button>
                <button onClick={() => { if (rejectReason) onReject(rejectStatus, rejectReason) }} disabled={!rejectReason}
                  className="text-xs px-3 py-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white border-none rounded-[6px] cursor-pointer disabled:opacity-50 transition-colors">확인</button>
              </div>
            </div>
          )}
        </div>
        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-[#F3F4F6] flex gap-[10px] justify-between sticky bottom-0 bg-white">
          <button onClick={() => setShowReject(!showReject)}
            className="px-4 py-2 text-[13px] border border-[#F87171] text-[#DC2626] bg-white hover:bg-[#FFF5F5] rounded-[8px] cursor-pointer transition-colors">
            반려 / 재스캔
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-[13px] text-[#6B7280] bg-white border border-[#E5E7EB] rounded-[8px] cursor-pointer hover:bg-[#F9FAFB] transition-colors">닫기</button>
            <button onClick={onVerify}
              className="px-5 py-2 text-[13px] bg-[#16a34a] text-white border-none rounded-lg cursor-pointer">검토 완료</button>
          </div>
        </div>
      </div>
    </div>
  )
}
