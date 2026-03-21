'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contract {
  id: string
  contractType: string
  startDate: string
  endDate: string | null
  dailyWage: number
  monthlySalary: number | null
  isActive: boolean
  taxRuleType: string
  notes: string | null
  worker: { id: string; name: string; company: string }
  site: { id: string; name: string } | null
}

interface Worker { id: string; name: string; phone: string; company: string; jobTitle: string; employmentType: string; incomeType: string; organizationType: string; retirementMutualTargetYn: boolean }
interface Site   { id: string; name: string }

const CONTRACT_LABEL: Record<string, string> = { EMPLOYMENT: '근로계약', DAILY: '일용계약', SERVICE: '용역(3.3%)' }
const EMP_LABEL:      Record<string, string> = { REGULAR: '상용', DAILY_CONSTRUCTION: '건설일용', BUSINESS_33: '3.3%사업', OTHER: '기타' }
const ORG_LABEL:      Record<string, string> = { DIRECT: '직영', SUBCONTRACTOR: '협력사' }

const emptyWorkerForm = {
  name: '', phone: '', company: '', jobTitle: '',
  employmentType: 'DAILY_CONSTRUCTION', incomeType: 'DAILY_WAGE',
  organizationType: 'DIRECT', skillLevel: '', bankName: '', bankAccount: '',
  retirementMutualTargetYn: false, foreignerYn: false,
}

