'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const COMPANY_TYPES: Record<string, string> = {
  SELF: '자사',
  PARTNER: '협력사',
  SUBCONTRACTOR: '하도사',
  SECOND_TIER_SUBCONTRACTOR: '재하도사',
  LABOR_AGENCY: '인력사무소',
  SOLE_PROPRIETOR: '개인사업자',
  OTHER: '기타',
}

interface Company {
  id: string
  companyCode: string | null
  companyName: string
  businessNumber: string | null
  representativeName: string | null
  companyType: string
  contactName: string | null
  contactPhone: string | null
  email: string | null
  address: string | null
  isActive: boolean
  notes: string | null
  createdAt: string
  _count: { workerAssignments: number; siteAssignments: number }
}

const EMPTY_FORM = {
  companyName: '', companyCode: '', businessNumber: '', corpNumber: '',
  representativeName: '', companyType: 'OTHER', contactName: '', contactPhone: '',
  email: '', address: '', notes: '',
}

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '100' })
      if (q) params.set('q', q)
      if (typeFilter) params.set('companyType', typeFilter)
      if (!showInactive) params.set('isActive', 'true')
      const res = await fetch(`/api/admin/companies?${params}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      const data = await res.json()
      setCompanies(data.data?.items ?? [])
      setTotal(data.data?.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [q, typeFilter, showInactive, router])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setMsg('')
  }

  const openEdit = (c: Company) => {
    setEditId(c.id)
    setForm({
      companyName: c.companyName,
      companyCode: c.companyCode ?? '',
      businessNumber: c.businessNumber ?? '',
      corpNumber: '',
      representativeName: c.representativeName ?? '',
      companyType: c.companyType,
      contactName: c.contactName ?? '',
      contactPhone: c.contactPhone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
    })
    setShowForm(true)
    setMsg('')
  }

  const handleSave = async () => {
    if (!form.companyName.trim()) { setMsg('회사명을 입력하세요.'); return }
    setSaving(true)
    setMsg('')
    try {
      const url = editId ? `/api/admin/companies/${editId}` : '/api/admin/companies'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          companyCode: form.companyCode || null,
          businessNumber: form.businessNumber || null,
          corpNumber: form.corpNumber || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(editId ? '수정 완료' : '등록 완료')
        setShowForm(false)
        load()
      } else {
        setMsg(data.error ?? '저장 실패')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`${name} 회사를 비활성화하시겠습니까?`)) return
    const res = await fetch(`/api/admin/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    if (res.ok) { setMsg('비활성화 완료'); load() }
  }

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            style={{ ...s.navItem, ...(item.href === '/admin/companies' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))}
          style={s.logoutBtn}
        >로그아웃</button>
      </nav>

      <main style={s.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={s.pageTitle}>회사 관리</h1>
          <button onClick={openCreate} style={s.btn}>+ 회사 등록</button>
        </div>

        {msg && (
          <div style={{ background: msg.includes('완료') ? '#e8f5e9' : '#ffebee', color: msg.includes('완료') ? '#2e7d32' : '#c62828', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' }}>
            {msg}
          </div>
        )}

        {/* 필터 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="회사명, 사업자번호 검색..."
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ ...s.input, minWidth: '220px' }}
          />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={s.input}>
            <option value="">전체 유형</option>
            {Object.entries(COMPANY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label style={{ fontSize: '13px', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            비활성 포함
          </label>
          <span style={{ fontSize: '13px', color: '#888' }}>총 {total}건</span>
        </div>

        {/* 등록/수정 폼 */}
        {showForm && (
          <div style={s.formCard}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>{editId ? '회사 수정' : '회사 등록'}</h3>
            <div style={s.formGrid}>
              {[
                { label: '회사명*', key: 'companyName', placeholder: '(주)해한건설' },
                { label: '회사코드', key: 'companyCode', placeholder: 'HH001' },
                { label: '사업자번호', key: 'businessNumber', placeholder: '123-45-67890' },
                { label: '법인번호', key: 'corpNumber', placeholder: '(선택)' },
                { label: '대표자명', key: 'representativeName', placeholder: '' },
                { label: '담당자명', key: 'contactName', placeholder: '' },
                { label: '담당자 연락처', key: 'contactPhone', placeholder: '010-0000-0000' },
                { label: '이메일', key: 'email', placeholder: '' },
                { label: '주소', key: 'address', placeholder: '' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={s.label}>{label}</label>
                  <input
                    value={(form as Record<string, string>)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={s.input}
                  />
                </div>
              ))}
              <div>
                <label style={s.label}>회사 유형</label>
                <select value={form.companyType} onChange={e => setForm(f => ({ ...f, companyType: e.target.value }))} style={s.input}>
                  {Object.entries(COMPANY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>메모</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  style={{ ...s.input, resize: 'vertical' as const }}
                />
              </div>
            </div>
            {msg && <div style={{ color: '#c62828', fontSize: '13px', marginTop: '8px' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={handleSave} disabled={saving} style={{ ...s.btn, opacity: saving ? 0.6 : 1 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setShowForm(false)} style={{ ...s.btn, background: '#888' }}>취소</button>
            </div>
          </div>
        )}

        {/* 테이블 */}
        <div style={s.tableCard}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>로딩 중...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['회사명', '유형', '사업자번호', '대표자', '담당자', '근로자', '현장', '상태', ''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#999' }}>등록된 회사가 없습니다.</td></tr>
                  ) : companies.map(c => (
                    <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.5 }}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600 }}>{c.companyName}</div>
                        {c.companyCode && <div style={{ fontSize: '11px', color: '#888' }}>{c.companyCode}</div>}
                      </td>
                      <td style={s.td}><span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{COMPANY_TYPES[c.companyType] ?? c.companyType}</span></td>
                      <td style={{ ...s.td, fontSize: '12px', color: '#888' }}>{c.businessNumber ?? '-'}</td>
                      <td style={{ ...s.td, fontSize: '13px' }}>{c.representativeName ?? '-'}</td>
                      <td style={{ ...s.td, fontSize: '12px' }}>{c.contactName ? `${c.contactName}${c.contactPhone ? ` (${c.contactPhone})` : ''}` : '-'}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{c._count.workerAssignments}명</td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>{c._count.siteAssignments}개</td>
                      <td style={s.td}><span style={{ color: c.isActive ? '#2e7d32' : '#999', fontWeight: 600, fontSize: '12px' }}>{c.isActive ? '활성' : '비활성'}</span></td>
                      <td style={s.td}>
                        <button onClick={() => openEdit(c)} style={s.actionBtn}>수정</button>
                        {c.isActive && (
                          <button onClick={() => handleDeactivate(c.id, c.companyName)} style={{ ...s.actionBtn, color: '#c62828', marginLeft: '4px' }}>비활성화</button>
                        )}
                      </td>
                    </tr>
                  ))}
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
  { href: '/admin',                         label: '대시보드' },
  { href: '/admin/companies',               label: '회사 관리' },
  { href: '/admin/workers',                 label: '근로자 관리' },
  { href: '/admin/sites',                   label: '현장 관리' },
  { href: '/admin/attendance',              label: '출퇴근 조회' },
  { href: '/admin/presence-checks',         label: '체류확인 현황' },
  { href: '/admin/presence-report',         label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',      label: '근무확정' },
  { href: '/admin/contracts',               label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility',   label: '보험판정' },
  { href: '/admin/wage-calculations',       label: '세금/노임 계산' },
  { href: '/admin/filing-exports',          label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',       label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',    label: '노무비 집계' },
  { href: '/admin/subcontractor-settlements', label: '협력사 정산' },
  { href: '/admin/document-center',         label: '서식 출력 센터' },
  { href: '/admin/month-closings',          label: '월마감' },
  { href: '/admin/corrections',             label: '정정 이력' },
  { href: '/admin/exceptions',              label: '예외 승인' },
  { href: '/admin/device-requests',         label: '기기 변경' },
]

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:      { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0' },
  label:        { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 600 },
  input:        { width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  btn:          { padding: '10px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  actionBtn:    { padding: '4px 10px', background: 'none', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#1976d2' },
  formCard:     { background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  formGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },
  tableCard:    { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th:           { background: '#f8f9fa', padding: '12px 14px', textAlign: 'left' as const, fontWeight: 600, color: '#555', borderBottom: '1px solid #e0e0e0', whiteSpace: 'nowrap' as const },
  td:           { padding: '12px 14px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle' as const },
}
