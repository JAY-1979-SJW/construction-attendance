'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Site {
  id: string
  name: string
}

interface EstimateDocument {
  id: string
  fileName: string
  fileSize: number | null
  documentType: string
  parseStatus: string
  parseVersion: number
  sheetCount: number
  notes: string | null
  uploadedAt: string
  site: { id: string; name: string } | null
  _count: { billRows: number; aggregateRows: number }
}

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: '업로드됨',
  PARSING: '파싱중',
  PARSED: '완료',
  REVIEW_REQUIRED: '검토필요',
  FAILED: '실패',
}

const STATUS_COLOR: Record<string, string> = {
  UPLOADED: '#607d8b',
  PARSING: '#f9a825',
  PARSED: '#2e7d32',
  REVIEW_REQUIRED: '#e65100',
  FAILED: '#b71c1c',
}

const DOC_TYPE_LABEL: Record<string, string> = {
  ESTIMATE: '내역서',
  CHANGE_ESTIMATE: '설계변경',
  UNIT_PRICE_SOURCE: '일위대가',
  PRICE_TABLE: '단가표',
  OTHER: '기타',
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function MaterialsPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<EstimateDocument[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [siteFilter, setSiteFilter] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  // Upload form state
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSiteId, setUploadSiteId] = useState('')
  const [uploadDocType, setUploadDocType] = useState('ESTIMATE')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pageSize = 20

  const fetchDocs = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (siteFilter) params.set('siteId', siteFilter)
    fetch(`/api/admin/materials/estimates?${params}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setDocs(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/admin/sites')
      .then(r => r.json())
      .then(data => {
        if (data.success) setSites(data.data?.items ?? data.data ?? [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchDocs() }, [page, siteFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async () => {
    if (!uploadFile) { setUploadError('파일을 선택하세요'); return }
    setUploading(true)
    setUploadError('')
    const fd = new FormData()
    fd.append('file', uploadFile)
    if (uploadSiteId) fd.append('siteId', uploadSiteId)
    fd.append('documentType', uploadDocType)
    if (uploadNotes) fd.append('notes', uploadNotes)
    try {
      const res = await fetch('/api/admin/materials/estimates', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) { setUploadError(data.error ?? '업로드 실패'); return }
      setShowUpload(false)
      setUploadFile(null)
      setUploadSiteId('')
      setUploadDocType('ESTIMATE')
      setUploadNotes('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchDocs()
    } catch {
      setUploadError('네트워크 오류')
    } finally {
      setUploading(false)
    }
  }

  const handleReparse = async (id: string) => {
    await fetch(`/api/admin/materials/estimates/${id}/parse`, { method: 'POST' })
    setTimeout(fetchDocs, 1000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/admin/materials/estimates/${id}`, { method: 'DELETE' })
    fetchDocs()
  }

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        <div style={styles.navSection}>관리</div>
        {[
          { href: '/admin', label: '대시보드' },
          { href: '/admin/workers', label: '근로자 관리' },
          { href: '/admin/companies', label: '회사 관리' },
          { href: '/admin/sites', label: '현장 관리' },
          { href: '/admin/attendance', label: '출퇴근 조회' },
          { href: '/admin/presence-checks', label: '체류확인 현황' },
          { href: '/admin/presence-report', label: '체류확인 리포트' },
          { href: '/admin/work-confirmations', label: '근무확정' },
          { href: '/admin/contracts', label: '인력/계약 관리' },
          { href: '/admin/insurance-eligibility', label: '보험판정' },
          { href: '/admin/wage-calculations', label: '세금/노임 계산' },
          { href: '/admin/filing-exports', label: '신고자료 내보내기' },
          { href: '/admin/exceptions', label: '예외 승인' },
          { href: '/admin/device-requests', label: '기기 변경' },
          { href: '/admin/materials', label: '자재관리' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={item.href === '/admin/materials' ? styles.navItemActive : styles.navItem}>{item.label}</Link>
        ))}
        <button onClick={handleLogout} style={styles.logoutBtn}>로그아웃</button>
      </nav>

      {/* Main */}
      <main style={styles.main}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={styles.pageTitle}>자재관리</h1>
            <p style={styles.pageDesc}>계약내역서 엑셀 파일을 업로드하여 공종별 자재를 파싱·집계합니다</p>
          </div>
          <button onClick={() => setShowUpload(true)} style={styles.primaryBtn}>+ 내역서 업로드</button>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700 }}>내역서 업로드</h2>

              <label style={styles.formLabel}>파일 선택 (xlsx / xls)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                style={styles.fileInput}
              />

              <label style={styles.formLabel}>현장 (선택)</label>
              <select value={uploadSiteId} onChange={e => setUploadSiteId(e.target.value)} style={styles.select}>
                <option value="">-- 현장 선택 안함 --</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <label style={styles.formLabel}>문서 유형</label>
              <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value)} style={styles.select}>
                <option value="ESTIMATE">내역서</option>
                <option value="CHANGE_ESTIMATE">설계변경 내역서</option>
                <option value="UNIT_PRICE_SOURCE">일위대가</option>
                <option value="PRICE_TABLE">단가표</option>
                <option value="OTHER">기타</option>
              </select>

              <label style={styles.formLabel}>메모 (선택)</label>
              <textarea
                value={uploadNotes}
                onChange={e => setUploadNotes(e.target.value)}
                placeholder="내역서에 대한 메모를 입력하세요"
                rows={3}
                style={styles.textarea}
              />

              {uploadError && <div style={styles.errorMsg}>{uploadError}</div>}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button onClick={() => { setShowUpload(false); setUploadError('') }} style={styles.cancelBtn} disabled={uploading}>취소</button>
                <button onClick={handleUpload} style={styles.primaryBtn} disabled={uploading}>
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={styles.filterRow}>
          <select value={siteFilter} onChange={e => { setSiteFilter(e.target.value); setPage(1) }} style={styles.filterSelect}>
            <option value="">전체 현장</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span style={{ color: '#A0AEC0', fontSize: '14px' }}>총 {total}건</span>
        </div>

        {/* Table */}
        <div style={styles.tableCard}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#A0AEC0' }}>로딩 중...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['파일명', '현장', '유형', '상태', '시트수', '업로드일', '액션'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docs.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>업로드된 내역서가 없습니다</td></tr>
                  ) : docs.map(doc => (
                    <tr key={doc.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{doc.fileName}</div>
                        <div style={{ fontSize: '12px', color: '#A0AEC0' }}>{formatFileSize(doc.fileSize)}{doc.notes ? ` · ${doc.notes}` : ''}</div>
                      </td>
                      <td style={styles.td}>{doc.site?.name ?? '-'}</td>
                      <td style={styles.td}>
                        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: '#e8f5e9', color: '#2e7d32' }}>
                          {DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: `${STATUS_COLOR[doc.parseStatus]}20`,
                          color: STATUS_COLOR[doc.parseStatus],
                        }}>
                          {STATUS_LABEL[doc.parseStatus] ?? doc.parseStatus}
                        </span>
                      </td>
                      <td style={styles.td}>{doc.sheetCount}</td>
                      <td style={styles.td}>{new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}</td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Link href={`/admin/materials/estimates/${doc.id}`} style={styles.actionBtn}>보기</Link>
                          <button onClick={() => handleReparse(doc.id)} style={styles.actionBtnSecondary}>재파싱</button>
                          <button onClick={() => handleDelete(doc.id)} style={styles.actionBtnDanger}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', padding: '20px 0 4px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>이전</button>
              <span style={{ padding: '6px 12px', fontSize: '14px', color: '#555' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>다음</button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar: { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navItemActive: { display: 'block', color: 'white', padding: '10px 20px', fontSize: '14px', textDecoration: 'none', background: 'rgba(244,121,32,0.15)', borderLeft: '3px solid #F47920' },
  logoutBtn: { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main: { flex: 1, padding: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: 700, margin: '0 0 4px' },
  pageDesc: { fontSize: '14px', color: '#A0AEC0', margin: 0 },
  primaryBtn: { padding: '10px 20px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  cancelBtn: { padding: '10px 20px', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  filterRow: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' },
  filterSelect: { padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px', background: 'white' },
  tableCard: { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' },
  td: { padding: '12px', fontSize: '14px', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'top' },
  tr: {},
  actionBtn: { padding: '4px 10px', background: 'rgba(91,164,217,0.12)', color: '#5BA4D9', border: '1px solid #90caf9', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' },
  actionBtnSecondary: { padding: '4px 10px', background: '#f3e5f5', color: '#7b1fa2', border: '1px solid #ce93d8', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  actionBtnDanger: { padding: '4px 10px', background: '#ffebee', color: '#b71c1c', border: '1px solid #ef9a9a', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  pageBtn: { padding: '6px 14px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '13px' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#243144', borderRadius: '12px', padding: '32px', width: '480px', maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  formLabel: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px', marginTop: '16px' },
  fileInput: { display: 'block', width: '100%', padding: '8px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px' },
  select: { width: '100%', padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px', background: 'white' },
  textarea: { width: '100%', padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' },
  errorMsg: { background: '#ffebee', color: '#b71c1c', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginTop: '12px' },
}
