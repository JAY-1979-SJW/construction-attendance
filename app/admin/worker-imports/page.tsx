'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface RowResult {
  row: number
  name: string
  phone: string
  status: 'success' | 'failed' | 'duplicate_warning'
  message: string
  workerId?: string
}

export default function WorkerImportsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    totalRows: number
    successCount: number
    failCount: number
    results: RowResult[]
  } | null>(null)

  async function handleUpload(file: File) {
    setError('')
    setResult(null)
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/worker-imports', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error || json.message || '업로드 실패')
      } else {
        setResult(json.data ?? json)
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const failedRows = result?.results.filter(r => r.status === 'failed') ?? []
  const successRows = result?.results.filter(r => r.status === 'success') ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
            연락처는 010-xxxx-xxxx 형식 (하이픈 있어도 자동 제거됨). 중복 연락처는 자동 차단됨.
          </p>
          <div className="mt-2">
            <p className="font-medium text-[#a0aec0]">고용형태 인식값:</p>
            <p>일용, 정규직, 상용, 3.3%, 프리랜서, 기간제, 계약직, 상주, 기타</p>
          </div>
          <div className="mt-1">
            <p className="font-medium text-[#a0aec0]">소속 인식값:</p>
            <p>직영, 직접, 외주, 협력사, 하도급, 하청</p>
          </div>
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
            <span className="text-xs text-teal-400 animate-pulse">근로자 등록 처리 중...</span>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-400/40 rounded p-3 text-red-400 text-sm">{error}</div>
        )}
      </div>

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 집계 */}
          <div className="bg-card border border-[rgba(91,164,217,0.25)] rounded-lg p-4">
            <h2 className="font-semibold text-sm mb-3">업로드 결과</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{result.totalRows}</div>
                <div className="text-xs text-[#718096]">전체 행</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{result.successCount}</div>
                <div className="text-xs text-[#718096]">등록 성공</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{result.failCount}</div>
                <div className="text-xs text-[#718096]">실패</div>
              </div>
            </div>
          </div>

          {/* 실패 목록 */}
          {failedRows.length > 0 && (
            <div className="bg-card border border-red-400/30 rounded-lg p-4">
              <h3 className="font-semibold text-sm text-red-400 mb-2">
                실패 ({failedRows.length}건)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#718096] border-b border-[rgba(91,164,217,0.1)]">
                      <th className="text-left py-1 pr-2">행</th>
                      <th className="text-left py-1 pr-2">이름</th>
                      <th className="text-left py-1 pr-2">연락처</th>
                      <th className="text-left py-1">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedRows.map(r => (
                      <tr key={r.row} className="border-b border-[rgba(91,164,217,0.05)]">
                        <td className="py-1 pr-2 text-[#718096]">{r.row}</td>
                        <td className="py-1 pr-2">{r.name || '(빈값)'}</td>
                        <td className="py-1 pr-2">{r.phone || '(빈값)'}</td>
                        <td className="py-1 text-red-400">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 성공 목록 */}
          {successRows.length > 0 && (
            <div className="bg-card border border-green-400/30 rounded-lg p-4">
              <h3 className="font-semibold text-sm text-green-400 mb-2">
                등록 성공 ({successRows.length}건)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#718096] border-b border-[rgba(91,164,217,0.1)]">
                      <th className="text-left py-1 pr-2">행</th>
                      <th className="text-left py-1 pr-2">이름</th>
                      <th className="text-left py-1">연락처</th>
                    </tr>
                  </thead>
                  <tbody>
                    {successRows.map(r => (
                      <tr key={r.row} className="border-b border-[rgba(91,164,217,0.05)]">
                        <td className="py-1 pr-2 text-[#718096]">{r.row}</td>
                        <td className="py-1 pr-2">{r.name}</td>
                        <td className="py-1">{r.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
