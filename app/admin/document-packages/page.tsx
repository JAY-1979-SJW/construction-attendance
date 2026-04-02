'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

const STATUS_LABELS: Record<string, string> = {
  NOT_READY: '준비 필요', UNDER_REVIEW: '검토 중', READY: '투입 가능', REJECTED: '보완 필요', EXPIRED: '만료 재제출 필요',
}
const STATUS_COLORS: Record<string, string> = {
  NOT_READY: '#9e9e9e', UNDER_REVIEW: '#f57c00', READY: '#2e7d32', REJECTED: '#c62828', EXPIRED: '#6d4c41',
}
const DOC_STATUS_LABELS: Record<string, string> = {
  NOT_SUBMITTED: '미제출', SUBMITTED: '검토 대기', APPROVED: '승인 완료', REJECTED: '반려', EXPIRED: '만료',
}
const DOC_STATUS_COLORS: Record<string, string> = {
  NOT_SUBMITTED: '#9e9e9e', SUBMITTED: '#f57c00', APPROVED: '#2e7d32', REJECTED: '#c62828', EXPIRED: '#6d4c41',
}
const DOC_TYPE_LABELS: Record<string, string> = {
  CONTRACT: '근로계약서', PRIVACY_CONSENT: '개인정보 동의서', HEALTH_DECLARATION: '건강 각서',
  HEALTH_CERTIFICATE: '건강증명서', SAFETY_ACK: '안전서류',
}

