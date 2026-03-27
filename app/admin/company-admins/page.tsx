'use client'

import { useState, useEffect, useCallback } from 'react'

interface CompanyAdmin {
  id: string
  name: string
  email: string
  companyId: string | null
  companyName: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface Company {
  id: string
  companyName: string
}

export default function CompanyAdminsPage() {
  const [admins, setAdmins] = useState<CompanyAdmin[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', companyId: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [a, c] = await Promise.all([
      fetch('/api/admin/company-admins').then((r) => r.json()),
      fetch('/api/admin/companies?limit=200').then((r) => r.json()),
    ])
    setAdmins(a.data ?? [])
    setCompanies(c.data?.items ?? c.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password || !form.companyId) {
      setMsg('모든 항목을 입력하세요.')
      return
    }
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/company-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) { setMsg(data.message); return }
      setMsg('생성 완료')
      setShowForm(false)
      setForm({ name: '', email: '', password: '', companyId: '' })
      load()
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/admin/company-admins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    load()
  }

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[22px] font-bold m-0">업체 관리자 계정</h1>
        <button
          className="px-5 py-[10px] bg-[#1a1a2e] text-white border-none rounded-lg cursor-pointer text-sm font-semibold"
          onClick={() => { setShowForm(true); setMsg('') }}
        >+ 계정 생성</button>
      </div>

      {msg && (
        <p className={`m-0 mb-3 text-[13px] ${msg.includes('완료') ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>{msg}</p>
      )}

      {showForm && (
        <div className="bg-brand border border-[rgba(91,164,217,0.3)] rounded-[12px] p-5 mb-6">
          <h3 className="m-0 mb-4 text-[15px] font-semibold">업체 관리자 계정 생성</h3>
          <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-[10px] items-center">
            <label className="text-[13px] font-semibold text-muted-brand">이름</label>
            <input
              className="px-3 py-[10px] text-sm border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="홍길동"
            />
            <label className="text-[13px] font-semibold text-muted-brand">이메일</label>
            <input
              className="px-3 py-[10px] text-sm border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="admin@company.com"
            />
            <label className="text-[13px] font-semibold text-muted-brand">비밀번호</label>
            <input
              className="px-3 py-[10px] text-sm border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="8자 이상"
            />
            <label className="text-[13px] font-semibold text-muted-brand">소속 업체</label>
            <select
              className="px-3 py-[10px] text-sm border border-[rgba(91,164,217,0.3)] rounded-lg w-full box-border"
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
            >
              <option value="">업체 선택</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              className="px-5 py-[10px] bg-[#1a1a2e] text-white border-none rounded-lg cursor-pointer text-sm font-semibold disabled:opacity-50"
              onClick={handleCreate}
              disabled={saving}
            >{saving ? '저장 중...' : '저장'}</button>
            <button
              className="px-5 py-[10px] bg-[#888] text-white border-none rounded-lg cursor-pointer text-sm font-semibold"
              onClick={() => setShowForm(false)}
            >취소</button>
          </div>
        </div>
      )}

      {loading ? <p>불러오는 중...</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {['이름', '이메일', '소속 업체', '상태', '마지막 로그인', '생성일', '조작'].map((h) => (
                <th
                  key={h}
                  className="px-3 py-[10px] bg-brand border border-[#E5E7EB] text-left font-semibold"
                >{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-brand">등록된 업체 관리자가 없습니다.</td>
              </tr>
            )}
            {admins.map((a) => (
              <tr key={a.id} className={a.isActive ? 'bg-white' : 'bg-[#fafafa]'}>
                <td className="px-3 py-[10px] border border-[#e0e0e0]">{a.name}</td>
                <td className="px-3 py-[10px] border border-[#e0e0e0]">{a.email}</td>
                <td className="px-3 py-[10px] border border-[#e0e0e0]">{a.companyName}</td>
                <td className="px-3 py-[10px] border border-[#e0e0e0]">
                  <span className={`font-semibold ${a.isActive ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>
                    {a.isActive ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-3 py-[10px] border border-[#e0e0e0]">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('ko-KR') : '-'}</td>
                <td className="px-3 py-[10px] border border-[#e0e0e0]">{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                <td className="px-3 py-[10px] border border-[#e0e0e0]">
                  <button
                    className={`px-3 py-1 text-white border-none rounded-md cursor-pointer text-xs ${a.isActive ? 'bg-[#e53935]' : 'bg-[#388e3c]'}`}
                    onClick={() => toggleActive(a.id, a.isActive)}
                  >
                    {a.isActive ? '정지' : '활성화'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
