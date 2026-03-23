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
    <div style={s.wrap}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>업체 관리자 계정</h1>
          <p style={{ color: '#A0AEC0', fontSize: 13, margin: '4px 0 0' }}>전체 {accounts.length}개 계정</p>
        </div>
        <button style={s.btn} onClick={() => { setShowForm(true); setMsg('') }}>+ 계정 생성</button>
      </div>

      {msg && <p style={{ color: msg.includes('생성') || msg.includes('완료') ? '#2e7d32' : '#c62828', margin: '0 0 12px', fontSize: 13 }}>{msg}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['ALL', 'SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COMPANY_ADMIN', 'SITE_ADMIN', 'EXTERNAL_SITE_ADMIN'].map((r) => (
          <button
            key={r}
            style={{ ...s.filterBtn, background: filterRole === r ? '#1a1a2e' : '#f0f0f0', color: filterRole === r ? 'white' : '#333' }}
            onClick={() => setFilterRole(r)}
          >
            {r === 'ALL' ? '전체' : ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      {showForm && (
        <div style={s.formBox}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>관리자 계정 생성</h3>
          <div style={s.grid}>
            <label style={s.label}>이름 *</label>
            <input style={s.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" />
            <label style={s.label}>이메일 *</label>
            <input style={s.input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@company.com" />
            <label style={s.label}>비밀번호 *</label>
            <input style={s.input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8자 이상" />
            <label style={s.label}>역할 *</label>
            <select style={s.input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, companyId: '' })}>
              {['EXTERNAL_SITE_ADMIN', 'SITE_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'VIEWER', 'SUPER_ADMIN'].map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]} ({r})</option>
              ))}
            </select>
            {form.role === 'COMPANY_ADMIN' && (
              <>
                <label style={s.label}>소속 업체 *</label>
                <select style={s.input} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">업체 선택</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </>
            )}
            {form.role === 'SITE_ADMIN' && (
              <p style={{ gridColumn: '1/-1', fontSize: 12, color: '#e65100', margin: 0 }}>
                ℹ SITE_ADMIN은 계정 생성 후 &quot;현장 관리자 배정&quot; 페이지에서 담당 현장을 지정하세요.
              </p>
            )}
            {form.role === 'EXTERNAL_SITE_ADMIN' && (
              <>
                <label style={s.label}>소속 업체 *</label>
                <select style={s.input} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">업체 선택</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
                <p style={{ gridColumn: '1/-1', fontSize: 12, color: '#6a1b9a', margin: 0 }}>
                  ℹ 계정 생성 후 &quot;현장 접근 그룹&quot; 페이지에서 운영 범위를 배정하세요. 배정된 현장 외에는 접근할 수 없습니다.
                </p>
              </>
            )}
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
              {['이름', '이메일', '역할', '소속 업체', '상태', '마지막 로그인', '생성일', '조작'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#A0AEC0' }}>계정이 없습니다.</td></tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} style={{ opacity: a.isActive ? 1 : 0.6 }}>
                <td style={{ ...s.td, fontWeight: 600 }}>{a.name}</td>
                <td style={s.td}>{a.email}</td>
                <td style={s.td}>
                  <span style={{ color: ROLE_COLOR[a.role] ?? '#333', fontWeight: 600, fontSize: 12 }}>
                    {ROLE_LABEL[a.role] ?? a.role}
                  </span>
                </td>
                <td style={s.td}>
                  {a.companyId ? (
                    <Link href={`/admin/companies/${a.companyId}`} style={{ color: '#4A93C8', textDecoration: 'none' }}>
                      {a.companyName}
                    </Link>
                  ) : '-'}
                </td>
                <td style={s.td}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: a.isActive ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                      {a.isActive ? '활성' : '비활성'}
                    </span>
                    {a.role === 'EXTERNAL_SITE_ADMIN' && a.companyVerificationStatus && (
                      <span style={{
                        fontSize: 11,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: a.companyVerificationStatus === 'VERIFIED' ? '#e8f5e9' : a.companyVerificationStatus === 'PENDING_VERIFICATION' ? '#fff8e1' : '#fce4ec',
                        color: a.companyVerificationStatus === 'VERIFIED' ? '#2e7d32' : a.companyVerificationStatus === 'PENDING_VERIFICATION' ? '#f57f17' : '#c62828',
                      }}>
                        {a.companyVerificationStatus === 'VERIFIED' ? '인증완료' : a.companyVerificationStatus === 'PENDING_VERIFICATION' ? '인증대기' : a.companyVerificationStatus}
                      </span>
                    )}
                  </div>
                </td>
                <td style={s.td}>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('ko-KR') : '-'}</td>
                <td style={s.td}>{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!a.isActive && (
                      <button
                        style={{ ...s.smallBtn, background: '#388e3c' }}
                        onClick={() => activate(a.id)}
                      >
                        활성화
                      </button>
                    )}
                    {a.isActive && (
                      <button
                        style={{ ...s.smallBtn, background: '#e53935' }}
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

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 32, maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  btn: { padding: '10px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  smallBtn: { padding: '4px 12px', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  filterBtn: { padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  formBox: { background: '#1B2838', border: '1px solid rgba(91,164,217,0.3)', borderRadius: 12, padding: 24, marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px 12px', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: 600, color: '#A0AEC0' },
  input: { padding: '10px 12px', fontSize: 14, border: '1px solid rgba(91,164,217,0.3)', borderRadius: 8, width: '100%', boxSizing: 'border-box' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: { padding: '10px 12px', background: '#1B2838', border: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' as const, fontWeight: 600 },
  td: { padding: '10px 12px', border: '1px solid #e0e0e0' },
}
