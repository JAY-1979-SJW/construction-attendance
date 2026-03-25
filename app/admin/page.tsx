'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── 타입 ──────────────────────────────────────────────────────────────────────
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

// ─── 상수 ──────────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무중', COMPLETED: '퇴근', MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외',
}
const STATUS_BADGE: Record<string, string> = {
  WORKING:          'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]',
  COMPLETED:        'bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]',
  MISSING_CHECKOUT: 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]',
  EXCEPTION:        'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
}
// 표시 우선순위: 확인필요 → 근무중 → 퇴근
const STATUS_SORT: Record<string, number> = {
  MISSING_CHECKOUT: 0, EXCEPTION: 1, WORKING: 2, COMPLETED: 3,
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
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

  // 우선순위 정렬: 확인필요 → 근무중 → 퇴근
  const sortedRecent = useMemo(() =>
    [...recent].sort((a, b) => (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9)),
    [recent]
  )

  // 현장별 집계
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

  // 절대 날짜 (KST)
  const todayStr = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)

  // 승인 대기 = 기기 변경 대기 + 예외 처리
  const pendingApproval = (summary?.pendingDeviceRequests ?? 0) + (summary?.pendingExceptions ?? 0)

  return (
    <div className="p-5 md:p-7 bg-[#F5F7FA] min-h-screen">

      {/* ── 페이지 헤더 ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A] m-0 mb-1">대시보드</h1>
          <p className="text-[13px] text-[#6B7280] m-0">오늘 현장 운영 현황을 확인하세요</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[13px] text-[#6B7280] tabular-nums">{todayStr} 기준</span>
          <button
            onClick={loadToday}
            className="flex items-center gap-1.5 text-[13px] text-[#374151] border border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-[8px] px-3 py-1.5 cursor-pointer transition-colors"
          >
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
          {/* 체류확인 알림 배너 */}
          {summary && (summary.todayPresenceReview > 0 || summary.todayPresenceNoResponse > 0) && (
            <div className="flex gap-3 mb-5 flex-wrap">
              {summary.todayPresenceReview > 0 && (
                <a href="/admin/presence-checks?status=REVIEW_REQUIRED"
                  className="flex items-center gap-2.5 no-underline px-4 py-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] text-[#D97706] hover:border-[#F59E0B] transition-colors">
                  <span className="text-[16px] font-bold">{summary.todayPresenceReview}</span>
                  <span className="text-[12px] font-medium">체류확인 검토 필요</span>
                </a>
              )}
              {summary.todayPresenceNoResponse > 0 && (
                <a href="/admin/presence-checks?status=NO_RESPONSE"
                  className="flex items-center gap-2.5 no-underline px-4 py-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] text-[#DC2626] hover:border-[#FCA5A5] transition-colors">
                  <span className="text-[16px] font-bold">{summary.todayPresenceNoResponse}</span>
                  <span className="text-[12px] font-medium">체류확인 미응답</span>
                </a>
              )}
            </div>
          )}

          {/* ── KPI 4개 ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: '오늘 총 출근 인원',
                value: summary?.todayTotal ?? 0,
                unit: '명',
                sub: '오늘 기록 기준',
                accent: '#F97316',
                href: '/admin/attendance',
              },
              {
                label: '현재 근무중',
                value: summary?.todayCheckedIn ?? 0,
                unit: '명',
                sub: '퇴근 전 인원',
                accent: '#16A34A',
                href: '/admin/attendance',
              },
              {
                label: '미퇴근 인원',
                value: summary?.pendingMissing ?? 0,
                unit: '명',
                sub: '확인 필요',
                accent: '#DC2626',
                href: '/admin/attendance',
              },
              {
                label: '승인 대기',
                value: pendingApproval,
                unit: '건',
                sub: '처리 필요',
                accent: '#7C3AED',
                href: '/admin/device-requests',
              },
            ].map(card => (
              <Link
                key={card.label}
                href={card.href}
                className="no-underline bg-white rounded-[12px] border border-[#E5E7EB] px-5 py-4 hover:border-[#D1D5DB] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all block"
                style={{ borderTopWidth: 3, borderTopColor: card.accent }}
              >
                <div className="text-[11px] font-semibold text-[#6B7280] mb-2 tracking-wide uppercase">{card.label}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[32px] font-bold text-[#0F172A] leading-none tabular-nums">{card.value}</span>
                  <span className="text-[14px] text-[#6B7280]">{card.unit}</span>
                </div>
                <div className="text-[11px] text-[#9CA3AF]">{card.sub}</div>
              </Link>
            ))}
          </div>

          {/* ── 메인 2단 영역 ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 mb-5">

            {/* 좌: 오늘 출근 현황 */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F4F6]">
                <div>
                  <span className="text-[14px] font-semibold text-[#111827]">오늘 출근 현황</span>
                  <span className="ml-2 text-[11px] text-[#9CA3AF]">확인 필요 우선 정렬</span>
                </div>
                <Link href="/admin/attendance" className="text-[12px] text-[#F97316] no-underline font-medium hover:underline">
                  전체보기 →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#F9FAFB]">
                      {['이름', '소속', '현장', '출근', '퇴근', '상태'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap border-b border-[#F3F4F6]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecent.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-[#9CA3AF] text-[13px]">
                          오늘 출근 기록이 없습니다.
                        </td>
                      </tr>
                    ) : sortedRecent.slice(0, 10).map(r => (
                      <tr
                        key={r.id}
                        className={`hover:bg-[#FAFAFA] transition-colors border-b border-[#F9FAFB] last:border-b-0 ${
                          r.status === 'MISSING_CHECKOUT' || r.status === 'EXCEPTION' ? 'bg-[#FFFBEB]/40' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-[13px] font-medium text-[#111827] whitespace-nowrap">{r.workerName}</td>
                        <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">{r.company}</td>
                        <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">{r.siteName}</td>
                        <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap tabular-nums">{fmtTime(r.checkInAt)}</td>
                        <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap tabular-nums">{fmtTime(r.checkOutAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status] ?? 'bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]'}`}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedRecent.length > 10 && (
                <div className="px-5 py-3 border-t border-[#F3F4F6] flex items-center justify-between">
                  <span className="text-[12px] text-[#9CA3AF]">{sortedRecent.length - 10}건 더 있음</span>
                  <Link href="/admin/attendance" className="text-[12px] text-[#F97316] no-underline hover:underline font-medium">
                    출근현황 전체보기 →
                  </Link>
                </div>
              )}
            </div>

            {/* 우: 빠른 처리 */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#F3F4F6]">
                <span className="text-[14px] font-semibold text-[#111827]">빠른 처리</span>
              </div>
              <div className="p-4 flex flex-col gap-2.5">
                {[
                  {
                    label: '미퇴근 확인',
                    desc: '퇴근 누락 인원을 확인하세요',
                    count: summary?.pendingMissing ?? 0,
                    href: '/admin/attendance',
                    btnLabel: '출근현황으로 이동',
                    urgent: (summary?.pendingMissing ?? 0) > 0,
                  },
                  {
                    label: '승인 대기',
                    desc: '신규 기기 및 변경 요청을 확인하세요',
                    count: summary?.pendingDeviceRequests ?? 0,
                    href: '/admin/device-requests',
                    btnLabel: '승인관리로 이동',
                    urgent: (summary?.pendingDeviceRequests ?? 0) > 0,
                  },
                  {
                    label: '예외 처리',
                    desc: '출퇴근 예외 건을 확인하세요',
                    count: summary?.pendingExceptions ?? 0,
                    href: '/admin/attendance',
                    btnLabel: '출근현황으로 이동',
                    urgent: (summary?.pendingExceptions ?? 0) > 0,
                  },
                  ...(summary?.todayPresenceReview ?? 0) > 0 ? [{
                    label: '체류확인 검토',
                    desc: '응답 검토가 필요한 인원이 있습니다',
                    count: summary?.todayPresenceReview ?? 0,
                    href: '/admin/presence-checks?status=REVIEW_REQUIRED',
                    btnLabel: '체류확인으로 이동',
                    urgent: true,
                  }] : [],
                ].map(item => (
                  <div
                    key={item.label}
                    className={`rounded-[10px] border p-3.5 ${
                      item.urgent && item.count > 0
                        ? 'bg-[#FEF2F2] border-[#FECACA]'
                        : 'bg-[#F9FAFB] border-[#F3F4F6]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <div className={`text-[13px] font-semibold ${item.urgent && item.count > 0 ? 'text-[#DC2626]' : 'text-[#374151]'}`}>
                          {item.label}
                        </div>
                        <div className="text-[11px] text-[#9CA3AF] mt-0.5">{item.desc}</div>
                      </div>
                      <span className={`text-[20px] font-bold ml-2 tabular-nums ${item.urgent && item.count > 0 ? 'text-[#DC2626]' : 'text-[#D1D5DB]'}`}>
                        {item.count}
                      </span>
                    </div>
                    <Link
                      href={item.href}
                      className={`no-underline block text-center text-[12px] font-semibold py-1.5 rounded-[7px] transition-colors ${
                        item.urgent && item.count > 0
                          ? 'bg-[#DC2626] text-white hover:bg-[#B91C1C]'
                          : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#D1D5DB] hover:text-[#374151]'
                      }`}
                    >
                      {item.btnLabel}
                    </Link>
                  </div>
                ))}

                {/* 바로가기 */}
                <div className="mt-1 pt-3 border-t border-[#F3F4F6]">
                  <div className="text-[11px] text-[#9CA3AF] mb-2 font-semibold uppercase tracking-wide">바로가기</div>
                  <div className="flex flex-col gap-1">
                    {[
                      { label: '출근현황 보기', href: '/admin/attendance' },
                      { label: '근로자 관리', href: '/admin/workers' },
                      { label: '현장 관리', href: '/admin/sites' },
                    ].map(link => (
                      <Link key={link.label} href={link.href}
                        className="no-underline text-[12px] text-[#6B7280] hover:text-[#F97316] flex items-center justify-between transition-colors py-1 px-1 rounded hover:bg-[#FFF7ED]">
                        <span>{link.label}</span>
                        <span className="text-[#D1D5DB]">→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 현장별 오늘 현황 ────────────────────────────────────── */}
          {siteSummary.length > 0 && (
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F4F6]">
                <span className="text-[14px] font-semibold text-[#111827]">현장별 오늘 현황</span>
                <Link href="/admin/sites" className="text-[12px] text-[#6B7280] no-underline hover:text-[#F97316] transition-colors">
                  현장 관리 →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#F9FAFB]">
                      {['현장명', '오늘 출근', '근무중', '퇴근완료', '확인 필요', '상태'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider border-b border-[#F3F4F6] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {siteSummary.map(s => (
                      <tr key={s.name} className={`hover:bg-[#FAFAFA] transition-colors border-b border-[#F9FAFB] last:border-b-0 ${s.issue > 0 ? 'bg-[#FFFBEB]/30' : ''}`}>
                        <td className="px-4 py-3 text-[13px] font-medium text-[#111827]">{s.name}</td>
                        <td className="px-4 py-3 text-[13px] text-[#374151] tabular-nums">{s.total}명</td>
                        <td className="px-4 py-3">
                          <span className={`text-[13px] font-semibold tabular-nums ${s.working > 0 ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}`}>
                            {s.working}명
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#6B7280] tabular-nums">{s.completed}명</td>
                        <td className="px-4 py-3 tabular-nums">
                          {s.issue > 0
                            ? <span className="text-[12px] font-semibold text-[#DC2626]">{s.issue}건</span>
                            : <span className="text-[12px] text-[#D1D5DB]">-</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {s.issue > 0 ? (
                            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                              확인 필요
                            </span>
                          ) : s.total > 0 ? (
                            <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                              정상
                            </span>
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
