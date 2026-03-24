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
    <div className="flex min-h-screen bg-brand">
      {/* Sidebar */}
      <nav className="w-[220px] bg-brand-deeper py-6 shrink-0 flex flex-col">
        <div className="text-white text-base font-bold px-5 pb-6 border-b border-white/10">해한 출퇴근</div>
        <div className="text-white/40 text-[11px] px-5 pt-4 pb-2 uppercase tracking-widest">관리</div>
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
          <Link key={item.href} href={item.href}
            className={item.href === '/admin/materials'
              ? 'block text-white px-5 py-[10px] text-sm no-underline bg-[rgba(244,121,32,0.15)] border-l-[3px] border-[#F47920]'
              : 'block text-white/80 px-5 py-[10px] text-sm no-underline'}>
            {item.label}
          </Link>
        ))}
        <button onClick={handleLogout} className="mx-5 mt-6 p-[10px] bg-white/10 border-0 rounded-md text-white/60 cursor-pointer text-[13px]">로그아웃</button>
      </nav>

      {/* Main */}
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold m-0 mb-1">자재관리</h1>
            <p className="text-sm text-muted-brand m-0">계약내역서 엑셀 파일을 업로드하여 공종별 자재를 파싱·집계합니다</p>
          </div>
          <button onClick={() => setShowUpload(true)} className="px-5 py-[10px] bg-[#F47920] text-white border-0 rounded-md cursor-pointer text-sm font-semibold">+ 내역서 업로드</button>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
            <div className="bg-card rounded-[12px] p-8 w-[480px] max-w-[90vw] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
              <h2 className="m-0 mb-5 text-[18px] font-bold">내역서 업로드</h2>

              <label className="block text-[13px] font-semibold text-muted-brand mb-[6px] mt-4">파일 선택 (xlsx / xls)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                className="block w-full p-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm"
              />

              <label className="block text-[13px] font-semibold text-muted-brand mb-[6px] mt-4">현장 (선택)</label>
              <select value={uploadSiteId} onChange={e => setUploadSiteId(e.target.value)} className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-card">
                <option value="">-- 현장 선택 안함 --</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <label className="block text-[13px] font-semibold text-muted-brand mb-[6px] mt-4">문서 유형</label>
              <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value)} className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-card">
                <option value="ESTIMATE">내역서</option>
                <option value="CHANGE_ESTIMATE">설계변경 내역서</option>
                <option value="UNIT_PRICE_SOURCE">일위대가</option>
                <option value="PRICE_TABLE">단가표</option>
                <option value="OTHER">기타</option>
              </select>

              <label className="block text-[13px] font-semibold text-muted-brand mb-[6px] mt-4">메모 (선택)</label>
              <textarea
                value={uploadNotes}
                onChange={e => setUploadNotes(e.target.value)}
                placeholder="내역서에 대한 메모를 입력하세요"
                rows={3}
                className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm resize-y box-border"
              />

              {uploadError && (
                <div className="bg-[#ffebee] text-[#b71c1c] px-[14px] py-[10px] rounded-md text-[13px] mt-3">{uploadError}</div>
              )}

              <div className="flex gap-3 justify-end mt-5">
                <button onClick={() => { setShowUpload(false); setUploadError('') }} className="px-5 py-[10px] bg-[#e0e0e0] text-[#CBD5E0] border-0 rounded-md cursor-pointer text-sm" disabled={uploading}>취소</button>
                <button onClick={handleUpload} className="px-5 py-[10px] bg-[#F47920] text-white border-0 rounded-md cursor-pointer text-sm font-semibold" disabled={uploading}>
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 items-center mb-4">
          <select value={siteFilter} onChange={e => { setSiteFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-sm bg-card">
            <option value="">전체 현장</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="text-muted-brand text-sm">총 {total}건</span>
        </div>

        {/* Table */}
        <div className="bg-card rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          {loading ? (
            <div className="py-10 text-center text-muted-brand">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['파일명', '현장', '유형', '상태', '시트수', '업로드일', '액션'].map(h => (
                      <th key={h} className="text-left px-3 py-[10px] text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docs.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-[#999]">업로드된 내역서가 없습니다</td></tr>
                  ) : docs.map(doc => (
                    <tr key={doc.id}>
                      <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)] align-top">
                        <div className="font-semibold text-sm">{doc.fileName}</div>
                        <div className="text-[12px] text-muted-brand">{formatFileSize(doc.fileSize)}{doc.notes ? ` · ${doc.notes}` : ''}</div>
                      </td>
                      <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)] align-top">{doc.site?.name ?? '-'}</td>
                      <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)] align-top">
                        <span className="text-[12px] px-2 py-[2px] rounded-[10px] bg-[#e8f5e9] text-[#2e7d32]">
                          {DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)] align-top">
                        <span className="inline-block px-[10px] py-[2px] rounded-[20px] text-[12px] font-semibold"
                          style={{
                            background: `${STATUS_COLOR[doc.parseStatus]}20`,
                            color: STATUS_COLOR[doc.parseStatus],
                          }}>
                          {STATUS_LABEL[doc.parseStatus] ?? doc.parseStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)] align-top">{doc.sheetCount}</td>
                      <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)] align-top">{new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}</td>
                      <td className="px-3 py-3 text-sm border-b border-[rgba(91,164,217,0.1)] align-top">
                        <div className="flex gap-2">
                          <Link href={`/admin/materials/estimates/${doc.id}`} className="px-[10px] py-1 bg-[rgba(91,164,217,0.12)] text-[#5BA4D9] border border-[#90caf9] rounded cursor-pointer text-[12px] font-semibold no-underline inline-block">보기</Link>
                          <button onClick={() => handleReparse(doc.id)} className="px-[10px] py-1 bg-[#f3e5f5] text-[#7b1fa2] border border-[#ce93d8] rounded cursor-pointer text-[12px] font-semibold">재파싱</button>
                          <button onClick={() => handleDelete(doc.id)} className="px-[10px] py-1 bg-[#ffebee] text-[#b71c1c] border border-[#ef9a9a] rounded cursor-pointer text-[12px] font-semibold">삭제</button>
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
            <div className="flex gap-2 justify-center py-5 pb-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-[14px] py-[6px] border border-[rgba(91,164,217,0.3)] rounded bg-card cursor-pointer text-[13px]">이전</button>
              <span className="px-3 py-[6px] text-sm text-muted-brand">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-[14px] py-[6px] border border-[rgba(91,164,217,0.3)] rounded bg-card cursor-pointer text-[13px]">다음</button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
