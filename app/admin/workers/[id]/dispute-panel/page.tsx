'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'

/**
 * 관리자 분쟁방어 패널
 *
 * 8개 섹션:
 *  1. 헤더 요약 (근로자 기본 + 방어 점수)
 *  2. 방어 점수 (0-100, 증거 완비도 기준 — 법적 판단 아님)
 *  3. 문서 체크리스트
 *  4. 출퇴근·공수 이력
 *  5. 출퇴근 수정 이력
 *  6. 분쟁 케이스 목록
 *  7. 리스크 경고
 *  8. 조치 버튼 (새 케이스 개설, 스냅샷 저장)
 *
 * WORKER 접근 불가 — admin_token 세션에서만 표시됨
 * 모든 조회는 서버에서 감사 로그 기록
 */

interface Worker {
  id:             string
  name:           string
  phone:          string
  jobTitle:       string
  employmentType: string
  accountStatus:  string
  companyName:    string | null
  companyId:      string | null
  createdAt:      string
}

interface Contract {
  id:             string
  contractType:   string
  startDate:      string
  endDate:        string | null
  contractStatus: string
  createdAt:      string
}

interface DeliveryLog {
  id:             string
  documentType:   string
  deliveryMethod: string
  status:         string
  deliveredAt:    string | null
  createdAt:      string
}

interface AdjustmentLog {
  id:                 string
  attendanceRecordId: string
  field:              string
  beforeValue:        string | null
  afterValue:         string | null
  reason:             string
  adjustedBy:         string
  createdAt:          string
}

interface DisputeCase {
  id:          string
  disputeType: string
  status:      string
  title:       string
  openedAt:    string
  resolvedAt:  string | null
  defenseScore: number | null
  _count: { notes: number }
}

interface AttendanceRecord {
  id:        string
  workDate:  string
  checkInAt: string | null
  checkOutAt: string | null
  status:    string
}

type RiskLevel = 'OK' | 'WARN' | 'DANGER' | 'CRITICAL'

interface RiskItem {
  key:         string
  label:       string
  level:       RiskLevel
  action?:     string
  actionHref?: string
}

interface RiskSection {
  id:         string
  title:      string
  items:      RiskItem[]
  worstLevel: RiskLevel
}

interface PanelData {
  worker:             Worker
  defenseScore:       number
  riskSections:       RiskSection[]
  contracts:          Contract[]
  deliveryLogs:       DeliveryLog[]
  adjustmentLogs:     AdjustmentLog[]
  disputeCases:       DisputeCase[]
  recentAttendance:   AttendanceRecord[]
  warnings:           { id: string; warningLevel: string; reason: string; createdAt: string }[]
  explanations:       { id: string; subject: string; status: string; createdAt: string }[]
  notices:            { id: string; noticeType: string; title: string; deliveredAt: string | null }[]
  terminationReview:  { id: string; status: string; terminationReason: string | null; terminationDate: string | null; confirmedAt: string | null } | null
}