export default function ContractsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'workers' | 'contracts'>('workers')

  // Workers state
  const [workers, setWorkers]   = useState<Worker[]>([])
  const [wLoading, setWLoading] = useState(false)
  const [wSearch, setWSearch]   = useState('')
  const [showWForm, setShowWForm] = useState(false)
  const [wForm, setWForm]       = useState(emptyWorkerForm)
  const [wSaving, setWSaving]   = useState(false)
  const [editWorker, setEditWorker] = useState<Worker | null>(null)

  // Contracts state
  const [contracts, setContracts] = useState<Contract[]>([])
  const [cLoading, setCLoading]   = useState(false)
  const [sites, setSites]         = useState<Site[]>([])
  const [showCForm, setShowCForm] = useState(false)
  const [cForm, setCForm] = useState({
    workerId: '', siteId: '', contractType: 'DAILY', startDate: '', endDate: '',
    dailyWage: '', monthlySalary: '', taxRuleType: 'DAILY_WAGE', notes: '',
    retirementMutualRuleType: 'DEFAULT',
  })
  const [cSaving, setCSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadWorkers = useCallback(() => {
    setWLoading(true)
    fetch(`/api/admin/workers?search=${encodeURIComponent(wSearch)}&pageSize=100`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setWorkers(d.data.items)
        setWLoading(false)
      })
  }, [wSearch, router])

  const loadContracts = useCallback(() => {
    setCLoading(true)
    Promise.all([
      fetch('/api/admin/contracts').then((r) => r.json()),
      fetch('/api/admin/sites').then((r) => r.json()),
    ]).then(([cd, sd]) => {
      if (cd.success) setContracts(cd.data.items)
      if (sd.success) setSites(sd.data.items ?? sd.data)
      setCLoading(false)
    })
  }, [])

  useEffect(() => { loadWorkers() }, [loadWorkers])
  useEffect(() => { loadContracts() }, [loadContracts])

  const saveWorker = async () => {
    if (!wForm.name || !wForm.phone) { setMsg('이름과 전화번호를 입력하세요'); return }
    setWSaving(true)
    const url    = editWorker ? `/api/admin/workers/${editWorker.id}` : '/api/admin/workers'
    const method = editWorker ? 'PATCH' : 'POST'
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wForm),
    }).then((r) => r.json())
    setWSaving(false)
    if (r.success) { setShowWForm(false); setEditWorker(null); setWForm(emptyWorkerForm); loadWorkers() }
    else setMsg('저장 실패: ' + r.message)
  }

  const saveContract = async () => {
    if (!cForm.workerId || !cForm.startDate || !cForm.contractType) { setMsg('근로자, 계약유형, 시작일을 입력하세요'); return }
    setCSaving(true)
    const r = await fetch('/api/admin/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cForm, dailyWage: parseInt(cForm.dailyWage) || 0 }),
    }).then((r) => r.json())
    setCSaving(false)
    if (r.success) { setShowCForm(false); loadContracts() }
    else setMsg('저장 실패: ' + r.message)
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR') + '원'

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(item.href === '/admin/contracts' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} style={s.logoutBtn}>로그아웃</button>
      </nav>

      <main style={s.main}>
        <h1 style={s.pageTitle}>인력/계약 관리</h1>
        {msg && <div style={s.msg}>{msg}</div>}

        {/* 탭 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {(['workers', 'contracts'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}>
              {t === 'workers' ? '근로자 목록' : '계약 목록'}
            </button>
          ))}
        </div>

        {tab === 'workers' && (
          <>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <input placeholder="이름/전화 검색" value={wSearch} onChange={(e) => setWSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadWorkers()} style={s.input} />
              <button onClick={loadWorkers} style={s.btn}>검색</button>
              <button onClick={() => { setEditWorker(null); setWForm(emptyWorkerForm); setShowWForm(true) }} style={{ ...s.btn, background: '#2e7d32' }}>+ 근로자 등록</button>
            </div>
            <div style={s.tableCard}>
              {wLoading ? <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>로딩 중...</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>{['이름', '전화', '회사', '직종', '고용형태', '소득유형', '소속', '퇴직공제'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {workers.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>데이터 없음</td></tr>
                      ) : workers.map((w) => (
                        <tr key={w.id} style={s.tr} onClick={() => { setEditWorker(w); setWForm({ ...emptyWorkerForm, name: w.name, employmentType: w.employmentType, incomeType: w.incomeType, organizationType: w.organizationType, phone: w.phone ?? '', company: w.company ?? '', jobTitle: w.jobTitle ?? '' }); setShowWForm(true) }}>
                          <td style={s.td}>{w.name}</td>
                          <td style={s.td}>{w.phone}</td>
                          <td style={s.td}>{w.company}</td>
                          <td style={s.td}>{w.jobTitle}</td>
                          <td style={s.td}>{EMP_LABEL[w.employmentType] ?? w.employmentType}</td>
                          <td style={s.td}>{w.incomeType}</td>
                          <td style={s.td}>{ORG_LABEL[w.organizationType] ?? w.organizationType}</td>
                          <td style={s.td}>{w.retirementMutualTargetYn ? '✅ 대상' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'contracts' && (
          <>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button onClick={() => setShowCForm(true)} style={{ ...s.btn, background: '#2e7d32' }}>+ 계약 등록</button>
            </div>
            <div style={s.tableCard}>
              {cLoading ? <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>로딩 중...</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>{['근로자', '현장', '계약유형', '시작일', '종료일', '일당', '세금구분', '상태'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {contracts.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>데이터 없음</td></tr>
                      ) : contracts.map((c) => (
                        <tr key={c.id} style={s.tr}>
                          <td style={s.td}>{c.worker.name}<br /><span style={{ fontSize: '11px', color: '#999' }}>{c.worker.company}</span></td>
                          <td style={s.td}>{c.site?.name ?? '-'}</td>
                          <td style={s.td}>{CONTRACT_LABEL[c.contractType] ?? c.contractType}</td>
                          <td style={s.td}>{c.startDate}</td>
                          <td style={s.td}>{c.endDate ?? '계속'}</td>
                          <td style={{ ...s.td, textAlign: 'right' as const }}>{fmt(c.dailyWage)}</td>
                          <td style={s.td}>{c.taxRuleType}</td>
                          <td style={s.td}><span style={{ color: c.isActive ? '#2e7d32' : '#888' }}>{c.isActive ? '유효' : '만료'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* 근로자 등록/수정 모달 */}
      {showWForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={{ margin: '0 0 16px' }}>{editWorker ? '근로자 정보 수정' : '근로자 등록'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: '이름*', key: 'name' },
                { label: '전화번호*', key: 'phone' },
                { label: '회사', key: 'company' },
                { label: '직종', key: 'jobTitle' },
                { label: '기술 등급', key: 'skillLevel' },
                { label: '은행명', key: 'bankName' },
                { label: '계좌번호', key: 'bankAccount' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label style={s.label}>{label}</label>
                  <input value={(wForm as unknown as Record<string, string>)[key] ?? ''} onChange={(e) => setWForm({ ...wForm, [key]: e.target.value })} style={{ ...s.input, width: '100%' }} />
                </div>
              ))}
              <div>
                <label style={s.label}>고용형태</label>
                <select value={wForm.employmentType} onChange={(e) => setWForm({ ...wForm, employmentType: e.target.value })} style={s.input}>
                  <option value="DAILY_CONSTRUCTION">건설일용</option>
                  <option value="REGULAR">상용</option>
                  <option value="BUSINESS_33">3.3% 사업소득</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>
              <div>
                <label style={s.label}>소득유형</label>
                <select value={wForm.incomeType} onChange={(e) => setWForm({ ...wForm, incomeType: e.target.value })} style={s.input}>
                  <option value="DAILY_WAGE">일용근로소득</option>
                  <option value="SALARY">급여(상용)</option>
                  <option value="BUSINESS_INCOME">사업소득</option>
                </select>
              </div>
              <div>
                <label style={s.label}>소속</label>
                <select value={wForm.organizationType} onChange={(e) => setWForm({ ...wForm, organizationType: e.target.value })} style={s.input}>
                  <option value="DIRECT">직영</option>
                  <option value="SUBCONTRACTOR">협력사</option>
                </select>
              </div>
            </div>
            {wForm.employmentType === 'BUSINESS_33' && (
              <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '13px', color: '#e65100' }}>
                ⚠️ 실질 근로자성을 먼저 검토하십시오. 출퇴근 통제·지휘감독 구조가 있는 경우 근로자성 리스크가 있습니다.
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={wForm.retirementMutualTargetYn}
                  onChange={(e) => setWForm({ ...wForm, retirementMutualTargetYn: e.target.checked })} />
                퇴직공제 대상
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={wForm.foreignerYn}
                  onChange={(e) => setWForm({ ...wForm, foreignerYn: e.target.checked })} />
                외국인
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={saveWorker} disabled={wSaving} style={{ ...s.btn, background: '#2e7d32' }}>{wSaving ? '저장 중...' : '저장'}</button>
              <button onClick={() => { setShowWForm(false); setEditWorker(null) }} style={s.btnCancel}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 계약 등록 모달 */}
      {showCForm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, width: '520px' }}>
            <h3 style={{ margin: '0 0 16px' }}>계약 등록</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={s.label}>근로자*</label>
                <select value={cForm.workerId} onChange={(e) => setCForm({ ...cForm, workerId: e.target.value })} style={{ ...s.input, width: '100%' }}>
                  <option value="">선택</option>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.company})</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={s.label}>현장</label>
                <select value={cForm.siteId} onChange={(e) => setCForm({ ...cForm, siteId: e.target.value })} style={{ ...s.input, width: '100%' }}>
                  <option value="">전체 현장 적용</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>계약유형*</label>
                <select value={cForm.contractType} onChange={(e) => setCForm({ ...cForm, contractType: e.target.value })} style={s.input}>
                  <option value="DAILY">일용계약</option>
                  <option value="EMPLOYMENT">근로계약</option>
                  <option value="SERVICE">용역(3.3%)</option>
                </select>
              </div>
              <div>
                <label style={s.label}>세금구분</label>
                <select value={cForm.taxRuleType} onChange={(e) => setCForm({ ...cForm, taxRuleType: e.target.value })} style={s.input}>
                  <option value="DAILY_WAGE">일용근로소득</option>
                  <option value="SALARY">상용급여</option>
                  <option value="BUSINESS_33">3.3%사업소득</option>
                </select>
              </div>
              <div>
                <label style={s.label}>시작일*</label>
                <input type="date" value={cForm.startDate} onChange={(e) => setCForm({ ...cForm, startDate: e.target.value })} style={s.input} />
              </div>
              <div>
                <label style={s.label}>종료일</label>
                <input type="date" value={cForm.endDate} onChange={(e) => setCForm({ ...cForm, endDate: e.target.value })} style={s.input} />
              </div>
              <div>
                <label style={s.label}>일당(원)</label>
                <input type="number" value={cForm.dailyWage} onChange={(e) => setCForm({ ...cForm, dailyWage: e.target.value })} style={s.input} />
              </div>
              <div>
                <label style={s.label}>퇴직공제 규칙</label>
                <select value={cForm.retirementMutualRuleType} onChange={(e) => setCForm({ ...cForm, retirementMutualRuleType: e.target.value })} style={s.input}>
                  <option value="DEFAULT">기본</option>
                  <option value="EXCLUDE">제외</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={s.label}>메모</label>
                <input value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} style={{ ...s.input, width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={saveContract} disabled={cSaving} style={{ ...s.btn, background: '#2e7d32' }}>{cSaving ? '저장 중...' : '저장'}</button>
              <button onClick={() => setShowCForm(false)} style={s.btnCancel}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                      label: '대시보드' },
  { href: '/admin/workers',              label: '근로자 관리' },
  { href: '/admin/sites',                label: '현장 관리' },
  { href: '/admin/attendance',           label: '출퇴근 조회' },
  { href: '/admin/presence-checks',      label: '체류확인 현황' },
  { href: '/admin/presence-report',      label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',   label: '근무확정' },
  { href: '/admin/contracts',            label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility', label: '보험판정' },
  { href: '/admin/wage-calculations',    label: '세금/노임 계산' },
  { href: '/admin/filing-exports',       label: '신고자료 내보내기' },
  { href: '/admin/exceptions',           label: '예외 승인' },
  { href: '/admin/device-requests',      label: '기기 변경' },
]

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:      { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase' as const, letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0 0 24px' },
  input:        { padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', background: 'white' },
  btn:          { padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  btnCancel:    { padding: '8px 16px', background: '#f5f5f5', color: '#555', border: '1px solid #e0e0e0', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  tabBtn:       { padding: '8px 20px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  tabActive:    { background: '#1976d2', color: 'white', border: '1px solid #1976d2', fontWeight: 700 },
  msg:          { padding: '12px 16px', background: '#e3f2fd', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', color: '#1565c0' },
  tableCard:    { background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const },
  th:           { padding: '12px 16px', textAlign: 'left' as const, fontSize: '12px', fontWeight: 600, color: '#666', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#333', borderBottom: '1px solid #f9f9f9', verticalAlign: 'top' as const },
  tr:           { cursor: 'pointer' },
  overlay:      { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: 'white', borderRadius: '16px', padding: '32px', width: '480px', maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflow: 'auto' },
  label:        { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 },
}
