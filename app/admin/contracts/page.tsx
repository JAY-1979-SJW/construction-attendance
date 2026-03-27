'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/admin/ui/PageShell'

const CONTRACT_KIND_LABEL: Record<string, string> = {
  EMPLOYMENT: '근로계약', SERVICE: '용역계약', OUTSOURCING: '업무위탁',
}
const TEMPLATE_LABEL: Record<string, string> = {
  DAILY_EMPLOYMENT:   '일용 근로계약서',
  REGULAR_EMPLOYMENT: '상용 근로계약서',
  FREELANCER_SERVICE: '프리랜서 용역계약서',
  OFFICE_SERVICE:     '사무보조 용역계약서',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안', SIGNED: '서명완료', ACTIVE: '활성', ENDED: '종료',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT:  'bg-[rgba(255,255,255,0.04)] text-[#CBD5E0]',
  SIGNED: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  ENDED:  'bg-red-100 text-red-600',
}

interface Contract {
  id: string
  contractKind: string | null
  contractTemplateType: string | null
  contractStatus: string
  startDate: string
  endDate: string | null
  dailyWage: number
  monthlySalary: number | null
  serviceFee: number | null
  nationalPensionYn: boolean
  healthInsuranceYn: boolean
  employmentInsuranceYn: boolean
  industrialAccidentYn: boolean
  retirementMutualYn: boolean
  signedAt: string | null
  worker: { id: string; name: string; phone: string; jobTitle: string }
  site: { id: string; name: string } | null
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterKind, setFilterKind]     = useState('')
  const [page, setPage] = useState(1)
  const limit = 30

  async function fetchContracts() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (filterStatus) params.set('contractStatus', filterStatus)
    if (filterKind)   params.set('contractKind', filterKind)
    const res  = await fetch(`/api/admin/contracts?${params}`)
    const json = await res.json()
    if (json.success) { setContracts(json.data); setTotal(json.total) }
    setLoading(false)
  }

  useEffect(() => { fetchContracts() }, [filterStatus, filterKind, page])

  const won = (n: number | null | undefined) =>
    n != null ? n.toLocaleString('ko-KR') + '원' : '—'

  const amountLabel = (c: Contract) => {
    if (c.contractKind === 'SERVICE' && c.serviceFee) return won(c.serviceFee)
    if (c.monthlySalary) return won(c.monthlySalary) + '/월'
    return won(c.dailyWage) + '/일'
  }

  const insuranceSummary = (c: Contract) => {
    const items: string[] = []
    if (c.nationalPensionYn)     items.push('국연')
    if (c.healthInsuranceYn)     items.push('건보')
    if (c.employmentInsuranceYn) items.push('고용')
    if (c.industrialAccidentYn)  items.push('산재')
    if (c.retirementMutualYn)    items.push('퇴공')
    return items.length ? items.join('/') : '없음'
  }

  async function handleActivate(id: string) {
    if (!confirm('이 계약을 활성으로 설정하시겠습니까? 기존 활성 계약이 있으면 종료 처리됩니다.')) return
    const res  = await fetch(`/api/admin/contracts/${id}/activate`, { method: 'POST' })
    const json = await res.json()
    json.success ? fetchContracts() : alert(json.error)
  }

  async function handleEnd(id: string) {
    if (!confirm('이 계약을 종료하시겠습니까?')) return
    const res  = await fetch(`/api/admin/contracts/${id}/end`, { method: 'POST' })
    const json = await res.json()
    json.success ? fetchContracts() : alert(json.error)
  }

  const filtered = search
    ? contracts.filter(c =>
        c.worker.name.includes(search) ||
        c.worker.phone.includes(search) ||
        (c.site?.name || '').includes(search)
      )
    : contracts

  const filterHeader = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold">계약 관리</h1>
          <p className="text-sm text-[#718096] mt-1">근로계약 · 용역계약 · 업무위탁 계약 전체 관리</p>
        </div>
        <Link href="/admin/contracts/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
          + 신규 계약
        </Link>
      </div>
      <div className="flex gap-3 flex-wrap bg-white border rounded-[12px] p-5">
        <input
          type="text" placeholder="근로자명 · 연락처 · 현장 검색"
          value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-56"
        />
        <select value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">계약상태 전체</option>
          <option value="DRAFT">초안</option>
          <option value="SIGNED">서명완료</option>
          <option value="ACTIVE">활성</option>
          <option value="ENDED">종료</option>
        </select>
        <select value={filterKind}
          onChange={e => { setFilterKind(e.target.value); setPage(1) }}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">계약종류 전체</option>
          <option value="EMPLOYMENT">근로계약</option>
          <option value="SERVICE">용역계약</option>
          <option value="OUTSOURCING">업무위탁</option>
        </select>
        <span className="text-sm text-[#718096] self-center ml-auto">총 {total}건</span>
      </div>
    </>
  )

  return (
    <PageShell header={filterHeader}>
      {/* 목록 */}
      {loading ? (
        <div className="text-center py-16 text-[#718096]">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#718096]">
          계약이 없습니다.{' '}
          <Link href="/admin/contracts/new" className="text-blue-600 hover:underline">
            신규 계약 등록 →
          </Link>
        </div>
      ) : (
        <div className="bg-white border rounded-[12px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(255,255,255,0.04)] text-xs text-[#CBD5E0] border-b">
              <tr>
                <th className="px-4 py-3 text-left">근로자</th>
                <th className="px-4 py-3 text-left">현장</th>
                <th className="px-4 py-3 text-left">계약종류</th>
                <th className="px-4 py-3 text-left">템플릿</th>
                <th className="px-4 py-3 text-left">기간</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3 text-center">보험</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3 text-center">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-[rgba(255,255,255,0.04)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.worker.name}</div>
                    <div className="text-xs text-[#718096]">{c.worker.jobTitle}</div>
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E0] text-xs">{c.site?.name || '—'}</td>
                  <td className="px-4 py-3">{CONTRACT_KIND_LABEL[c.contractKind || ''] || '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#CBD5E0]">
                    {TEMPLATE_LABEL[c.contractTemplateType || ''] || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{c.startDate}</div>
                    <div className="text-[#718096]">{c.endDate || '무기한'}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{amountLabel(c)}</td>
                  <td className="px-4 py-3 text-center text-xs text-[#CBD5E0]">{insuranceSummary(c)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[c.contractStatus] || ''}`}>
                      {STATUS_LABEL[c.contractStatus] || c.contractStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-center">
                      <Link href={`/admin/contracts/${c.id}`}
                        className="px-2 py-1 text-xs bg-[rgba(255,255,255,0.04)] rounded hover:bg-[rgba(255,255,255,0.08)]">
                        상세
                      </Link>
                      {(c.contractStatus === 'DRAFT' || c.contractStatus === 'SIGNED') && (
                        <button onClick={() => handleActivate(c.id)}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                          활성화
                        </button>
                      )}
                      {c.contractStatus === 'ACTIVE' && (
                        <button onClick={() => handleEnd(c.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">
                          종료
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > limit && (
        <div className="flex justify-center gap-2 text-sm">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border rounded disabled:opacity-40">이전</button>
          <span className="px-3 py-1.5 text-[#CBD5E0]">{page} / {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}
            className="px-3 py-1.5 border rounded disabled:opacity-40">다음</button>
        </div>
      )}
    </PageShell>
  )
}
