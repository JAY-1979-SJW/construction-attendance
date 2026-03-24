'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CorrectionRecord {
  id: string
  createdAt: string
  domainType: string
  targetId: string
  action: string
  reason: string | null
  operatorId: string | null
  operatorName: string | null
  beforeJson: Record<string, unknown> | null
  afterJson: Record<string, unknown> | null
}

const DOMAIN_TYPES = [
  { value: '', label: '전체 도메인' },
  { value: 'ATTENDANCE',         label: '출퇴근' },
  { value: 'WORK_CONFIRMATION',  label: '근무확정' },
  { value: 'INSURANCE',          label: '보험판정' },
  { value: 'WAGE',               label: '세금/노임' },
  { value: 'FILING_EXPORT',      label: '신고자료' },
  { value: 'RETIREMENT_MUTUAL',  label: '퇴직공제' },
  { value: 'CONTRACT',           label: '계약' },
  { value: 'WORKER',             label: '근로자' },
]

function getDefaultDateRange() {
  const now = new Date(Date.now() + 9 * 3600000)
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  return { from, to }
}

export default function CorrectionsPage() {
  const router = useRouter()
  const { from: defaultFrom, to: defaultTo } = getDefaultDateRange()

  const [domainFilter, setDomainFilter] = useState('')
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [items, setItems] = useState<CorrectionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (domainFilter) params.set('domainType', domainFilter)
      const res = await fetch(`/api/admin/corrections?${params}`)
      const data = await res.json()
      if (!data.success) { router.push('/admin/login'); return }
      setItems(data.data?.items ?? [])
      setTotal(data.data?.total ?? 0)
    } finally { setLoading(false) }
  }, [domainFilter, dateFrom, dateTo, page, router])

  useEffect(() => { load() }, [load])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  const domainLabel = (type: string) =>
    DOMAIN_TYPES.find((d) => d.value === type)?.label ?? type

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex min-h-screen bg-brand">
      <nav className="w-[220px] bg-brand-dark py-6 flex-shrink-0 flex flex-col">
        <div className="text-white text-base font-bold px-5 pb-6 border-b border-white/10">해한 출퇴근</div>
        <div className="text-white/40 text-[11px] px-5 pt-4 pb-2 uppercase tracking-widest">관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}
            className={`block px-5 py-2.5 text-[13px] no-underline transition-colors ${item.href === '/admin/corrections' ? 'bg-white/10 text-white font-bold' : 'text-white/80 hover:text-white'}`}>
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))}
          className="mx-5 mt-6 py-2.5 bg-white/10 border-none rounded-md text-white/60 cursor-pointer text-[13px]"
        >로그아웃</button>
      </nav>

      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-bold m-0 mb-2">정정 이력</h1>
        <p className="text-[13px] text-muted-brand mb-5">
          데이터 수정/정정 이력을 조회합니다
        </p>

        {/* 필터 영역 */}
        <div className="bg-card rounded-xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs text-muted-brand mb-1 font-semibold">도메인</label>
              <select value={domainFilter} onChange={(e) => { setDomainFilter(e.target.value); setPage(1) }}
                className="input-base">
                {DOMAIN_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-brand mb-1 font-semibold">시작일</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="input-base" />
            </div>
            <div>
              <label className="block text-xs text-muted-brand mb-1 font-semibold">종료일</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="input-base" />
            </div>
            <button onClick={() => { setPage(1); load() }} className="btn-primary">조회</button>
          </div>
        </div>

        {/* 결과 테이블 */}
        <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(91,164,217,0.15)] flex justify-between items-center">
            <span className="font-bold text-sm">정정 이력 목록</span>
            <span className="text-xs text-muted-brand">전체 {total.toLocaleString('ko-KR')}건</span>
          </div>
          {loading ? (
            <div className="py-8 text-center text-[#999]">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[rgba(91,164,217,0.15)]">
                    {['일시', '도메인', '대상 ID', '액션', '사유', '처리자', '변경 전/후'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-brand uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-6 text-[#999]">이력 없음</td></tr>
                  ) : items.map((item) => (
                    <>
                      <tr key={item.id} className="border-b border-[rgba(91,164,217,0.08)] hover:bg-[rgba(91,164,217,0.04)] transition-colors">
                        <td className="px-4 py-3 text-sm text-[#CBD5E0]">{fmtDate(item.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-[#CBD5E0]">
                          <span className="text-xs font-semibold text-[#4A93C8] bg-[rgba(91,164,217,0.1)] px-2 py-0.5 rounded">
                            {domainLabel(item.domainType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-brand font-mono max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.targetId}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#CBD5E0]">
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: item.action === 'DELETE' ? '#c62828' : item.action === 'CREATE' ? '#2e7d32' : '#e65100',
                          }}>
                            {item.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-brand max-w-[200px]">{item.reason ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-[#CBD5E0]">{item.operatorName ?? item.operatorId ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-[#CBD5E0]">
                          {(item.beforeJson || item.afterJson) && (
                            <button
                              onClick={() => toggleExpand(item.id)}
                              className="px-2.5 py-0.5 text-xs text-white border-none rounded cursor-pointer font-semibold"
                              style={{ background: expandedId === item.id ? '#455a64' : '#607d8b' }}
                            >
                              {expandedId === item.id ? '접기' : '보기'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === item.id && (
                        <tr key={`${item.id}-expand`}>
                          <td colSpan={7} className="p-0 bg-brand border-b border-[rgba(91,164,217,0.08)]">
                            <div className="grid grid-cols-2">
                              <div className="p-4 border-r border-[rgba(91,164,217,0.15)]">
                                <div className="text-[11px] font-bold text-[#c62828] mb-2 uppercase">
                                  변경 전 (Before)
                                </div>
                                <pre className="text-[11px] text-[#CBD5E0] m-0 whitespace-pre-wrap break-all">
                                  {item.beforeJson ? JSON.stringify(item.beforeJson, null, 2) : '(없음)'}
                                </pre>
                              </div>
                              <div className="p-4">
                                <div className="text-[11px] font-bold text-[#2e7d32] mb-2 uppercase">
                                  변경 후 (After)
                                </div>
                                <pre className="text-[11px] text-[#CBD5E0] m-0 whitespace-pre-wrap break-all">
                                  {item.afterJson ? JSON.stringify(item.afterJson, null, 2) : '(없음)'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-[rgba(91,164,217,0.15)] flex gap-2 justify-center items-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3.5 py-1.5 border border-[rgba(91,164,217,0.2)] rounded-md bg-card cursor-pointer text-[13px] disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-[13px] text-muted-brand">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3.5 py-1.5 border border-[rgba(91,164,217,0.2)] rounded-md bg-card cursor-pointer text-[13px] disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                       label: '대시보드' },
  { href: '/admin/workers',               label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
  { href: '/admin/sites',                 label: '현장 관리' },
  { href: '/admin/attendance',            label: '출퇴근 조회' },
  { href: '/admin/presence-checks',       label: '체류확인 현황' },
  { href: '/admin/presence-report',       label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',    label: '근무확정' },
  { href: '/admin/contracts',             label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility', label: '보험판정' },
  { href: '/admin/wage-calculations',     label: '세금/노임 계산' },
  { href: '/admin/filing-exports',        label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',     label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',  label: '노무비 집계' },
  { href: '/admin/month-closings',        label: '월마감' },
  { href: '/admin/corrections',           label: '정정 이력' },
  { href: '/admin/exceptions',            label: '예외 승인' },
  { href: '/admin/device-requests',       label: '기기 변경' },
]
