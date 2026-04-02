'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const XLSX_SUPPORTED = ['WAGE_LEDGER', 'INSURANCE_REPORT', 'TAX_REPORT', 'RETIREMENT_MUTUAL_SUMMARY', 'SUBCONTRACTOR_SETTLEMENT']

const DOC_TYPES = [
  { value: 'WAGE_LEDGER', label: '노임대장', desc: '근로자별 일별 임금 지급 내역' },
  { value: 'MONTHLY_ATTENDANCE', label: '월 출역표', desc: '근로자별 월간 출역 현황' },
  { value: 'INSURANCE_REPORT', label: '보험판정표', desc: '4대보험 적용/제외 판정 결과' },
  { value: 'TAX_REPORT', label: '세금계산표', desc: '원천세 계산 내역' },
  { value: 'RETIREMENT_MUTUAL_SUMMARY', label: '퇴직공제 요약표', desc: '퇴직공제 인정일수 요약' },
  { value: 'SUBCONTRACTOR_SETTLEMENT', label: '협력사 정산서', desc: '협력사별 노무비 정산 기초자료' },
]

interface Site {
  id: string
  name: string
}

interface PreflightIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO'
  code: string
  message: string
  workerIds?: string[]
  detail?: string
}

interface PreflightResult {
  ok: boolean
  canDownload: boolean
  summary: {
    errorCount: number
    warningCount: number
    infoCount: number
  }
  issues: PreflightIssue[]
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

export default function DocumentCenterPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey)
  const [docType, setDocType] = useState('WAGE_LEDGER')
  const [siteId, setSiteId] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const [preflightLoading, setPreflightLoading] = useState(false)
  const [xlsxLoading, setXlsxLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [preflightCheckedAt, setPreflightCheckedAt] = useState<Date | null>(null)

  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => {
        if (d.success) setSites(d.data?.items?.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) ?? [])
      })
  }, [])

  // 월/서식 바뀌면 사전검사 결과 초기화
  useEffect(() => {
    setPreflight(null)
    setPreflightCheckedAt(null)
    setMsg('')
  }, [monthKey, docType, siteId])

  const handlePreflight = async () => {
    setPreflightLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/document-center/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, templateCode: docType, siteId: siteId || undefined }),
      })
      if (res.status === 401) { router.push('/admin/login'); return }
      const data = await res.json()
      if (!res.ok) { setMsg(`사전검사 실패: ${data.error ?? res.status}`); return }
      setPreflight(data)
      setPreflightCheckedAt(new Date())
    } finally {
      setPreflightLoading(false)
    }
  }

  const handleDownload = async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/document-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, documentType: docType, siteId: siteId || undefined }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMsg(`실패: ${err.error}`)
        return
      }

      const rowCount = res.headers.get('X-Row-Count')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const label = DOC_TYPES.find(d => d.value === docType)?.label ?? docType
      a.href = url
      a.download = `${monthKey}_${label}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMsg(`다운로드 완료 (${rowCount ?? '?'}행)`)
    } finally {
      setLoading(false)
    }
  }

  const handleXlsxDownload = async () => {
    setXlsxLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/document-center/xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, documentType: docType, siteId: siteId || undefined }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMsg(`XLSX 생성 실패: ${err.error}`)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const label = DOC_TYPES.find(d => d.value === docType)?.label ?? docType
      a.href = url
      a.download = `${monthKey}_${label}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMsg('XLSX 다운로드 완료')
    } finally {
      setXlsxLoading(false)
    }
  }

  const selectedDoc = DOC_TYPES.find(d => d.value === docType)
  const isSuccess = msg.startsWith('다운로드') || msg.startsWith('XLSX 다운로드')
  const hasXlsx = XLSX_SUPPORTED.includes(docType)
  // preflight가 실행됐고 canDownload가 false인 경우에만 차단
  const downloadBlocked = preflight !== null && !preflight.canDownload

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">서식 출력 센터</h1>

      <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mb-5">
        {/* 귀속연월 + 현장 */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs text-muted-brand mb-1 font-semibold">귀속연월</label>
            <input
              type="month"
              value={monthKey}
              onChange={e => setMonthKey(e.target.value)}
              className="px-2.5 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-brand mb-1 font-semibold">현장 (선택)</label>
            <select
              value={siteId}
              onChange={e => setSiteId(e.target.value)}
              className="w-full px-2.5 py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-sm bg-card"
            >
              <option value="">전체 현장</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 서식 종류 선택 */}
        <div className="mb-5">
          {/* 서식 레이블 + XLSX 지원 배지 */}
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-muted-brand font-semibold">서식 종류</label>
            {XLSX_SUPPORTED.includes(docType) ? (
              <span className="text-[11px] px-2 py-0.5 bg-green-light text-[#2e7d32] rounded-full font-semibold">
                XLSX 지원
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 bg-brand text-[#9e9e9e] rounded-full font-semibold">
                CSV만
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DOC_TYPES.map(d => (
              <button
                key={d.value}
                onClick={() => setDocType(d.value)}
                className={`text-left px-3.5 py-3 rounded-lg border cursor-pointer transition-all ${
                  docType === d.value
                    ? 'bg-[rgba(91,164,217,0.1)] border-[#1976d2] text-secondary-brand'
                    : 'bg-white border-brand'
                }`}
              >
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  {d.label}
                  {XLSX_SUPPORTED.includes(d.value) && (
                    <span className="text-[11px] bg-green-light text-[#2e7d32] px-1.5 py-0.5 rounded font-bold">
                      XLSX
                    </span>
                  )}
                </div>
                <div className={`text-xs mt-0.5 ${docType === d.value ? 'text-secondary-brand' : 'text-[#9e9e9e]'}`}>
                  {d.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 선택된 서식 설명 */}
        {selectedDoc && (
          <div className="bg-[rgba(91,164,217,0.1)] rounded-md px-3.5 py-2.5 mb-4 text-sm text-secondary-brand">
            <strong>{selectedDoc.label}</strong>: {selectedDoc.desc}
            {hasXlsx && (
              <span className="ml-2 text-xs text-[#2e7d32] font-semibold">
                (XLSX 실서식 출력 지원)
              </span>
            )}
          </div>
        )}

        {/* 사전검사 버튼 */}
        <div className="flex gap-2.5 mb-4">
          <button
            onClick={handlePreflight}
            disabled={preflightLoading}
            className="px-4 py-2 bg-[#455a64] text-white border-0 rounded-lg cursor-pointer text-sm font-semibold"
            style={{ opacity: preflightLoading ? 0.6 : 1 }}
          >
            {preflightLoading ? '검사 중...' : '사전검사 실행'}
          </button>
        </div>

        {/* 사전검사 결과 패널 */}
        {preflight ? (
          <div className="mb-4 border border-brand rounded-[12px] overflow-hidden">
            {/* 헤더 - 결과 요약 */}
            <div className={`px-4 py-3.5 flex items-center justify-between border-b border-brand ${
              preflight.summary.errorCount > 0
                ? 'bg-[#fff5f5]'
                : preflight.summary.warningCount > 0
                  ? 'bg-[#fffde7]'
                  : 'bg-[#f1f8e9]'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-[18px]">
                  {preflight.summary.errorCount > 0 ? '❌' : preflight.summary.warningCount > 0 ? '⚠️' : '✅'}
                </span>
                <div>
                  <div className="font-bold text-sm">
                    {preflight.canDownload ? '다운로드 가능' : '다운로드 차단됨'}
                  </div>
                  <div className="text-[11px] text-muted-brand mt-0.5">
                    {preflightCheckedAt && `${preflightCheckedAt.toLocaleTimeString('ko-KR')} 검사 완료`}
                  </div>
                </div>
              </div>
              {/* 배지 요약 */}
              <div className="flex gap-1.5">
                {preflight.summary.errorCount > 0 && (
                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-red-light text-[#c62828] rounded-full">
                    오류 {preflight.summary.errorCount}
                  </span>
                )}
                {preflight.summary.warningCount > 0 && (
                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-[#fff8e1] text-[#f57f17] rounded-full">
                    경고 {preflight.summary.warningCount}
                  </span>
                )}
                {preflight.summary.infoCount > 0 && (
                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-[rgba(244,121,32,0.12)] text-accent rounded-full">
                    정보 {preflight.summary.infoCount}
                  </span>
                )}
                {preflight.summary.errorCount === 0 && preflight.summary.warningCount === 0 && (
                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-green-light text-[#2e7d32] rounded-full">
                    이상 없음
                  </span>
                )}
              </div>
            </div>

            {/* 이슈 목록 */}
            {preflight.issues.length > 0 ? (
              <ul className="m-0 p-0 list-none">
                {preflight.issues.map((issue, i) => (
                  <li key={i} className={`px-3.5 py-2.5 flex gap-2.5 items-start ${i < preflight.issues.length - 1 ? 'border-b border-brand' : ''}`}>
                    <span className={`mt-px flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      issue.severity === 'ERROR'
                        ? 'bg-red-light text-[#c62828]'
                        : issue.severity === 'WARNING'
                          ? 'bg-[#fff8e1] text-[#f57f17]'
                          : 'bg-[#e3f2fd] text-secondary-brand'
                    }`}>
                      {issue.severity === 'ERROR' ? '!' : issue.severity === 'WARNING' ? '△' : 'i'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-dim-brand">{issue.message}</div>
                      {issue.detail && (
                        <div className="text-xs text-muted-brand mt-0.5">{issue.detail}</div>
                      )}
                      {issue.workerIds && issue.workerIds.length > 0 && (
                        <div className="text-[11px] text-[#aaa] mt-0.5">
                          대상 근로자 {issue.workerIds.length}명
                        </div>
                      )}
                      <div className="text-[11px] text-[#bbb] mt-0.5 font-mono">{issue.code}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-4 text-[13px] text-[#aaa] text-center">
                검사 항목 없음 (모두 정상)
              </div>
            )}

            {/* 재실행 버튼 */}
            <div className="px-3.5 py-2.5 bg-surface border-t border-brand flex justify-end">
              <button
                onClick={handlePreflight}
                disabled={preflightLoading}
                className="text-xs text-secondary-brand bg-transparent border-0 cursor-pointer"
                style={{ opacity: preflightLoading ? 0.5 : 1 }}
              >
                {preflightLoading ? '검사 중...' : '↻ 사전검사 재실행'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4 border border-brand rounded-[12px] px-4 py-4 bg-surface text-[13px] text-[#aaa] text-center">
            사전검사를 실행하면 결과가 여기에 표시됩니다.
          </div>
        )}

        {/* 다운로드 버튼 영역 */}
        <div className="flex gap-2.5">
          {/* CSV 다운로드 */}
          <button
            onClick={handleDownload}
            disabled={loading || downloadBlocked}
            className={`py-3 bg-brand-accent text-white border-0 rounded-lg cursor-pointer text-[15px] font-bold ${hasXlsx ? 'flex-1' : 'w-full'}`}
            style={{ opacity: (loading || downloadBlocked) ? 0.5 : 1 }}
          >
            {loading ? '생성 중...' : downloadBlocked ? '오류 해결 필요 (CSV)' : 'CSV 다운로드'}
          </button>

          {/* XLSX 다운로드 (지원되는 서식만) */}
          {hasXlsx && (
            <button
              onClick={handleXlsxDownload}
              disabled={xlsxLoading || downloadBlocked}
              className="flex-1 py-3 text-white border-0 rounded-lg cursor-pointer text-[15px] font-bold"
              style={{
                background: downloadBlocked ? '#bdbdbd' : '#2e7d32',
                opacity: (xlsxLoading || downloadBlocked) ? 0.5 : 1,
              }}
            >
              {xlsxLoading ? '생성 중...' : downloadBlocked ? '오류 해결 필요 (XLSX)' : 'XLSX 다운로드'}
            </button>
          )}
        </div>

        {/* 다운로드 차단 안내 */}
        {preflight && !preflight.canDownload && (
          <p className="text-xs text-[#c62828] mt-1.5">
            오류를 해결한 후 다운로드하세요.
          </p>
        )}

        {/* 결과 메시지 */}
        {msg && (
          <div className={`mt-3 px-3.5 py-2.5 rounded-md text-[13px] ${isSuccess ? 'bg-green-light text-[#2e7d32]' : 'bg-red-light text-[#c62828]'}`}>
            {msg}
          </div>
        )}
      </div>

      {/* 서식 안내 테이블 */}
      <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mb-5">
        <h2 className="text-base font-bold mb-4">서식별 포함 내용</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['서식명', '포함 내용', '주요 활용', '형식'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: '노임대장', desc: '근로자별 일별 임금 지급 내역', use: '노무비 정산, 현장 제출용', xlsx: true },
              { label: '월 출역표', desc: '근로자별 월간 출역 현황 및 공수', use: '공사일보 첨부, 현장 기록', xlsx: false },
              { label: '보험판정표', desc: '4대보험 적용/제외 판정 결과', use: '보험 신고 기초자료', xlsx: true },
              { label: '세금계산표', desc: '원천세 계산 내역 (과세/비과세)', use: '세무 신고용', xlsx: true },
              { label: '퇴직공제 요약표', desc: '퇴직공제 인정일수 집계', use: '건설근로자공제회 신고', xlsx: true },
              { label: '협력사 정산서', desc: '협력사별 노무비 정산 기초자료', use: '협력사 노무비 지급', xlsx: true },
            ].map(row => (
              <tr key={row.label}>
                <td className="px-3 py-3 text-[13px] text-dim-brand border-b border-brand font-semibold">{row.label}</td>
                <td className="px-3 py-3 text-[13px] text-dim-brand border-b border-brand">{row.desc}</td>
                <td className="px-3 py-3 text-[13px] text-muted-brand border-b border-brand">{row.use}</td>
                <td className="px-3 py-3 text-[13px] text-dim-brand border-b border-brand">
                  <span className="text-xs text-muted-brand">CSV</span>
                  {row.xlsx && (
                    <span className="ml-1.5 text-xs bg-green-light text-[#2e7d32] px-1.5 py-0.5 rounded font-bold">
                      XLSX
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