const DISPUTE_TYPE_LABEL: Record<string, string> = {
  WAGE:              '임금',
  ATTENDANCE:        '출퇴근',
  CONTRACT:          '계약',
  TERMINATION:       '종료/해고',
  DOCUMENT_DELIVERY: '문서 미교부',
}
const DISPUTE_STATUS_LABEL: Record<string, string> = {
  OPEN:       '진행 중',
  MONITORING: '모니터링',
  RESOLVED:   '해결됨',
  CLOSED:     '종결',
}
const DISPUTE_STATUS_COLOR: Record<string, string> = {
  OPEN:       '#e53935',
  MONITORING: '#ff9800',
  RESOLVED:   '#43a047',
  CLOSED:     '#9e9e9e',
}
const CONTRACT_TYPE_LABEL: Record<string, string> = {
  EMPLOYMENT: '근로계약',
  DAILY:      '일용계약',
  SERVICE:    '용역계약(3.3%)',
}
const DELIVERY_STATUS_LABEL: Record<string, string> = {
  DELIVERED: '교부완료',
  FAILED:    '교부실패',
  PENDING:   '교부대기',
  REJECTED:  '수령거부',
}
const DELIVERY_STATUS_COLOR: Record<string, string> = {
  DELIVERED: '#2e7d32',
  FAILED:    '#c62828',
  PENDING:   '#ff9800',
  REJECTED:  '#e53935',
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#2e7d32' : score >= 40 ? '#f57f17' : '#c62828'
  const label = score >= 70 ? '양호' : score >= 40 ? '주의' : '위험'
  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <svg width="120" height="70" viewBox="0 0 120 70">
          <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="#e0e0e0" strokeWidth="10" />
          <path
            d="M10 65 A50 50 0 0 1 110 65"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${(score / 100) * 157} 157`}
          />
        </svg>
        <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 900, color }}>{score}</div>
        </div>
      </div>
      <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 700, color }}>{label}</div>
      <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>증거 완비도 기준 (법적 판단 아님)</div>
    </div>
  )
}

export default function DisputePanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workerId } = use(params)

  const [data,          setData]          = useState<PanelData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [activeSection, setActiveSection] = useState<string>('overview')
  const [showNewCase,   setShowNewCase]   = useState(false)
  const [newCaseForm,   setNewCaseForm]   = useState({ disputeType: '', title: '', summary: '' })
  const [submitting,    setSubmitting]    = useState(false)

  useEffect(() => {
    fetch(`/api/admin/workers/${workerId}/dispute-panel`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [workerId])

  async function handleOpenCase() {
    if (!newCaseForm.disputeType || !newCaseForm.title) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/workers/${workerId}/dispute-panel`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(newCaseForm),
      })
      if (res.ok) {
        setShowNewCase(false)
        setNewCaseForm({ disputeType: '', title: '', summary: '' })
        const d = await fetch(`/api/admin/workers/${workerId}/dispute-panel`).then(r => r.json())
        setData(d)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>로딩 중...</div>
  if (!data)   return <div style={{ padding: '40px', textAlign: 'center', color: '#c62828' }}>데이터를 불러올 수 없습니다.</div>

  const { worker, defenseScore, riskSections, contracts, deliveryLogs, adjustmentLogs, disputeCases, recentAttendance } = data

  const openDisputes  = disputeCases.filter(d => d.status === 'OPEN')
  const criticalRisks = (riskSections ?? []).filter(s => s.worstLevel === 'CRITICAL')
  const dangerRisks   = (riskSections ?? []).filter(s => s.worstLevel === 'DANGER')

  const SECTIONS = [
    { id: 'overview',    label: '개요' },
    { id: 'risks',       label: `리스크 점검${criticalRisks.length > 0 ? ` 🚨${criticalRisks.length}` : dangerRisks.length > 0 ? ` ⚠️` : ''}` },
    { id: 'documents',   label: '문서 교부' },
    { id: 'attendance',  label: '출퇴근' },
    { id: 'adjustments', label: '수정 이력' },
    { id: 'disputes',    label: `분쟁 케이스${openDisputes.length > 0 ? ` (${openDisputes.length})` : ''}` },
  ]

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
      {/* 뒤로가기 */}
      <div style={{ marginBottom: '16px' }}>
        <Link href={`/admin/workers/${workerId}`} style={{ color: '#4A93C8', fontSize: '14px', textDecoration: 'none' }}>
          ← 근로자 상세로 돌아가기
        </Link>
      </div>

      {/* 헤더 */}
      <div style={{ background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{worker.name}</h1>
              {openDisputes.length > 0 && (
                <span style={{ background: '#ffebee', color: '#c62828', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>
                  진행 중 분쟁 {openDisputes.length}건
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.8' }}>
              <span>{worker.jobTitle}</span>
              {worker.companyName && <span> · {worker.companyName}</span>}
              <br />
              <span>{worker.phone}</span>
              <span style={{ marginLeft: '12px', background: '#1B2838', padding: '1px 8px', borderRadius: '4px', fontSize: '12px' }}>
                {worker.employmentType}
              </span>
            </div>
          </div>
          <ScoreGauge score={defenseScore} />
        </div>

        {/* 관리자 경고 박스 */}
        {defenseScore < 40 && (
          <div style={{ marginTop: '14px', background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#e65100' }}>
            <strong>주의:</strong> 방어 점수가 낮습니다. 계약서·문서 교부 이력을 보강하고 출퇴근 기록을 점검하세요.
          </div>
        )}
      </div>

      {/* 섹션 탭 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', overflowX: 'auto' }}>
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            style={{
              padding:      '8px 16px',
              border:       'none',
              borderRadius: '8px',
              background:   activeSection === sec.id ? '#1565c0' : '#f0f0f0',
              color:        activeSection === sec.id ? '#ffffff' : '#555',
              fontSize:     '13px',
              fontWeight:   activeSection === sec.id ? 700 : 400,
              cursor:       'pointer',
              whiteSpace:   'nowrap',
            }}
          >
            {sec.label}
          </button>
        ))}
        {/* 조치 버튼 */}
        <button
          onClick={() => setShowNewCase(true)}
          style={{ marginLeft: 'auto', padding: '8px 16px', background: '#e53935', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          + 분쟁 케이스 개설
        </button>
      </div>

      {/* 개요 */}
      {activeSection === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <StatCard label="계약 이력" value={`${contracts.length}건`} sub={contracts[0] ? `최근: ${CONTRACT_TYPE_LABEL[contracts[0].contractType] ?? contracts[0].contractType}` : '없음'} />
          <StatCard label="문서 교부 기록" value={`${deliveryLogs.filter(d => d.status === 'DELIVERED').length}건`} sub={`교부 문서 종류: ${new Set(deliveryLogs.filter(d => d.status === 'DELIVERED').map(d => d.documentType)).size}종`} />
          <StatCard label="출퇴근 기록 (90일)" value={`${recentAttendance.length}일`} sub={`수정 이력: ${adjustmentLogs.length}건`} />
          <StatCard label="분쟁 케이스" value={`${disputeCases.length}건`} sub={`진행 중: ${openDisputes.length}건`} accent={openDisputes.length > 0} />
        </div>
      )}

      {/* 리스크 점검 */}
      {activeSection === 'risks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {criticalRisks.length > 0 && (
            <div style={{ background: '#ffebee', border: '2px solid #e53935', borderRadius: '10px', padding: '14px 18px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#c62828', marginBottom: '6px' }}>
                🚨 치명 리스크 {criticalRisks.length}개 섹션 — 즉시 조치 필요
              </div>
              {criticalRisks.map(s => (
                <div key={s.id} style={{ fontSize: '13px', color: '#c62828' }}>
                  · {s.title}: {s.items.filter(i => i.level === 'CRITICAL').map(i => i.label).join(', ')}
                </div>
              ))}
            </div>
          )}

          {(riskSections ?? []).map(section => {
            const LEVEL_CFG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
              OK:       { color: '#2e7d32', bg: '#f1f8e9', border: '#c5e1a5', icon: '✅', label: '정상' },
              WARN:     { color: '#f57f17', bg: '#fffde7', border: '#fff176', icon: '⚠️', label: '주의' },
              DANGER:   { color: '#e65100', bg: '#fff3e0', border: '#ffcc80', icon: '🔶', label: '위험' },
              CRITICAL: { color: '#c62828', bg: '#ffebee', border: '#ef9a9a', icon: '🚨', label: '치명' },
            }
            const hdr = LEVEL_CFG[section.worstLevel]
            return (
              <div key={section.id} style={{ background: '#fff', border: `1px solid ${section.worstLevel !== 'OK' ? hdr.border : '#e0e0e0'}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: section.worstLevel !== 'OK' ? hdr.bg : '#fafafa' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{section.title}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: hdr.color, background: hdr.bg, border: `1px solid ${hdr.border}`, padding: '2px 10px', borderRadius: '20px' }}>
                    {hdr.icon} {hdr.label}
                  </span>
                </div>
                <div style={{ padding: '10px 16px' }}>
                  {section.items.map(item => {
                    const cfg = LEVEL_CFG[item.level]
                    return (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                        <span style={{ fontSize: '14px', width: '18px', flexShrink: 0 }}>{item.level === 'OK' ? '✅' : cfg.icon}</span>
                        <div style={{ flex: 1, fontSize: '13px', color: item.level === 'OK' ? '#555' : cfg.color, fontWeight: item.level !== 'OK' ? 600 : 400 }}>
                          {item.label}
                        </div>
                        {item.level !== 'OK' && item.action && (
                          <a
                            href={item.actionHref ?? `/admin/workers/${workerId}`}
                            style={{ fontSize: '12px', color: '#4A93C8', background: 'rgba(91,164,217,0.1)', padding: '3px 10px', borderRadius: '6px', textDecoration: 'none', flexShrink: 0 }}
                          >
                            {item.action} →
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 문서 교부 */}
      {activeSection === 'documents' && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>
            문서 교부 이력 ({deliveryLogs.length}건)
          </div>
          {deliveryLogs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#c62828', fontSize: '14px' }}>
              문서 교부 이력이 없습니다. 분쟁 발생 시 불리할 수 있습니다.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['문서 유형', '교부 방법', '상태', '교부일'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliveryLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '10px 16px' }}>{log.documentType}</td>
                    <td style={{ padding: '10px 16px', color: '#666' }}>{log.deliveryMethod}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ color: DELIVERY_STATUS_COLOR[log.status] ?? '#666', fontWeight: 700, fontSize: '12px' }}>
                        {DELIVERY_STATUS_LABEL[log.status] ?? log.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#718096', fontSize: '12px' }}>
                      {log.deliveredAt ? new Date(log.deliveredAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 출퇴근 이력 */}
      {activeSection === 'attendance' && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>
            출퇴근 이력 (최근 90일, {recentAttendance.length}건)
          </div>
          {recentAttendance.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#718096', fontSize: '14px' }}>출퇴근 기록이 없습니다.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['날짜', '출근', '퇴근', '상태'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentAttendance.map(rec => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{rec.workDate}</td>
                    <td style={{ padding: '10px 16px', color: '#555' }}>{rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td style={{ padding: '10px 16px', color: '#555' }}>{rec.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: rec.status === 'ADJUSTED' ? '#f57f17' : '#666' }}>{rec.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 수정 이력 */}
      {activeSection === 'adjustments' && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>
            출퇴근 수정 이력 ({adjustmentLogs.length}건)
          </div>
          {adjustmentLogs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#718096', fontSize: '14px' }}>수정 이력이 없습니다.</div>
          ) : (
            <div style={{ padding: '16px' }}>
              {adjustmentLogs.map(log => (
                <div key={log.id} style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{log.field}</span>
                    <span style={{ fontSize: '11px', color: '#999' }}>{new Date(log.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    <span style={{ textDecoration: 'line-through', color: '#c62828' }}>{log.beforeValue ?? '없음'}</span>
                    <span style={{ margin: '0 8px' }}>→</span>
                    <span style={{ color: '#2e7d32', fontWeight: 600 }}>{log.afterValue ?? '없음'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#555', marginTop: '6px' }}>
                    사유: {log.reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 분쟁 케이스 */}
      {activeSection === 'disputes' && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>
            분쟁 케이스 ({disputeCases.length}건)
          </div>
          {disputeCases.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#718096', fontSize: '14px' }}>분쟁 케이스가 없습니다.</div>
          ) : (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {disputeCases.map(dc => (
                <div key={dc.id} style={{ border: `1px solid ${DISPUTE_STATUS_COLOR[dc.status] ?? '#e0e0e0'}30`, borderLeft: `4px solid ${DISPUTE_STATUS_COLOR[dc.status] ?? '#e0e0e0'}`, borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontSize: '12px', background: '#f0f0f0', padding: '2px 8px', borderRadius: '4px', marginRight: '8px' }}>
                        {DISPUTE_TYPE_LABEL[dc.disputeType] ?? dc.disputeType}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 700 }}>{dc.title}</span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: DISPUTE_STATUS_COLOR[dc.status] ?? '#666' }}>
                      {DISPUTE_STATUS_LABEL[dc.status] ?? dc.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    개설: {new Date(dc.openedAt).toLocaleDateString('ko-KR')}
                    {dc.resolvedAt && ` · 해결: ${new Date(dc.resolvedAt).toLocaleDateString('ko-KR')}`}
                    <span style={{ marginLeft: '12px' }}>메모 {dc._count.notes}건</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 새 분쟁 케이스 모달 */}
      {showNewCase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px', margin: '16px' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 800 }}>분쟁 케이스 개설</h2>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>분쟁 유형</label>
              <select
                value={newCaseForm.disputeType}
                onChange={e => setNewCaseForm(f => ({ ...f, disputeType: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="">선택...</option>
                {Object.entries(DISPUTE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>제목</label>
              <input
                value={newCaseForm.title}
                onChange={e => setNewCaseForm(f => ({ ...f, title: e.target.value }))}
                placeholder="예: 2026-03 임금 지급 관련 이의제기"
                style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>요약 (선택)</label>
              <textarea
                value={newCaseForm.summary}
                onChange={e => setNewCaseForm(f => ({ ...f, summary: e.target.value }))}
                rows={3}
                style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowNewCase(false)} style={{ flex: 1, padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>취소</button>
              <button
                onClick={handleOpenCase}
                disabled={!newCaseForm.disputeType || !newCaseForm.title || submitting}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', background: (!newCaseForm.disputeType || !newCaseForm.title) ? '#bdbdbd' : '#e53935', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
              >
                {submitting ? '처리 중...' : '케이스 개설'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{ background: '#ffffff', border: `1px solid ${accent ? '#ffcdd2' : '#e0e0e0'}`, borderRadius: '12px', padding: '16px 20px' }}>
      <div style={{ fontSize: '12px', color: '#718096', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: accent ? '#c62828' : '#1a1a2e' }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>{sub}</div>
    </div>
  )
}
