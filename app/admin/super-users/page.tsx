'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface AdminAccount {
  id: string
  name: string
  email: string
  role: string
  companyId: string | null
  companyName: string
  companyVerificationStatus: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface Company {
  id: string
  companyName: string
}

// 사용자 화면 표시 문구 — 외주/하도급 등 민감 표현 없이 관리 범위 중심으로 기술
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN:          '슈퍼관리자',
  ADMIN:                '관리자',
  VIEWER:               '뷰어',
  COMPANY_ADMIN:        '전체 현장 관리',    // 자기 회사 전체 현장 접근
  SITE_ADMIN:           '담당 현장 관리',    // SiteAdminAssignment로 지정한 현장만 접근
  EXTERNAL_SITE_ADMIN:  '지정 현장 운영형',  // 접근 그룹으로 복수 현장 관리, 회사 데이터 차단
}
const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN:          '#1a237e',
  ADMIN:                '#1565c0',
  VIEWER:               '#455a64',
  COMPANY_ADMIN:        '#2e7d32',
  SITE_ADMIN:           '#e65100',
  EXTERNAL_SITE_ADMIN:  '#6a1b9a',
}

export default function SuperUsersPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'EXTERNAL_SITE_ADMIN', companyId: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [filterRole, setFilterRole] = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, cRes] = await Promise.all([
      fetch('/api/admin/admin-users?pageSize=500').then((r) => r.json()),
      fetch('/api/admin/companies?pageSize=200').then((r) => r.json()),
    ])
    const allUsers = (usersRes.data?.items ?? []) as AdminAccount[]
    const cos: Company[] = cRes.data?.items ?? cRes.data ?? []
    setCompanies(cos)
    setAccounts(allUsers)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) { setMsg('이름, 이메일, 비밀번호를 입력하세요.'); return }
    if (['COMPANY_ADMIN', 'EXTERNAL_SITE_ADMIN'].includes(form.role) && !form.companyId) { setMsg('소속 업체를 선택하세요.'); return }
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/admin/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      form.name,
          email:     form.email,
          password:  form.password,
          role:      form.role,
          companyId: form.companyId || null,
        }),
      })
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? data.error ?? '생성 실패'); return }
      setMsg('계정이 생성되었습니다.')
      setShowForm(false)
      setForm({ name: '', email: '', password: '', role: 'SITE_ADMIN', companyId: '' })
      load()
    } finally { setSaving(false) }
  }

  const activate = async (id: string) => {
    setMsg('')
    const res = await fetch(`/api/admin/admin-users/${id}/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const d = await res.json()
    if (res.ok) {
      setMsg('계정이 활성화되었습니다.')
      load()
    } else {
      const unmet = d.unmet?.join(', ')
      setMsg(`활성화 실패: ${unmet ?? d.error ?? '조건 미충족'}`)
    }
  }

  const deactivate = async (id: string) => {
    setMsg('')
    await fetch(`/api/admin/admin-users/${id}/deactivate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    setMsg('계정이 비활성화되었습니다.')
    load()
  }

  const filtered = filterRole === 'ALL' ? accounts : accounts.filter((a) => a.role === filterRole)

  return (
    <div className="px-8 py-8 max-w-[1100px] mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[22px] font-bold m-0">업체 관리자 계정</h1>
          <p className="text-[#A0AEC0] text-[13px] mt-1 mb-0">전체 {accounts.length}개 계정</p>
        </div>
        <button className="px-5 py-[10px] bg-[#1a1a2e] text-white border-none rounded-lg cursor-pointer text-[14px] font-semibold" onClick={() => { setShowForm(true); setMsg('') }}>+ 계정 생성</button>
      </div>

      {msg && <p className={`mb-3 text-[13px] ${msg.includes('생성') || msg.includes('완료') ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>{msg}</p>}

      <div className="flex gap-2 mb-4 flex-wrap">
        {['ALL', 'SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COMPANY_ADMIN', 'SITE_ADMIN', 'EXTERNAL_SITE_ADMIN'].map((r) => (
          <button
            key={r}
            className={`px-[14px] py-[6px] border-none rounded-md cursor-pointer text-[13px] ${filterRole === r ? 'bg-[#1a1a2e] text-white' : 'bg-footer text-[#333]'}`}
            onClick={() => setFilterRole(r)}
          >
            {r === 'ALL' ? '전체' : ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-brand border border-[rgba(91,164,217,0.3)] rounded-[12px] p-5 mb-6">
          <h3 className="mt-0 mb-4 text-[15px]">관리자 계정 생성</h3>
          <div className="grid gap-[10px_12px] items-center mb-4 [grid-template-columns:100px_1fr]">
            <label className="text-[13px] font-semibold text-muted-brand">이름 *</label>
            <input className="px-[12px] py-[10px] text-[14px] border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border bg-card" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" />
            <label className="text-[13px] font-semibold text-muted-brand">이메일 *</label>
            <input className="px-[12px] py-[10px] text-[14px] border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border bg-card" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@company.com" />
            <label className="text-[13px] font-semibold text-muted-brand">비밀번호 *</label>
            <input className="px-[12px] py-[10px] text-[14px] border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border bg-card" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8자 이상" />
            <label className="text-[13px] font-semibold text-muted-brand">역할 *</label>
            <select className="px-[12px] py-[10px] text-[14px] border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border bg-card" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, companyId: '' })}>
              {['EXTERNAL_SITE_ADMIN', 'SITE_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'VIEWER', 'SUPER_ADMIN'].map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]} ({r})</option>
              ))}
            </select>
            {form.role === 'COMPANY_ADMIN' && (
              <>
                <label className="text-[13px] font-semibold text-muted-brand">소속 업체 *</label>
                <select className="px-[12px] py-[10px] text-[14px] border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border bg-card" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">업체 선택</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </>
            )}
            {form.role === 'SITE_ADMIN' && (
              <p className="col-span-full text-[12px] text-accent-hover m-0">
                ℹ SITE_ADMIN은 계정 생성 후 &quot;현장 관리자 배정&quot; 페이지에서 담당 현장을 지정하세요.
              </p>
            )}
            {form.role === 'EXTERNAL_SITE_ADMIN' && (
              <>
                <label className="text-[13px] font-semibold text-muted-brand">소속 업체 *</label>
                <select className="px-[12px] py-[10px] text-[14px] border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border bg-card" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">업체 선택</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
                <p className="col-span-full text-[12px] text-[#6a1b9a] m-0">
                  ℹ 계정 생성 후 &quot;현장 접근 그룹&quot; 페이지에서 운영 범위를 배정하세요. 배정된 현장 외에는 접근할 수 없습니다.
                </p>
              </>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button className="px-5 py-[10px] bg-[#1a1a2e] text-white border-none rounded-lg cursor-pointer text-[14px] font-semibold" onClick={handleCreate} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            <button className="px-5 py-[10px] bg-[#888] text-white border-none rounded-lg cursor-pointer text-[14px] font-semibold" onClick={() => setShowForm(false)}>취소</button>
          </div>
        </div>
      )}

      {loading ? <p>불러오는 중...</p> : (
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {['이름', '이메일', '역할', '소속 업체', '상태', '마지막 로그인', '생성일', '조작'].map((h) => (
                <th key={h} className="px-3 py-[10px] bg-brand border border-[rgba(255,255,255,0.12)] text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center px-3 py-8 text-muted-brand">계정이 없습니다.</td></tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} className={a.isActive ? '' : 'opacity-60'}>
                <td className="px-3 py-[10px] border border-brand font-semibold">{a.name}</td>
                <td className="px-3 py-[10px] border border-brand">{a.email}</td>
                <td className="px-3 py-[10px] border border-brand">
                  <span className="font-semibold text-[12px]" style={{ color: ROLE_COLOR[a.role] ?? '#333' }}>
                    {ROLE_LABEL[a.role] ?? a.role}
                  </span>
                </td>
                <td className="px-3 py-[10px] border border-brand">
                  {a.companyId ? (
                    <Link href={`/admin/companies/${a.companyId}`} className="text-secondary-brand no-underline">
                      {a.companyName}
                    </Link>
                  ) : '-'}
                </td>
                <td className="px-3 py-[10px] border border-brand">
                  <div className="flex flex-col gap-1">
                    <span className={`font-semibold ${a.isActive ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>
                      {a.isActive ? '활성' : '비활성'}
                    </span>
                    {a.role === 'EXTERNAL_SITE_ADMIN' && a.companyVerificationStatus && (
                      <span className={`text-[11px] px-[6px] py-[1px] rounded ${
                        a.companyVerificationStatus === 'VERIFIED'
                          ? 'bg-green-light text-[#2e7d32]'
                          : a.companyVerificationStatus === 'PENDING_VERIFICATION'
                          ? 'bg-[#fff8e1] text-[#f57f17]'
                          : 'bg-[#fce4ec] text-[#c62828]'
                      }`}>
                        {a.companyVerificationStatus === 'VERIFIED' ? '인증완료' : a.companyVerificationStatus === 'PENDING_VERIFICATION' ? '인증대기' : a.companyVerificationStatus}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-[10px] border border-brand">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('ko-KR') : '-'}</td>
                <td className="px-3 py-[10px] border border-brand">{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                <td className="px-3 py-[10px] border border-brand">
                  <div className="flex gap-1">
                    {!a.isActive && (
                      <button
                        className="px-3 py-1 bg-[#388e3c] text-white border-none rounded-md cursor-pointer text-[12px]"
                        onClick={() => activate(a.id)}
                      >
                        활성화
                      </button>
                    )}
                    {a.isActive && (
                      <button
                        className="px-3 py-1 bg-[#e53935] text-white border-none rounded-md cursor-pointer text-[12px]"
                        onClick={() => deactivate(a.id)}
                      >
                        비활성화
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
