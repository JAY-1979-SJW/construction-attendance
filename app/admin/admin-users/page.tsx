'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface SiteAssignment {
  id: string
  siteId: string
  siteName: string
  siteAddress: string
  companyId: string
  companyName: string
  assignedAt: string
}

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  companyId: string | null
  companyName: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  siteAssignments?: SiteAssignment[]
}

interface Company {
  id: string
  companyName: string
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:         '대표',
  HQ_ADMIN:            '본사관리자',
  ADMIN:               '관리자(레거시)',
  VIEWER:              '조회자',
  SITE_ADMIN:          '현장관리자',
  EXTERNAL_SITE_ADMIN: '외부현장관리자',
  COMPANY_ADMIN:       '업체관리자',
}

const ROLE_SCOPE: Record<string, string> = {
  SUPER_ADMIN:         '전체 현장 · 전체 업체',
  HQ_ADMIN:            '전체 현장 · 전체 업체',
  ADMIN:               '전체 현장 · 전체 업체',
  VIEWER:              '전체 현장 (읽기 전용)',
  SITE_ADMIN:          '담당 현장만',
  EXTERNAL_SITE_ADMIN: '배정된 현장 그룹 (읽기 전용)',
  COMPANY_ADMIN:       '소속 업체 + 참여 현장',
}

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  SUPER_ADMIN:         { bg: '#4a148c', text: '#fff' },
  HQ_ADMIN:            { bg: '#1565c0', text: '#fff' },
  ADMIN:               { bg: '#0d47a1', text: '#fff' },
  VIEWER:              { bg: '#546e7a', text: '#fff' },
  SITE_ADMIN:          { bg: '#2e7d32', text: '#fff' },
  EXTERNAL_SITE_ADMIN: { bg: '#00695c', text: '#fff' },
  COMPANY_ADMIN:       { bg: '#e65100', text: '#fff' },
}

// 기능별 권한 매트릭스 (UI 표시용 — security-policy.ts의 ROLE_FEATURE_PERMISSIONS와 동기화)
const FEATURE_MATRIX: Record<string, Record<string, boolean>> = {
  SUPER_ADMIN:         { WORKER_VIEW: true,  ATTENDANCE_APPROVE: true,  SITE_WRITE: true,  COMPANY_MANAGE: true,  DOCUMENT_DOWNLOAD: true,  STATS_VIEW: true  },
  HQ_ADMIN:            { WORKER_VIEW: true,  ATTENDANCE_APPROVE: true,  SITE_WRITE: true,  COMPANY_MANAGE: true,  DOCUMENT_DOWNLOAD: true,  STATS_VIEW: true  },
  ADMIN:               { WORKER_VIEW: true,  ATTENDANCE_APPROVE: true,  SITE_WRITE: true,  COMPANY_MANAGE: true,  DOCUMENT_DOWNLOAD: true,  STATS_VIEW: true  },
  VIEWER:              { WORKER_VIEW: true,  ATTENDANCE_APPROVE: false, SITE_WRITE: false, COMPANY_MANAGE: false, DOCUMENT_DOWNLOAD: true,  STATS_VIEW: true  },
  SITE_ADMIN:          { WORKER_VIEW: true,  ATTENDANCE_APPROVE: true,  SITE_WRITE: false, COMPANY_MANAGE: false, DOCUMENT_DOWNLOAD: true,  STATS_VIEW: true  },
  EXTERNAL_SITE_ADMIN: { WORKER_VIEW: true,  ATTENDANCE_APPROVE: false, SITE_WRITE: false, COMPANY_MANAGE: false, DOCUMENT_DOWNLOAD: false, STATS_VIEW: true  },
  COMPANY_ADMIN:       { WORKER_VIEW: true,  ATTENDANCE_APPROVE: false, SITE_WRITE: false, COMPANY_MANAGE: false, DOCUMENT_DOWNLOAD: true,  STATS_VIEW: true  },
}

const FEATURE_LABELS: Record<string, string> = {
  WORKER_VIEW:        '근로자 조회',
  ATTENDANCE_APPROVE: '출근 승인/반려',
  SITE_WRITE:         '현장 등록/수정',
  COMPANY_MANAGE:     '업체 관리',
  DOCUMENT_DOWNLOAD:  '문서 다운로드',
  STATS_VIEW:         '통계 조회',
}

