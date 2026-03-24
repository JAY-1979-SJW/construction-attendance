'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'sites' | 'workers' | 'daily' | 'monthly' | 'export'

interface RetirementSite {
  id: string
  siteId: string
  siteName: string
  enabledYn: boolean
  contractNumber: string | null
  createdAt: string
}

interface RetirementWorker {
  id: string
  workerId: string
  workerName: string
  company: string
  enabledYn: boolean
  joinDate: string | null
  createdAt: string
}

interface DailyRecord {
  id: string
  date: string
  workerName: string
  siteName: string
  recognizedYn: boolean
  recognizedMandays: number
  manualOverride: boolean
  overrideReason: string | null
}

interface MonthlyRecord {
  id: string
  monthKey: string
  workerName: string
  siteName: string
  recognizedDays: number
  recognizedMandays: number
  status: string
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const TAB_LABELS: Record<Tab, string> = {
  sites:   '현장설정',
  workers: '근로자설정',
  daily:   '일별내역',
  monthly: '월별요약',
  export:  'Export',
}

export default function RetirementMutualPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('sites')
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Sites tab state
  const [sites, setSites] = useState<RetirementSite[]>([])

  // Workers tab state
  const [workers, setWorkers] = useState<RetirementWorker[]>([])

  // Daily tab state
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([])
  const [dailySiteFilter, setDailySiteFilter] = useState('')

  // Monthly tab state
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecord[]>([])

  // Export tab state
  const [exportResult, setExportResult] = useState<{ count: number; message: string } | null>(null)
  const [exporting, setExporting] = useState(false)

