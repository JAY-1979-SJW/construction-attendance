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
    <div className="flex min-h-screen bg-brand">
      <nav className="w-[220px] bg-brand-deeper py-6 flex-shrink-0 flex flex-col">
        <div className="text-white text-base font-bold px-5 pb-6 border-b border-white/10">해한 출퇴근</div>
        <div className="text-white/40 text-[11px] px-5 pt-4 pb-2 uppercase tracking-widest">관리</div>
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            className={`block px-5 py-2.5 text-[13px] no-underline ${item.href === '/admin/devices-anomaly' ? 'bg-white/10 text-white font-bold' : 'text-white/80'}`}>
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))}
          className="mx-5 mt-6 py-2.5 bg-white/10 border-none rounded-md text-white/60 cursor-pointer text-[13px]"
        >로그아웃</button>
      </nav>

      <main className="flex-1 p-8 overflow-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold m-0">이상행위 탐지</h1>
            <p className="text-[13px] text-muted-brand mt-1 mb-0">최근 30일간 기기 승인 + 공수 수정에서 이상 패턴을 탐지합니다.</p>
          </div>
          <div className="flex items-center gap-3">
            {lastFetched && (
              <span className="text-[12px] text-[#aaa]">
                마지막 조회: {lastFetched.toLocaleTimeString('ko-KR')}
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="px-5 py-2.5 bg-[#F47920] text-white border-none rounded-lg cursor-pointer text-[14px] font-semibold"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? '조회 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {msg && (
          <div className="bg-[#ffebee] text-[#c62828] rounded-lg px-4 py-3 mb-4 text-[14px]">
            {msg}
          </div>
        )}

        {/* 요약 카운트 */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {[
            { label: 'HIGH', count: high,   style: SEVERITY_STYLE.HIGH },
            { label: 'MEDIUM', count: medium, style: SEVERITY_STYLE.MEDIUM },
            { label: 'LOW',  count: low,   style: SEVERITY_STYLE.LOW },
          ].map(({ label, count, style }) => (
            <div key={label} className="rounded-[10px] px-6 py-[14px] min-w-[120px] text-center"
              style={{
                background: style.bg,
                border: `1px solid ${style.color}30`,
              }}>
              <div className="text-[28px] font-bold" style={{ color: style.color }}>{count}</div>
              <div className="text-[12px] font-semibold" style={{ color: style.color }}>{label}</div>
            </div>
          ))}
          <div className="bg-brand border border-white/10 rounded-[10px] px-6 py-[14px] min-w-[120px] text-center">
            <div className="text-[28px] font-bold text-muted-brand">{anomalies.length}</div>
            <div className="text-[12px] font-semibold text-muted-brand">전체</div>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-[#999]">탐지 중...</div>
          ) : anomalies.length === 0 ? (
            <div className="py-12 text-center text-[#999]">
              <div className="text-[40px] mb-3">✓</div>
              <div className="font-semibold mb-1">이상 행위가 탐지되지 않았습니다.</div>
              <div className="text-[13px]">최근 30일간 기기 승인 및 공수 수정 패턴이 정상입니다.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {['유형', '심각도', '업체/관리자', '근로자', '기기정보', '발생시각', '상세내용'].map(h => (
                      <th key={h} className="bg-brand px-[14px] py-3 text-left font-semibold text-muted-brand border-b border-[#e0e0e0] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a, i) => {
                    const sev = SEVERITY_STYLE[a.severity]
                    const typ = TYPE_STYLE[a.type]
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td className="px-[14px] py-3 border-b border-[rgba(91,164,217,0.1)] align-middle">
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
                        <td className="px-[14px] py-3 border-b border-[rgba(91,164,217,0.1)] align-middle">
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
                        <td className="px-[14px] py-3 border-b border-[rgba(91,164,217,0.1)] align-middle">
                          <div className="font-semibold text-[13px]">{a.companyName}</div>
                          <div className="text-[12px] text-muted-brand">{a.adminName}</div>
                        </td>
                        <td className="px-[14px] py-3 border-b border-[rgba(91,164,217,0.1)] align-middle text-[13px] max-w-[160px]">
                          <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {a.workerName}
                          </div>
                        </td>
                        <td className="px-[14px] py-3 border-b border-[rgba(91,164,217,0.1)] align-middle text-[12px] text-muted-brand max-w-[160px]">
                          <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {a.deviceInfo}
                          </div>
                        </td>
                        <td className="px-[14px] py-3 border-b border-[rgba(91,164,217,0.1)] align-middle text-[12px] text-muted-brand whitespace-nowrap">
                          {new Date(a.occurredAt).toLocaleString('ko-KR')}
                        </td>
                        <td className="px-[14px] py-3 border-b border-[rgba(91,164,217,0.1)] align-middle text-[12px] text-muted-brand max-w-[240px]">
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
