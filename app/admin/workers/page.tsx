'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

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

export default function WorkersPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [workers, setWorkers] = useState<Worker[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // 등록 모달
  const [showForm, setShowForm] = useState(false)
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
    setShowForm(false)
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
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'],
          ['/admin/sites', '현장 관리'], ['/admin/attendance', '출퇴근 조회'],
          ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={styles.navItem}>{label}</Link>
        ))}
      </nav>

      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.pageTitle}>근로자 관리 ({total}명)</h1>
          {canMutate && <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ 근로자 등록</button>}
        </div>

        <div style={styles.searchRow}>
          <input
            type="text"
            placeholder="이름, 연락처, 회사 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            style={styles.searchInput}
          />
          <button onClick={() => load()} style={styles.searchBtn}>검색</button>
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['이름', '연락처', '소속회사', '직종', '고용형태', '기기', '퇴직공제', '신분증', '상태', '등록일', ''].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.length === 0 ? (
                  <tr><td colSpan={11} style={styles.empty}>등록된 근로자가 없습니다.</td></tr>
                ) : workers.map((w) => (
                  <tr key={w.id} style={{ opacity: w.isActive ? 1 : 0.5 }}>
                    <td style={styles.td}>{w.name}</td>
                    <td style={styles.td}>{formatPhone(w.phone)}</td>
                    <td style={styles.td}>{w.primaryCompany?.companyName ?? <span style={{ color: '#bbb' }}>—</span>}</td>
                    <td style={styles.td}>{w.jobTitle}</td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', color: '#555' }}>
                        {w.employmentType === 'DAILY_CONSTRUCTION' ? '건설일용' :
                         w.employmentType === 'REGULAR' ? '상용' :
                         w.employmentType === 'BUSINESS_33' ? '3.3%' : w.employmentType ?? '—'}
                        {w.foreignerYn && <span style={{ marginLeft: '4px', color: '#f57c00' }}>외</span>}
                      </span>
                    </td>
                    <td style={styles.td}>{w.deviceCount > 0 ? `${w.deviceCount}대` : '미등록'}</td>
                    <td style={styles.td}>
                      {w.retirementMutualStatus === 'TARGET' && (
                        <span style={styles.badgeBlue}>대상</span>
                      )}
                      {w.retirementMutualStatus === 'NOT_TARGET' && (
                        <span style={styles.badgeGray}>비대상</span>
                      )}
                      {w.retirementMutualStatus === 'PENDING_REVIEW' && (
                        <span style={styles.badgeOrange}>확인필요</span>
                      )}
                      {!w.retirementMutualStatus && (
                        <span style={{ fontSize: '12px', color: '#bbb' }}>—</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IdVerificationBadge status={w.idVerificationStatus} />
                        <button
                          onClick={() => { setUploadWorkerId(w.id); setUploadWorkerName(w.name); setShowUpload(true) }}
                          style={{ fontSize: '12px', color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          업로드
                        </button>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: w.isActive ? '#2e7d32' : '#999', fontSize: '12px', fontWeight: 600 }}>
                        {w.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td style={styles.td}>{new Date(w.createdAt).toLocaleDateString('ko-KR')}</td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                      <Link href={`/admin/workers/${w.id}`} style={{ fontSize: '12px', color: '#1976d2', textDecoration: 'none', marginRight: '6px' }}>상세</Link>
                      {canMutate && <button onClick={() => openEdit(w)} style={styles.editBtn}>수정</button>}
                      {canMutate && w.isActive && (
                        <button
                          onClick={() => { setDeleteTarget(w); setDeleteError('') }}
                          style={styles.deleteBtn}
                        >
                          비활성화
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 등록 모달 ─────────────────────────────────────── */}
        {showForm && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={styles.modalTitle}>근로자 등록</h3>
              {[
                { label: '이름', key: 'name', placeholder: '홍길동' },
                { label: '휴대폰', key: 'phone', placeholder: '01012345678 (숫자만)' },
                { label: '직종/역할', key: 'jobTitle', placeholder: '형틀목공' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={styles.fieldRow}>
                  <label style={styles.label}>{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={styles.input}
                  />
                </div>
              ))}
              <div style={styles.fieldRow}>
                <label style={styles.label}>고용형태</label>
                <select
                  value={form.employmentType}
                  onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                  style={styles.input}
                >
                  <option value="DAILY_CONSTRUCTION">건설 일용근로자</option>
                  <option value="REGULAR">상용근로자</option>
                  <option value="BUSINESS_33">3.3% 사업소득</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.label}>소속구분</label>
                <select
                  value={form.organizationType}
                  onChange={(e) => setForm({ ...form, organizationType: e.target.value })}
                  style={styles.input}
                >
                  <option value="DIRECT">직영</option>
                  <option value="SUBCONTRACTOR">협력사 소속</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="foreignerYn"
                  checked={form.foreignerYn as boolean}
                  onChange={(e) => setForm({ ...form, foreignerYn: e.target.checked })}
                />
                <label htmlFor="foreignerYn" style={{ fontSize: '14px' }}>외국인 근로자</label>
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
              <h3 style={styles.modalTitle}>근로자 수정 — {editTarget.name}</h3>
              {[
                { label: '이름', key: 'name', placeholder: '' },
                { label: '휴대폰', key: 'phone', placeholder: '01012345678' },
                { label: '직종/역할', key: 'jobTitle', placeholder: '' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={styles.fieldRow}>
                  <label style={styles.label}>{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={editForm[key as keyof typeof editForm] as string}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    style={styles.input}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  id="editActive"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                <label htmlFor="editActive" style={{ fontSize: '14px' }}>활성 상태</label>
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

        {/* ── 비활성화 확인 모달 ────────────────────────────── */}
        {deleteTarget && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modal, maxWidth: '360px' }}>
              <h3 style={{ ...styles.modalTitle, color: '#c62828' }}>근로자 비활성화</h3>
              <p style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>
                <strong>{deleteTarget.name}</strong> ({formatPhone(deleteTarget.phone)}) 을 비활성화합니다.
              </p>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
                출퇴근 이력은 보존되며, 기존 기기는 모두 비활성화됩니다.
              </p>
              {deleteError && <p style={styles.error}>{deleteError}</p>}
              <div style={styles.btnRow}>
                <button onClick={handleDelete} disabled={deleting} style={{ ...styles.saveBtn, background: '#c62828' }}>
                  {deleting ? '처리 중...' : '비활성화'}
                </button>
                <button onClick={() => setDeleteTarget(null)} style={styles.cancelBtn}>취소</button>
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { fontSize: '22px', fontWeight: 700, margin: 0 },
  addBtn: { padding: '10px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  searchRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  searchInput: { flex: 1, padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', maxWidth: '360px' },
  searchBtn: { padding: '10px 20px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  tableCard: { background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#888', borderBottom: '2px solid #f0f0f0' },
  td: { padding: '12px', fontSize: '14px', borderBottom: '1px solid #f5f5f5' },
  empty: { textAlign: 'center', padding: '24px', color: '#999' },
  editBtn: { padding: '4px 10px', fontSize: '12px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer', marginRight: '4px' },
  deleteBtn: { padding: '4px 10px', fontSize: '12px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '4px', cursor: 'pointer' },
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'white', borderRadius: '12px', padding: '32px', width: '400px', maxWidth: '90vw' },
  modalTitle: { margin: '0 0 20px', fontSize: '18px', fontWeight: 700 },
  fieldRow: { marginBottom: '12px' },
  label: { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' },
  input: { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' as const },
  error: { color: '#e53935', fontSize: '13px', margin: '0 0 12px' },
  btnRow: { display: 'flex', gap: '8px', marginTop: '16px' },
  saveBtn: { flex: 1, padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 },
  cancelBtn: { flex: 1, padding: '12px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  badgeBlue:   { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#e3f2fd', color: '#1565c0' },
  badgeGray:   { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#f5f5f5', color: '#757575' },
  badgeOrange: { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#fff3e0', color: '#e65100' },
}

// ── 신분증 관련 하위 컴포넌트 ─────────────────────────────────────────

function IdVerificationBadge({ status }: { status?: string | null }) {
  const config: Record<string, { label: string; className: string }> = {
    VERIFIED: { label: '검토완료', className: 'bg-green-100 text-green-700' },
    PENDING_REVIEW: { label: '검토대기', className: 'bg-yellow-100 text-yellow-700' },
    REJECTED: { label: '반려', className: 'bg-red-100 text-red-700' },
    RESCAN_REQUIRED: { label: '재스캔', className: 'bg-orange-100 text-orange-700' },
    ARCHIVED: { label: '보관', className: 'bg-gray-100 text-gray-500' },
  }
  const styleMap: Record<string, React.CSSProperties> = {
    VERIFIED: { background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
    PENDING_REVIEW: { background: '#fef9c3', color: '#a16207', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
    REJECTED: { background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
    RESCAN_REQUIRED: { background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
    ARCHIVED: { background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 },
  }
  if (!status) return <span style={{ fontSize: '12px', color: '#bbb' }}>미제출</span>
  const label = config[status]?.label ?? status
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '480px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>신분증 업로드 — {workerName}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#999', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#444', display: 'block', marginBottom: '6px' }}>신분증 이미지 (JPG/PNG, 최대 10MB)</span>
            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleFile}
              style={{ display: 'block', width: '100%', fontSize: '13px', color: '#555' }} />
          </label>
          {preview && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="미리보기" style={{ width: '100%', maxHeight: '192px', objectFit: 'contain', background: '#f9fafb', display: 'block' }} />
            </div>
          )}
          {error && <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>{error}</p>}
          <div style={{ fontSize: '12px', color: '#9ca3af', background: '#f9fafb', borderRadius: '6px', padding: '10px 12px' }}>
            ⚠️ 원본 이미지는 암호화 저장되며 관리자만 열람 가능합니다.
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: '13px', color: '#555', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>취소</button>
          <button onClick={handleUpload} disabled={!file || loading}
            style={{ padding: '8px 20px', fontSize: '13px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: (!file || loading) ? 0.5 : 1 }}>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* 헤더 */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>AI 분석 결과</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
              상태: <span style={{ fontWeight: 500 }}>{reviewLabel[result.reviewStatus] ?? result.reviewStatus}</span> · 스캔: {result.scanStatus}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#999', lineHeight: 1 }}>✕</button>
        </div>
        {/* 본문 */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 문서 종류 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>문서 종류:</span>
            <span style={{ padding: '2px 10px', fontSize: '12px', background: '#dbeafe', color: '#1d4ed8', borderRadius: '9999px', fontWeight: 500 }}>
              {docTypeLabel[p.documentType] ?? p.documentType}
            </span>
          </div>
          {/* 파싱 필드 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {fields.filter(item => item.value).map(item => (
              <div key={item.label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>{item.label}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a', wordBreak: 'break-all' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {/* AI 신뢰도 */}
          {p.confidence && Object.keys(p.confidence).length > 0 && (
            <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#1d4ed8', marginBottom: '6px' }}>AI 신뢰도</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {Object.entries(p.confidence).map(([k, v]) => (
                  <span key={k} style={{ fontSize: '12px', color: '#374151' }}>{k}: <strong>{Math.round(Number(v) * 100)}%</strong></span>
                ))}
              </div>
            </div>
          )}
          {/* 마스킹 이미지 */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/admin/identity-documents/${result.documentId}/file?variant=masked`}
              alt="마스킹본"
              style={{ width: '100%', maxHeight: '224px', objectFit: 'contain', background: '#f3f4f6', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div style={{ padding: '8px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>마스킹본 (민감정보 가림)</div>
          </div>
          <a
            href={`/api/admin/identity-documents/${result.documentId}/file?variant=original`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '12px', color: '#6b7280', textDecoration: 'underline' }}
          >
            원본 보기 (관리자 전용)
          </a>
          {/* 데이터 반영 */}
          <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>근로자 데이터 자동 반영</span>
              <button onClick={handleApply} disabled={applying}
                style={{ fontSize: '12px', padding: '4px 12px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: applying ? 0.5 : 1 }}>
                {applying ? '반영 중...' : '빈 필드에 반영'}
              </button>
            </div>
            {applyMsg && <p style={{ fontSize: '12px', color: '#15803d', margin: '0 0 4px' }}>{applyMsg}</p>}
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>기존 데이터가 있는 필드는 덮어쓰지 않습니다.</p>
          </div>
          {/* 반려 폼 */}
          {showReject && (
            <div style={{ border: '1px solid #fca5a5', borderRadius: '8px', padding: '14px', background: '#fff5f5', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select value={rejectStatus} onChange={e => setRejectStatus(e.target.value)}
                style={{ width: '100%', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', padding: '8px' }}>
                <option value="REJECTED">반려</option>
                <option value="RESCAN_REQUIRED">재스캔 요청</option>
              </select>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="사유 입력 (필수)" rows={2}
                style={{ width: '100%', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', padding: '8px', resize: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowReject(false)}
                  style={{ fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', textDecoration: 'underline' }}>취소</button>
                <button onClick={() => { if (rejectReason) onReject(rejectStatus, rejectReason) }} disabled={!rejectReason}
                  style={{ fontSize: '12px', padding: '4px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: !rejectReason ? 0.5 : 1 }}>확인</button>
              </div>
            </div>
          )}
        </div>
        {/* 하단 버튼 */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '10px', justifyContent: 'space-between', position: 'sticky', bottom: 0, background: 'white' }}>
          <button onClick={() => setShowReject(!showReject)}
            style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid #fca5a5', color: '#dc2626', background: 'white', borderRadius: '8px', cursor: 'pointer' }}>
            반려 / 재스캔
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose}
              style={{ padding: '8px 16px', fontSize: '13px', color: '#555', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>닫기</button>
            <button onClick={onVerify}
              style={{ padding: '8px 20px', fontSize: '13px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>검토 완료</button>
          </div>
        </div>
      </div>
    </div>
  )
}
