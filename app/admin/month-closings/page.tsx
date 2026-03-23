'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PrecheckResult {
  canClose: boolean
  errors: string[]
  warnings: string[]
  summary: {
    totalWorkers: number
    draftConfirmations: number
    missingInsurance: number
    missingWage: number
    missingRetirement: number
    missingExports: number
  }
}

interface MonthClosing {
  id: string
  monthKey: string
  status: 'OPEN' | 'CLOSING' | 'CLOSED' | 'REOPENED'
  closedAt: string | null
  closedBy: string | null
  reopenedAt: string | null
  reopenReason: string | null
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const statusColor: Record<string, React.CSSProperties> = {
  OPEN:     { background: 'rgba(91,164,217,0.1)', color: '#A0AEC0' },
  CLOSING:  { background: '#fff8e1', color: '#f9a825' },
  CLOSED:   { background: '#e8f5e9', color: '#2e7d32' },
  REOPENED: { background: '#fff3e0', color: '#e65100' },
}

const statusLabel: Record<string, string> = {
  OPEN:     '미마감',
  CLOSING:  '마감 중',
  CLOSED:   '마감 완료',
  REOPENED: '재오픈',
}

export default function MonthClosingsPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [closing, setClosing] = useState<MonthClosing | null>(null)
  const [precheck, setPrecheck] = useState<PrecheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [msg, setMsg] = useState('')

  const fetchClosing = useCallback(async () => {
    const res = await fetch(`/api/admin/month-closings?monthKey=${monthKey}`)
    const data = await res.json()
    if (!data.success) { router.push('/admin/login'); return }
    setClosing(data.data?.closings?.[0] ?? null)
  }, [monthKey, router])

  useEffect(() => {
    fetchClosing()
    setPrecheck(null)
    setMsg('')
  }, [monthKey, fetchClosing])

