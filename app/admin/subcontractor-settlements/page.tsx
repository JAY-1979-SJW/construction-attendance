'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Site {
  id: string
  name: string
}

interface Company {
  id: string
  companyName: string
}

interface Settlement {
  id: string
  monthKey: string
  siteId: string
  companyId: string
  workerCount: number
  confirmedWorkUnits: number
  grossAmount: number
  taxAmount: number
  retirementMutualAmount: number
  finalPayableAmount: number
  site: { id: string; name: string }
  company: { id: string; companyName: string; businessNumber: string }
}

interface Totals {
  workerCount: number
  grossAmount: number
  taxAmount: number
  finalPayableAmount: number
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

export default function SubcontractorSettlementsPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey)
  const [siteFilter, setSiteFilter] = useState('')
  const [subFilter, setSubFilter] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [msg, setMsg] = useState('')

  // Load sites + subcontractors
  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => {
        if (d.success) setSites(d.data?.items?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) ?? [])
      })
    fetch('/api/admin/companies?pageSize=200')
      .then(r => r.json())
      .then(d => {
        if (d.success) setCompanies(d.data?.items ?? [])
      })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ monthKey })
      if (siteFilter) params.set('siteId', siteFilter)
      if (subFilter) params.set('companyId', subFilter)
      const res = await fetch(`/api/admin/subcontractor-settlements?${params}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      const data = await res.json()
      setSettlements(data.settlements ?? [])
      setTotals(data.totals ?? null)
    } finally {
      setLoading(false)
    }
  }, [monthKey, siteFilter, subFilter, router])

  useEffect(() => { load() }, [load])

  const handleRun = async () => {
    if (!confirm(`${monthKey} 협력사 정산을 실행하시겠습니까?`)) return
    setRunning(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/subcontractor-settlements/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthKey,
          siteId: siteFilter || undefined,
          companyId: subFilter || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`정산 완료 — ${data.count ?? 0}건`)
        load()
      } else {
        setMsg(`정산 실패: ${data.error ?? '알 수 없는 오류'}`)
      }
    } finally {
      setRunning(false) }
  }

  const handleDownload = async () => {
    setDownloading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/document-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthKey,
          documentType: 'SUBCONTRACTOR_SETTLEMENT',
          siteId: siteFilter || undefined,
          companyId: subFilter || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setMsg(`다운로드 실패: ${err.error}`)
        return
      }
      const rowCount = res.headers.get('X-Row-Count')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${monthKey}_협력사정산서.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMsg(`다운로드 완료 (${rowCount ?? '?'}행)`)
    } finally {
      setDownloading(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR')
  const fmtWon = (n: number) => fmt(n) + '원'
  const isSuccess = msg.startsWith('정산 완료') || msg.startsWith('다운로드 완료')

  return (
    <div className="p-8 overflow-auto">
        <h1 className="text-2xl font-bold mb-6">협력사 정산</h1>

        {/* 필터 + 실행 버튼 */}
        <div className="flex gap-3 mb-5 flex-wrap items-end">
          <div>
            <label className="block text-[12px] text-muted-brand mb-1 font-semibold">귀속연월</label>
            <input
              type="month"
              value={monthKey}
              onChange={e => setMonthKey(e.target.value)}
              className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card"
            />
          </div>
          <div>
            <label className="block text-[12px] text-muted-brand mb-1 font-semibold">현장</label>
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card min-w-[160px]"
            >
              <option value="">전체 현장</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-muted-brand mb-1 font-semibold">협력사</label>
            <select
              value={subFilter}
              onChange={e => setSubFilter(e.target.value)}
              className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card min-w-[160px]"
            >
              <option value="">전체 협력사</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="px-4 py-2 text-white border-none rounded-md cursor-pointer text-[14px] font-semibold"
            style={{ background: '#7b1fa2', opacity: running ? 0.6 : 1 }}
          >
            {running ? '정산 중...' : '정산 실행'}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 text-white border-none rounded-md cursor-pointer text-[14px] font-semibold"
            style={{ background: '#E06810', opacity: downloading ? 0.6 : 1 }}
          >
            {downloading ? '생성 중...' : 'CSV 다운로드'}
          </button>
        </div>

        {msg && (
          <div className={`px-4 py-3 rounded-lg mb-4 text-[14px] ${isSuccess ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#ffebee] text-[#c62828]'}`}>
            {msg}
          </div>
        )}

        {/* 요약 카드 */}
        {totals && (
          <div className="flex gap-3 mb-5 flex-wrap">
            {[
              { label: '협력사수', value: fmt(settlements.length) + '개사', color: '#5BA4D9' },
              { label: '총 인원', value: fmt(totals.workerCount) + '명', color: '#388e3c' },
              { label: '총 지급액', value: fmtWon(totals.grossAmount), color: '#e65100' },
              { label: '총 원천세', value: fmtWon(totals.taxAmount), color: '#b71c1c' },
              { label: '최종지급예정액', value: fmtWon(totals.finalPayableAmount), color: '#6a1b9a' },
            ].map(c => (
              <div key={c.label} className="bg-card rounded-[10px] px-5 py-4 min-w-[140px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                style={{ borderTop: `4px solid ${c.color}` }}>
                <div className="text-[18px] font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[12px] text-muted-brand">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 테이블 */}
        <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
          {loading ? (
            <div className="py-8 text-center text-[#999]">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['현장', '협력사', '사업자번호', '인원', '공수', '지급총액', '원천세', '퇴직공제', '최종지급예정액'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {settlements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-[#999]">
                        데이터 없음 — 정산 실행을 먼저 하세요
                      </td>
                    </tr>
                  ) : settlements.map(row => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9]">{row.site.name}</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9]">{row.company.companyName}</td>
                      <td className="px-4 py-3 text-[12px] text-muted-brand border-b border-[#f9f9f9]">{row.company.businessNumber}</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9] text-center">{fmt(row.workerCount)}명</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9] text-center">{Number(row.confirmedWorkUnits).toFixed(1)}공수</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9] text-right">{fmt(row.grossAmount)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#b71c1c] border-b border-[#f9f9f9] text-right">{fmt(row.taxAmount)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#6a1b9a] border-b border-[#f9f9f9] text-right">{fmt(row.retirementMutualAmount)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9] text-right font-bold">{fmt(row.finalPayableAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                {settlements.length > 0 && totals && (
                  <tfoot>
                    <tr className="bg-brand font-bold">
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9] font-bold" colSpan={3}>합계</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9] text-center font-bold">{fmt(totals.workerCount)}명</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9]"></td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9] text-right font-bold">{fmt(totals.grossAmount)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#b71c1c] border-b border-[#f9f9f9] text-right font-bold">{fmt(totals.taxAmount)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9]"></td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[#f9f9f9] text-right font-bold">{fmt(totals.finalPayableAmount)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                         label: '대시보드' },
  { href: '/admin/workers',                 label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
  { href: '/admin/sites',                   label: '현장 관리' },
  { href: '/admin/attendance',              label: '출퇴근 조회' },
  { href: '/admin/presence-checks',         label: '체류확인 현황' },
  { href: '/admin/presence-report',         label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',      label: '근무확정' },
  { href: '/admin/contracts',               label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility',   label: '보험판정' },
  { href: '/admin/wage-calculations',       label: '세금/노임 계산' },
  { href: '/admin/filing-exports',          label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',       label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',    label: '노무비 집계' },
  { href: '/admin/subcontractor-settlements', label: '협력사 정산' },
  { href: '/admin/document-center',         label: '서식 출력 센터' },
  { href: '/admin/month-closings',          label: '월마감' },
  { href: '/admin/corrections',             label: '정정 이력' },
  { href: '/admin/exceptions',              label: '예외 승인' },
  { href: '/admin/device-requests',         label: '기기 변경' },
]
