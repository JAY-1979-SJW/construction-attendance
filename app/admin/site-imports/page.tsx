'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ImportJob {
  id: string
  originalFilename: string
  status: string
  totalRows: number
  readyRows: number
  failedRows: number
  approvedRows: number
  importedRows: number
  uploadedBy: string
  createdAt: string
}

const JOB_STATUS_LABEL: Record<string, string> = {
  PENDING: '대기중', PROCESSING: '처리중', DONE: '완료', FAILED: '실패',
}
const JOB_STATUS_COLOR: Record<string, string> = {
  PENDING: '#888', PROCESSING: '#1976d2', DONE: '#2e7d32', FAILED: '#b71c1c',
}

export default function SiteImportsPage() {
  const router = useRouter()
  const [jobs, setJobs]         = useState<ImportJob[]>([])
  const [loading, setLoading]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/site-imports')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setJobs(data.data.items)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(load, [router]) // eslint-disable-line

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { setUploadMsg('파일을 선택하세요.'); return }
    setUploading(true)
    setUploadMsg('')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/admin/site-imports', { method: 'POST', body: form })
    const data = await res.json()
    setUploading(false)
    if (data.success) {
      setUploadMsg(data.message ?? '업로드 완료')
      if (fileRef.current) fileRef.current.value = ''
      load()
      // 검수 화면으로 이동
      router.push(`/admin/site-imports/${data.data.jobId}`)
    } else {
      setUploadMsg(data.error ?? data.message ?? '업로드 실패')
    }
  }

  const formatDT = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'],
          ['/admin/sites', '현장 관리'], ['/admin/attendance', '출퇴근 조회'],
          ['/admin/presence-checks', '체류확인 현황'], ['/admin/labor', '투입현황/노임서류'],
          ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'],
          ['/admin/audit-logs', '감사 로그'], ['/admin/site-imports', '현장 엑셀 업로드'],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={{ ...styles.navItem, ...(href === '/admin/site-imports' ? styles.navActive : {}) }}>
            {label}
          </Link>
        ))}
      </nav>

      <main style={styles.main}>
        <h1 style={styles.pageTitle}>현장 엑셀 업로드</h1>
        <p style={{ fontSize: '13px', color: '#A0AEC0', marginTop: '-12px', marginBottom: '24px' }}>
          xlsx 파일 업로드 → 자동 지오코딩 → 검수 → 승인된 현장만 등록
        </p>

        {/* 업로드 카드 */}
        <div style={styles.uploadCard}>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>새 파일 업로드</div>
          <div style={{ fontSize: '13px', color: '#A0AEC0', marginBottom: '16px' }}>
            필수 컬럼: <strong>현장명</strong>, <strong>주소</strong> / 선택: 허용반경(m), 현장코드
          </div>

          {/* 엑셀 샘플 형식 안내 */}
          <div style={{ background: '#1B2838', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#A0AEC0' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>📋 엑셀 헤더 예시 (1행)</div>
            <code style={{ display: 'block', color: '#5BA4D9' }}>현장명 | 주소 | 허용반경(m) | 현장코드</code>
            <div style={{ marginTop: '4px', color: '#A0AEC0' }}>※ 지오코딩 API 미설정 시 좌표는 검수 화면에서 직접 입력</div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' as const }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={styles.fileInput} />
            <button onClick={handleUpload} disabled={uploading} style={{ ...styles.uploadBtn, opacity: uploading ? 0.6 : 1 }}>
              {uploading ? '업로드 중 (지오코딩 포함)...' : '업로드 및 파싱'}
            </button>
          </div>

          {uploadMsg && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: uploadMsg.includes('완료') ? '#e8f5e9' : '#ffebee',
              color: uploadMsg.includes('완료') ? '#2e7d32' : '#b71c1c',
            }}>
              {uploadMsg}
            </div>
          )}

          {uploading && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#A0AEC0' }}>
              ⏳ 주소별 지오코딩 중입니다. 행 수에 따라 최대 수 분이 소요될 수 있습니다.
            </div>
          )}
        </div>

        {/* 작업 목록 */}
        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px' }}>업로드 이력</div>
        {loading ? <p style={{ color: '#A0AEC0' }}>로딩 중...</p> : (
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['업로드일시', '파일명', '상태', '전체', 'READY', '검수필요/실패', '승인', '등록완료', ''].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#999' }}>업로드 이력이 없습니다.</td></tr>
                ) : jobs.map((j) => (
                  <tr key={j.id} style={styles.tr}>
                    <td style={styles.td}>{formatDT(j.createdAt)}</td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '13px', color: '#CBD5E0' }}>{j.originalFilename}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: JOB_STATUS_COLOR[j.status] ?? '#888' }}>
                        {JOB_STATUS_LABEL[j.status] ?? j.status}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' as const }}>{j.totalRows}</td>
                    <td style={{ ...styles.td, textAlign: 'center' as const }}>
                      <span style={{ color: '#2e7d32', fontWeight: 600 }}>{j.readyRows}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' as const }}>
                      <span style={{ color: j.failedRows > 0 ? '#e65100' : '#888', fontWeight: j.failedRows > 0 ? 600 : 400 }}>{j.failedRows}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' as const }}>
                      <span style={{ color: '#4A93C8', fontWeight: 600 }}>{j.approvedRows}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' as const }}>
                      <span style={{ color: '#4a148c', fontWeight: 600 }}>{j.importedRows}</span>
                    </td>
                    <td style={styles.td}>
                      <Link href={`/admin/site-imports/${j.id}`} style={styles.reviewLink}>검수</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout:      { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar:     { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0 },
  sidebarTitle:{ color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem:     { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  navActive:   { color: 'white', background: 'rgba(255,255,255,0.1)', fontWeight: 700 },
  main:        { flex: 1, padding: '32px', minWidth: 0 },
  pageTitle:   { fontSize: '22px', fontWeight: 700, margin: '0 0 4px' },
  uploadCard:  { background: '#243144', borderRadius: '12px', padding: '24px', marginBottom: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  fileInput:   { border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px' },
  uploadBtn:   { padding: '10px 24px', background: '#F47920', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  tableCard:   { background: '#243144', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  table:       { width: '100%', borderCollapse: 'collapse' as const },
  th:          { textAlign: 'left' as const, padding: '10px 14px', fontSize: '11px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)', background: '#fafafa', whiteSpace: 'nowrap' as const },
  td:          { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f5f5f5' },
  tr:          {},
  reviewLink:  { color: '#5BA4D9', textDecoration: 'underline', fontSize: '13px', fontWeight: 600 },
}