  const runPrecheck = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/month-closings/precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey }),
      })
      const data = await res.json()
      setPrecheck(data.data ?? data)
    } finally {
      setLoading(false)
    }
  }

  const runClose = async () => {
    if (!precheck?.canClose) return
    if (!confirm(`${monthKey} 월을 마감하시겠습니까?`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/month-closings/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`완료: ${data.message ?? '마감 처리되었습니다'}`)
        fetchClosing()
      } else {
        setMsg(`오류: ${data.error ?? '마감 실패'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const runReopen = async () => {
    if (!reopenReason.trim()) { alert('재오픈 사유를 입력하세요.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/month-closings/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, reason: reopenReason }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`완료: ${data.message ?? '재오픈 처리되었습니다'}`)
        setShowReopenModal(false)
        setReopenReason('')
        fetchClosing()
      } else {
        setMsg(`오류: ${data.error ?? '재오픈 실패'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const currentStatus = closing?.status ?? 'OPEN'
  const isClosed = closing?.status === 'CLOSED'

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(item.href === '/admin/month-closings' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>월마감 관리</h1>

        {/* 월 선택 + 상태 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            style={s.input}
          />
          <span style={{ ...s.badge, ...statusColor[currentStatus] }}>
            {statusLabel[currentStatus]}
          </span>
        </div>

        {/* 마감 정보 박스 */}
        {closing?.status === 'CLOSED' && (
          <div style={{ ...s.infoBox, background: '#e8f5e9', borderColor: '#a5d6a7', color: '#2e7d32', marginBottom: '16px' }}>
            마감일시: {closing.closedAt ? new Date(closing.closedAt).toLocaleString('ko-KR') : '-'}
            {closing.closedBy && <span style={{ marginLeft: '16px', fontSize: '12px' }}>처리자: {closing.closedBy}</span>}
          </div>
        )}
        {closing?.status === 'REOPENED' && (
          <div style={{ ...s.infoBox, background: '#fff3e0', borderColor: '#ffcc80', color: '#e65100', marginBottom: '16px' }}>
            재오픈 사유: {closing.reopenReason}
            <br />
            재오픈 일시: {closing.reopenedAt ? new Date(closing.reopenedAt).toLocaleString('ko-KR') : '-'}
          </div>
        )}

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={runPrecheck}
            disabled={loading}
            style={{ ...s.btn, background: '#F47920', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '처리 중...' : '사전검사 실행'}
          </button>
          <button
            onClick={runClose}
            disabled={loading || !precheck?.canClose || isClosed}
            style={{ ...s.btn, background: '#2e7d32', opacity: (loading || !precheck?.canClose || isClosed) ? 0.5 : 1 }}
          >
            마감 실행
          </button>
          <button
            onClick={() => setShowReopenModal(true)}
            disabled={loading || !isClosed}
            style={{ ...s.btn, background: '#e65100', opacity: (loading || !isClosed) ? 0.5 : 1 }}
          >
            재오픈
          </button>
        </div>

        {msg && (
          <div style={{
            ...s.msg,
            background: msg.startsWith('오류') ? '#ffebee' : '#e8f5e9',
            color: msg.startsWith('오류') ? '#c62828' : '#2e7d32',
          }}>
            {msg}
          </div>
        )}

        {/* 사전검사 결과 */}
        {precheck && (
          <div style={s.tableCard}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>
              사전검사 결과
            </div>
            <div style={{ padding: '20px' }}>

              {/* 요약 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: '전체 근로자', value: precheck.summary.totalWorkers, warn: false },
                  { label: '미확정 근무', value: precheck.summary.draftConfirmations, warn: precheck.summary.draftConfirmations > 0 },
                  { label: '보험 미생성', value: precheck.summary.missingInsurance, warn: precheck.summary.missingInsurance > 0 },
                  { label: '세금 미생성', value: precheck.summary.missingWage, warn: precheck.summary.missingWage > 0 },
                  { label: '퇴직공제 미생성', value: precheck.summary.missingRetirement, warn: precheck.summary.missingRetirement > 0 },
                  { label: '신고자료 미생성', value: precheck.summary.missingExports, warn: precheck.summary.missingExports > 0 },
                ].map((card) => (
                  <div key={card.label} style={{
                    ...s.summaryCard,
                    borderTop: `4px solid ${card.warn ? '#e53935' : '#e0e0e0'}`,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: card.warn ? '#e53935' : '#333' }}>
                      {card.value}
                    </div>
                    <div style={{ fontSize: '12px', color: '#A0AEC0' }}>{card.label}</div>
                  </div>
                ))}
              </div>

              {/* 오류 */}
              {precheck.errors.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#c62828', marginBottom: '6px' }}>
                    오류 (마감 불가)
                  </div>
                  {precheck.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#c62828', background: '#ffebee', padding: '8px 12px', borderRadius: '6px', marginBottom: '4px' }}>
                      x {e}
                    </div>
                  ))}
                </div>
              )}

              {/* 경고 */}
              {precheck.warnings.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f57f17', marginBottom: '6px' }}>
                    경고
                  </div>
                  {precheck.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#f57f17', background: '#fff8e1', padding: '8px 12px', borderRadius: '6px', marginBottom: '4px' }}>
                      ! {w}
                    </div>
                  ))}
                </div>
              )}

              {precheck.canClose && (
                <div style={{ fontSize: '13px', color: '#2e7d32', background: '#e8f5e9', padding: '10px 16px', borderRadius: '6px' }}>
                  모든 필수 조건이 충족되었습니다. 마감을 진행할 수 있습니다.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 재오픈 모달 */}
      {showReopenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#243144', borderRadius: '12px', padding: '24px', width: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>재오픈 사유 입력</h3>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="재오픈 사유를 입력하세요"
              style={{ width: '100%', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', padding: '10px', height: '96px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => { setShowReopenModal(false); setReopenReason('') }}
                style={{ padding: '8px 16px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', background: '#243144', cursor: 'pointer', fontSize: '13px' }}
              >
                취소
              </button>
              <button
                onClick={runReopen}
                disabled={loading || !reopenReason.trim()}
                style={{ ...s.btn, background: '#e65100', opacity: (loading || !reopenReason.trim()) ? 0.5 : 1, fontSize: '13px' }}
              >
                재오픈
              </button>
            </div>
          </div>
        </div>
      )}
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

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar:      { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 24px' },
  input:        { padding: '8px 10px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '14px', background: '#243144' },
  btn:          { padding: '8px 16px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  msg:          { padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' },
  badge:        { padding: '4px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 600 },
  infoBox:      { padding: '12px 16px', borderRadius: '8px', border: '1px solid', fontSize: '13px', lineHeight: '1.6' },
  summaryCard:  { background: '#243144', borderRadius: '10px', padding: '16px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  tableCard:    { background: '#243144', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#CBD5E0', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'top' as const },
  tr:           { cursor: 'default' },
}
