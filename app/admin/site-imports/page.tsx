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
    <div className="p-8 min-w-0">
        <h1 className="text-[22px] font-bold m-0 mb-1">현장 엑셀 업로드</h1>
        <p className="text-[13px] text-muted-brand mt-[-12px] mb-6">
          xlsx 파일 업로드 → 자동 지오코딩 → 검수 → 승인된 현장만 등록
        </p>

        {/* 업로드 카드 */}
        <div className="bg-white rounded-[12px] p-5 mb-7 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="font-bold text-[15px] mb-2">새 파일 업로드</div>
          <div className="text-[13px] text-muted-brand mb-4">
            필수 컬럼: <strong>현장명</strong>, <strong>주소</strong> / 선택: 허용반경(m), 현장코드
          </div>

          {/* 엑셀 샘플 형식 안내 */}
          <div className="bg-brand rounded-lg px-4 py-3 mb-4 text-[12px] text-muted-brand">
            <div className="font-semibold mb-[6px]">📋 엑셀 헤더 예시 (1행)</div>
            <code className="block text-[#5BA4D9]">현장명 | 주소 | 허용반경(m) | 현장코드</code>
            <div className="mt-1 text-muted-brand">※ 지오코딩 API 미설정 시 좌표는 검수 화면에서 직접 입력</div>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-[6px] text-[13px]" />
            <button onClick={handleUpload} disabled={uploading} className={`px-6 py-[10px] bg-[#F47920] text-white border-none rounded-lg cursor-pointer text-[14px] font-semibold ${uploading ? 'opacity-60' : ''}`}>
              {uploading ? '업로드 중 (지오코딩 포함)...' : '업로드 및 파싱'}
            </button>
          </div>

          {uploadMsg && (
            <div className={`mt-3 px-[14px] py-[10px] rounded-lg text-[13px] font-semibold ${uploadMsg.includes('완료') ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#ffebee] text-[#b71c1c]'}`}>
              {uploadMsg}
            </div>
          )}

          {uploading && (
            <div className="mt-3 text-[12px] text-muted-brand">
              ⏳ 주소별 지오코딩 중입니다. 행 수에 따라 최대 수 분이 소요될 수 있습니다.
            </div>
          )}
        </div>

        {/* 작업 목록 */}
        <div className="font-bold text-[15px] mb-3">업로드 이력</div>
        {loading ? <p className="text-muted-brand">로딩 중...</p> : (
          <div className="bg-white rounded-[12px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['업로드일시', '파일명', '상태', '전체', 'READY', '검수필요/실패', '승인', '등록완료', ''].map((h) => (
                    <th key={h} className="text-left px-[14px] py-[10px] text-[11px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] bg-[#fafafa] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-[#999]">업로드 이력이 없습니다.</td></tr>
                ) : jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="px-[14px] py-[10px] text-[13px] border-b border-[#f5f5f5]">{formatDT(j.createdAt)}</td>
                    <td className="px-[14px] py-[10px] text-[13px] border-b border-[#f5f5f5]">
                      <span className="text-[13px] text-[#CBD5E0]">{j.originalFilename}</span>
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px] border-b border-[#f5f5f5]">
                      <span className="text-[11px] font-bold" style={{ color: JOB_STATUS_COLOR[j.status] ?? '#888' }}>
                        {JOB_STATUS_LABEL[j.status] ?? j.status}
                      </span>
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px] border-b border-[#f5f5f5] text-center">{j.totalRows}</td>
                    <td className="px-[14px] py-[10px] text-[13px] border-b border-[#f5f5f5] text-center">
                      <span className="text-[#2e7d32] font-semibold">{j.readyRows}</span>
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px] border-b border-[#f5f5f5] text-center">
                      <span className={j.failedRows > 0 ? 'text-[#e65100] font-semibold' : 'text-[#888]'}>{j.failedRows}</span>
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px] border-b border-[#f5f5f5] text-center">
                      <span className="text-[#4A93C8] font-semibold">{j.approvedRows}</span>
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px] border-b border-[#f5f5f5] text-center">
                      <span className="text-[#4a148c] font-semibold">{j.importedRows}</span>
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px] border-b border-[#f5f5f5]">
                      <Link href={`/admin/site-imports/${j.id}`} className="text-[#5BA4D9] underline text-[13px] font-semibold">검수</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
