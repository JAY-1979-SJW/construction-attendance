'use client'

import { useState } from 'react'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields } from '@/components/admin/ui'

const RATE_TYPE_LABEL: Record<string, string> = {
  NATIONAL_PENSION:     '국민연금',
  HEALTH_INSURANCE:     '건강보험',
  LONG_TERM_CARE:       '장기요양보험',
  EMPLOYMENT_INSURANCE: '고용보험(실업급여)',
  EMPLOYMENT_STABILITY: '고용안정·직능개발',
  INDUSTRIAL_ACCIDENT:  '산재보험',
  RETIREMENT_MUTUAL:    '건설업 퇴직공제',
}

interface CalcResult {
  success: boolean
  wageType: 'MONTHLY' | 'DAILY'
  monthlyWage?: number
  dailyWage?: number
  referenceDate: string
  summary?: {
    employeeTotalAmount: number
    employerTotalAmount: number
    grandTotal: number
  }
  details?: {
    nationalPension: SingleResult | null
    healthInsurance: SingleResult | null
    longTermCare: SingleResult | null
    employmentInsurance: SingleResult | null
    employmentStability: SingleResult | null
    industrialAccident: SingleResult | null
    unavailable: string[]
  }
  result?: {
    employmentInsurance: { employeeAmount: number; employerAmount: number; versionId: string } | null
    industrialAccident: { employerAmount: number; versionId: string } | null
    healthInsuranceNote: string
    nationalPensionNote: string
  }
  unavailable?: string[]
  note?: string | null
}

interface SingleResult {
  baseAmount: number
  employeeAmount: number
  employerAmount: number
  totalAmount: number
  versionId: string
  employeeRatePct: number
  employerRatePct: number
}

