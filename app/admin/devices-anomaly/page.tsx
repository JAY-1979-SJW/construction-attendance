'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Severity = 'HIGH' | 'MEDIUM' | 'LOW'
type AnomalyType =
  | 'duplicate_device'
  | 'bulk_approval'
  | 'night_approval'
  | 'bulk_work_edit'
  | 'night_work_edit'
  | 'pre_settlement_edit'
  | 'repeated_work_edit'

interface AnomalyEvent {
  type: AnomalyType
  description: string
  companyName: string
  adminName: string
  workerName: string
  deviceInfo: string
  occurredAt: string
  severity: Severity
}

const TYPE_LABELS: Record<AnomalyType, string> = {
  duplicate_device:     '기기 중복',
  bulk_approval:        '대량 승인',
  night_approval:       '야간 승인',
  bulk_work_edit:       '공수 대량수정',
  night_work_edit:      '야간 공수수정',
  pre_settlement_edit:  '정산전 집중수정',
  repeated_work_edit:   '반복 공수수정',
}

const SEVERITY_STYLE: Record<Severity, { bg: string; color: string; label: string }> = {
  HIGH:   { bg: '#ffebee', color: '#c62828', label: 'HIGH' },
  MEDIUM: { bg: '#fff3e0', color: '#e65100', label: 'MEDIUM' },
  LOW:    { bg: '#fffde7', color: '#f9a825', label: 'LOW' },
}

const TYPE_STYLE: Record<AnomalyType, { bg: string; color: string }> = {
  duplicate_device:     { bg: '#fce4ec', color: '#880e4f' },
  bulk_approval:        { bg: '#e3f2fd', color: '#4A93C8' },
  night_approval:       { bg: '#f3e5f5', color: '#6a1b9a' },
  bulk_work_edit:       { bg: '#fbe9e7', color: '#bf360c' },
  night_work_edit:      { bg: '#e8eaf6', color: '#283593' },
  pre_settlement_edit:  { bg: '#fff8e1', color: '#ff6f00' },
  repeated_work_edit:   { bg: '#f1f8e9', color: '#33691e' },
}

