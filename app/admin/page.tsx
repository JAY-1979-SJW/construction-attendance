'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── 오늘 현황 타입 ────────────────────────────────────────────────────────────
interface DashboardSummary {
  totalWorkers: number
  activeSites: number
  todayTotal: number
  todayCheckedIn: number
  todayCompleted: number
  pendingMissing: number
  pendingExceptions: number
  pendingDeviceRequests: number
  todayPresenceTotal: number
  todayPresencePending: number
  todayPresenceReview: number
  todayPresenceNoResponse: number
}
interface RecentRecord {
  id: string
  workerName: string
  company: string
  siteName: string
  checkInAt: string | null
  checkOutAt: string | null
  status: string
}

// ─── 월간 운영 타입 ────────────────────────────────────────────────────────────
interface KpiData {
  todayActiveWorkers: number
  monthWorkerCount: number
  pendingOnboardingCount: number
  retirementPendingCount: number
  exceptionWorkerCount: number
  insuranceExceptionCount: number
  taxExceptionCount: number
  unconfirmedSettlementCount: number
  thisMonthDownloadCount: number
}
interface MonthClosingStatus { status: string; closedAt: string | null; reopenReason: string | null }
interface RecentDownload { id: string; exportType: string; monthKey: string; createdAt: string; createdBy: string | null; versionNo: number }
interface SettlementSummary { total: number; confirmed: number; reviewRequired: number; draft: number; hold: number }
interface OnboardingIssue { workerId: string; workerName: string; issueCount: number; topIssue: string }
interface OpsData {
  monthKey: string
  kpi: KpiData
  monthClosingStatus: MonthClosingStatus | null
  recentDownloads: RecentDownload[]
  settlementSummary: SettlementSummary
  onboardingIssues: OnboardingIssue[]
}

// ─── 상수 ──────────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = { WORKING: '근무중', COMPLETED: '퇴근', MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외' }
const STATUS_COLOR: Record<string, string> = { WORKING: '#4caf50', COMPLETED: '#5BA4D9', MISSING_CHECKOUT: '#ef5350', EXCEPTION: '#ff9800' }

const CLOSING_COLOR: Record<string, { bg: string; color: string }> = {
  OPEN:     { bg: 'rgba(91,164,217,0.12)', color: '#A0AEC0' },
  CLOSING:  { bg: 'rgba(249,168,37,0.15)', color: '#f9a825' },
  CLOSED:   { bg: 'rgba(46,125,50,0.15)',  color: '#4caf50' },
  REOPENED: { bg: 'rgba(230,81,0,0.15)',   color: '#e65100' },
}
const CLOSING_LABEL: Record<string, string> = { OPEN: '미마감', CLOSING: '마감 중', CLOSED: '마감 완료', REOPENED: '재오픈' }
const EXPORT_LABEL: Record<string, string> = {
  LABOR_COST_SUMMARY: '노무비 집계', INSURANCE_ACQUISITION: '보험취득신고',
  INSURANCE_LOSS: '보험상실신고', WITHHOLDING_TAX: '원천세',
  RETIREMENT_MUTUAL_REPORT: '퇴직공제 신고', SUBCONTRACTOR_SETTLEMENT: '협력사 정산서',
}

