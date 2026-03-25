'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DashboardSummary {
  totalWorkers: number; activeSites: number; todayTotal: number
  todayCheckedIn: number; todayCompleted: number; pendingMissing: number
  pendingExceptions: number; pendingDeviceRequests: number
  todayPresenceTotal: number; todayPresencePending: number
  todayPresenceReview: number; todayPresenceNoResponse: number
}
interface RecentRecord {
  id: string; workerName: string; company: string; siteName: string
  checkInAt: string | null; checkOutAt: string | null; status: string
}

// [5] 상태 배지 채도 조정
const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무중', COMPLETED: '퇴근', MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외',
}
const STATUS_BADGE: Record<string, string> = {
  WORKING:          'bg-[#ECFDF5] text-[#16A34A] border border-[#A7F3D0]',  // 채도 소폭 낮춤
  COMPLETED:        'bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB]',  // 가독성 소폭 향상
  MISSING_CHECKOUT: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#F87171]',
  EXCEPTION:        'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
}
const STATUS_SORT: Record<string, number> = {
  MISSING_CHECKOUT: 0, EXCEPTION: 1, WORKING: 2, COMPLETED: 3,
}

export default function AdminDashboard() {
  const router = useRouter()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recent, setRecent] = useState<RecentRecord[]>([])
  const [todayLoading, setTodayLoading] = useState(true)

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  const loadToday = useCallback(() => {
    setTodayLoading(true)
    fetch('/api/admin/dashboard')
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setSummary(data.data.summary)
        setRecent(data.data.recentAttendance)
        setTodayLoading(false)
      })
  }, [router])

  useEffect(() => { loadToday() }, [loadToday])

  const sortedRecent = useMemo(() =>
    [...recent].sort((a, b) => (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9)),
    [recent]
  )

  const siteSummary = useMemo(() => {
    const map = new Map<string, { total: number; working: number; completed: number; issue: number }>()
    recent.forEach(r => {
      const e = map.get(r.siteName) ?? { total: 0, working: 0, completed: 0, issue: 0 }
      map.set(r.siteName, {
        total:     e.total + 1,
        working:   e.working   + (r.status === 'WORKING' ? 1 : 0),
        completed: e.completed + (r.status === 'COMPLETED' ? 1 : 0),
        issue:     e.issue     + (r.status === 'MISSING_CHECKOUT' || r.status === 'EXCEPTION' ? 1 : 0),
      })
    })
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => (b.issue - a.issue) || (b.working - a.working))
  }, [recent])

  const todayStr = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  const pendingApproval = (summary?.pendingDeviceRequests ?? 0) + (summary?.pendingExceptions ?? 0)

  return (
    <div className="p-4 md:p-6 bg-[#F5F7FA] min-h-screen">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-bold text-[#111827] m-0">대시보드</h1>
          <span className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] border border-[#E5E7EB] rounded-full px-2.5 py-1 tabular-nums">
            {todayStr} 기준
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/attendance"
            className="no-underline flex items-center gap-1.5 text-[13px] font-semibold text-white bg-[#071020] hover:bg-[#1E293B] rounded-[8px] px-3.5 py-1.5 transition-colors">
            출근현황
          </Link>
          <Link href="/admin/device-requests"
            className="no-underline flex items-center gap-1.5 text-[13px] font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] rounded-[8px] px-3.5 py-1.5 transition-colors">
            승인관리
            {pendingApproval > 0 && (
              <span className="bg-white text-[#F97316] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">{pendingApproval}</span>
            )}
          </Link>
          <button onClick={loadToday}
            className="flex items-center gap-1.5 text-[13px] text-[#374151] border border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-[8px] px-3 py-1.5 cursor-pointer transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            새로고침
          </button>
        </div>
      </div>

      {todayLoading ? (
        <div className="text-[#9CA3AF] text-sm py-20 text-center">로딩 중...</div>
      ) : (
        <>
          {summary && (summary.todayPresenceReview > 0 || summary.todayPresenceNoResponse > 0) && (
            <div className="flex gap-3 mb-4 flex-wrap">
              {summary.todayPresenceReview > 0 && (
                <a href="/admin/presence-checks?status=REVIEW_REQUIRED"
                  className="flex items-center gap-2.5 no-underline px-4 py-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] text-[#D97706] hover:border-[#F59E0B] transition-colors">
                  <span className="text-[15px] font-bold">{summary.todayPresenceReview}</span>
                  <span className="text-[12px] font-medium">체류확인 검토 필요</span>
                </a>
              )}
              {summary.todayPresenceNoResponse > 0 && (
                <a href="/admin/presence-checks?status=NO_RESPONSE"
                  className="flex items-center gap-2.5 no-underline px-4 py-2 bg-[#FEE2E2] border border-[#F87171] rounded-[10px] text-[#B91C1C] hover:border-[#EF4444] transition-colors">
                  <span className="text-[15px] font-bold">{summary.todayPresenceNoResponse}</span>
                  <span className="text-[12px] font-medium">체류확인 미응답</span>
                </a>
              )}
            </div>
          )}

          {/* ── KPI 4개 [1] 중립 통일, 문제 카드만 강조 [7] mb-4+패딩 축소 ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              // [1] 출근/근무중: 중립 회색 라인
              { label: '오늘 총 출근 인원', value: summary?.todayTotal ?? 0,     unit: '명', sub: '오늘 기록 기준', accent: '#9CA3AF', href: '/admin/attendance' },
              { label: '현재 근무중',       value: summary?.todayCheckedIn ?? 0, unit: '명', sub: '퇴근 전 인원',   accent: '#9CA3AF', href: '/admin/attendance' },
              // [1] 미퇴근/승인대기: 강조
              { label: '미퇴근 인원',       value: summary?.pendingMissing ?? 0, unit: '명', sub: '확인 필요',      accent: '#DC2626', href: '/admin/attendance' },
              { label: '승인 대기',         value: pendingApproval,              unit: '건', sub: '처리 필요',      accent: '#F97316', href: '/admin/device-requests' },
            ].map(card => (
              <Link key={card.label} href={card.href}
                // [7] 패딩 축소 px-4 py-3
                className="no-underline bg-white rounded-[12px] border border-[#E5E7EB] px-4 py-3 hover:border-[#D1D5DB] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all block"
                style={{ borderTopWidth: 3, borderTopColor: card.accent }}
              >
                <div className="text-[11px] font-semibold text-[#6B7280] mb-1.5 tracking-wide uppercase">{card.label}</div>
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-[28px] font-bold text-[#0F172A] leading-none tabular-nums">{card.value}</span>
                  <span className="text-[13px] text-[#6B7280]">{card.unit}</span>
                </div>
                <div className="text-[11px] text-[#9CA3AF]">{card.sub}</div>
              </Link>
            ))}
          </div>

          {/* ── 메인 2단 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 mb-4 items-start">

            {/* 좌: 출근 현황 */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#111827]">오늘 출근 현황</span>
                  <span className="text-[11px] text-[#9CA3AF]">확인 필요 우선</span>
                </div>
                {/* [6] 전체보기 상단 1개만 유지 */}
                <Link href="/admin/attendance" className="text-[12px] text-[#F97316] no-underline font-medium hover:underline">
                  전체보기 →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    {/* [4] 헤더 배경/텍스트 대비 강화 */}
                    <tr className="bg-[#F3F4F6]">
                      {['이름', '소속', '현장', '출근', '퇴근', '상태'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-[#4B5563] uppercase tracking-wider whitespace-nowrap border-b border-[#E5E7EB]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecent.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-[#9CA3AF] text-[13px]">오늘 출근 기록이 없습니다.</td></tr>
                    ) : sortedRecent.slice(0, 10).map(r => (
                      <tr key={r.id}
                        className={`hover:bg-[#FAFAFA] transition-colors border-b border-[#F9FAFB] last:border-b-0 ${
                          r.status === 'MISSING_CHECKOUT' || r.status === 'EXCEPTION' ? 'bg-[#FFF1F2]' : ''
                        }`}>
                        <td className="px-4 py-2.5 text-[13px] font-medium text-[#111827] whitespace-nowrap">{r.workerName}</td>
                        <td className="px-4 py-2.5 text-[13px] text-[#6B7280] whitespace-nowrap">{r.company}</td>
                        <td className="px-4 py-2.5 text-[13px] text-[#6B7280] whitespace-nowrap">{r.siteName}</td>
                        <td className="px-4 py-2.5 text-[13px] text-[#374151] whitespace-nowrap tabular-nums">{fmtTime(r.checkInAt)}</td>
                        <td className="px-4 py-2.5 text-[13px] text-[#374151] whitespace-nowrap tabular-nums">{fmtTime(r.checkOutAt)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status] ?? 'bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB]'}`}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* [6] 하단 전체보기 링크 제거 → 건수만 표시 */}
              {sortedRecent.length > 10 && (
                <div className="px-5 py-2.5 border-t border-[#F3F4F6]">
                  <span className="text-[12px] text-[#9CA3AF]">{sortedRecent.length - 10}건 더 있음 — 전체보기에서 확인</span>
                </div>
              )}
            </div>

            {/* 우: 빠른 처리 [2] 강약 조정 */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F3F4F6]">
                <span className="text-[14px] font-semibold text-[#111827]">빠른 처리</span>
              </div>
              <div className="p-4 flex flex-col gap-2.5">
                {[
                  {
                    label: '미퇴근 확인',
                    desc:  '퇴근 누락 인원',
                    count: summary?.pendingMissing ?? 0,
                    href:  '/admin/attendance',
                    btnLabel: '출근현황으로 이동',
                    // [2] 미퇴근: 강한 빨강
                    style: 'red' as const,
                  },
                  {
                    label: '예외 처리',
                    desc:  '출퇴근 예외 건',
                    count: summary?.pendingExceptions ?? 0,
                    href:  '/admin/attendance',
                    btnLabel: '출근현황으로 이동',
                    // [2] 예외: 강한 빨강
                    style: 'red' as const,
                  },
                  {
                    label: '승인 대기',
                    desc:  '기기 변경 및 신규 요청',
                    count: summary?.pendingDeviceRequests ?? 0,
                    href:  '/admin/device-requests',
                    btnLabel: '승인관리로 이동',
                    // [2] 승인대기: 오렌지/중립 강조
                    style: 'orange' as const,
                  },
                  ...(summary?.todayPresenceReview ?? 0) > 0 ? [{
                    label: '체류확인 검토',
                    desc:  '응답 검토 필요',
                    count: summary?.todayPresenceReview ?? 0,
                    href:  '/admin/presence-checks?status=REVIEW_REQUIRED',
                    btnLabel: '체류확인으로 이동',
                    style: 'red' as const,
                  }] : [],
                ].map(item => {
                  const hasIssue = item.count > 0
                  const isRed    = item.style === 'red'
                  const isOrange = item.style === 'orange'
                  return (
                    <div key={item.label}
                      className={`rounded-[10px] border p-3.5 ${
                        hasIssue && isRed    ? 'bg-[#FEE2E2] border-[#F87171]'  :
                        hasIssue && isOrange ? 'bg-[#FFF7ED] border-[#FDE68A]'  :
                        'bg-[#F9FAFB] border-[#F3F4F6]'
                      }`}>
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <div className={`text-[13px] font-semibold ${
                            hasIssue && isRed    ? 'text-[#B91C1C]' :
                            hasIssue && isOrange ? 'text-[#D97706]' :
                            'text-[#374151]'
                          }`}>
                            {item.label}
                          </div>
                          <div className="text-[11px] text-[#9CA3AF] mt-0.5">{item.desc}</div>
                        </div>
                        <span className={`text-[20px] font-bold ml-2 tabular-nums ${
                          hasIssue && isRed    ? 'text-[#B91C1C]' :
                          hasIssue && isOrange ? 'text-[#D97706]' :
                          'text-[#D1D5DB]'
                        }`}>
                          {item.count}
                        </span>
                      </div>
                      <Link href={item.href}
                        className={`no-underline block text-center text-[12px] font-semibold py-1.5 rounded-[7px] transition-colors ${
                          hasIssue && isRed    ? 'bg-[#B91C1C] text-white hover:bg-[#991B1B]'               :
                          hasIssue && isOrange ? 'bg-[#F97316] text-white hover:bg-[#EA580C]'               :
                          'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#D1D5DB]'
                        }`}>
                        {item.btnLabel}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── 현장별 오늘 현황 ── */}
          {siteSummary.length > 0 && (
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#F3F4F6]">
                <span className="text-[14px] font-semibold text-[#111827]">현장별 오늘 현황</span>
                <Link href="/admin/sites" className="text-[12px] text-[#6B7280] no-underline hover:text-[#F97316] transition-colors">
                  현장 관리 →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    {/* [4] 현장 표 헤더도 동일하게 */}
                    <tr className="bg-[#F3F4F6]">
                      {['현장명', '오늘 출근', '근무중', '퇴근완료', '확인 필요', '상태'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-[#4B5563] uppercase tracking-wider border-b border-[#E5E7EB] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {siteSummary.map(s => (
                      <tr key={s.name}
                        onClick={() => router.push('/admin/attendance')}
                        className={`cursor-pointer transition-colors border-b border-[#F9FAFB] last:border-b-0 ${
                          s.issue > 0 ? 'bg-[#FFF1F2] hover:bg-[#FFE4E6]' : 'hover:bg-[#F9FAFB]'
                        }`}>
                        <td className="px-4 py-2.5 text-[13px] font-medium text-[#111827]">
                          <span className="flex items-center gap-1.5">{s.name}{s.issue > 0 && <span className="text-[10px] text-[#B91C1C]">↗</span>}</span>
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-[#374151] tabular-nums">{s.total}명</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[13px] font-semibold tabular-nums ${s.working > 0 ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}`}>{s.working}명</span>
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-[#6B7280] tabular-nums">{s.completed}명</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {s.issue > 0 ? <span className="text-[12px] font-bold text-[#B91C1C]">{s.issue}건</span> : <span className="text-[12px] text-[#D1D5DB]">-</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {s.issue > 0 ? (
                            <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] border border-[#F87171]">확인 필요</span>
                          ) : s.total > 0 ? (
                            <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#9CA3AF] border border-[#E5E7EB]">정상</span>
                          ) : (
                            <span className="text-[11px] text-[#D1D5DB]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