export default function DocumentPackagesPage() {
  const [filter, setFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [packages, setPackages] = useState<any[]>([])
  const [pendingDocs, setPendingDocs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'packages' | 'pending'>('pending')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set('status', filter)
      if (keyword) params.set('keyword', keyword)
      if (viewMode === 'pending') params.set('docStatus', 'SUBMITTED')
      const res = await fetch(`/api/admin/document-packages?${params}`)
      const json = await res.json()
      if (json.success) {
        setPackages(json.data.packages || [])
        setPendingDocs(json.data.pendingDocs || [])
        setTotal(json.data.total || 0)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter, viewMode])

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">투입 문서 관리</h1>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('pending')}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium border cursor-pointer ${viewMode === 'pending' ? 'bg-[#f57c00] text-white border-[#f57c00]' : 'bg-white border-brand'}`}>
            검토대기 문서
          </button>
          <button onClick={() => setViewMode('packages')}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium border cursor-pointer ${viewMode === 'packages' ? 'bg-[#1976d2] text-white border-[#1976d2]' : 'bg-white border-brand'}`}>
            근로자별 패키지
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4 items-center">
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="이름/연락처 검색"
          className="px-3 py-2 border border-brand rounded-md text-[13px] w-48" />
        <button onClick={load} className="px-3 py-2 bg-[#1976d2] text-white border-none rounded-md text-[13px] cursor-pointer">검색</button>
        {viewMode === 'packages' && (
          <div className="flex gap-1 ml-4">
            {['', 'NOT_READY', 'UNDER_REVIEW', 'READY', 'REJECTED', 'EXPIRED'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-full text-[12px] border cursor-pointer ${filter === s ? 'bg-[#37474f] text-white border-[#37474f]' : 'bg-white border-brand'}`}>
                {s ? STATUS_LABELS[s] : '전체'}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-[#718096]">불러오는 중...</div>
      ) : viewMode === 'pending' ? (
        /* 검토대기 문서 목록 */
        <div className="bg-card rounded-[12px] shadow-sm border border-brand">
          <div className="px-4 py-3 border-b border-brand text-sm font-bold text-[#37474f]">
            검토대기 문서 ({pendingDocs.length}건)
          </div>
          <MobileCardList
            items={pendingDocs}
            emptyMessage="검토대기 문서가 없습니다."
            keyExtractor={(doc: any) => doc.id}
            renderCard={(doc: any) => (
              <MobileCard
                title={doc.worker?.name}
                subtitle={doc.worker?.phone}
                badge={
                  <span className="px-2 py-0.5 rounded bg-[#fff3e0] text-[#f57c00] text-[11px] font-bold">
                    {DOC_TYPE_LABELS[doc.docType] || doc.docType}
                  </span>
                }
              >
                <MobileCardFields>
                  <MobileCardField label="현장" value={doc.site?.name || '—'} />
                  <MobileCardField label="제출일" value={doc.submittedAt ? new Date(doc.submittedAt).toLocaleDateString('ko-KR') : '—'} />
                </MobileCardFields>
                <MobileCardActions>
                  <Link href={`/admin/workers/${doc.worker?.id}`}
                    className="px-3 py-1 bg-[#1976d2] text-white rounded text-[11px] no-underline font-bold">
                    검토하기
                  </Link>
                </MobileCardActions>
              </MobileCard>
            )}
            renderTable={() => (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-[#718096] border-b border-brand">
                    <th className="py-2.5 px-4">근로자</th>
                    <th className="py-2.5 px-4">현장</th>
                    <th className="py-2.5 px-4">문서</th>
                    <th className="py-2.5 px-4">제출일</th>
                    <th className="py-2.5 px-4">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDocs.map((doc: any) => (
                    <tr key={doc.id} className="border-b border-brand hover:bg-surface">
                      <td className="py-2.5 px-4">
                        <Link href={`/admin/workers/${doc.worker?.id}`} className="text-[#1976d2] no-underline font-medium">
                          {doc.worker?.name}
                        </Link>
                        {doc.worker?.phone && <span className="text-xs text-[#718096] ml-1">{doc.worker.phone}</span>}
                      </td>
                      <td className="py-2.5 px-4 text-xs">{doc.site?.name || '—'}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#fff3e0] text-[#f57c00] text-[11px] font-bold">
                          {DOC_TYPE_LABELS[doc.docType] || doc.docType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-[#718096]">
                        {doc.submittedAt ? new Date(doc.submittedAt).toLocaleDateString('ko-KR') : '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <Link href={`/admin/workers/${doc.worker?.id}`}
                          className="px-3 py-1 bg-[#1976d2] text-white rounded text-[11px] no-underline font-bold">
                          검토하기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />
        </div>
      ) : (
        /* 근로자별 패키지 목록 */
        <div className="bg-card rounded-[12px] shadow-sm border border-brand">
          <div className="px-4 py-3 border-b border-brand text-sm font-bold text-[#37474f]">
            전체 {total}명
          </div>
          <MobileCardList
            items={packages}
            emptyMessage="데이터가 없습니다."
            keyExtractor={(pkg: any) => pkg.id}
            renderCard={(pkg: any) => (
              <MobileCard
                title={pkg.worker?.name}
                subtitle={pkg.worker?.jobTitle}
                badge={
                  <span style={{ background: STATUS_COLORS[pkg.overallStatus] || '#9e9e9e' }}
                    className="px-2 py-0.5 rounded text-white text-[11px] font-bold">
                    {STATUS_LABELS[pkg.overallStatus] || pkg.overallStatus}
                  </span>
                }
              >
                <MobileCardFields>
                  <MobileCardField label="현장" value={pkg.site?.name || '—'} />
                  <MobileCardField label="승인" value={`${pkg.approvedDocCount}/${pkg.requiredDocCount}`} />
                </MobileCardFields>
                <div className="flex gap-1 flex-wrap mt-2">
                  {pkg.onboardingDocs?.map((doc: any) => (
                    <span key={doc.id} className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white"
                      style={{ background: DOC_STATUS_COLORS[doc.status] || '#9e9e9e' }}
                      title={`${DOC_TYPE_LABELS[doc.docType]}: ${DOC_STATUS_LABELS[doc.status]}`}>
                      {DOC_TYPE_LABELS[doc.docType]?.slice(0, 2)}
                    </span>
                  ))}
                </div>
                <MobileCardActions>
                  <Link href={`/admin/workers/${pkg.worker?.id}`}
                    className="px-3 py-1 bg-[#37474f] text-white rounded text-[11px] no-underline font-bold">
                    상세
                  </Link>
                </MobileCardActions>
              </MobileCard>
            )}
            renderTable={() => (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-[#718096] border-b border-brand">
                    <th className="py-2.5 px-4">근로자</th>
                    <th className="py-2.5 px-4">현장</th>
                    <th className="py-2.5 px-4">상태</th>
                    <th className="py-2.5 px-4">승인</th>
                    <th className="py-2.5 px-4">문서별 상태</th>
                    <th className="py-2.5 px-4">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg: any) => (
                    <tr key={pkg.id} className="border-b border-brand hover:bg-surface">
                      <td className="py-2.5 px-4">
                        <Link href={`/admin/workers/${pkg.worker?.id}`} className="text-[#1976d2] no-underline font-medium">
                          {pkg.worker?.name}
                        </Link>
                        <div className="text-xs text-[#718096]">{pkg.worker?.jobTitle}</div>
                      </td>
                      <td className="py-2.5 px-4 text-xs">{pkg.site?.name || '—'}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-white text-[11px] font-bold"
                          style={{ background: STATUS_COLORS[pkg.overallStatus] || '#9e9e9e' }}>
                          {STATUS_LABELS[pkg.overallStatus] || pkg.overallStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs">{pkg.approvedDocCount}/{pkg.requiredDocCount}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {pkg.onboardingDocs?.map((doc: any) => (
                            <span key={doc.id} className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white"
                              style={{ background: DOC_STATUS_COLORS[doc.status] || '#9e9e9e' }}
                              title={`${DOC_TYPE_LABELS[doc.docType]}: ${DOC_STATUS_LABELS[doc.status]}`}>
                              {DOC_TYPE_LABELS[doc.docType]?.slice(0, 2)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <Link href={`/admin/workers/${pkg.worker?.id}`}
                          className="px-3 py-1 bg-[#37474f] text-white rounded text-[11px] no-underline font-bold">
                          상세
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />
        </div>
      )}
    </div>
  )
}
