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
    <div className="flex min-h-screen bg-brand">
      <nav className="w-[220px] bg-brand-dark py-6 flex-shrink-0 flex flex-col">
        <div className="text-white text-base font-bold px-5 pb-6 border-b border-white/10">해한 출퇴근</div>
        <div className="text-white/40 text-[11px] px-5 pt-4 pb-2 uppercase tracking-widest">관리</div>
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            className={`block px-5 py-2.5 text-[13px] no-underline transition-colors ${item.href === '/admin/companies' ? 'bg-white/10 text-white font-bold' : 'text-white/80 hover:text-white'}`}>
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))}
          className="mx-5 mt-6 py-2.5 bg-white/10 border-none rounded-md text-white/60 cursor-pointer text-[13px]"
        >로그아웃</button>
      </nav>

      <main className="flex-1 p-8 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold m-0">회사 관리</h1>
          <button onClick={openCreate} className="btn-primary">+ 회사 등록</button>
        </div>

        {msg && (
          <div className={`rounded-lg px-4 py-3 mb-4 text-sm ${msg.includes('완료') ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#ffebee] text-[#c62828]'}`}>
            {msg}
          </div>
        )}

        {/* 필터 */}
        <div className="flex gap-2.5 mb-4 flex-wrap items-center">
          <input
            placeholder="회사명, 사업자번호 검색..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="input-base min-w-[220px]"
          />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-base">
            <option value="">전체 유형</option>
            {Object.entries(COMPANY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="text-[13px] text-muted-brand cursor-pointer flex items-center gap-1">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            비활성 포함
          </label>
          <span className="text-[13px] text-muted-brand">총 {total}건</span>
        </div>

        {/* 등록/수정 폼 */}
        {showForm && (
          <div className="bg-card rounded-xl p-6 mb-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <h3 className="m-0 mb-4 text-base">{editId ? '회사 수정' : '회사 등록'}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
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
                  <label className="block text-xs text-muted-brand mb-1 font-semibold">{label}</label>
                  <input
                    value={(form as Record<string, string>)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="input-base"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-muted-brand mb-1 font-semibold">회사 유형</label>
                <select value={form.companyType} onChange={e => setForm(f => ({ ...f, companyType: e.target.value }))} className="input-base">
                  {Object.entries(COMPANY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-muted-brand mb-1 font-semibold">메모</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="input-base resize-y"
                />
              </div>
            </div>
            {msg && <div className="text-[#c62828] text-[13px] mt-2">{msg}</div>}
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving} className={`btn-primary ${saving ? 'opacity-60' : ''}`}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-[#888] text-white border-none rounded-lg cursor-pointer text-sm font-semibold">취소</button>
            </div>
          </div>
        )}

        {/* 테이블 */}
        <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          {loading ? (
            <div className="py-8 text-center text-[#999]">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[rgba(91,164,217,0.15)]">
                    {['회사명', '유형', '사업자번호', '대표자', '담당자', '근로자', '현장', '상태', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-brand uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-[#999]">등록된 회사가 없습니다.</td></tr>
                  ) : companies.map(c => (
                    <tr key={c.id} className={`border-b border-[rgba(91,164,217,0.08)] hover:bg-[rgba(91,164,217,0.04)] transition-colors ${c.isActive ? '' : 'opacity-50'}`}>
                      <td className="px-4 py-3 text-sm text-[#CBD5E0]">
                        <div className="font-semibold">{c.companyName}</div>
                        {c.companyCode && <div className="text-[11px] text-muted-brand">{c.companyCode}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#CBD5E0]">
                        <span className="bg-[rgba(244,121,32,0.12)] text-accent px-2 py-0.5 rounded-[10px] text-[11px] font-semibold">
                          {COMPANY_TYPES[c.companyType] ?? c.companyType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-brand">{c.businessNumber ?? '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-[#CBD5E0]">{c.representativeName ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-[#CBD5E0]">{c.contactName ? `${c.contactName}${c.contactPhone ? ` (${c.contactPhone})` : ''}` : '-'}</td>
                      <td className="px-4 py-3 text-sm text-[#CBD5E0] text-center">{c._count.workerAssignments}명</td>
                      <td className="px-4 py-3 text-sm text-[#CBD5E0] text-center">{c._count.siteAssignments}개</td>
                      <td className="px-4 py-3 text-sm text-[#CBD5E0]">
                        <span className={`font-semibold text-xs ${c.isActive ? 'text-[#2e7d32]' : 'text-[#999]'}`}>{c.isActive ? '활성' : '비활성'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#CBD5E0]">
                        <button onClick={() => openEdit(c)} className="px-2.5 py-1 bg-transparent border border-white/[0.12] rounded text-xs text-secondary-brand cursor-pointer">수정</button>
                        {c.isActive && (
                          <button onClick={() => handleDeactivate(c.id, c.companyName)} className="px-2.5 py-1 bg-transparent border border-white/[0.12] rounded text-xs text-[#c62828] cursor-pointer ml-1">비활성화</button>
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
