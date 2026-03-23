'use client'

import { useEffect, useState } from 'react'

const RATE_TYPE_LABEL: Record<string, string> = {
  NATIONAL_PENSION:     '국민연금',
  HEALTH_INSURANCE:     '건강보험',
  LONG_TERM_CARE:       '장기요양보험',
  EMPLOYMENT_INSURANCE: '고용보험(실업급여)',
  EMPLOYMENT_STABILITY: '고용안정·직능개발',
  INDUSTRIAL_ACCIDENT:  '산재보험',
  RETIREMENT_MUTUAL:    '건설업 퇴직공제',
}

interface RateSource {
  id: string
  rateType: string
  sourceName: string
  sourceUrl: string
  checkFrequencyDays: number
  lastCheckedAt: string | null
  lastChangeDetectedAt: string | null
  currentRateNote: string | null
  isActive: boolean
  notes: string | null
  needsCheck: boolean
  nextCheckDate: string | null
}

export default function InsuranceRateSourcesPage() {
  const [sources, setSources]   = useState<RateSource[]>([])
  const [loading, setLoading]   = useState(true)
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function fetchSources() {
    setLoading(true)
    const res  = await fetch('/api/admin/insurance-rates/sources')
    const json = await res.json()
    if (json.success) setSources(json.data)
    setLoading(false)
  }

  useEffect(() => { fetchSources() }, [])

  async function initSources() {
    setSubmitting(true)
    const res  = await fetch('/api/admin/insurance-rates/sources', { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      setMsg({ type: 'ok', text: json.message })
      fetchSources()
    } else {
      setMsg({ type: 'err', text: json.error ?? '실패' })
    }
    setSubmitting(false)
  }

  async function markChecked(rateType: string) {
    const note = prompt('이번 확인에서 파악한 요율 메모를 입력하세요. (선택 — 엔터로 건너뜀)')
    const res  = await fetch('/api/admin/insurance-rates/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rateType, note: note || undefined }),
    })
    const json = await res.json()
    if (json.success) {
      setMsg({ type: 'ok', text: `${RATE_TYPE_LABEL[rateType] ?? rateType} 확인 시각이 기록되었습니다.` })
      fetchSources()
    } else {
      setMsg({ type: 'err', text: json.error ?? '실패' })
    }
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '미확인'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 서브 네비게이션 */}
      <div className="flex gap-2 text-sm border-b pb-3">
        <a href="/admin/insurance-rates" className="px-3 py-1.5 bg-white border rounded text-gray-600 hover:bg-gray-50">요율 버전 관리</a>
        <a href="/admin/insurance-rates/sources" className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium">고시 소스 관리</a>
        <a href="/admin/insurance-rates/calculate" className="px-3 py-1.5 bg-white border rounded text-gray-600 hover:bg-gray-50">보험료 계산기</a>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">보험요율 고시 소스 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            공식 고시 소스를 주기적으로 확인하고, 변경이 감지되면 신규 요율 버전을 등록·승인하세요.
            <br />
            <strong className="text-red-600">자동 반영 없음 — 관리자 검토 후 수동 등록 필수.</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={initSources}
            disabled={submitting}
            className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm disabled:opacity-50"
          >
            소스 초기화
          </button>
          <a
            href="/admin/insurance-rates"
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            요율 버전 관리 →
          </a>
        </div>
      </div>

      {/* 알림 */}
      {msg && (
        <div className={`p-3 rounded text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-2 underline text-xs">닫기</button>
        </div>
      )}

      {/* 주기 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>확인 주기 정책:</strong>
        <ul className="mt-1 ml-4 list-disc space-y-1">
          <li>1~7월: 주 1회 (매주 월요일) — 고시 변경이 적은 기간</li>
          <li>8~12월: 평일 매일 — 다음 연도 고시 발표 집중 기간</li>
        </ul>
        <p className="mt-2 text-xs text-blue-600">
          "확인 필요" 표시는 주기 도래 여부를 나타냅니다. 아래 소스 URL에 직접 접속하여 요율 변경 여부를 확인 후,
          변경이 있으면 요율 버전 관리 화면에서 신규 버전을 등록하세요.
        </p>
      </div>

      {/* 소스 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          등록된 소스가 없습니다. "소스 초기화" 버튼을 눌러 기본 소스를 등록하세요.
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(source => (
            <div
              key={source.id}
              className={`border rounded-lg p-4 ${source.needsCheck ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">
                      {RATE_TYPE_LABEL[source.rateType] ?? source.rateType}
                    </span>
                    {source.needsCheck && (
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded font-medium">
                        확인 필요
                      </span>
                    )}
                    {!source.isActive && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">비활성</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">{source.sourceName}</div>
                  <a
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline break-all"
                  >
                    {source.sourceUrl}
                  </a>
                  {source.notes && (
                    <div className="text-xs text-gray-500 mt-1">{source.notes}</div>
                  )}
                  {source.currentRateNote && (
                    <div className="text-xs bg-gray-100 rounded px-2 py-1 text-gray-700 mt-1">
                      최근 파악 내용: {source.currentRateNote}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500 shrink-0 space-y-1">
                  <div>마지막 확인: {fmtDate(source.lastCheckedAt)}</div>
                  {source.nextCheckDate && (
                    <div>다음 예정: {fmtDate(source.nextCheckDate)}</div>
                  )}
                  {source.lastChangeDetectedAt && (
                    <div className="text-amber-700">
                      변경 감지: {fmtDate(source.lastChangeDetectedAt)}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs hover:bg-blue-100"
                >
                  고시 페이지 열기
                </a>
                <button
                  onClick={() => markChecked(source.rateType)}
                  className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs hover:bg-green-100"
                >
                  확인 완료 처리
                </button>
                <a
                  href="/admin/insurance-rates"
                  className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded text-xs hover:bg-gray-100"
                >
                  요율 버전 등록하기 →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
