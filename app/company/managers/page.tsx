'use client'

import { useState, useEffect } from 'react'

interface Manager {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  companyId: string | null
  lastLoginAt: string | null
  createdAt: string
}

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: '전체 현장 관리',
  SITE_ADMIN: '담당 현장 관리',
  EXTERNAL_SITE_ADMIN: '지정 현장 운영형',
}

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  COMPANY_ADMIN:       { bg: '#dbeafe', color: '#1e40af' },
  SITE_ADMIN:          { bg: '#d1fae5', color: '#065f46' },
  EXTERNAL_SITE_ADMIN: { bg: '#fef3c7', color: '#92400e' },
}

export default function CompanyManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'SITE_ADMIN' })
  const [inviting, setInviting] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/admin-users')
      .then(r => r.json())
      .then(d => setManagers(d.data ?? d.items ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleInvite = async () => {
    if (!form.name || !form.email) return
    setInviting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (res.ok) {
        setMsg({ type: 'success', text: '관리자가 생성되었습니다.' })
        setShowInvite(false)
        setForm({ name: '', email: '', role: 'SITE_ADMIN' })
        load()
      } else {
        setMsg({ type: 'error', text: d.message ?? '오류가 발생했습니다.' })
      }
    } finally {
      setInviting(false)
    }
  }

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`${name} 관리자를 비활성화하시겠습니까?`)) return
    const res = await fetch(`/api/admin/admin-users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    if (res.ok) {
      setMsg({ type: 'success', text: '비활성화 처리되었습니다.' })
      load()
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[22px] font-bold text-fore-brand m-0">관리자 관리</h1>
        <button className="px-4 py-2 bg-[#1d4ed8] text-white border-none rounded-md cursor-pointer text-[14px] font-semibold" onClick={() => setShowInvite(true)}>+ 관리자 추가</button>
      </div>

      {msg && (
        <div
          className="px-4 py-[10px] rounded-md mb-4 text-[14px]"
          style={{
            background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: msg.type === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          {msg.text}
        </div>
      )}

      <div className="bg-blue-light border border-[#bfdbfe] rounded-lg px-4 py-[14px] mb-5 text-[14px] text-[#1e40af]">
        <strong>관리 범위 안내</strong>
        <ul className="mt-[6px] mb-0 pl-[18px] text-[13px] text-body-brand">
          <li><strong>전체 현장 관리</strong> — 회사 전체 현장 접근</li>
          <li><strong>담당 현장 관리</strong> — 배정된 현장만 접근</li>
          <li><strong>지정 현장 운영형</strong> — 그룹 지정 현장 접근 (읽기 위주)</li>
        </ul>
      </div>

      {loading ? (
        <p className="text-muted-brand">로딩 중...</p>
      ) : (
        <div className="border border-brand rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-surface">
              <tr>
                {['이름', '이메일', '관리 범위', '최근 로그인', '상태', ''].map(h => (
                  <th key={h} className="px-[14px] py-[11px] text-left text-[12px] font-semibold text-muted-brand border-b border-brand">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {managers.map(m => {
                const rc = ROLE_COLOR[m.role] ?? { bg: '#f3f4f6', color: '#6b7280' }
                return (
                  <tr key={m.id} className="border-b border-brand">
                    <td className="px-[14px] py-[13px] text-[14px] text-[#1f2937] align-middle"><span className="font-semibold">{m.name}</span></td>
                    <td className="px-[14px] py-[13px] text-[13px] text-muted-brand align-middle">{m.email}</td>
                    <td className="px-[14px] py-[13px] text-[14px] text-[#1f2937] align-middle">
                      <span
                        className="text-[11px] px-2 py-[3px] rounded font-medium"
                        style={{ background: rc.bg, color: rc.color }}
                      >
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>
                    <td className="px-[14px] py-[13px] text-[12px] text-muted2-brand align-middle">
                      {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString('ko-KR') : '없음'}
                    </td>
                    <td className="px-[14px] py-[13px] text-[14px] text-[#1f2937] align-middle">
                      <span
                        className="text-[11px] px-2 py-[3px] rounded font-medium"
                        style={{
                          background: m.isActive ? '#d1fae5' : '#f3f4f6',
                          color: m.isActive ? '#065f46' : '#9ca3af',
                        }}
                      >
                        {m.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-[14px] py-[13px] text-[14px] text-[#1f2937] align-middle">
                      {m.isActive && (
                        <button
                          className="px-[10px] py-1 bg-card border border-brand rounded-[5px] cursor-pointer text-[12px] text-muted-brand"
                          onClick={() => handleDeactivate(m.id, m.name)}
                        >
                          비활성화
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 관리자 추가 모달 */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
          <div className="bg-card rounded-[10px] px-7 py-7 w-[380px] max-w-[90vw]">
            <h3 className="text-[16px] font-bold text-fore-brand mb-5 mt-0">관리자 추가</h3>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-body-brand mb-[6px]">이름 *</label>
              <input
                className="w-full px-3 py-[9px] border border-brand rounded-md text-[14px] box-border"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="담당자명"
              />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-body-brand mb-[6px]">이메일 *</label>
              <input
                className="w-full px-3 py-[9px] border border-brand rounded-md text-[14px] box-border"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="이메일 주소"
              />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-body-brand mb-[6px]">관리 범위</label>
              <select
                className="w-full px-3 py-[9px] border border-brand rounded-md text-[14px] box-border"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="SITE_ADMIN">담당 현장 관리</option>
                <option value="EXTERNAL_SITE_ADMIN">지정 현장 운영형</option>
                <option value="COMPANY_ADMIN">전체 현장 관리</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                className="px-4 py-[7px] border border-brand rounded-md bg-card cursor-pointer text-[14px]"
                onClick={() => setShowInvite(false)}
              >
                취소
              </button>
              <button
                className="px-4 py-[7px] bg-[#1d4ed8] text-white border-none rounded-md cursor-pointer text-[14px] font-semibold"
                disabled={inviting || !form.name || !form.email}
                onClick={handleInvite}
              >
                {inviting ? '처리 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