const ALL_ROLES = ['SUPER_ADMIN', 'HQ_ADMIN', 'VIEWER', 'SITE_ADMIN', 'EXTERNAL_SITE_ADMIN', 'COMPANY_ADMIN']
const COMPANY_REQUIRED_ROLES = ['COMPANY_ADMIN', 'EXTERNAL_SITE_ADMIN']

// ── 권한 미리보기 컴포넌트 ────────────────────────────────────────────────────

function PermissionPreview({ role }: { role: string }) {
  if (!role || !FEATURE_MATRIX[role]) return null
  const perms = FEATURE_MATRIX[role]
  return (
    <div className="mt-3 p-3 bg-surface rounded-[8px]">
      <div className="text-[11px] font-semibold text-muted-brand mb-2 uppercase">기능 권한 미리보기</div>
      <div className="grid grid-cols-2 gap-1">
        {Object.entries(FEATURE_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              background: perms[key] ? '#2e7d32' : '#e0e0e0',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {perms[key] && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
            </span>
            <span className="text-[12px] text-dim-brand">{label}</span>
          </div>
        ))}
      </div>
      {ROLE_SCOPE[role] && (
        <div className="mt-2 text-[11px] text-muted-brand">
          <span className="font-semibold">범위:</span> {ROLE_SCOPE[role]}
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers]           = useState<AdminUser[]>([])
  const [companies, setCompanies]   = useState<Company[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<AdminUser | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [msg, setMsg]               = useState('')
  const [filterRole, setFilterRole] = useState('')

  // 수정 폼 상태
  const [editRole, setEditRole]         = useState('')
  const [editCompanyId, setEditCompanyId] = useState<string>('')
  const [editName, setEditName]         = useState('')
  const [saving, setSaving]             = useState(false)

  // 생성 폼 상태
  const [newName, setNewName]         = useState('')
  const [newEmail, setNewEmail]       = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole]         = useState('HQ_ADMIN')
  const [newCompanyId, setNewCompanyId] = useState('')
  const [creating, setCreating]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, cRes] = await Promise.all([
        fetch(`/api/admin/admin-users${filterRole ? `?role=${filterRole}` : ''}`),
        fetch('/api/admin/companies?limit=300'),
      ])
      if (uRes.status === 401 || uRes.status === 403) { router.push('/admin'); return }
      const [uData, cData] = await Promise.all([uRes.json(), cRes.json()])
      setUsers(uData.data?.items ?? [])
      setCompanies(cData.data?.items ?? cData.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [router, filterRole])

  useEffect(() => { load() }, [load])

  const loadDetail = async (id: string) => {
    const res = await fetch(`/api/admin/admin-users/${id}`)
    if (!res.ok) return
    const data = await res.json()
    if (!data.success) return
    const user = data.data
    setSelected(user)
    setEditRole(user.role)
    setEditCompanyId(user.companyId ?? '')
    setEditName(user.name)
    setMsg('')
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    setMsg('')
    try {
      const body: Record<string, unknown> = {}
      if (editRole !== selected.role) body.role = editRole
      if (editName !== selected.name) body.name = editName
      if (COMPANY_REQUIRED_ROLES.includes(editRole)) {
        body.companyId = editCompanyId || null
      } else {
        body.companyId = null
      }

      if (Object.keys(body).length === 0) { setMsg('변경 사항이 없습니다.'); setSaving(false); return }

      const res = await fetch(`/api/admin/admin-users/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? '저장 실패'); return }
      setMsg('저장 완료')
      setSelected(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const endpoint = isActive
      ? `/api/admin/admin-users/${id}/deactivate`
      : `/api/admin/admin-users/${id}/activate`
    const res = await fetch(endpoint, { method: 'POST' })
    const data = await res.json()
    if (!data.success) { setMsg(data.message ?? data.error ?? '변경 실패'); return }
    load()
  }

  const handleCreate = async () => {
    if (!newName || !newEmail || !newPassword) { setMsg('이름·이메일·비밀번호는 필수입니다.'); return }
    if (COMPANY_REQUIRED_ROLES.includes(newRole) && !newCompanyId) {
      setMsg(`${ROLE_LABELS[newRole]} 역할은 소속 업체를 선택해야 합니다.`); return
    }
    setCreating(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName, email: newEmail, password: newPassword,
          role: newRole,
          companyId: COMPANY_REQUIRED_ROLES.includes(newRole) ? newCompanyId : null,
        }),
      })
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? '생성 실패'); return }
      setMsg('계정 생성 완료')
      setShowCreate(false)
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('HQ_ADMIN'); setNewCompanyId('')
      load()
    } finally {
      setCreating(false)
    }
  }

  const roleColor = (role: string) => ROLE_COLOR[role] ?? { bg: '#888', text: '#fff' }

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[22px] font-bold mb-1 mt-0">관리자 계정 관리</h1>
          <p className="text-[13px] text-muted-brand -mt-1">역할·접근 범위·기능 권한 설정</p>
        </div>
        <button onClick={() => { setShowCreate(true); setMsg('') }}
          className="px-4 py-2 bg-brand-accent text-white rounded-md text-[13px] cursor-pointer border-none">
          + 관리자 추가
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-md text-[13px] ${msg.includes('완료') || msg.includes('저장') ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#ffebee] text-[#b71c1c]'}`}>
          {msg}
        </div>
      )}

      {/* 권한 매트릭스 표 */}
      <div className="bg-card rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden mb-6">
        <div className="px-5 pt-4 pb-2 border-b border-brand">
          <div className="text-[14px] font-semibold text-dim-brand">역할별 기능 권한 매트릭스</div>
          <div className="text-[12px] text-muted-brand mt-0.5">서버 API에서도 동일하게 강제됩니다.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-surface">
                <th className="text-left px-4 py-2.5 text-muted-brand font-semibold border-b border-brand min-w-[120px]">역할</th>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <th key={key} className="text-center px-3 py-2.5 text-muted-brand font-semibold border-b border-brand whitespace-nowrap">{label}</th>
                ))}
                <th className="text-left px-4 py-2.5 text-muted-brand font-semibold border-b border-brand">접근 범위</th>
              </tr>
            </thead>
            <tbody>
              {ALL_ROLES.map((role) => {
                const perms = FEATURE_MATRIX[role] ?? {}
                const rc = roleColor(role)
                return (
                  <tr key={role} className="border-b border-brand">
                    <td className="px-4 py-2.5">
                      <span style={{ background: rc.bg, color: rc.text, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                        {ROLE_LABELS[role]}
                      </span>
                    </td>
                    {Object.keys(FEATURE_LABELS).map((feat) => (
                      <td key={feat} className="text-center px-3 py-2.5">
                        {perms[feat]
                          ? <span className="text-[#2e7d32] font-bold text-[14px]">✓</span>
                          : <span className="text-[#ccc] text-[14px]">–</span>
                        }
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-[11px] text-muted-brand">{ROLE_SCOPE[role]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-4 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-muted-brand">역할 필터</label>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]">
            <option value="">전체</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
            ))}
          </select>
        </div>
        <button onClick={() => load()}
          className="px-4 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] cursor-pointer bg-brand text-muted-brand">
          조회
        </button>
      </div>

      {/* 관리자 목록 */}
      {loading ? (
        <p className="text-muted-brand text-[13px]">로딩 중...</p>
      ) : (
        <div className="bg-card rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface">
                {['이름', '이메일', '역할', '소속 업체', '현장 배정', '상태', '마지막 로그인', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] text-muted-brand border-b-2 border-brand whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-brand text-[13px]">관리자가 없습니다.</td></tr>
              ) : users.map((u) => {
                const rc = roleColor(u.role)
                return (
                  <tr key={u.id} className="border-b border-brand hover:bg-surface cursor-pointer"
                    onClick={() => loadDetail(u.id)}>
                    <td className="px-4 py-3 text-[13px] font-medium text-dim-brand">{u.name}</td>
                    <td className="px-4 py-3 text-[12px] text-muted-brand">{u.email}</td>
                    <td className="px-4 py-3">
                      <span style={{ background: rc.bg, color: rc.text, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-brand">{u.companyName ?? '–'}</td>
                    <td className="px-4 py-3 text-[12px] text-muted-brand">
                      {u.role === 'SITE_ADMIN' ? '배정 현장 확인' : '–'}
                    </td>
                    <td className="px-4 py-3">
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: u.isActive ? '#e8f5e9' : '#ffebee',
                        color: u.isActive ? '#2e7d32' : '#b71c1c',
                      }}>
                        {u.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-brand">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ko-KR') : '없음'}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleActive(u.id, u.isActive)}
                        className="px-3 py-1 border border-[rgba(91,164,217,0.3)] rounded-md text-[11px] cursor-pointer bg-brand text-muted-brand">
                        {u.isActive ? '비활성화' : '활성화'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 상세 / 수정 패널 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelected(null)}>
          <div className="bg-white rounded-[16px] shadow-2xl p-6 w-[480px] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-[17px] font-bold text-dim-brand m-0">관리자 수정</h2>
              <button onClick={() => setSelected(null)} className="text-muted-brand cursor-pointer bg-transparent border-none text-[18px]">✕</button>
            </div>

            <div className="text-[12px] text-muted-brand mb-1">이메일</div>
            <div className="text-[14px] text-dim-brand mb-3 font-mono">{selected.email}</div>

            <div className="flex flex-col gap-3">
              {/* 이름 수정 */}
              <div>
                <label className="text-[12px] text-muted-brand block mb-1">이름</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]" />
              </div>

              {/* 역할 수정 */}
              <div>
                <label className="text-[12px] text-muted-brand block mb-1">역할</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]">
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                  ))}
                </select>
                <PermissionPreview role={editRole} />
              </div>

              {/* 업체 선택 (COMPANY_ADMIN, EXTERNAL_SITE_ADMIN) */}
              {COMPANY_REQUIRED_ROLES.includes(editRole) && (
                <div>
                  <label className="text-[12px] text-muted-brand block mb-1">소속 업체 <span className="text-[#b71c1c]">*</span></label>
                  <select value={editCompanyId} onChange={(e) => setEditCompanyId(e.target.value)}
                    className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]">
                    <option value="">업체 선택</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 현장 배정 안내 (SITE_ADMIN) */}
              {editRole === 'SITE_ADMIN' && (
                <div className="p-3 bg-surface rounded-[8px]">
                  <div className="text-[12px] font-semibold text-muted-brand mb-1">담당 현장 배정</div>
                  {selected.siteAssignments && selected.siteAssignments.length > 0 ? (
                    <div className="space-y-1">
                      {selected.siteAssignments.map((a) => (
                        <div key={a.id} className="text-[12px] text-dim-brand">
                          • {a.siteName} ({a.companyName})
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[12px] text-muted-brand">배정된 현장 없음</div>
                  )}
                  <a href="/admin/site-admin-assignments"
                    className="text-[12px] text-brand-accent mt-1 block hover:underline">
                    현장 배정 관리 →
                  </a>
                </div>
              )}
            </div>

            {msg && (
              <div className={`mt-3 px-3 py-2 rounded-md text-[12px] ${msg.includes('완료') ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#ffebee] text-[#b71c1c]'}`}>
                {msg}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2 bg-brand-accent text-white rounded-md text-[13px] cursor-pointer border-none disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setSelected(null)}
                className="px-4 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] cursor-pointer bg-brand text-muted-brand">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-[16px] shadow-2xl p-6 w-[440px]"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-[17px] font-bold text-dim-brand m-0">관리자 계정 추가</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-brand cursor-pointer bg-transparent border-none text-[18px]">✕</button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] text-muted-brand block mb-1">이름</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]" placeholder="홍길동" />
              </div>
              <div>
                <label className="text-[12px] text-muted-brand block mb-1">이메일</label>
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  type="email"
                  className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]" placeholder="admin@example.com" />
              </div>
              <div>
                <label className="text-[12px] text-muted-brand block mb-1">비밀번호 (8자 이상)</label>
                <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]" />
              </div>
              <div>
                <label className="text-[12px] text-muted-brand block mb-1">역할</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]">
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                  ))}
                </select>
                <PermissionPreview role={newRole} />
              </div>
              {COMPANY_REQUIRED_ROLES.includes(newRole) && (
                <div>
                  <label className="text-[12px] text-muted-brand block mb-1">소속 업체 <span className="text-[#b71c1c]">*</span></label>
                  <select value={newCompanyId} onChange={(e) => setNewCompanyId(e.target.value)}
                    className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]">
                    <option value="">업체 선택</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {msg && (
              <div className={`mt-3 px-3 py-2 rounded-md text-[12px] ${msg.includes('완료') ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#ffebee] text-[#b71c1c]'}`}>
                {msg}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 px-4 py-2 bg-brand-accent text-white rounded-md text-[13px] cursor-pointer border-none disabled:opacity-50">
                {creating ? '생성 중...' : '계정 생성'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] cursor-pointer bg-brand text-muted-brand">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
