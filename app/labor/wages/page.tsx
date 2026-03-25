'use client'

import { useEffect, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WageRow {
  workerId: string
  workerName: string
  employmentType: string
  siteId: string
  siteName: string
  monthKey: string
  // 출근일수
  attendanceDays: number
  // 작업일보 작성일수 (SiteWorkLog SUBMITTED 기준)
  workLogDays: number
  // 공수 합계 (확정된 confirmedWorkUnits 합)
  totalManday: number
  // 일당/단가 (원)
  dailyRate: number
  // 월 노임 (확정 총액)
  monthlyWage: number
  // 지급 상태
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID'
  // 확정 상태
  confirmationStatus: 'DRAFT' | 'CONFIRMED' | 'LOCKED'
  // 4대보험 대상 여부
  insuranceEligible: boolean
  // 비고
  notes: string | null
}

type GroupMode = 'worker' | 'site'
type SortKey = keyof Pick<WageRow, 'workerName' | 'siteName' | 'monthlyWage' | 'totalManday' | 'attendanceDays'>

const EMP_TYPE_LABEL: Record<string, string> = {
  REGULAR:             '상용직',
  DAILY_CONSTRUCTION:  '일용직',
  BUSINESS_33:         '3.3%용역',
  FIXED_TERM:          '기간제',
  CONTINUOUS_SITE:     '상주인력',
  OTHER:               '기타',
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_LABEL: Record<WageRow['paymentStatus'], string> = {
  UNPAID: '미지급',
  PARTIAL: '일부지급',
  PAID: '지급완료',
}

const PAYMENT_STYLE: Record<WageRow['paymentStatus'], { bg: string; color: string }> = {
  UNPAID:  { bg: '#FEF2F2', color: '#DC2626' },
  PARTIAL: { bg: '#FFFBEB', color: '#D97706' },
  PAID:    { bg: '#F0FDF4', color: '#16A34A' },
}

const CONFIRM_LABEL: Record<WageRow['confirmationStatus'], string> = {
  DRAFT:     '미확정',
  CONFIRMED: '확정',
  LOCKED:    '잠금',
}

const CONFIRM_STYLE: Record<WageRow['confirmationStatus'], { bg: string; color: string }> = {
  DRAFT:     { bg: '#F3F4F6', color: '#6B7280' },
  CONFIRMED: { bg: '#EFF6FF', color: '#2563EB' },
  LOCKED:    { bg: '#F5F3FF', color: '#7C3AED' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtWon(n: number) {
  return n.toLocaleString() + '원'
}

function Badge({
  label,
  bg,
  color,
}: {
  label: string
  bg: string
  color: string
}) {
  return (
    <span
      className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WagesPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [groupMode, setGroupMode] = useState<GroupMode>('worker')
  const [sortKey, setSortKey] = useState<SortKey>('workerName')
  const [sortAsc, setSortAsc] = useState(true)
  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState<WageRow['paymentStatus'] | ''>('')
  const [confirmFilter, setConfirmFilter] = useState<WageRow['confirmationStatus'] | ''>('')
  const [rows, setRows] = useState<WageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/labor/wages?month=${month}&group=${groupMode}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setRows(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month, groupMode])

  // 필터 + 정렬
  const filtered = rows
    .filter((r) => {
      const q = search.trim().toLowerCase()
      if (q && !r.workerName.toLowerCase().includes(q) && !r.siteName.toLowerCase().includes(q)) return false
      if (payFilter && r.paymentStatus !== payFilter) return false
      if (confirmFilter && r.confirmationStatus !== confirmFilter) return false
      return true
    })
    .sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortAsc ? cmp : -cmp
    })

  // 합계
  const totalWage = filtered.reduce((s, r) => s + r.monthlyWage, 0)
  const totalManday = filtered.reduce((s, r) => s + r.totalManday, 0)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  function SortTh({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k
    return (
      <th
        className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] cursor-pointer select-none whitespace-nowrap"
        onClick={() => handleSort(k)}
      >
        {label}
        {active && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
      </th>
    )
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A]">노임 관리</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">근로자별·현장별 월 노임 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-[13px] border border-[#E5E7EB] rounded-[8px] px-3 py-1.5 focus:outline-none focus:border-[#F97316]"
          />
        </div>
      </div>

      {/* 필터바 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* 그룹 탭 */}
        <div
          className="flex rounded-[8px] overflow-hidden shrink-0"
          style={{ border: '1px solid #E5E7EB' }}
        >
          {(['worker', 'site'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupMode(g)}
              className="px-3 py-1.5 text-[12px] transition-colors"
              style={{
                background: groupMode === g ? '#F97316' : '#FFFFFF',
                color: groupMode === g ? '#FFFFFF' : '#6B7280',
              }}
            >
              {g === 'worker' ? '근로자별' : '현장별'}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="근로자 / 현장 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-[12px] border border-[#E5E7EB] rounded-[8px] px-3 py-1.5 w-[180px] focus:outline-none focus:border-[#F97316]"
        />

        <select
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value as WageRow['paymentStatus'] | '')}
          className="text-[12px] border border-[#E5E7EB] rounded-[8px] px-2 py-1.5 focus:outline-none focus:border-[#F97316] text-[#374151]"
        >
          <option value="">지급 전체</option>
          <option value="UNPAID">미지급</option>
          <option value="PARTIAL">일부지급</option>
          <option value="PAID">지급완료</option>
        </select>

        <select
          value={confirmFilter}
          onChange={(e) => setConfirmFilter(e.target.value as WageRow['confirmationStatus'] | '')}
          className="text-[12px] border border-[#E5E7EB] rounded-[8px] px-2 py-1.5 focus:outline-none focus:border-[#F97316] text-[#374151]"
        >
          <option value="">확정 전체</option>
          <option value="DRAFT">미확정</option>
          <option value="CONFIRMED">확정</option>
          <option value="LOCKED">잠금</option>
        </select>

        <div className="ml-auto text-[12px] text-[#9CA3AF]">
          {filtered.length}건 · 합계 <span className="font-semibold text-[#F97316]">{totalWage.toLocaleString()}원</span>
          {' '}/ 공수 <span className="font-semibold text-[#374151]">{totalManday.toFixed(2)}</span>
        </div>
      </div>

      {/* 테이블 */}
      <div
        className="rounded-[10px] overflow-hidden"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[12px]">
            <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <tr>
                <SortTh label="근로자명" k="workerName" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap">소속/근로형태</th>
                <SortTh label="현장명" k="siteName" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap">기간</th>
                <SortTh label="출근일수" k="attendanceDays" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap">작업일보</th>
                <SortTh label="총 공수" k="totalManday" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap">노임 단가</th>
                <SortTh label="지급예정액" k="monthlyWage" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap">지급 상태</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap">확정 상태</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap">4대보험</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] whitespace-nowrap">비고</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {Array.from({ length: 13 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-3.5 bg-[#F3F4F6] rounded animate-pulse" style={{ width: j === 0 ? 72 : j === 1 ? 60 : j === 2 ? 100 : 48 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-[13px] text-[#9CA3AF]">
                    해당 조건의 노임 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const pStyle = PAYMENT_STYLE[row.paymentStatus]
                  const cStyle = CONFIRM_STYLE[row.confirmationStatus]
                  return (
                    <tr
                      key={`${row.workerId}-${row.siteId}-${row.monthKey}-${idx}`}
                      style={{ borderBottom: '1px solid #F3F4F6' }}
                      className="hover:bg-[#FAFAFA] transition-colors"
                    >
                      <td className="px-3 py-2.5 font-medium text-[#0F172A]">{row.workerName}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">
                        {EMP_TYPE_LABEL[row.employmentType] ?? row.employmentType}
                      </td>
                      <td className="px-3 py-2.5 text-[#374151]">{row.siteName}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{row.monthKey}</td>
                      <td className="px-3 py-2.5 text-center text-[#374151]">{row.attendanceDays}일</td>
                      <td className="px-3 py-2.5 text-center text-[#374151]">{row.workLogDays}일</td>
                      <td className="px-3 py-2.5 text-center font-medium text-[#374151]">{row.totalManday.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-[#374151]">{row.dailyRate > 0 ? fmtWon(row.dailyRate) : '-'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#0F172A]">{fmtWon(row.monthlyWage)}</td>
                      <td className="px-3 py-2.5">
                        <Badge label={PAYMENT_LABEL[row.paymentStatus]} bg={pStyle.bg} color={pStyle.color} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge label={CONFIRM_LABEL[row.confirmationStatus]} bg={cStyle.bg} color={cStyle.color} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.insuranceEligible ? (
                          <span className="text-[#16A34A] font-medium">대상</span>
                        ) : (
                          <span className="text-[#9CA3AF]">해당없음</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[#9CA3AF] max-w-[120px] truncate">
                        {row.notes ?? '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
