'use client'

import { useEffect, useState } from 'react'

interface DocumentRow {
  id: string
  workerId: string
  workerName: string
  documentType: 'ID_CARD' | 'INSURANCE_DOC' | 'CONTRACT' | 'OTHER'
  status: 'UPLOADED' | 'REVIEW_PENDING' | 'APPROVED'
  expiresAt?: string
  uploadedAt: string
  reviewedAt?: string
  reviewedBy?: string
}

const DOC_TYPE_LABEL: Record<DocumentRow['documentType'], string> = {
  ID_CARD: '신분증',
  INSURANCE_DOC: '4대보험증빙',
  CONTRACT: '근로계약서',
  OTHER: '기타',
}

const STATUS_LABEL: Record<DocumentRow['status'], string> = {
  UPLOADED: '업로드완료',
  REVIEW_PENDING: '검토대기',
  APPROVED: '검토완료',
}

const STATUS_STYLE: Record<DocumentRow['status'], { bg: string; color: string }> = {
  UPLOADED:       { bg: '#F3F4F6', color: '#6B7280' },
  REVIEW_PENDING: { bg: '#FFFBEB', color: '#D97706' },
  APPROVED:       { bg: '#F0FDF4', color: '#16A34A' },
}

export default function DocumentsPage() {
  const [rows, setRows] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<DocumentRow['status'] | ''>('')
  const [typeFilter, setTypeFilter] = useState<DocumentRow['documentType'] | ''>('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/labor/documents?status=${statusFilter}&type=${typeFilter}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setRows(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [statusFilter, typeFilter])

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase()
    return !q || r.workerName.toLowerCase().includes(q)
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A]">근로자 서류관리</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">신분증·계약서·4대보험 증빙 서류 현황</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="근로자명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-[12px] border border-[#E5E7EB] rounded-[8px] px-3 py-1.5 w-[160px] focus:outline-none focus:border-[#F97316]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as DocumentRow['documentType'] | '')}
          className="text-[12px] border border-[#E5E7EB] rounded-[8px] px-2 py-1.5 focus:outline-none focus:border-[#F97316] text-[#374151]"
        >
          <option value="">서류 유형 전체</option>
          <option value="ID_CARD">신분증</option>
          <option value="INSURANCE_DOC">4대보험증빙</option>
          <option value="CONTRACT">근로계약서</option>
          <option value="OTHER">기타</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DocumentRow['status'] | '')}
          className="text-[12px] border border-[#E5E7EB] rounded-[8px] px-2 py-1.5 focus:outline-none focus:border-[#F97316] text-[#374151]"
        >
          <option value="">검토 상태 전체</option>
          <option value="REVIEW_PENDING">검토대기</option>
          <option value="UPLOADED">업로드완료</option>
          <option value="APPROVED">검토완료</option>
        </select>
        <span className="ml-auto text-[12px] text-[#9CA3AF]">{filtered.length}건</span>
      </div>

      {/* 테이블 */}
      <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        <table className="w-full text-[12px]">
          <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            <tr>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">근로자명</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">서류 유형</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">검토 상태</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">업로드일</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">만료일</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">검토 완료</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-3.5 bg-[#F3F4F6] rounded animate-pulse" style={{ width: j === 0 ? 64 : 80 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#9CA3AF]">
                  서류 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const ss = STATUS_STYLE[row.status]
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-[#FAFAFA]">
                    <td className="px-3 py-2.5 font-medium text-[#0F172A]">{row.workerName}</td>
                    <td className="px-3 py-2.5 text-[#374151]">{DOC_TYPE_LABEL[row.documentType]}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: ss.bg, color: ss.color }}
                      >
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#6B7280]">{row.uploadedAt.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 text-[#6B7280]">{row.expiresAt?.slice(0, 10) ?? '-'}</td>
                    <td className="px-3 py-2.5 text-[#6B7280]">
                      {row.reviewedAt ? `${row.reviewedAt.slice(0, 10)} (${row.reviewedBy ?? ''})` : '-'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
