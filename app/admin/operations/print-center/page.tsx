'use client'

import { useState } from 'react'

/**
 * 관리자 출력물 센터
 * 출력 대상:
 *  1. 일일 출퇴근 현황 — GET /api/admin/print-center/daily-attendance
 *  2. 공수 검토 목록 — /admin/operations/labor-review (화면 이동)
 *  3. 종료 증빙 패키지 — /admin/workers/[id]/termination/evidence (화면 이동)
 */

export default function PrintCenterPage() {
  const today = new Date().toISOString().slice(0, 10)

  const [dailyDate, setDailyDate] = useState(today)
  const [dailySiteId, setDailySiteId] = useState('')

  function openDailyAttendance() {
    const params = new URLSearchParams({ date: dailyDate, format: 'html' })
    if (dailySiteId) params.set('siteId', dailySiteId)
    window.open(`/api/admin/print-center/daily-attendance?${params.toString()}`, '_blank')
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 py-6 font-[system-ui,sans-serif]">
      <h1 className="m-0 mb-[6px] text-[22px] font-extrabold">관리자 출력물 센터</h1>
      <p className="m-0 mb-7 text-[13px] text-muted-brand">
        출력물을 선택하고 인쇄 또는 PDF로 저장하세요. 모든 출력물은 Ctrl+P (또는 인쇄 버튼)으로 PDF 저장 가능합니다.
      </p>

      {/* 1. 일일 출퇴근 현황 */}
      <PrintCard
        title="일일 출퇴근 현황"
        description="특정 날짜의 전체 출퇴근 기록을 출력합니다. 현장별 필터 가능."
        icon="📋"
      >
        <div className="flex gap-[10px] flex-wrap items-end">
          <div>
            <label className="block text-[12px] font-bold mb-[5px] text-muted-brand">날짜 *</label>
            <input
              type="date"
              value={dailyDate}
              onChange={e => setDailyDate(e.target.value)}
              className="px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[13px] outline-none"
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-[5px] text-muted-brand">현장 ID (선택)</label>
            <input
              type="text"
              value={dailySiteId}
              onChange={e => setDailySiteId(e.target.value)}
              placeholder="비우면 전체"
              className="w-[160px] px-3 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[13px] outline-none"
            />
          </div>
          <button
            onClick={openDailyAttendance}
            disabled={!dailyDate}
            className={`px-5 py-[9px] text-white border-none rounded-md text-[13px] font-bold ${!dailyDate ? 'bg-[#bdbdbd] cursor-not-allowed' : 'bg-[#263238] cursor-pointer'}`}
          >
            출력 열기 →
          </button>
        </div>
      </PrintCard>

      {/* 2. 공수/정산 검토 목록 */}
      <PrintCard
        title="공수/정산 검토 목록"
        description="월별 미확정 공수 항목을 화면에서 검토 후 확정 처리합니다."
        icon="📊"
      >
        <a
          href="/admin/operations/labor-review"
          className="inline-block px-5 py-[9px] bg-[#263238] text-white border-none rounded-md text-[13px] font-bold no-underline"
        >
          공수 검토 화면으로 →
        </a>
      </PrintCard>

      {/* 3. 오늘 처리할 일 */}
      <PrintCard
        title="오늘 처리할 일 패널"
        description="미처리 출퇴근 예외, 기기 승인, 현장참여 신청 등 오늘의 할 일을 한눈에 확인합니다."
        icon="📌"
      >
        <a
          href="/admin/operations/today-tasks"
          className="inline-block px-5 py-[9px] bg-[#263238] text-white border-none rounded-md text-[13px] font-bold no-underline"
        >
          오늘 할 일 보기 →
        </a>
      </PrintCard>

      {/* 4. 출퇴근 예외 처리 */}
      <PrintCard
        title="출퇴근 예외/누락 처리 센터"
        description="EXCEPTION 및 퇴근누락(MISSING_CHECKOUT) 건을 일괄 처리합니다."
        icon="⚠️"
      >
        <a
          href="/admin/operations/attendance-exceptions"
          className="inline-block px-5 py-[9px] bg-[#263238] text-white border-none rounded-md text-[13px] font-bold no-underline"
        >
          예외 처리 센터로 →
        </a>
      </PrintCard>

      {/* 5. 종료 증빙 패키지 안내 */}
      <div className="bg-card border border-brand rounded-[12px] px-5 py-[18px] mt-4">
        <div className="text-[14px] text-muted-brand">
          💼 <strong>종료 증빙 패키지</strong>는 개별 근로자 종료 처리 화면에서 출력할 수 있습니다.
          <br />
          <span className="text-[12px]">경로: 관리자 → 근로자 상세 → 종료 처리 → 종료 완료 후 &ldquo;종료 증빙 패키지 보기&rdquo; 버튼</span>
        </div>
      </div>
    </div>
  )
}

function PrintCard({ title, description, icon, children }: {
  title: string
  description: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-brand rounded-[12px] p-5 mb-4">
      <div className="flex items-start gap-[14px]">
        <div className="text-[28px] flex-shrink-0">{icon}</div>
        <div className="flex-1">
          <div className="text-[15px] font-extrabold mb-1">{title}</div>
          <div className="text-[13px] text-[#777] mb-[14px]">{description}</div>
          {children}
        </div>
      </div>
    </div>
  )
}
