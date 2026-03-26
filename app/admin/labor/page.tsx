'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AllocationRow {
  attendanceLogId: string
  workDate: string
  workerName: string
  workerPhone: string
  company: string
  jobTitle: string
  checkInSiteName: string
  lastSiteName: string
  allocatedSiteName: string
  hasMove: boolean
  checkInAt: string | null
  checkOutAt: string | null
  totalWorkedMinutes: number | null
  status: string
  isAutoCheckout: boolean
  isAdjusted: boolean
  includeInLabor: boolean
  needsReview: boolean
  adminNote: string | null
}

interface SummaryRow {
  workerName: string
  company: string
  jobTitle: string
  allocatedSiteName: string
  totalDays: number
  totalMinutes: number
  adjustedDays: number
  autoCheckoutDays: number
  needsReviewDays: number
}

interface Meta {
  totalRows: number
  includedCount: number
  needsReviewCount: number
  autoCount: number
}

interface Site {
  id: string
  name: string
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: '완료', ADJUSTED: '보정', MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외', ADMIN_MANUAL: '수동',
}
const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#1565c0', ADJUSTED: '#6a1b9a', MISSING_CHECKOUT: '#b71c1c', EXCEPTION: '#e65100',
}
const STATUS_BG: Record<string, string> = {
  COMPLETED: '#e3f2fd', ADJUSTED: '#f3e5f5', MISSING_CHECKOUT: '#ffebee', EXCEPTION: '#fff3e0',
}

function formatMinutes(m: number | null): string {
  if (!m || m <= 0) return '-'
  const h = Math.floor(m / 60), min = m % 60
  return h > 0 ? (min > 0 ? `${h}h ${min}m` : `${h}h`) : `${min}m`
}