function getMonthKey() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7)
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<'today' | 'monthly'>('today')

  // 오늘 현황
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recent, setRecent] = useState<RecentRecord[]>([])
  const [todayLoading, setTodayLoading] = useState(true)

  // 월간 운영
  const [monthKey, setMonthKey] = useState(getMonthKey)
  const [opsData, setOpsData] = useState<OpsData | null>(null)
  const [opsLoading, setOpsLoading] = useState(false)
  const [opsError, setOpsError] = useState('')

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  // 오늘 현황 로드
  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setSummary(data.data.summary)
        setRecent(data.data.recentAttendance)
        setTodayLoading(false)
      })
  }, [router])

  // 월간 운영 로드
  const fetchOps = useCallback(async () => {
    setOpsLoading(true); setOpsError('')
    try {
      const res = await fetch(`/api/admin/operations-dashboard?monthKey=${monthKey}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      const json = await res.json()
      if (json.error) { setOpsError(json.error); return }
      setOpsData(json)
    } catch { setOpsError('데이터 조회 실패') }
    finally { setOpsLoading(false) }
  }, [monthKey, router])

  useEffect(() => { if (tab === 'monthly') fetchOps() }, [tab, fetchOps])

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div className="p-6 md:p-8">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold m-0 mb-1">대시보드</h1>
          <p className="text-sm text-muted-brand m-0">{today}</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b border-[rgba(91,164,217,0.12)] pb-0">
        {([['today', '🕐 오늘 현황'], ['monthly', '📅 월간 운영']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
              tab === key
                ? 'border-[#F47920] text-[#F47920] font-semibold'
                : 'border-transparent text-muted-brand hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 오늘 현황 ──────────────────────────────────────────────────── */}
      {tab === 'today' && (
        todayLoading ? (
          <div className="text-muted-brand text-sm py-10 text-center">로딩 중...</div>
        ) : (
          <>
            {/* 체류확인 알림 */}
            {summary && (summary.todayPresenceReview > 0 || summary.todayPresenceNoResponse > 0) && (
              <div className="flex gap-3 mb-5 flex-wrap">
                {summary.todayPresenceReview > 0 && (
                  <a href="/admin/presence-checks?status=REVIEW_REQUIRED"
                    className="flex flex-col items-center justify-center no-underline min-w-[140px] rounded-[10px] p-4 bg-[rgba(245,127,23,0.12)] border border-[rgba(245,127,23,0.3)]">
                    <div className="text-[22px] font-bold text-[#f9a825]">{summary.todayPresenceReview}</div>
                    <div className="text-xs text-[#f9a825] mt-1">체류확인 검토필요</div>
                  </a>
                )}
                {summary.todayPresenceNoResponse > 0 && (
                  <a href="/admin/presence-checks?status=NO_RESPONSE"
                    className="flex flex-col items-center justify-center no-underline min-w-[140px] rounded-[10px] p-4 bg-[rgba(239,83,80,0.12)] border border-[rgba(239,83,80,0.3)]">
                    <div className="text-[22px] font-bold text-[#ef5350]">{summary.todayPresenceNoResponse}</div>
                    <div className="text-xs text-[#ef5350] mt-1">체류확인 미응답</div>
                  </a>
                )}
                {summary.todayPresenceTotal > 0 && (
                  <a href="/admin/presence-checks"
                    className="flex flex-col items-center justify-center no-underline min-w-[140px] rounded-[10px] p-4 bg-[rgba(91,164,217,0.08)] border border-[rgba(91,164,217,0.2)]">
                    <div className="text-[22px] font-bold text-[#5BA4D9]">{summary.todayPresenceTotal}</div>
                    <div className="text-xs text-[#5BA4D9] mt-1">오늘 체류확인 전체</div>
                  </a>
                )}
              </div>
            )}

            {/* KPI 카드 */}
            <div className="grid gap-3 mb-6 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              {[
                { label: '오늘 출근',       value: summary?.todayTotal ?? 0,           color: '#5BA4D9' },
                { label: '근무 중',         value: summary?.todayCheckedIn ?? 0,        color: '#4caf50' },
                { label: '퇴근 완료',       value: summary?.todayCompleted ?? 0,        color: '#A0AEC0' },
                { label: '미퇴근 누적',     value: summary?.pendingMissing ?? 0,        color: '#ef5350' },
                { label: '예외 대기',       value: summary?.pendingExceptions ?? 0,     color: '#ff9800' },
                { label: '기기 변경 대기',  value: summary?.pendingDeviceRequests ?? 0, color: '#ab47bc' },
                { label: '등록 근로자',     value: summary?.totalWorkers ?? 0,          color: '#718096' },
              ].map(c => (
                <div key={c.label} className="bg-card rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                  style={{ borderTop: `3px solid ${c.color}` }}>
                  <div className="text-[28px] font-bold mb-1" style={{ color: c.color }}>{c.value}</div>
                  <div className="text-[12px] text-muted-brand">{c.label}</div>
                </div>
              ))}
            </div>

            {/* 오늘 출근 현황 테이블 */}
            <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[rgba(91,164,217,0.1)] font-semibold text-[14px]">오늘 출근 현황</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['이름', '회사', '현장', '출근', '퇴근', '상태'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] text-muted-brand border-b border-[rgba(91,164,217,0.1)] whitespace-nowrap font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-brand text-[13px]">오늘 출근 기록이 없습니다.</td></tr>
                    ) : recent.map(r => (
                      <tr key={r.id} className="hover:bg-[rgba(91,164,217,0.04)] transition-colors">
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.06)]">{r.workerName}</td>
                        <td className="px-4 py-3 text-[13px] text-muted-brand border-b border-[rgba(91,164,217,0.06)]">{r.company}</td>
                        <td className="px-4 py-3 text-[13px] text-muted-brand border-b border-[rgba(91,164,217,0.06)]">{r.siteName}</td>
                        <td className="px-4 py-3 text-[13px] text-muted-brand border-b border-[rgba(91,164,217,0.06)]">{fmtTime(r.checkInAt)}</td>
                        <td className="px-4 py-3 text-[13px] text-muted-brand border-b border-[rgba(91,164,217,0.06)]">{fmtTime(r.checkOutAt)}</td>
                        <td className="px-4 py-3 border-b border-[rgba(91,164,217,0.06)]">
                          <span className="text-[12px] font-semibold" style={{ color: STATUS_COLOR[r.status] ?? '#A0AEC0' }}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* ── 탭 2: 월간 운영 ──────────────────────────────────────────────────── */}
      {tab === 'monthly' && (
        <>
          {/* 월 선택 */}
          <div className="flex items-center gap-3 mb-6">
            <input
              type="month"
              value={monthKey}
              onChange={e => setMonthKey(e.target.value)}
              className="px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-lg text-sm bg-card text-white"
            />
            <button
              onClick={fetchOps}
              disabled={opsLoading}
              className="px-4 py-2 bg-accent text-white border-0 rounded-lg cursor-pointer text-sm font-semibold disabled:opacity-50"
            >
              {opsLoading ? '조회 중...' : '새로고침'}
            </button>
          </div>

          {opsError && (
            <div className="px-4 py-3 rounded-lg text-sm bg-[rgba(239,83,80,0.12)] text-[#ef5350] border border-[rgba(239,83,80,0.2)] mb-5">{opsError}</div>
          )}

          {opsLoading && !opsData ? (
            <div className="text-muted-brand text-sm py-10 text-center">로딩 중...</div>
          ) : opsData ? (
            <>
              {/* KPI + 월마감 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: '오늘 출근',       value: opsData.kpi.todayActiveWorkers,        color: '#5BA4D9',  alert: false },
                  { label: '이번 달 근로자',  value: opsData.kpi.monthWorkerCount,           color: '#4caf50',  alert: false },
                  { label: '온보딩 미완료',   value: opsData.kpi.pendingOnboardingCount,     color: opsData.kpi.pendingOnboardingCount > 0 ? '#ff9800' : '#718096', alert: opsData.kpi.pendingOnboardingCount > 0 },
                  { label: '미확정 정산',     value: opsData.kpi.unconfirmedSettlementCount, color: opsData.kpi.unconfirmedSettlementCount > 0 ? '#ef5350' : '#718096', alert: opsData.kpi.unconfirmedSettlementCount > 0 },
                  { label: '예외 처리 근로자', value: opsData.kpi.exceptionWorkerCount,      color: '#f9a825',  alert: false,
                    sub: `보험 ${opsData.kpi.insuranceExceptionCount} / 세금 ${opsData.kpi.taxExceptionCount}` },
                  { label: '이번 달 다운로드', value: opsData.kpi.thisMonthDownloadCount,    color: '#718096',  alert: false },
                ].map(c => (
                  <div key={c.label} className="bg-card rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                    style={{ borderTop: `3px solid ${c.color}`, outline: c.alert ? `1px solid ${c.color}` : 'none' }}>
                    <div className="text-[26px] font-bold" style={{ color: c.color }}>{c.value.toLocaleString()}</div>
                    <div className="text-[12px] text-muted-brand mt-1">{c.label}</div>
                    {'sub' in c && c.sub && <div className="text-[11px] text-muted-brand mt-0.5">{c.sub}</div>}
                    {c.alert && <div className="text-[11px] font-semibold mt-1" style={{ color: c.color }}>확인 필요</div>}
                  </div>
                ))}

                {/* 월마감 상태 */}
                {(() => {
                  const st = opsData.monthClosingStatus?.status ?? 'OPEN'
                  const { bg, color } = CLOSING_COLOR[st] ?? CLOSING_COLOR.OPEN
                  return (
                    <div className="bg-card rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.35)] border-t-[3px]" style={{ borderTopColor: color }}>
                      <div className="text-[11px] text-muted-brand mb-2 font-medium">월마감 상태</div>
                      <span className="inline-block px-3 py-1 rounded-full text-[13px] font-semibold" style={{ background: bg, color }}>
                        {CLOSING_LABEL[st] ?? st}
                      </span>
                      {opsData.monthClosingStatus?.closedAt && (
                        <div className="text-[11px] text-muted-brand mt-2">
                          {new Date(opsData.monthClosingStatus.closedAt).toLocaleDateString('ko-KR')} 마감
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* 3열 패널 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 협력사 정산 */}
                <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(91,164,217,0.1)] text-[13px] font-semibold">
                    <span>협력사 정산 현황</span>
                    <Link href="/admin/subcontractor-settlements" className="text-[12px] text-[#5BA4D9] no-underline font-normal">→ 이동</Link>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between mb-3 text-[13px]">
                      <span className="text-muted-brand">전체</span>
                      <span className="font-bold">{opsData.settlementSummary.total}건</span>
                    </div>
                    {opsData.settlementSummary.total === 0 ? (
                      <p className="text-[12px] text-muted-brand text-center py-2">정산 내역 없음</p>
                    ) : (
                      [
                        { label: '확정',     value: opsData.settlementSummary.confirmed,     color: '#4caf50' },
                        { label: '검토 필요', value: opsData.settlementSummary.reviewRequired, color: '#ef5350' },
                        { label: '임시저장', value: opsData.settlementSummary.draft,          color: '#718096' },
                        { label: '보류',     value: opsData.settlementSummary.hold,           color: '#f9a825' },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center px-3 py-2 rounded-lg mb-1.5"
                          style={{ background: `${item.color}18` }}>
                          <span className="text-[12px] font-semibold" style={{ color: item.color }}>{item.label}</span>
                          <span className="text-[13px] font-bold" style={{ color: item.color }}>{item.value}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 최근 다운로드 */}
                <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(91,164,217,0.1)] text-[13px] font-semibold">
                    <span>최근 다운로드</span>
                    <Link href="/admin/document-center" className="text-[12px] text-[#5BA4D9] no-underline font-normal">→ 이동</Link>
                  </div>
                  <div className="py-1">
                    {opsData.recentDownloads.length === 0 ? (
                      <p className="text-[12px] text-muted-brand text-center py-5">다운로드 내역 없음</p>
                    ) : opsData.recentDownloads.map(dl => (
                      <div key={dl.id} className="px-4 py-2.5 border-b border-[rgba(91,164,217,0.06)] flex justify-between items-start">
                        <div>
                          <div className="text-[12px] font-semibold text-[#CBD5E0]">{EXPORT_LABEL[dl.exportType] ?? dl.exportType}</div>
                          <div className="text-[11px] text-muted-brand mt-0.5">{dl.monthKey} · v{dl.versionNo}</div>
                        </div>
                        <div className="text-[11px] text-muted-brand text-right">
                          {new Date(dl.createdAt).toLocaleDateString('ko-KR')}
                          {dl.createdBy && <div className="mt-0.5">{dl.createdBy}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 온보딩 이슈 */}
                <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(91,164,217,0.1)] text-[13px] font-semibold">
                    <span>온보딩 이슈</span>
                    <Link href="/admin/workers" className="text-[12px] text-[#5BA4D9] no-underline font-normal">→ 이동</Link>
                  </div>
                  <div className="py-1">
                    {opsData.onboardingIssues.length === 0 ? (
                      <p className="text-[12px] text-muted-brand text-center py-5">온보딩 이슈 없음</p>
                    ) : opsData.onboardingIssues.map(issue => (
                      <div key={issue.workerId} className="px-4 py-2.5 border-b border-[rgba(91,164,217,0.06)] flex justify-between items-center">
                        <div>
                          <Link href={`/admin/workers/${issue.workerId}`} className="text-[12px] font-semibold text-[#5BA4D9] no-underline">
                            {issue.workerName}
                          </Link>
                          <div className="text-[11px] text-[#ff9800] mt-0.5">{issue.topIssue}</div>
                        </div>
                        <span className="text-[11px] font-bold text-white bg-[#e53935] rounded-full px-2 py-0.5 ml-2">
                          {issue.issueCount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
