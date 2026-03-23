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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800 }}>관리자 출력물 센터</h1>
      <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#A0AEC0' }}>
        출력물을 선택하고 인쇄 또는 PDF로 저장하세요. 모든 출력물은 Ctrl+P (또는 인쇄 버튼)으로 PDF 저장 가능합니다.
      </p>

      {/* 1. 일일 출퇴근 현황 */}
      <PrintCard
        title="일일 출퇴근 현황"
        description="특정 날짜의 전체 출퇴근 기록을 출력합니다. 현장별 필터 가능."
        icon="📋"
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>날짜 *</label>
            <input
              type="date"
              value={dailyDate}
              onChange={e => setDailyDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>현장 ID (선택)</label>
            <input
              type="text"
              value={dailySiteId}
              onChange={e => setDailySiteId(e.target.value)}
              placeholder="비우면 전체"
              style={{ ...inputStyle, width: '160px' }}
            />
          </div>
          <button onClick={openDailyAttendance} disabled={!dailyDate} style={printBtnStyle(!dailyDate)}>
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
          style={{ ...printBtnStyle(false), textDecoration: 'none', display: 'inline-block' }}
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
          style={{ ...printBtnStyle(false), textDecoration: 'none', display: 'inline-block' }}
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
          style={{ ...printBtnStyle(false), textDecoration: 'none', display: 'inline-block' }}
        >
          예외 처리 센터로 →
        </a>
      </PrintCard>

      {/* 5. 종료 증빙 패키지 안내 */}
      <div style={{ background: '#1B2838', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '18px 20px', marginTop: '16px' }}>
        <div style={{ fontSize: '14px', color: '#A0AEC0' }}>
          💼 <strong>종료 증빙 패키지</strong>는 개별 근로자 종료 처리 화면에서 출력할 수 있습니다.
          <br />
          <span style={{ fontSize: '12px' }}>경로: 관리자 → 근로자 상세 → 종료 처리 → 종료 완료 후 &ldquo;종료 증빙 패키지 보기&rdquo; 버튼</span>
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
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{ fontSize: '28px', flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>{title}</div>
          <div style={{ fontSize: '13px', color: '#777', marginBottom: '14px' }}>{description}</div>
          {children}
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px', color: '#555' }
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '13px', outline: 'none' }

function printBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '9px 20px', background: disabled ? '#bdbdbd' : '#263238', color: '#fff',
    border: 'none', borderRadius: '6px', fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
  }
}
