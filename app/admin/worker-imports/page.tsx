'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface ImportJob {
  id: string
  originalFilename: string
  status: string
  totalRows: number
  okRows: number
  reviewRows: number
  blockRows: number
  failedRows: number
  importedRows: number
  createdAt: string
}

export default function WorkerImportsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [loading, setLoading] = useState(true)

  const loadJobs = () => {
    fetch('/api/admin/worker-imports')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.items) setJobs(data.data.items)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(loadJobs, [])

  async function handleUpload(file: File) {
    setError('')
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/worker-imports', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error || json.message || '업로드 실패')
      } else {
        loadJobs()
      }
    } catch {
      setError('네트워�� 오류')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/workers" className="text-[#718096] hover:text-dim-brand text-sm">
          ← 근로자 목록
        </Link>
        <h1 className="text-2xl font-bold">근로자 엑셀 일괄 등록</h1>
      </div>

      {/* 안내 */}
      <div className="bg-card border border-[rgba(91,164,217,0.25)] rounded-lg p-4 space-y-2">
        <h2 className="font-semibold text-sm">엑셀 파일 형식</h2>
        <div className="text-xs text-[#718096] space-y-1">
          <p><strong>필수 컬럼:</strong> 이름, 연락처, 직종</p>
          <p><strong>선택 컬럼:</strong> 소속, 고용형태, 생년월일, 외국인여부, 숙련도, 협력사, 비고</p>
          <p className="text-amber-400">
            중복 없는 건은 자동 등록, 중복 의심 건은 검수 페이지에서 확인 후 등록합니다.
          </p>
        </div>
      </div>

      {/* 업로드 */}
      <div className="bg-card border-2 border-teal-200 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleUpload(f)
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-5 py-2.5 border-2 border-teal-400 text-teal-300 rounded-lg text-sm font-medium hover:bg-teal-900/20 disabled:opacity-50"
          >
            {uploading ? '업로드 중...' : '엑셀 파일 선택'}
          </button>
          {uploading && (
            <span className="text-xs text-teal-400 animate-pulse">처리 중... (OK 건 자동 등록 포함)</span>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-400/40 rounded p-3 text-red-400 text-sm">{error}</div>
        )}
      </div>

      {/* 작업 목록 */}
      <div className="bg-card border border-[rgba(91,164,217,0.25)] rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-3">업로드 이력</h2>
        {loading ? (
          <div className="text-center text-[#718096] text-sm py-4">로딩 중...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center text-[#718096] text-sm py-4">업로드 이력이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#718096] border-b border-[rgba(91,164,217,0.1)]">
                  <th className="text-left py-1.5 pr-2">파일명</th>
                  <th className="text-center py-1.5 pr-2">전체</th>
                  <th className="text-center py-1.5 pr-2">자동등록</th>
                  <th className="text-center py-1.5 pr-2">검토</th>
                  <th className="text-center py-1.5 pr-2">차단</th>
                  <th className="text-center py-1.5 pr-2">실패</th>
                  <th className="text-center py-1.5 pr-2">등록됨</th>
                  <th className="text-left py-1.5">업로드일</th>
                  <th className="text-left py-1.5">관리</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-b border-[rgba(91,164,217,0.05)] hover:bg-[rgba(91,164,217,0.05)]">
                    <td className="py-1.5 pr-2 font-medium">{job.originalFilename}</td>
                    <td className="py-1.5 pr-2 text-center">{job.totalRows}</td>
                    <td className="py-1.5 pr-2 text-center text-green-400">{job.okRows}</td>
                    <td className="py-1.5 pr-2 text-center text-amber-400">{job.reviewRows}</td>
                    <td className="py-1.5 pr-2 text-center text-red-400">{job.blockRows}</td>
                    <td className="py-1.5 pr-2 text-center text-[#718096]">{job.failedRows}</td>
                    <td className="py-1.5 pr-2 text-center text-purple-400">{job.importedRows}</td>
                    <td className="py-1.5 text-[#718096]">{new Date(job.createdAt).toLocaleString('ko-KR')}</td>
                    <td className="py-1.5">
                      {(job.reviewRows + job.blockRows) > 0 ? (
                        <Link
                          href={`/admin/worker-imports/${job.id}`}
                          className="text-teal-400 hover:underline"
                        >
                          검수
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/worker-imports/${job.id}`}
                          className="text-[#718096] hover:underline"
                        >
                          상세
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
