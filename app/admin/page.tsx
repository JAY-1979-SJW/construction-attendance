'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DashboardSummary {
  totalWorkers: number
  activeSites: number
  todayTotal: number
  todayCheckedIn: number
  todayCompleted: number
  pendingMissing: number
  pendingExceptions: number
  pendingDeviceRequests: number
  todayPresenceTotal:    number
  todayPresencePending:  number
  todayPresenceReview:   number
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

const STATUS_LABEL: Record<string, string> = { WORKING: '근무중', COMPLETED: '퇴근', MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외' }
const STATUS_COLOR: Record<string, string> = { WORKING: '#2e7d32', COMPLETED: '#1565c0', MISSING_CHECKOUT: '#b71c1c', EXCEPTION: '#e65100' }

export default function AdminDashboard() {
  const router = useRouter()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recent, setRecent] = useState<RecentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setSummary(data.data.summary)
        setRecent(data.data.recentAttendance)
        setLoading(false)
      })
  }, [router])

  const formatTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-brand">
      로딩 중...
    </div>
  )

  return (
    <div className="flex min-h-screen bg-brand">
      {/* Sidebar */}
      <nav className="w-[220px] bg-brand-dark py-6 shrink-0 flex flex-col">
        <div className="text-white text-base font-bold px-5 pb-6 border-b border-white/10">해한 출퇴근</div>
        <div className="text-white/40 text-[11px] px-5 pt-4 pb-2 uppercase tracking-widest">관리</div>
        {[
          { href: '/admin', label: '대시보드' },
          { href: '/admin/workers', label: '근로자 관리' },
          { href: '/admin/companies', label: '회사 관리' },
          { href: '/admin/sites', label: '현장 관리' },
          { href: '/admin/attendance', label: '출퇴근 조회' },
          { href: '/admin/presence-checks', label: '체류확인 현황' },
          { href: '/admin/presence-report', label: '체류확인 리포트' },
          { href: '/admin/work-confirmations', label: '근무확정' },
          { href: '/admin/contracts', label: '인력/계약 관리' },
          { href: '/admin/insurance-eligibility', label: '보험판정' },
          { href: '/admin/wage-calculations', label: '세금/노임 계산' },
          { href: '/admin/filing-exports', label: '신고자료 내보내기' },
          { href: '/admin/exceptions', label: `예외 승인${summary?.pendingExceptions ? ` (${summary.pendingExceptions})` : ''}` },
          { href: '/admin/device-requests', label: `기기 변경${summary?.pendingDeviceRequests ? ` (${summary.pendingDeviceRequests})` : ''}` },
          { href: '/admin/materials', label: '자재관리' },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="block text-white/80 px-5 py-[10px] text-sm no-underline hover:text-white transition-colors">{item.label}</Link>
        ))}
        <button onClick={handleLogout} className="mx-5 mt-6 py-[10px] bg-white/10 border-none rounded-md text-white/60 cursor-pointer text-[13px]">로그아웃</button>
      </nav>

      {/* Main */}
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold m-0 mb-1">대시보드</h1>
        <p className="text-sm text-muted-brand mb-6">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>

        {/* 체류확인 알림 */}
        {summary && (summary.todayPresenceReview > 0 || summary.todayPresenceNoResponse > 0) && (
          <div className="flex gap-3 mb-5 flex-wrap">
            {summary.todayPresenceReview > 0 && (
              <a href="/admin/presence-checks?status=REVIEW_REQUIRED"
                className="flex flex-col items-center justify-center no-underline min-w-[140px] rounded-[10px] p-4 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.35)] bg-[#fff8e1] border border-[#f57f1740]">
                <div className="text-[22px] font-bold text-[#f57f17]">{summary.todayPresenceReview}</div>
                <div className="text-xs text-[#f57f17]">검토필요 — 즉시 확인</div>
              </a>
            )}
            {summary.todayPresenceNoResponse > 0 && (
              <a href="/admin/presence-checks?status=NO_RESPONSE"
                className="flex flex-col items-center justify-center no-underline min-w-[140px] rounded-[10px] p-4 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.35)] bg-[#fff3f3] border border-[#b71c1c40]">
                <div className="text-[22px] font-bold text-[#b71c1c]">{summary.todayPresenceNoResponse}</div>
                <div className="text-xs text-[#b71c1c]">미응답 — 확인 필요</div>
              </a>
            )}
            {summary.todayPresenceTotal > 0 && (
              <a href="/admin/presence-checks"
                className="flex flex-col items-center justify-center no-underline min-w-[140px] rounded-[10px] p-4 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.35)] bg-[#f5f5f5] border border-[#546e7a40]">
                <div className="text-[22px] font-bold text-[#546e7a]">{summary.todayPresenceTotal}</div>
                <div className="text-xs text-[#546e7a]">오늘 체류확인 전체</div>
              </a>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 mb-6 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
          {[
            { label: '오늘 출근', value: summary?.todayTotal ?? 0, color: '#5BA4D9' },
            { label: '근무 중', value: summary?.todayCheckedIn ?? 0, color: '#2e7d32' },
            { label: '퇴근 완료', value: summary?.todayCompleted ?? 0, color: '#455a64' },
            { label: '미퇴근 누적', value: summary?.pendingMissing ?? 0, color: '#b71c1c' },
            { label: '예외 대기', value: summary?.pendingExceptions ?? 0, color: '#e65100' },
            { label: '기기 변경 대기', value: summary?.pendingDeviceRequests ?? 0, color: '#7b1fa2' },
            { label: '등록 근로자', value: summary?.totalWorkers ?? 0, color: '#37474f' },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-[10px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.35)]" style={{ borderTop: `4px solid ${item.color}` }}>
              <div className="text-[32px] font-bold mb-1" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[13px] text-muted-brand">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Attendance */}
        <div className="bg-card rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          <div className="text-base font-bold mb-4">오늘 출근 현황</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['이름', '회사', '현장', '출근', '퇴근', '상태'].map((h) => (
                    <th key={h} className="text-left px-3 py-[10px] text-xs text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-[#999]">오늘 출근 기록이 없습니다.</td></tr>
                ) : recent.map((r) => (
                  <tr key={r.id} className="hover:bg-[rgba(91,164,217,0.05)] transition-colors">
                    <td className="px-3 py-3 text-sm text-[#A0AEC0] border-b border-[rgba(91,164,217,0.08)]">{r.workerName}</td>
                    <td className="px-3 py-3 text-sm text-[#A0AEC0] border-b border-[rgba(91,164,217,0.08)]">{r.company}</td>
                    <td className="px-3 py-3 text-sm text-[#A0AEC0] border-b border-[rgba(91,164,217,0.08)]">{r.siteName}</td>
                    <td className="px-3 py-3 text-sm text-[#A0AEC0] border-b border-[rgba(91,164,217,0.08)]">{formatTime(r.checkInAt)}</td>
                    <td className="px-3 py-3 text-sm text-[#A0AEC0] border-b border-[rgba(91,164,217,0.08)]">{formatTime(r.checkOutAt)}</td>
                    <td className="px-3 py-3 text-sm text-[#A0AEC0] border-b border-[rgba(91,164,217,0.08)]">
                      <span style={{ color: STATUS_COLOR[r.status], fontWeight: 600, fontSize: '13px' }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