export default function DevicesAnomalyPage() {
  const router = useRouter()
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/devices/anomalies')
      if (res.status === 401) { router.push('/admin/login'); return }
      if (res.status === 403) { setMsg('접근 권한이 없습니다.'); return }
      const data = await res.json()
      if (!res.ok) { setMsg(data.error ?? '불러오기 실패'); return }
      setAnomalies(data.data ?? [])
      setLastFetched(new Date())
    } catch {
      setMsg('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const high   = anomalies.filter(a => a.severity === 'HIGH').length
  const medium = anomalies.filter(a => a.severity === 'MEDIUM').length
  const low    = anomalies.filter(a => a.severity === 'LOW').length

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            style={{ ...s.navItem, ...(item.href === '/admin/devices-anomaly' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))}
          style={s.logoutBtn}
        >로그아웃</button>
      </nav>

      <main style={s.main}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={s.pageTitle}>이상행위 탐지</h1>
            <p style={{ fontSize: '13px', color: '#A0AEC0', margin: '4px 0 0' }}>최근 30일간 기기 승인 + 공수 수정에서 이상 패턴을 탐지합니다.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastFetched && (
              <span style={{ fontSize: '12px', color: '#aaa' }}>
                마지막 조회: {lastFetched.toLocaleTimeString('ko-KR')}
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? '조회 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {msg && (
          <div style={{ background: '#ffebee', color: '#c62828', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' }}>
            {msg}
          </div>
        )}

        {/* 요약 카운트 */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { label: 'HIGH', count: high,   style: SEVERITY_STYLE.HIGH },
            { label: 'MEDIUM', count: medium, style: SEVERITY_STYLE.MEDIUM },
            { label: 'LOW',  count: low,   style: SEVERITY_STYLE.LOW },
          ].map(({ label, count, style }) => (
            <div key={label} style={{
              background: style.bg,
              border: `1px solid ${style.color}30`,
              borderRadius: '10px',
              padding: '14px 24px',
              minWidth: '120px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: style.color }}>{count}</div>
              <div style={{ fontSize: '12px', color: style.color, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
          <div style={{
            background: '#1B2838',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            padding: '14px 24px',
            minWidth: '120px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#A0AEC0' }}>{anomalies.length}</div>
            <div style={{ fontSize: '12px', color: '#A0AEC0', fontWeight: 600 }}>전체</div>
          </div>
        </div>

        {/* 테이블 */}
        <div style={s.tableCard}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#999' }}>탐지 중...</div>
          ) : anomalies.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#999' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>이상 행위가 탐지되지 않았습니다.</div>
              <div style={{ fontSize: '13px' }}>최근 30일간 기기 승인 및 공수 수정 패턴이 정상입니다.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['유형', '심각도', '업체/관리자', '근로자', '기기정보', '발생시각', '상세내용'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a, i) => {
                    const sev = SEVERITY_STYLE[a.severity]
                    const typ = TYPE_STYLE[a.type]
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={s.td}>
                          <span style={{
                            background: typ.bg,
                            color: typ.color,
                            padding: '3px 10px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}>
                            {TYPE_LABELS[a.type]}
                          </span>
                        </td>
                        <td style={s.td}>
                          <span style={{
                            background: sev.bg,
                            color: sev.color,
                            padding: '3px 10px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}>
                            {sev.label}
                          </span>
                        </td>
                        <td style={s.td}>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{a.companyName}</div>
                          <div style={{ fontSize: '12px', color: '#A0AEC0' }}>{a.adminName}</div>
                        </td>
                        <td style={{ ...s.td, fontSize: '13px', maxWidth: '160px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.workerName}
                          </div>
                        </td>
                        <td style={{ ...s.td, fontSize: '12px', color: '#A0AEC0', maxWidth: '160px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.deviceInfo}
                          </div>
                        </td>
                        <td style={{ ...s.td, fontSize: '12px', color: '#A0AEC0', whiteSpace: 'nowrap' }}>
                          {new Date(a.occurredAt).toLocaleString('ko-KR')}
                        </td>
                        <td style={{ ...s.td, fontSize: '12px', color: '#A0AEC0', maxWidth: '240px' }}>
                          {a.description}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                           label: '대시보드' },
  { href: '/admin/companies',                 label: '회사 관리' },
  { href: '/admin/workers',                   label: '근로자 관리' },
  { href: '/admin/sites',                     label: '현장 관리' },
  { href: '/admin/attendance',                label: '출퇴근 조회' },
  { href: '/admin/presence-checks',           label: '체류확인 현황' },
  { href: '/admin/presence-report',           label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',        label: '근무확정' },
  { href: '/admin/contracts',                 label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility',     label: '보험판정' },
  { href: '/admin/wage-calculations',         label: '세금/노임 계산' },
  { href: '/admin/filing-exports',            label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',         label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',      label: '노무비 집계' },
  { href: '/admin/subcontractor-settlements', label: '협력사 정산' },
  { href: '/admin/document-center',           label: '서식 출력 센터' },
  { href: '/admin/month-closings',            label: '월마감' },
  { href: '/admin/corrections',               label: '정정 이력' },
  { href: '/admin/exceptions',                label: '예외 승인' },
  { href: '/admin/device-requests',           label: '기기 변경' },
  { href: '/admin/devices-anomaly',           label: '기기 이상 감지' },
]

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar:      { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0' },
  btn:          { padding: '10px 20px', background: '#F47920', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  tableCard:    { background: '#243144', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:           { background: '#1B2838', padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid #e0e0e0', whiteSpace: 'nowrap' },
  td:           { padding: '12px 14px', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'middle' },
}