export default function LaborPage() {
  const router = useRouter()
  const today  = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo,   setDateTo]   = useState(today)
  const [siteId,   setSiteId]   = useState('')
  const [tab,      setTab]      = useState<'detail' | 'summary'>('detail')

  const [sites,   setSites]   = useState<Site[]>([])
  const [rows,    setRows]    = useState<AllocationRow[]>([])
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [meta,    setMeta]    = useState<Meta | null>(null)
  const [loading, setLoading] = useState(false)

  // 현장 목록 로드
  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then((r) => r.json())
      .then((d) => { if (d.success) setSites(d.data.items ?? d.data) })
  }, [])

  const load = () => {
    setLoading(true)
    const p = new URLSearchParams({ dateFrom, dateTo })
    if (siteId) p.set('siteId', siteId)
    fetch(`/api/admin/labor/allocations?${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setRows(d.data.rows)
        setSummary(d.data.summary)
        setMeta(d.data.meta)
        setLoading(false)
      })
  }

  useEffect(load, [router])

  const handleExport = () => {
    const p = new URLSearchParams({ dateFrom, dateTo })
    if (siteId) p.set('siteId', siteId)
    window.location.href = `/api/export/labor?${p}`
  }

  const goToAttendance = (row: AllocationRow) => {
    const p = new URLSearchParams({ date: row.workDate, name: row.workerName })
    router.push(`/admin/attendance?${p}`)
  }

  return (
    <div className="bg-[#F5F7FA]">
      <div className="sticky top-0 z-10 bg-[#F5F7FA] px-8 pt-8 pb-3">
        <h1 className="text-[18px] font-bold text-[#0F172A]">노무관리</h1>
      </div>
      <div className="px-8 pb-8">

      {/* 노무 관제 허브 */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {[
          { label: '노임 관리', href: '/admin/wage', desc: '공수·단가·노임' },
          { label: '문서 센터', href: '/admin/document-center', desc: '서식 다운로드' },
          { label: '급여 계산', href: '/admin/wage-calculations', desc: '세금 계산' },
          { label: '보험 자격', href: '/admin/insurance-eligibility', desc: '4대보험 대상' },
          { label: '노임 집계', href: '/admin/labor-cost-summaries', desc: '월별 집계' },
          { label: '월 마감', href: '/admin/month-closings', desc: '마감 처리' },
          { label: '출퇴근 처리', href: '/admin/attendance', desc: '보정/예외' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-card rounded-[10px] px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.35)] no-underline hover:shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition-shadow"
          >
            <div className="text-[13px] font-bold text-secondary-brand">{item.label}</div>
            <div className="text-[11px] text-muted-brand mt-0.5">{item.desc}</div>
          </Link>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex gap-3 items-end mb-5 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-brand">시작일</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border border-secondary-brand/30 rounded-md text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-brand">종료일</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border border-secondary-brand/30 rounded-md text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-brand">현장 (인정현장 기준)</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="px-3 py-2 border border-secondary-brand/30 rounded-md text-sm">
            <option value="">전체 현장</option>
            {sites.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
        </div>
        <button onClick={load} className="px-5 py-2 bg-accent text-white border-none rounded-md cursor-pointer text-sm">조회</button>
        <button onClick={handleExport} className="px-5 py-2 bg-[#2e7d32] text-white border-none rounded-md cursor-pointer text-sm">엑셀 다운로드</button>
      </div>

      {/* 집계 요약 카드 */}
      {meta && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: '전체 기록', value: meta.totalRows, color: '#37474f' },
            { label: '노임 집계 포함', value: meta.includedCount, color: '#4A93C8' },
            { label: '검토 필요(미퇴근)', value: meta.needsReviewCount, color: '#b71c1c' },
            { label: '자동처리 포함', value: meta.autoCount, color: '#6a1b9a' },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-[10px] px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.35)] min-w-[140px]" style={{ borderTop: `3px solid ${item.color}` }}>
              <div className="text-[28px] font-bold mb-1" style={{ color: item.color }}>{item.value}</div>
              <div className="text-xs text-muted-brand">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-0 mb-4 border-b-2 border-[#e0e0e0]">
        {(['detail', 'summary'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2.5 bg-transparent border-none text-sm cursor-pointer font-medium -mb-0.5 border-b-2 ${tab === t ? 'text-secondary-brand font-bold border-[#1976d2]' : 'text-muted-brand border-transparent'}`}
          >
            {t === 'detail' ? '투입현황 (상세)' : '노임집계 (합계)'}
          </button>
        ))}
      </div>

      {loading ? <p className="text-muted-brand py-6">집계 중...</p> : (
        <>
          {/* ── 탭1: 투입현황 상세 ──────────────────────────── */}
          {tab === 'detail' && (
            <div className="bg-card rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)] mb-5 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['날짜', '근로자명', '소속', '직종', '출근현장', '인정현장', '이동', '출근', '퇴근', '인정시간', '상태', '보정', '자동', '집계'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs text-muted-brand border-b-2 border-secondary-brand/20 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={14} className="text-center py-8 text-[#999]">데이터가 없습니다.</td></tr>
                  ) : rows.map((row) => (
                    <tr
                      key={row.attendanceLogId}
                      onClick={() => goToAttendance(row)}
                      className="cursor-pointer hover:bg-[#f0f4ff]"
                      style={{
                        background: row.needsReview ? '#fff8f8' : row.isAdjusted ? '#faf5ff' : undefined,
                      }}
                    >
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{row.workDate}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">
                        <span className="font-semibold text-secondary-brand underline">{row.workerName}</span>
                        {row.needsReview && (
                          <span className="ml-1.5 text-[10px] bg-[#ffebee] text-[#b71c1c] px-1.5 py-px rounded font-bold">처리필요</span>
                        )}
                      </td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{row.company}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{row.jobTitle}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{row.checkInSiteName}</td>
                      <td className={`px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap ${row.hasMove ? 'font-semibold' : ''}`}>
                        {row.allocatedSiteName}
                        {row.hasMove && <span className="text-[10px] text-[#e65100] ml-1">이동</span>}
                      </td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">{row.hasMove ? '✓' : ''}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{row.checkInAt ?? '-'}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{row.checkOutAt ?? <span className="text-[#b71c1c]">미기록</span>}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap font-semibold">{formatMinutes(row.totalWorkedMinutes)}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-[10px] font-semibold"
                          style={{
                            color: STATUS_COLOR[row.status] ?? '#555',
                            background: STATUS_BG[row.status] ?? '#f5f5f5',
                          }}
                        >
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                      </td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">
                        {row.isAdjusted && <span className="text-[#6a1b9a] text-[11px]">보정</span>}
                      </td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">
                        {row.isAutoCheckout && <span className="text-[#b71c1c] text-[11px]">AUTO</span>}
                      </td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">
                        {row.includeInLabor
                          ? <span className="text-[#2e7d32] text-[11px]">포함</span>
                          : row.needsReview
                            ? <span className="text-[#b71c1c] text-[11px]">검토</span>
                            : <span className="text-[#bbb] text-[11px]">제외</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 탭2: 노임집계 합계 ──────────────────────────── */}
          {tab === 'summary' && (
            <div className="bg-card rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)] mb-5 overflow-x-auto">
              <div className="text-xs text-muted-brand mb-3">
                * COMPLETED + ADJUSTED 기준 합산. MISSING_CHECKOUT은 검토필요 건수만 표시됩니다.
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['인정현장', '근로자명', '소속', '직종', '투입일수', '인정시간', '보정', '자동처리', '검토필요', '비고'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs text-muted-brand border-b-2 border-secondary-brand/20 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-[#999]">데이터가 없습니다.</td></tr>
                  ) : summary.map((row, i) => (
                    <tr key={i} style={{ background: row.needsReviewDays > 0 ? '#fff8f8' : 'white' }}>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap font-semibold">{row.allocatedSiteName}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap font-semibold">{row.workerName}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{row.company}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">{row.jobTitle}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center font-bold text-[#4A93C8]">{row.totalDays}일</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center font-bold">{formatMinutes(row.totalMinutes)}</td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">
                        {row.adjustedDays > 0 && <span className="text-[#6a1b9a] text-xs">{row.adjustedDays}건</span>}
                      </td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">
                        {row.autoCheckoutDays > 0 && <span className="text-[#b71c1c] text-xs">{row.autoCheckoutDays}건</span>}
                      </td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap text-center">
                        {row.needsReviewDays > 0 && <span className="text-[#b71c1c] font-bold text-xs">{row.needsReviewDays}건 ⚠</span>}
                      </td>
                      <td className="px-3 py-[9px] text-[13px] border-b border-[#f5f5f5] whitespace-nowrap">
                        {row.adjustedDays > 0 && '보정있음 '}
                        {row.needsReviewDays > 0 && '검토필요'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 집계 기준 안내 */}
      <div className="bg-card rounded-[10px] px-6 py-5 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
        <div className="text-xs text-muted-brand font-semibold mb-2.5 uppercase">집계 기준</div>
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className="text-[11px] px-2 py-0.5 rounded-[10px] font-semibold text-[#4A93C8] bg-secondary-brand/10">완료</span>
          <span className="text-[13px] text-muted-brand">정상 집계 포함 (COMPLETED)</span>
        </div>
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className="text-[11px] px-2 py-0.5 rounded-[10px] font-semibold text-[#6a1b9a] bg-[#f3e5f5]">보정</span>
          <span className="text-[13px] text-muted-brand">관리자 보정 후 집계 포함 (ADJUSTED)</span>
        </div>
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className="text-[11px] px-2 py-0.5 rounded-[10px] font-semibold text-[#b71c1c] bg-[#ffebee]">미퇴근</span>
          <span className="text-[13px] text-muted-brand">집계 제외 — 검토 필요 (MISSING_CHECKOUT)</span>
        </div>
        <div className="flex items-center gap-2.5 mt-2 text-xs text-muted-brand">
          인정 현장 기준: 이동 이력이 있으면 마지막 현장 기준 / 없으면 출근 현장 기준
        </div>
      </div>
      </div>
    </div>
  )
}
