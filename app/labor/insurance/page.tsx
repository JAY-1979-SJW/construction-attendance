'use client'

import { useEffect, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InsuranceTarget {
  workerId: string
  workerName: string
  birthDate?: string
  workDays: number
  acquisitionDate?: string
  lossDate?: string
  reportingStatus: 'NOT_CHECKED' | 'VERIFIED' | 'ACQUISITION_REQUIRED' | 'LOSS_REQUIRED' | 'EXCEPTION_REVIEW_REQUIRED'
  nationalPensionEligible: boolean
  healthInsuranceEligible: boolean
  employmentInsuranceEligible: boolean
  industrialAccidentEligible: boolean
  notes?: string
}

interface SubmissionHistory {
  id: string
  monthKey: string
  submittedAt: string
  submittedBy: string
  targetCount: number
  type: '취득' | '상실' | '변경'
  status: '제출완료' | '반려' | '처리중'
}

type ActiveTab = 'targets' | 'history'

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORTING_LABEL: Record<InsuranceTarget['reportingStatus'], string> = {
  NOT_CHECKED: '미확인',
  VERIFIED: '확인완료',
  ACQUISITION_REQUIRED: '취득신고필요',
  LOSS_REQUIRED: '상실신고필요',
  EXCEPTION_REVIEW_REQUIRED: '예외확인필요',
}

const REPORTING_STYLE: Record<InsuranceTarget['reportingStatus'], { bg: string; color: string }> = {
  NOT_CHECKED:               { bg: '#F3F4F6', color: '#6B7280' },
  VERIFIED:                  { bg: '#F0FDF4', color: '#16A34A' },
  ACQUISITION_REQUIRED:      { bg: '#EFF6FF', color: '#2563EB' },
  LOSS_REQUIRED:             { bg: '#FFFBEB', color: '#D97706' },
  EXCEPTION_REVIEW_REQUIRED: { bg: '#FEF2F2', color: '#DC2626' },
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  )
}

