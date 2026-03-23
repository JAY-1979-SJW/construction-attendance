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
    <div style={s.wrap}>
      <div style={s.header}>
        <h1 style={s.title}>업체 관리자 계정</h1>
        <button style={s.btn} onClick={() => { setShowForm(true); setMsg('') }}>+ 계정 생성</button>
      </div>

      {msg && <p style={{ color: msg.includes('완료') ? '#2e7d32' : '#c62828', margin: '0 0 12px', fontSize: 13 }}>{msg}</p>}

      {showForm && (
        <div style={s.formBox}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>업체 관리자 계정 생성</h3>
          <div style={s.grid}>
            <label style={s.label}>이름</label>
            <input style={s.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" />
            <label style={s.label}>이메일</label>
            <input style={s.input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@company.com" />
            <label style={s.label}>비밀번호</label>
            <input style={s.input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8자 이상" />
            <label style={s.label}>소속 업체</label>
            <select style={s.input} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">업체 선택</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button style={s.btn} onClick={handleCreate} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            <button style={{ ...s.btn, background: '#888' }} onClick={() => setShowForm(false)}>취소</button>
          </div>
        </div>
      )}

      {loading ? <p>불러오는 중...</p> : (
        <table style={s.table}>
          <thead>
            <tr>
              {['이름', '이메일', '소속 업체', '상태', '마지막 로그인', '생성일', '조작'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#A0AEC0' }}>등록된 업체 관리자가 없습니다.</td></tr>
            )}
            {admins.map((a) => (
              <tr key={a.id} style={{ background: a.isActive ? 'white' : '#fafafa' }}>
                <td style={s.td}>{a.name}</td>
                <td style={s.td}>{a.email}</td>
                <td style={s.td}>{a.companyName}</td>
                <td style={s.td}>
                  <span style={{ color: a.isActive ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                    {a.isActive ? '활성' : '비활성'}
                  </span>
                </td>
                <td style={s.td}>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('ko-KR') : '-'}</td>
                <td style={s.td}>{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                <td style={s.td}>
                  <button
                    style={{ ...s.smallBtn, background: a.isActive ? '#e53935' : '#388e3c' }}
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

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 32, maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  btn: { padding: '10px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  smallBtn: { padding: '4px 12px', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  formBox: { background: '#1B2838', border: '1px solid rgba(91,164,217,0.3)', borderRadius: 12, padding: 24, marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px 12px', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: 600, color: '#A0AEC0' },
  input: { padding: '10px 12px', fontSize: 14, border: '1px solid rgba(91,164,217,0.3)', borderRadius: 8, width: '100%', boxSizing: 'border-box' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: { padding: '10px 12px', background: '#1B2838', border: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' as const, fontWeight: 600 },
  td: { padding: '10px 12px', border: '1px solid #e0e0e0' },
}