  const loadSites = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/retirement-mutual/sites')
      const data = await res.json()
      if (!data.success) { router.push('/admin/login'); return }
      setSites(data.data?.items ?? [])
    } finally { setLoading(false) }
  }, [router])

  const loadWorkers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/retirement-mutual/workers')
      const data = await res.json()
      if (!data.success) { router.push('/admin/login'); return }
      setWorkers(data.data?.items ?? [])
    } finally { setLoading(false) }
  }, [router])

  const loadDaily = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ monthKey })
      if (dailySiteFilter) params.set('siteId', dailySiteFilter)
      const res = await fetch(`/api/admin/retirement-mutual/daily?${params}`)
      const data = await res.json()
      if (!data.success) { router.push('/admin/login'); return }
      setDailyRecords(data.data?.items ?? [])
    } finally { setLoading(false) }
  }, [monthKey, dailySiteFilter, router])

  const loadMonthly = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/retirement-mutual/monthly?monthKey=${monthKey}`)
      const data = await res.json()
      if (!data.success) { router.push('/admin/login'); return }
      setMonthlyRecords(data.data?.items ?? [])
    } finally { setLoading(false) }
  }, [monthKey, router])

  useEffect(() => {
    setMsg('')
    if (tab === 'sites')   loadSites()
    if (tab === 'workers') loadWorkers()
    if (tab === 'daily')   loadDaily()
    if (tab === 'monthly') loadMonthly()
  }, [tab, loadSites, loadWorkers, loadDaily, loadMonthly])

  useEffect(() => {
    if (tab === 'daily')   loadDaily()
    if (tab === 'monthly') loadMonthly()
  }, [monthKey, tab, loadDaily, loadMonthly])

  const toggleSite = async (id: string, enabled: boolean) => {
    await fetch(`/api/admin/retirement-mutual/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabledYn: !enabled }),
    })
    loadSites()
  }

  const toggleWorker = async (id: string, enabled: boolean) => {
    await fetch(`/api/admin/retirement-mutual/workers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabledYn: !enabled }),
    })
    loadWorkers()
  }

  const runExport = async () => {
    if (!confirm(`${monthKey} 퇴직공제 자료를 생성하시겠습니까?`)) return
    setExporting(true)
    setExportResult(null)
    try {
      const res = await fetch('/api/admin/retirement-mutual/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey }),
      })
      const data = await res.json()
      if (res.ok) {
        setExportResult({ count: data.data?.count ?? 0, message: data.message ?? '생성 완료' })
        setMsg(`완료: ${data.message ?? '퇴직공제 자료 생성 완료'}`)
      } else {
        setMsg(`오류: ${data.error ?? '생성 실패'}`)
      }
    } finally { setExporting(false) }
  }

  return (
    <div className="p-8 overflow-auto">
        <h1 className="text-2xl font-bold mb-6">퇴직공제 관리</h1>

        {/* 탭 */}
        <div className="flex gap-0 mb-6 border-b-2 border-[#e0e0e0]">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2.5 border-none bg-transparent cursor-pointer text-[14px]"
              style={{
                fontWeight: tab === t ? 700 : 400,
                color: tab === t ? '#1976d2' : '#666',
                borderBottom: tab === t ? '2px solid #1976d2' : '2px solid transparent',
                marginBottom: '-2px',
              }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* 월 선택 (일별/월별/Export 탭) */}
        {(tab === 'daily' || tab === 'monthly' || tab === 'export') && (
          <div className="flex gap-3 mb-5 items-center">
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card"
            />
            {tab === 'daily' && (
              <input
                type="text"
                placeholder="현장 ID 필터"
                value={dailySiteFilter}
                onChange={(e) => setDailySiteFilter(e.target.value)}
                className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card w-40"
              />
            )}
          </div>
        )}

        {msg && (
          <div className={`px-4 py-3 rounded-lg mb-4 text-[14px] ${msg.startsWith('오류') ? 'bg-[#ffebee] text-[#c62828]' : 'bg-[#e8f5e9] text-[#2e7d32]'}`}>
            {msg}
          </div>
        )}

        {/* 현장설정 탭 */}
        {tab === 'sites' && (
          <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f0f0] font-bold text-[14px]">퇴직공제 대상 현장</div>
            {loading ? <div className="py-8 text-center text-[#999]">로딩 중...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['현장명', '계약번호', '등록일', '활성'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sites.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-6 text-[#999]">등록된 현장 없음</td></tr>
                    ) : sites.map((site) => (
                      <tr key={site.id}>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                          {site.siteName}<br /><span className="text-[11px] text-[#999]">{site.siteId}</span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{site.contractNumber ?? '-'}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{new Date(site.createdAt).toLocaleDateString('ko-KR')}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                          <button
                            onClick={() => toggleSite(site.id, site.enabledYn)}
                            className="px-3 py-1 text-white border-none rounded-full cursor-pointer text-[12px] font-semibold"
                            style={{ background: site.enabledYn ? '#2e7d32' : '#9e9e9e' }}
                          >
                            {site.enabledYn ? '활성' : '비활성'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 근로자설정 탭 */}
        {tab === 'workers' && (
          <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f0f0] font-bold text-[14px]">퇴직공제 대상 근로자</div>
            {loading ? <div className="py-8 text-center text-[#999]">로딩 중...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['근로자', '소속', '가입일', '등록일', '활성'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workers.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-6 text-[#999]">등록된 근로자 없음</td></tr>
                    ) : workers.map((w) => (
                      <tr key={w.id}>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                          {w.workerName}<br /><span className="text-[11px] text-[#999]">{w.workerId}</span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{w.company}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{w.joinDate ? new Date(w.joinDate).toLocaleDateString('ko-KR') : '-'}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{new Date(w.createdAt).toLocaleDateString('ko-KR')}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                          <button
                            onClick={() => toggleWorker(w.id, w.enabledYn)}
                            className="px-3 py-1 text-white border-none rounded-full cursor-pointer text-[12px] font-semibold"
                            style={{ background: w.enabledYn ? '#2e7d32' : '#9e9e9e' }}
                          >
                            {w.enabledYn ? '활성' : '비활성'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 일별내역 탭 */}
        {tab === 'daily' && (
          <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f0f0] font-bold text-[14px]">일별 퇴직공제 내역</div>
            {loading ? <div className="py-8 text-center text-[#999]">로딩 중...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['날짜', '근로자', '현장', '인정여부', '인정공수', '수동보정', '사유'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRecords.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-6 text-[#999]">데이터 없음</td></tr>
                    ) : dailyRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{r.date}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{r.workerName}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{r.siteName}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                          <span style={{ color: r.recognizedYn ? '#2e7d32' : '#9e9e9e' }} className="font-semibold text-[12px]">
                            {r.recognizedYn ? '인정' : '미인정'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">{r.recognizedMandays}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                          <span style={{ color: r.manualOverride ? '#e65100' : '#9e9e9e' }} className="text-[12px]">
                            {r.manualOverride ? '보정' : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-muted-brand border-b border-[rgba(91,164,217,0.1)] align-top">{r.overrideReason ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 월별요약 탭 */}
        {tab === 'monthly' && (
          <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f0f0] font-bold text-[14px]">월별 퇴직공제 요약</div>
            {loading ? <div className="py-8 text-center text-[#999]">로딩 중...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['귀속연월', '근로자', '현장', '인정일수', '인정공수', '상태'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRecords.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-6 text-[#999]">데이터 없음</td></tr>
                    ) : monthlyRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{r.monthKey}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{r.workerName}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{r.siteName}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">{r.recognizedDays}일</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">{r.recognizedMandays}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                          <span style={{
                            color: r.status === 'CONFIRMED' ? '#2e7d32' : r.status === 'EXPORTED' ? '#1565c0' : '#888',
                          }} className="text-[12px] font-semibold">
                            {r.status === 'CONFIRMED' ? '확정' : r.status === 'EXPORTED' ? '신고완료' : r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Export 탭 */}
        {tab === 'export' && (
          <div className="bg-card rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
            <div className="font-bold text-[14px] mb-4">퇴직공제 자료 생성</div>
            <p className="text-[13px] text-muted-brand mb-5">
              선택한 귀속연월의 퇴직공제 신고 기초자료를 생성합니다.
            </p>
            <button
              onClick={runExport}
              disabled={exporting}
              className="px-4 py-2 text-white border-none rounded-md cursor-pointer text-[14px] font-semibold"
              style={{ background: '#7b1fa2', opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? '생성 중...' : `${monthKey} 퇴직공제 자료 생성`}
            </button>

            {exportResult && (
              <div className="mt-5 p-4 bg-[#e8f5e9] rounded-lg text-[13px] text-[#2e7d32]">
                생성 완료 — {exportResult.count}건 / {exportResult.message}
              </div>
            )}
          </div>
        )}
    </div>
  )
}