function Check({ v }: { v: boolean }) {
  return v
    ? <span className="text-[#16A34A] font-medium">●</span>
    : <span className="text-[#D1D5DB]">○</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsurancePage() {
  const [tab, setTab] = useState<ActiveTab>('targets')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [statusFilter, setStatusFilter] = useState<InsuranceTarget['reportingStatus'] | ''>('')
  const [targets, setTargets] = useState<InsuranceTarget[]>([])
  const [history, setHistory] = useState<SubmissionHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const endpoint =
      tab === 'targets'
        ? `/api/labor/insurance?month=${month}&status=${statusFilter}`
        : `/api/labor/insurance/history?month=${month}`
    fetch(endpoint)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          if (tab === 'targets') setTargets(res.data)
          else setHistory(res.data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab, month, statusFilter])

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A]">4대보험 관리</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">신고 대상자·취득/상실 반영·제출 이력</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-[13px] border border-[#E5E7EB] rounded-[8px] px-3 py-1.5 focus:outline-none focus:border-[#F97316]"
        />
      </div>

      {/* 회사 기준 안내 */}
      <div
        className="flex items-start gap-2 rounded-[10px] px-4 py-3 mb-4 text-[12px] text-[#374151]"
        style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="10" stroke="#F97316" strokeWidth="2"/>
          <path d="M12 8v4M12 16h.01" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span>
          <strong className="text-[#C2410C]">4대보험 상태는 현장별이 아니라 회사 기준으로 관리됩니다.</strong>
          {' '}동일 근로자가 여러 현장에 배정된 경우에도 보험 신고는 회사 단위로 1건 처리됩니다.
          현장별 노무현황은 <span className="text-[#F97316] font-medium">현장별 노무현황</span> 메뉴에서 확인하세요.
        </span>
      </div>

      {/* 탭 */}
      <div
        className="flex gap-0 mb-4 rounded-[8px] overflow-hidden self-start w-fit"
        style={{ border: '1px solid #E5E7EB' }}
      >
        {(['targets', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 text-[12px] transition-colors"
            style={{
              background: tab === t ? '#F97316' : '#FFFFFF',
              color: tab === t ? '#FFFFFF' : '#6B7280',
            }}
          >
            {t === 'targets' ? '신고 대상자' : '제출 이력'}
          </button>
        ))}
      </div>

      {tab === 'targets' && (
        <>
          {/* 필터 */}
          <div className="flex items-center gap-2 mb-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InsuranceTarget['reportingStatus'] | '')}
              className="text-[12px] border border-[#E5E7EB] rounded-[8px] px-2 py-1.5 focus:outline-none focus:border-[#F97316] text-[#374151]"
            >
              <option value="">신고 상태 전체</option>
              <option value="NOT_CHECKED">미확인</option>
              <option value="ACQUISITION_REQUIRED">취득신고필요</option>
              <option value="LOSS_REQUIRED">상실신고필요</option>
              <option value="EXCEPTION_REVIEW_REQUIRED">예외확인필요</option>
              <option value="VERIFIED">확인완료</option>
            </select>
            <span className="text-[12px] text-[#9CA3AF] ml-auto">{targets.length}명</span>
          </div>

          {/* 테이블 */}
          <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            <table className="w-full text-[12px]">
              <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">근로자명</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">근무일수</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">국민연금</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">건강보험</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">고용보험</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">산재보험</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">취득일</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">상실일</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">신고 상태</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-3.5 bg-[#F3F4F6] rounded animate-pulse" style={{ width: j === 0 ? 64 : 36 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : targets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-[#9CA3AF]">
                      신고 대상자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  targets.map((t) => {
                    const rs = REPORTING_STYLE[t.reportingStatus]
                    return (
                      <tr
                        key={t.workerId}
                        style={{ borderBottom: '1px solid #F3F4F6' }}
                        className="hover:bg-[#FAFAFA]"
                      >
                        <td className="px-3 py-2.5 font-medium text-[#0F172A]">{t.workerName}</td>
                        <td className="px-3 py-2.5 text-center text-[#374151]">{t.workDays}일</td>
                        <td className="px-3 py-2.5 text-center"><Check v={t.nationalPensionEligible} /></td>
                        <td className="px-3 py-2.5 text-center"><Check v={t.healthInsuranceEligible} /></td>
                        <td className="px-3 py-2.5 text-center"><Check v={t.employmentInsuranceEligible} /></td>
                        <td className="px-3 py-2.5 text-center"><Check v={t.industrialAccidentEligible} /></td>
                        <td className="px-3 py-2.5 text-[#6B7280]">{t.acquisitionDate ?? '-'}</td>
                        <td className="px-3 py-2.5 text-[#6B7280]">{t.lossDate ?? '-'}</td>
                        <td className="px-3 py-2.5">
                          <Badge label={REPORTING_LABEL[t.reportingStatus]} bg={rs.bg} color={rs.color} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <table className="w-full text-[12px]">
            <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">신고월</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">신고 유형</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280]">대상 인원</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">제출자</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">제출일시</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280]">처리 상태</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-3.5 bg-[#F3F4F6] rounded animate-pulse" style={{ width: 72 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#9CA3AF]">
                    제출 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-[#FAFAFA]">
                    <td className="px-3 py-2.5 text-[#374151]">{h.monthKey}</td>
                    <td className="px-3 py-2.5 text-[#374151]">{h.type}</td>
                    <td className="px-3 py-2.5 text-center text-[#374151]">{h.targetCount}명</td>
                    <td className="px-3 py-2.5 text-[#6B7280]">{h.submittedBy}</td>
                    <td className="px-3 py-2.5 text-[#6B7280]">{h.submittedAt}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[11px] font-medium"
                        style={{
                          color:
                            h.status === '제출완료'
                              ? '#16A34A'
                              : h.status === '반려'
                              ? '#DC2626'
                              : '#D97706',
                        }}
                      >
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
