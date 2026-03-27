'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FloatingToast } from '@/components/admin/ui'

// ── 타입 ─────────────────────────────────────────────────────
interface WageSummaryItem {
  workerId: string
  workerName: string
  jobTitle: string
  siteId: string
  siteName: string
  contractId: string | null
  dailyWage: number
  totalUnits: number
  confirmedUnits: number
  draftUnits: number
  totalAmount: number
  draftCount: number
  confirmedCount: number
  invalidCount: number
  status: 'DRAFT' | 'CONFIRMED' | 'CLOSED'
}

interface WageTotals {
  workerCount: number
  totalMandays: number
  totalAmount: number
}

interface RateItem {
  workerId: string
  workerName: string
  jobTitle: string
  contractId: string | null
  dailyWage: number
  hasContract: boolean
}

interface Site { id: string; name: string }

type Tab = 'summary' | 'rates'

// ── 헬퍼 ─────────────────────────────────────────────────────
function getMonthKey() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7)
}

const fmt = (n: number) => n.toLocaleString('ko-KR')
const fmtWon = (n: number) => fmt(n) + '원'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '집계중', CONFIRMED: '검토완료', CLOSED: '마감완료',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#e65100', CONFIRMED: '#1565c0', CLOSED: '#2e7d32',
}
const STATUS_BG: Record<string, string> = {
  DRAFT: '#fff3e0', CONFIRMED: '#e3f2fd', CLOSED: '#e8f5e9',
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function WagePage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [siteId, setSiteId]     = useState('')
  const [tab, setTab]           = useState<Tab>('summary')
  const [sites, setSites]       = useState<Site[]>([])

  // 노임 집계
  const [items, setItems]   = useState<WageSummaryItem[]>([])
  const [totals, setTotals] = useState<WageTotals | null>(null)
  const [closingStatus, setClosingStatus] = useState('OPEN')
  const [loading, setLoading] = useState(false)

  // 단가 관리
  const [rates, setRates]       = useState<RateItem[]>([])
  const [ratesLoading, setRatesLoading] = useState(false)
  const [editingRate, setEditingRate] = useState<Record<string, string>>({})
  const [rateSaving, setRateSaving]   = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  // 현장 목록
  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then((r) => r.json())
      .then((d) => { if (d.success) setSites(d.data?.items ?? d.data ?? []) })
  }, [])

  // 노임 집계 로드
  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ monthKey })
      if (siteId) p.set('siteId', siteId)
      const res = await fetch(`/api/admin/wage/summary?${p}`)
      const data = await res.json()
      if (!data.success) { router.push('/admin/login'); return }
      setItems(data.data.items ?? [])
      setTotals(data.data.totals ?? null)
      setClosingStatus(data.data.monthClosingStatus ?? 'OPEN')
    } finally { setLoading(false) }
  }, [monthKey, siteId, router])

  // 단가 목록 로드
  const loadRates = useCallback(async () => {
    setRatesLoading(true)
    try {
      const res = await fetch(`/api/admin/wage/rates?monthKey=${monthKey}`)
      const data = await res.json()
      if (!data.success) return
      setRates(data.data.items ?? [])
      const initial: Record<string, string> = {}
      for (const r of data.data.items ?? []) {
        initial[r.workerId] = String(r.dailyWage)
      }
      setEditingRate(initial)
    } finally { setRatesLoading(false) }
  }, [monthKey])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { if (tab === 'rates') loadRates() }, [tab, loadRates])

  // 단가 저장
  const saveRate = async (item: RateItem) => {
    if (!item.contractId) {
      showToast(false, '계약서가 없는 근로자는 먼저 계약서를 등록하세요.')
      return
    }
    const dailyWage = parseInt(editingRate[item.workerId] ?? '0', 10)
    if (isNaN(dailyWage) || dailyWage < 0) {
      showToast(false, '올바른 금액을 입력하세요.')
      return
    }
    setRateSaving((prev) => ({ ...prev, [item.workerId]: true }))
    try {
      const res = await fetch('/api/admin/wage/rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: item.contractId, dailyWage }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRates((prev) => prev.map((r) =>
          r.workerId === item.workerId ? { ...r, dailyWage } : r
        ))
        showToast(true, `${item.workerName} 단가가 저장됐습니다.`)
      } else {
        showToast(false, data.message ?? '저장 실패')
      }
    } finally {
      setRateSaving((prev) => ({ ...prev, [item.workerId]: false }))
    }
  }

  // 현장별로 items를 그룹핑
  const siteGroups = items.reduce<Record<string, WageSummaryItem[]>>((acc, item) => {
    if (!acc[item.siteId]) acc[item.siteId] = []
    acc[item.siteId].push(item)
    return acc
  }, {})

  return (
    <div className="p-5 md:p-6 bg-[#F5F7FA]">
      <p className="text-[12px] text-[#9CA3AF] mb-4 m-0">
        출퇴근 기록 → 공수 → 노임 집계 / 공수 기준: 점심 제외 8시간 이상=1.0공수, 4~8시간=0.5공수
      </p>

      {/* 필터 */}
      <div className="bg-white rounded-[12px] p-5 mb-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs text-muted-brand mb-1 font-semibold">귀속연월</label>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="px-2.5 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-brand mb-1 font-semibold">현장</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="min-w-[160px] px-2.5 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card"
          >
            <option value="">전체 현장</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button
          onClick={loadSummary}
          className="px-4 py-2 bg-accent text-white border-none rounded-md text-sm cursor-pointer font-semibold"
        >
          조회
        </button>
        {/* 마감 상태 배지 */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-brand">마감 상태:</span>
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              background: STATUS_BG[closingStatus] ?? '#f5f5f5',
              color: STATUS_COLOR[closingStatus] ?? '#555',
            }}
          >
            {STATUS_LABEL[closingStatus] ?? closingStatus}
          </span>
          <button
            onClick={() => router.push('/admin/month-closings')}
            className="text-xs text-[#5BA4D9] underline cursor-pointer bg-transparent border-none"
          >
            월마감 →
          </button>
        </div>
      </div>

      {/* 집계 요약 카드 */}
      {totals && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: '집계 인원',   value: fmt(totals.workerCount) + '명',    color: '#5BA4D9' },
            { label: '총 공수',     value: fmt(totals.totalMandays) + '공수',  color: '#388e3c' },
            { label: '총 예상 노임', value: fmtWon(totals.totalAmount),        color: '#e65100' },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-white rounded-[12px] p-5 min-w-[140px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              style={{ borderTop: `4px solid ${c.color}` }}
            >
              <div className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</div>
              <div className="text-xs text-muted-brand">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-0 mb-4 border-b-2 border-[rgba(91,164,217,0.15)]">
        {([
          { key: 'summary', label: '노임 집계' },
          { key: 'rates',   label: '단가 관리' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-2.5 bg-transparent border-none text-sm cursor-pointer font-medium -mb-0.5 border-b-2 transition-colors ${
              tab === t.key
                ? 'text-secondary-brand font-bold border-secondary-brand'
                : 'text-muted-brand border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 탭1: 노임 집계 ─────────────────────────────────── */}
      {tab === 'summary' && (
        <div className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
          {loading ? (
            <div className="py-10 text-center text-[#999]">집계 중...</div>
          ) : (
            <div className="overflow-x-auto">
              {items.length === 0 ? (
                <div className="py-10 text-center text-[#999]">
                  이 월에 집계된 근무 기록이 없습니다.
                  <br />
                  <span className="text-xs">출퇴근 → 근무확정 생성 후 조회하세요.</span>
                </div>
              ) : (
                Object.entries(siteGroups).map(([sid, siteItems]) => {
                  const siteTotal = siteItems.reduce((s, r) => ({
                    units: s.units + r.totalUnits,
                    amount: s.amount + r.totalAmount,
                  }), { units: 0, amount: 0 })

                  return (
                    <div key={sid}>
                      {/* 현장 헤더 */}
                      <div className="px-5 py-2 bg-[rgba(91,164,217,0.08)] border-b border-[rgba(91,164,217,0.15)] flex justify-between items-center">
                        <span className="text-[13px] font-bold text-secondary-brand">
                          {siteItems[0].siteName}
                        </span>
                        <span className="text-xs text-muted-brand">
                          소계: {fmt(Math.round(siteTotal.units * 100) / 100)}공수 / {fmtWon(siteTotal.amount)}
                        </span>
                      </div>

                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-[rgba(91,164,217,0.1)]">
                            {['근로자', '직종', '총공수', '확정공수', '집계중', '단가', '예상노임', '상태'].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-brand whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {siteItems.map((row) => (
                            <tr
                              key={`${row.workerId}-${row.siteId}`}
                              className="border-b border-[rgba(91,164,217,0.06)] hover:bg-[rgba(91,164,217,0.03)] transition-colors"
                            >
                              <td className="px-4 py-3 text-[13px] font-semibold text-secondary-brand whitespace-nowrap">
                                {row.workerName}
                              </td>
                              <td className="px-4 py-3 text-[12px] text-muted-brand whitespace-nowrap">
                                {row.jobTitle}
                              </td>
                              <td className="px-4 py-3 text-[13px] font-bold whitespace-nowrap text-center">
                                {fmt(row.totalUnits)}
                              </td>
                              <td className="px-4 py-3 text-[13px] text-[#1565c0] whitespace-nowrap text-center">
                                {fmt(row.confirmedUnits)}
                              </td>
                              <td className="px-4 py-3 text-[13px] text-[#e65100] whitespace-nowrap text-center">
                                {row.draftUnits > 0 ? fmt(row.draftUnits) : '-'}
                              </td>
                              <td className="px-4 py-3 text-[13px] whitespace-nowrap text-right">
                                {row.dailyWage > 0
                                  ? <span className="font-semibold">{fmt(row.dailyWage)}</span>
                                  : <span className="text-[#999] text-xs">단가 미설정</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-[13px] font-bold whitespace-nowrap text-right">
                                {row.totalAmount > 0 ? fmtWon(row.totalAmount) : '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                                  style={{
                                    background: STATUS_BG[row.status],
                                    color: STATUS_COLOR[row.status],
                                  }}
                                >
                                  {STATUS_LABEL[row.status]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 탭2: 단가 관리 ─────────────────────────────────── */}
      {tab === 'rates' && (
        <div className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[rgba(91,164,217,0.15)]">
            <p className="text-xs text-muted-brand m-0">
              * 단가는 근로자 계약서의 일당(dailyWage)을 기준으로 합니다.
              계약서가 없는 근로자는 먼저 계약서를 등록하세요.
            </p>
          </div>
          {ratesLoading ? (
            <div className="py-10 text-center text-[#999]">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              {rates.length === 0 ? (
                <div className="py-10 text-center text-[#999]">
                  이 월에 출퇴근 기록이 있는 근로자가 없습니다.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(91,164,217,0.1)]">
                      {['근로자', '직종', '현재 단가(원)', '수정', '계약서'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-brand whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((item) => (
                      <tr
                        key={item.workerId}
                        className="border-b border-[rgba(91,164,217,0.06)] hover:bg-[rgba(91,164,217,0.03)]"
                      >
                        <td className="px-4 py-3 text-[13px] font-semibold whitespace-nowrap">{item.workerName}</td>
                        <td className="px-4 py-3 text-[12px] text-muted-brand whitespace-nowrap">{item.jobTitle}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            value={editingRate[item.workerId] ?? ''}
                            onChange={(e) =>
                              setEditingRate((prev) => ({ ...prev, [item.workerId]: e.target.value }))
                            }
                            disabled={!item.hasContract}
                            className="w-[120px] px-2.5 py-1.5 border border-[rgba(91,164,217,0.25)] rounded-md text-[13px] text-right bg-card disabled:opacity-50"
                            placeholder="0"
                            min={0}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => saveRate(item)}
                            disabled={rateSaving[item.workerId] || !item.hasContract}
                            className="px-3 py-1.5 text-xs font-semibold text-white rounded-md border-none cursor-pointer disabled:opacity-50"
                            style={{ background: '#F47920' }}
                          >
                            {rateSaving[item.workerId] ? '저장 중...' : '저장'}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.hasContract ? (
                            <span className="text-[11px] text-[#2e7d32] bg-[#e8f5e9] px-2 py-0.5 rounded-full">계약서 있음</span>
                          ) : (
                            <span className="text-[11px] text-[#b71c1c] bg-[#ffebee] px-2 py-0.5 rounded-full">계약서 없음</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* 집계 기준 안내 */}
      <div className="mt-5 bg-white rounded-[12px] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="text-xs font-semibold text-muted-brand mb-2 uppercase">공수 계산 기준</div>
        <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-brand">
          <div>· 근무 경과 4시간 초과 시 점심 60분 자동 차감 → 실근로 시간 산출</div>
          <div>· 실근로 <strong>8시간 이상</strong> → 1.0 공수 (FULL_DAY)</div>
          <div>· 실근로 <strong>4~8시간</strong> → 0.5 공수 (HALF_DAY)</div>
          <div>· 실근로 <strong>4시간 미만 / 미퇴근</strong> → 0 공수 (INVALID, 집계 제외)</div>
          <div className="mt-1 text-[11px]">* 현장별 휴게시간 설정이 있으면 해당 값 적용. 예: 오전 7시~오후 4시(9h 경과) → 점심 1h 차감 → 8h → 1.0공수</div>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <FloatingToast message={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />
      )}
    </div>
  )
}
