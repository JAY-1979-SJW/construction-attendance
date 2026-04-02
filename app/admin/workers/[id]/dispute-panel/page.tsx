'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Modal } from '@/components/admin/ui'

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
    <div className="text-center p-5">
      <div className="relative inline-block">
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
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
          <div style={{ fontSize: '24px', fontWeight: 900, color }}>{score}</div>
        </div>
      </div>
      <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 700, color }}>{label}</div>
      <div className="text-[11px] text-[#718096] mt-0.5">증거 완비도 기준 (법적 판단 아님)</div>
    </div>
  )
}

export default function DisputePanelPage() {
  const { id: workerId } = useParams<{ id: string }>()

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

  if (loading) return <div className="p-10 text-center text-[#999]">로딩 중...</div>
  if (!data)   return <div className="p-10 text-center text-[#c62828]">데이터를 불러올 수 없습니다.</div>

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
    <div className="max-w-[900px] mx-auto px-4 py-6">
      {/* 뒤로가기 */}
      <div className="mb-4">
        <Link href={`/admin/workers/${workerId}`} className="text-secondary-brand text-sm no-underline">
          ← 근로자 상세로 돌아가기
        </Link>
      </div>

      {/* 헤더 */}
      <div className="bg-card border border-brand rounded-[12px] p-5 mb-4">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="m-0 text-xl font-black">{worker.name}</h1>
              {openDisputes.length > 0 && (
                <span className="bg-red-light text-[#c62828] text-[11px] font-bold px-2 py-0.5 rounded-full">
                  진행 중 분쟁 {openDisputes.length}건
                </span>
              )}
            </div>
            <div className="text-[13px] text-muted-brand leading-[1.8]">
              <span>{worker.jobTitle}</span>
              {worker.companyName && <span> · {worker.companyName}</span>}
              <br />
              <span>{worker.phone}</span>
              <span className="ml-3 bg-brand px-2 py-px rounded text-[12px]">
                {worker.employmentType}
              </span>
            </div>
          </div>
          <ScoreGauge score={defenseScore} />
        </div>

        {/* 관리자 경고 박스 */}
        {defenseScore < 40 && (
          <div className="mt-3.5 bg-[#fff3e0] border border-[#ffcc80] rounded-lg px-3.5 py-2.5 text-[13px] text-accent-hover">
            <strong>주의:</strong> 방어 점수가 낮습니다. 계약서·문서 교부 이력을 보강하고 출퇴근 기록을 점검하세요.
          </div>
        )}
      </div>

      {/* 섹션 탭 */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className="px-4 py-2 border-none rounded-lg text-[13px] whitespace-nowrap cursor-pointer"
            style={{
              background: activeSection === sec.id ? '#1565c0' : '#f0f0f0',
              color:      activeSection === sec.id ? '#ffffff' : '#555',
              fontWeight: activeSection === sec.id ? 700 : 400,
            }}
          >
            {sec.label}
          </button>
        ))}
        {/* 조치 버튼 */}
        <button
          onClick={() => setShowNewCase(true)}
          className="ml-auto px-4 py-2 bg-[#e53935] text-white border-none rounded-lg text-[13px] font-bold cursor-pointer whitespace-nowrap"
        >
          + 분쟁 케이스 개설
        </button>
      </div>

      {/* 개요 */}
      {activeSection === 'overview' && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <StatCard label="계약 이력" value={`${contracts.length}건`} sub={contracts[0] ? `최근: ${CONTRACT_TYPE_LABEL[contracts[0].contractType] ?? contracts[0].contractType}` : '없음'} />
          <StatCard label="문서 교부 기록" value={`${deliveryLogs.filter(d => d.status === 'DELIVERED').length}건`} sub={`교부 문서 종류: ${new Set(deliveryLogs.filter(d => d.status === 'DELIVERED').map(d => d.documentType)).size}종`} />
          <StatCard label="출퇴근 기록 (90일)" value={`${recentAttendance.length}일`} sub={`수정 이력: ${adjustmentLogs.length}건`} />
          <StatCard label="분쟁 케이스" value={`${disputeCases.length}건`} sub={`진행 중: ${openDisputes.length}건`} accent={openDisputes.length > 0} />
        </div>
      )}

      {/* 리스크 점검 */}
      {activeSection === 'risks' && (
        <div className="flex flex-col gap-3">
          {criticalRisks.length > 0 && (
            <div className="bg-red-light border-2 border-[#e53935] rounded-[10px] px-4 py-3.5">
              <div className="text-[14px] font-black text-[#c62828] mb-1.5">
                🚨 치명 리스크 {criticalRisks.length}개 섹션 — 즉시 조치 필요
              </div>
              {criticalRisks.map(s => (
                <div key={s.id} className="text-[13px] text-[#c62828]">
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
              <div key={section.id} className="bg-card rounded-[12px] overflow-hidden"
                style={{ border: `1px solid ${section.worstLevel !== 'OK' ? hdr.border : '#e0e0e0'}` }}>
                <div className="px-4 py-3.5 border-b border-brand flex justify-between items-center"
                  style={{ background: section.worstLevel !== 'OK' ? hdr.bg : '#fafafa' }}>
                  <span className="font-bold text-[14px]">{section.title}</span>
                  <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full"
                    style={{ color: hdr.color, background: hdr.bg, border: `1px solid ${hdr.border}` }}>
                    {hdr.icon} {hdr.label}
                  </span>
                </div>
                <div className="px-4 py-2.5">
                  {section.items.map(item => {
                    const cfg = LEVEL_CFG[item.level]
                    return (
                      <div key={item.key} className="flex items-center gap-2.5 py-2 border-b border-brand">
                        <span className="text-[14px] w-[18px] shrink-0">{item.level === 'OK' ? '✅' : cfg.icon}</span>
                        <div className="flex-1 text-[13px]"
                          style={{ color: item.level === 'OK' ? '#555' : cfg.color, fontWeight: item.level !== 'OK' ? 600 : 400 }}>
                          {item.label}
                        </div>
                        {item.level !== 'OK' && item.action && (
                          <a
                            href={item.actionHref ?? `/admin/workers/${workerId}`}
                            className="text-[12px] text-secondary-brand bg-[rgba(91,164,217,0.1)] px-2.5 py-0.5 rounded-md no-underline shrink-0"
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
        <div className="bg-card border border-brand rounded-[12px] overflow-hidden">
          <div className="px-5 py-4 border-b border-brand font-bold text-[14px]">
            문서 교부 이력 ({deliveryLogs.length}건)
          </div>
          {deliveryLogs.length === 0 ? (
            <div className="p-10 text-center text-[#c62828] text-[14px]">
              문서 교부 이력이 없습니다. 분쟁 발생 시 불리할 수 있습니다.
            </div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface">
                  {['문서 유형', '교부 방법', '상태', '교부일'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliveryLogs.map(log => (
                  <tr key={log.id} className="border-b border-brand">
                    <td className="px-4 py-2.5">{log.documentType}</td>
                    <td className="px-4 py-2.5 text-muted-brand">{log.deliveryMethod}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[12px] font-bold" style={{ color: DELIVERY_STATUS_COLOR[log.status] ?? '#666' }}>
                        {DELIVERY_STATUS_LABEL[log.status] ?? log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#718096] text-[12px]">
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
        <div className="bg-card border border-brand rounded-[12px] overflow-hidden">
          <div className="px-5 py-4 border-b border-brand font-bold text-[14px]">
            출퇴근 이력 (최근 90일, {recentAttendance.length}건)
          </div>
          {recentAttendance.length === 0 ? (
            <div className="p-10 text-center text-[#718096] text-[14px]">출퇴근 기록이 없습니다.</div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface">
                  {['날짜', '출근', '퇴근', '상태'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentAttendance.map(rec => (
                  <tr key={rec.id} className="border-b border-brand">
                    <td className="px-4 py-2.5 font-semibold">{rec.workDate}</td>
                    <td className="px-4 py-2.5 text-muted-brand">{rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-2.5 text-muted-brand">{rec.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: rec.status === 'ADJUSTED' ? '#f57f17' : '#666' }}>{rec.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 수정 이력 */}
      {activeSection === 'adjustments' && (
        <div className="bg-card border border-brand rounded-[12px] overflow-hidden">
          <div className="px-5 py-4 border-b border-brand font-bold text-[14px]">
            출퇴근 수정 이력 ({adjustmentLogs.length}건)
          </div>
          {adjustmentLogs.length === 0 ? (
            <div className="p-10 text-center text-[#718096] text-[14px]">수정 이력이 없습니다.</div>
          ) : (
            <div className="p-4">
              {adjustmentLogs.map(log => (
                <div key={log.id} className="border border-brand rounded-lg p-3 mb-2.5">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[13px] font-bold">{log.field}</span>
                    <span className="text-[11px] text-[#999]">{new Date(log.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div className="text-[12px] text-muted-brand">
                    <span className="line-through text-[#c62828]">{log.beforeValue ?? '없음'}</span>
                    <span className="mx-2">→</span>
                    <span className="text-[#2e7d32] font-semibold">{log.afterValue ?? '없음'}</span>
                  </div>
                  <div className="text-[12px] text-muted-brand mt-1.5">
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
        <div className="bg-card border border-brand rounded-[12px] overflow-hidden">
          <div className="px-5 py-4 border-b border-brand font-bold text-[14px]">
            분쟁 케이스 ({disputeCases.length}건)
          </div>
          {disputeCases.length === 0 ? (
            <div className="p-10 text-center text-[#718096] text-[14px]">분쟁 케이스가 없습니다.</div>
          ) : (
            <div className="p-4 flex flex-col gap-3">
              {disputeCases.map(dc => (
                <div key={dc.id} className="rounded-lg p-3.5"
                  style={{
                    border: `1px solid ${DISPUTE_STATUS_COLOR[dc.status] ?? '#e0e0e0'}30`,
                    borderLeft: `4px solid ${DISPUTE_STATUS_COLOR[dc.status] ?? '#e0e0e0'}`,
                  }}>
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <span className="text-[12px] bg-footer px-2 py-0.5 rounded mr-2">
                        {DISPUTE_TYPE_LABEL[dc.disputeType] ?? dc.disputeType}
                      </span>
                      <span className="text-[14px] font-bold">{dc.title}</span>
                    </div>
                    <span className="text-[12px] font-bold" style={{ color: DISPUTE_STATUS_COLOR[dc.status] ?? '#666' }}>
                      {DISPUTE_STATUS_LABEL[dc.status] ?? dc.status}
                    </span>
                  </div>
                  <div className="text-[12px] text-[#999]">
                    개설: {new Date(dc.openedAt).toLocaleDateString('ko-KR')}
                    {dc.resolvedAt && ` · 해결: ${new Date(dc.resolvedAt).toLocaleDateString('ko-KR')}`}
                    <span className="ml-3">메모 {dc._count.notes}건</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 새 분쟁 케이스 모달 */}
      <Modal open={showNewCase} onClose={() => setShowNewCase(false)} title="분쟁 케이스 개설">
        <div className="mb-3.5">
          <label className="block text-[13px] font-bold mb-1.5">분쟁 유형</label>
          <select
            value={newCaseForm.disputeType}
            onChange={e => setNewCaseForm(f => ({ ...f, disputeType: e.target.value }))}
            className="w-full px-2.5 py-2.5 border border-white/[0.12] rounded-lg text-[14px]"
          >
            <option value="">선택...</option>
            {Object.entries(DISPUTE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="mb-3.5">
          <label className="block text-[13px] font-bold mb-1.5">제목</label>
          <input
            value={newCaseForm.title}
            onChange={e => setNewCaseForm(f => ({ ...f, title: e.target.value }))}
            placeholder="예: 2026-03 임금 지급 관련 이의제기"
            className="w-full px-2.5 py-2.5 border border-white/[0.12] rounded-lg text-[14px] box-border"
          />
        </div>
        <div className="mb-5">
          <label className="block text-[13px] font-bold mb-1.5">요약 (선택)</label>
          <textarea
            value={newCaseForm.summary}
            onChange={e => setNewCaseForm(f => ({ ...f, summary: e.target.value }))}
            rows={3}
            className="w-full px-2.5 py-2.5 border border-white/[0.12] rounded-lg text-[14px] resize-y box-border"
          />
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => setShowNewCase(false)} className="flex-1 py-3 border border-white/[0.12] rounded-lg bg-card cursor-pointer text-[14px]">취소</button>
          <button
            onClick={handleOpenCase}
            disabled={!newCaseForm.disputeType || !newCaseForm.title || submitting}
            className="flex-1 py-3 border-none rounded-lg text-white cursor-pointer text-[14px] font-bold"
            style={{ background: (!newCaseForm.disputeType || !newCaseForm.title) ? '#bdbdbd' : '#e53935' }}
          >
            {submitting ? '처리 중...' : '케이스 개설'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-card rounded-[12px] p-5" style={{ border: `1px solid ${accent ? '#ffcdd2' : '#e0e0e0'}` }}>
      <div className="text-[12px] text-[#718096] mb-1.5">{label}</div>
      <div className="text-[22px] font-black" style={{ color: accent ? '#c62828' : '#1a1a2e' }}>{value}</div>
      <div className="text-[12px] text-[#718096] mt-1">{sub}</div>
    </div>
  )
}