export default function InsuranceCalculatePage() {
  const [wage, setWage]             = useState('')
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10))
  const [wageType, setWageType]     = useState<'MONTHLY' | 'DAILY'>('MONTHLY')
  const [industryCode, setIndustryCode] = useState('')
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<CalcResult | null>(null)
  const [error, setError]           = useState('')

  async function handleCalc() {
    const wageNum = parseInt(wage.replace(/,/g, ''))
    if (!wageNum || wageNum <= 0) { setError('임금을 올바르게 입력하세요.'); return }
    setError(''); setLoading(true); setResult(null)

    try {
      const res  = await fetch('/api/admin/insurance-rates/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wage: wageNum,
          date,
          wageType,
          ...(industryCode ? { industryCode } : {}),
        }),
      })
      const data = await res.json()
      if (data.success) setResult(data)
      else setError(data.message ?? data.error ?? '계산 실패')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const won = (n: number) => n.toLocaleString('ko-KR') + '원'

  const MONTHLY_ITEMS: [keyof NonNullable<CalcResult['details']>, string][] = [
    ['nationalPension', '국민연금'],
    ['healthInsurance', '건강보험'],
    ['longTermCare', '장기요양보험'],
    ['employmentInsurance', '고용보험(실업급여)'],
    ['employmentStability', '고용안정·직능개발'],
    ['industrialAccident', '산재보험'],
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 서브 네비게이션 */}
      <div className="flex gap-2 text-sm border-b pb-3">
        <a href="/admin/insurance-rates" className="px-3 py-1.5 bg-card border rounded text-gray-600 hover:bg-gray-50">요율 버전 관리</a>
        <a href="/admin/insurance-rates/sources" className="px-3 py-1.5 bg-card border rounded text-gray-600 hover:bg-gray-50">고시 소스 관리</a>
        <a href="/admin/insurance-rates/calculate" className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium">보험료 계산기</a>
      </div>

      <div>
        <h1 className="text-2xl font-bold">4대보험 계산기</h1>
        <p className="text-sm text-gray-500 mt-1">
          승인된 요율 버전 기반으로 계산합니다. 하드코딩 값 사용 없음.
        </p>
      </div>

      {/* 입력 */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">임금 구분</label>
            <div className="flex gap-2">
              {(['MONTHLY', 'DAILY'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setWageType(t)}
                  className={`px-4 py-2 rounded border text-sm font-medium ${
                    wageType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  {t === 'MONTHLY' ? '월급여' : '일용 일급'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              {wageType === 'MONTHLY' ? '월급여 (원)' : '일급 (원)'}
            </label>
            <input
              type="text"
              value={wage}
              onChange={e => setWage(e.target.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
              placeholder="예: 2,500,000"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">기준일</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              업종 코드 (산재 전용, 선택)
            </label>
            <input
              type="text"
              value={industryCode}
              onChange={e => setIndustryCode(e.target.value)}
              placeholder="예: 47"
              className="border rounded px-3 py-2 text-sm w-32"
            />
          </div>
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button
          onClick={handleCalc}
          disabled={loading || !wage}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? '계산 중...' : '계산하기'}
        </button>
      </div>

      {/* 결과 — 월급여 */}
      {result && result.wageType === 'MONTHLY' && result.details && (
        <div className="space-y-4">
          {/* 합계 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <div className="text-sm font-semibold text-blue-800 mb-3">
              {result.referenceDate} 기준 계산 결과 — 월급여 {won(result.monthlyWage ?? 0)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500 mb-1">근로자 부담 합계</div>
                <div className="text-xl font-bold text-blue-700">{won(result.summary?.employeeTotalAmount ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">사업주 부담 합계</div>
                <div className="text-xl font-bold text-orange-600">{won(result.summary?.employerTotalAmount ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">전체 합계</div>
                <div className="text-xl font-bold text-gray-800">{won(result.summary?.grandTotal ?? 0)}</div>
              </div>
            </div>
          </div>

          {/* 보험별 상세 */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <MobileCardList
              items={MONTHLY_ITEMS}
              keyExtractor={([key]) => key as string}
              emptyMessage=""
              renderCard={([key, label]) => {
                const item = result.details![key as keyof NonNullable<CalcResult['details']>] as SingleResult | null
                if (!item) {
                  return (
                    <MobileCard title={label as string} badge={<span className="text-[11px] text-red-600 bg-red-50 px-2 py-0.5 rounded">요율없음</span>}>
                      <MobileCardFields>
                        <MobileCardField label="상태" value="승인된 요율 없음 — 보험요율 관리에서 등록·승인 필요" />
                      </MobileCardFields>
                    </MobileCard>
                  )
                }
                return (
                  <MobileCard title={label as string}>
                    <MobileCardFields>
                      <MobileCardField label="근로자 요율" value={`${item.employeeRatePct}%`} />
                      <MobileCardField label="사업주 요율" value={`${item.employerRatePct}%`} />
                      <MobileCardField label="근로자 부담" value={won(item.employeeAmount)} />
                      <MobileCardField label="사업주 부담" value={won(item.employerAmount)} />
                    </MobileCardFields>
                  </MobileCard>
                )
              }}
              renderTable={() => (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left">보험 종류</th>
                      <th className="px-4 py-3 text-right">근로자 요율(%)</th>
                      <th className="px-4 py-3 text-right">사업주 요율(%)</th>
                      <th className="px-4 py-3 text-right text-blue-700">근로자 부담</th>
                      <th className="px-4 py-3 text-right text-orange-600">사업주 부담</th>
                      <th className="px-4 py-3 text-left text-gray-400">요율 ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {MONTHLY_ITEMS.map(([key, label]) => {
                      const item = result.details![key as keyof NonNullable<CalcResult['details']>] as SingleResult | null
                      if (!item) {
                        return (
                          <tr key={key as string} className="bg-red-50">
                            <td className="px-4 py-3 font-medium text-red-600">{label as string}</td>
                            <td colSpan={5} className="px-4 py-3 text-red-500 text-xs">
                              승인된 요율 없음 — 보험요율 관리에서 등록·승인 필요
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={key as string} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{label as string}</td>
                          <td className="px-4 py-3 text-right font-mono">{item.employeeRatePct}%</td>
                          <td className="px-4 py-3 text-right font-mono">{item.employerRatePct}%</td>
                          <td className="px-4 py-3 text-right font-mono text-blue-700">{won(item.employeeAmount)}</td>
                          <td className="px-4 py-3 text-right font-mono text-orange-600">{won(item.employerAmount)}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[120px]">{item.versionId.slice(0, 12)}…</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            />
          </div>

          {result.details.unavailable.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
              미등록 요율: {result.details.unavailable.map(t => RATE_TYPE_LABEL[t] ?? t).join(', ')}
              <br /><span className="text-xs">보험요율 관리 → 신규 버전 등록 → 승인 후 다시 계산하세요.</span>
            </div>
          )}
        </div>
      )}

      {/* 결과 — 일용 */}
      {result && result.wageType === 'DAILY' && result.result && (
        <div className="space-y-4">
          <div className="bg-card border rounded-lg p-5 space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              {result.referenceDate} 기준 — 일급 {won(result.dailyWage ?? 0)} (건설업 일용근로자)
            </div>
            <div className="grid grid-cols-1 gap-3">
              {result.result.employmentInsurance ? (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="text-sm">고용보험(실업급여)</span>
                  <span className="text-sm">
                    근로자 <strong className="text-blue-700">{won(result.result.employmentInsurance.employeeAmount)}</strong>
                    {' / '}
                    사업주 <strong className="text-orange-600">{won(result.result.employmentInsurance.employerAmount)}</strong>
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded">
                  고용보험 — 승인된 요율 없음
                </div>
              )}
              {result.result.industrialAccident ? (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="text-sm">산재보험</span>
                  <span className="text-sm">
                    사업주 전액 <strong className="text-orange-600">{won(result.result.industrialAccident.employerAmount)}</strong>
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded">
                  산재보험 — 승인된 요율 없음
                </div>
              )}
              <div className="p-3 bg-gray-100 text-gray-600 text-sm rounded">
                건강보험: {result.result.healthInsuranceNote}
              </div>
              <div className="p-3 bg-gray-100 text-gray-600 text-sm rounded">
                국민연금: {result.result.nationalPensionNote}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 링크 */}
      <div className="flex gap-3 text-sm">
        <a href="/admin/insurance-rates" className="text-blue-600 hover:underline">요율 버전 관리 →</a>
        <a href="/admin/insurance-rates/sources" className="text-blue-600 hover:underline">고시 소스 관리 →</a>
        <a href="/api/admin/insurance-rates/effective" target="_blank" className="text-gray-500 hover:underline">유효 요율 API →</a>
      </div>
    </div>
  )
}
