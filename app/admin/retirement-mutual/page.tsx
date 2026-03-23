'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(item.href === '/admin/retirement-mutual' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>퇴직공제 관리</h1>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid #e0e0e0' }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px',
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
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              style={s.input}
            />
            {tab === 'daily' && (
              <input
                type="text"
                placeholder="현장 ID 필터"
                value={dailySiteFilter}
                onChange={(e) => setDailySiteFilter(e.target.value)}
                style={{ ...s.input, width: '160px' }}
              />
            )}
          </div>
        )}

        {msg && (
          <div style={{
            ...s.msg,
            background: msg.startsWith('오류') ? '#ffebee' : '#e8f5e9',
            color: msg.startsWith('오류') ? '#c62828' : '#2e7d32',
          }}>
            {msg}
          </div>
        )}

        {/* 현장설정 탭 */}
        {tab === 'sites' && (
          <div style={s.tableCard}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>퇴직공제 대상 현장</div>
            {loading ? <div style={s.loadingCell}>로딩 중...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['현장명', '계약번호', '등록일', '활성'].map((h) => <th key={h} style={s.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sites.length === 0 ? (
                      <tr><td colSpan={4} style={s.emptyCell}>등록된 현장 없음</td></tr>
                    ) : sites.map((site) => (
                      <tr key={site.id} style={s.tr}>
                        <td style={s.td}>{site.siteName}<br /><span style={{ fontSize: '11px', color: '#999' }}>{site.siteId}</span></td>
                        <td style={s.td}>{site.contractNumber ?? '-'}</td>
                        <td style={s.td}>{new Date(site.createdAt).toLocaleDateString('ko-KR')}</td>
                        <td style={s.td}>
                          <button
                            onClick={() => toggleSite(site.id, site.enabledYn)}
                            style={{
                              ...s.toggleBtn,
                              background: site.enabledYn ? '#2e7d32' : '#9e9e9e',
                            }}
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
          <div style={s.tableCard}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>퇴직공제 대상 근로자</div>
            {loading ? <div style={s.loadingCell}>로딩 중...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['근로자', '소속', '가입일', '등록일', '활성'].map((h) => <th key={h} style={s.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {workers.length === 0 ? (
                      <tr><td colSpan={5} style={s.emptyCell}>등록된 근로자 없음</td></tr>
                    ) : workers.map((w) => (
                      <tr key={w.id} style={s.tr}>
                        <td style={s.td}>{w.workerName}<br /><span style={{ fontSize: '11px', color: '#999' }}>{w.workerId}</span></td>
                        <td style={s.td}>{w.company}</td>
                        <td style={s.td}>{w.joinDate ? new Date(w.joinDate).toLocaleDateString('ko-KR') : '-'}</td>
                        <td style={s.td}>{new Date(w.createdAt).toLocaleDateString('ko-KR')}</td>
                        <td style={s.td}>
                          <button
                            onClick={() => toggleWorker(w.id, w.enabledYn)}
                            style={{
                              ...s.toggleBtn,
                              background: w.enabledYn ? '#2e7d32' : '#9e9e9e',
                            }}
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
          <div style={s.tableCard}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>일별 퇴직공제 내역</div>
            {loading ? <div style={s.loadingCell}>로딩 중...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['날짜', '근로자', '현장', '인정여부', '인정공수', '수동보정', '사유'].map((h) => <th key={h} style={s.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRecords.length === 0 ? (
                      <tr><td colSpan={7} style={s.emptyCell}>데이터 없음</td></tr>
                    ) : dailyRecords.map((r) => (
                      <tr key={r.id} style={s.tr}>
                        <td style={s.td}>{r.date}</td>
                        <td style={s.td}>{r.workerName}</td>
                        <td style={s.td}>{r.siteName}</td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>
                          <span style={{ color: r.recognizedYn ? '#2e7d32' : '#9e9e9e', fontWeight: 600, fontSize: '12px' }}>
                            {r.recognizedYn ? '인정' : '미인정'}
                          </span>
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>{r.recognizedMandays}</td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>
                          <span style={{ color: r.manualOverride ? '#e65100' : '#9e9e9e', fontSize: '12px' }}>
                            {r.manualOverride ? '보정' : '-'}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontSize: '12px', color: '#A0AEC0' }}>{r.overrideReason ?? '-'}</td>
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
          <div style={s.tableCard}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: '14px' }}>월별 퇴직공제 요약</div>
            {loading ? <div style={s.loadingCell}>로딩 중...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['귀속연월', '근로자', '현장', '인정일수', '인정공수', '상태'].map((h) => <th key={h} style={s.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRecords.length === 0 ? (
                      <tr><td colSpan={6} style={s.emptyCell}>데이터 없음</td></tr>
                    ) : monthlyRecords.map((r) => (
                      <tr key={r.id} style={s.tr}>
                        <td style={s.td}>{r.monthKey}</td>
                        <td style={s.td}>{r.workerName}</td>
                        <td style={s.td}>{r.siteName}</td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>{r.recognizedDays}일</td>
                        <td style={{ ...s.td, textAlign: 'center' as const }}>{r.recognizedMandays}</td>
                        <td style={s.td}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: r.status === 'CONFIRMED' ? '#2e7d32' : r.status === 'EXPORTED' ? '#1565c0' : '#888',
                          }}>
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
          <div style={s.generateCard}>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>퇴직공제 자료 생성</div>
            <p style={{ fontSize: '13px', color: '#A0AEC0', marginBottom: '20px' }}>
              선택한 귀속연월의 퇴직공제 신고 기초자료를 생성합니다.
            </p>
            <button
              onClick={runExport}
              disabled={exporting}
              style={{ ...s.btn, background: '#7b1fa2', opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? '생성 중...' : `${monthKey} 퇴직공제 자료 생성`}
            </button>

            {exportResult && (
              <div style={{ marginTop: '20px', padding: '16px', background: '#e8f5e9', borderRadius: '8px', fontSize: '13px', color: '#2e7d32' }}>
                생성 완료 — {exportResult.count}건 / {exportResult.message}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                       label: '대시보드' },
  { href: '/admin/workers',               label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
  { href: '/admin/sites',                 label: '현장 관리' },
  { href: '/admin/attendance',            label: '출퇴근 조회' },
  { href: '/admin/presence-checks',       label: '체류확인 현황' },
  { href: '/admin/presence-report',       label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',    label: '근무확정' },
  { href: '/admin/contracts',             label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility', label: '보험판정' },
  { href: '/admin/wage-calculations',     label: '세금/노임 계산' },
  { href: '/admin/filing-exports',        label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',     label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',  label: '노무비 집계' },
  { href: '/admin/month-closings',        label: '월마감' },
  { href: '/admin/corrections',           label: '정정 이력' },
  { href: '/admin/exceptions',            label: '예외 승인' },
  { href: '/admin/device-requests',       label: '기기 변경' },
]

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar:      { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 24px' },
  input:        { padding: '8px 10px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '14px', background: 'white' },
  btn:          { padding: '8px 16px', background: '#F47920', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  msg:          { padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' },
  generateCard: { background: '#243144', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  tableCard:    { background: '#243144', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#CBD5E0', borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign: 'top' as const },
  tr:           { cursor: 'default' },
  loadingCell:  { padding: '32px', textAlign: 'center' as const, color: '#999' },
  emptyCell:    { textAlign: 'center' as const, padding: '24px', color: '#999' },
  toggleBtn:    { padding: '4px 12px', color: 'white', border: 'none', borderRadius: '99px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
}
