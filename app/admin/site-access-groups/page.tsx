'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface SiteEntry {
  id: string
  siteId: string
  addedAt: string
  site: { id: string; name: string; address: string }
}

interface UserEntry {
  id: string
  userId: string
  assignedAt: string
  user: { id: string; name: string; email: string; role: string }
}

interface AccessGroup {
  id: string
  name: string
  description: string | null
  ownerCompanyId: string | null
  isActive: boolean
  createdAt: string
  siteCount: number
  activeUserCount: number
  sites: SiteEntry[]
  activeUsers: UserEntry[]
}

interface Site {
  id: string
  name: string
  address: string
}

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function SiteAccessGroupsPage() {
  const [groups, setGroups]       = useState<AccessGroup[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<AccessGroup | null>(null)

  // 생성 폼
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [creating, setCreating]     = useState(false)

  // 현장 추가 폼
  const [sites, setSites]           = useState<Site[]>([])
  const [addSiteId, setAddSiteId]   = useState('')
  const [addingSite, setAddingSite] = useState(false)

  // 사용자 할당 폼
  const [extUsers, setExtUsers]         = useState<AdminUser[]>([])
  const [addUserId, setAddUserId]       = useState('')
  const [addingUser, setAddingUser]     = useState(false)

  const [msg, setMsg] = useState('')

  // ── 로드 ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/site-access-groups')
      if (res.ok) {
        const data = await res.json()
        const items: AccessGroup[] = data.data?.items ?? []
        setGroups(items)
        // selected 갱신
        if (selected) {
          const refreshed = items.find((g) => g.id === selected.id)
          setSelected(refreshed ?? null)
        }
      }
    } finally { setLoading(false) }
  }, [selected])

  const loadFormData = useCallback(async () => {
    const [sRes, uRes] = await Promise.all([
      fetch('/api/admin/sites?pageSize=500'),
      fetch('/api/admin/admin-users?role=EXTERNAL_SITE_ADMIN&pageSize=200'),
    ])
    if (sRes.ok) { const d = await sRes.json(); setSites(d.data?.items ?? []) }
    if (uRes.ok) { const d = await uRes.json(); setExtUsers(d.data?.items ?? []) }
  }, [])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 그룹 생성 ───────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.name.trim()) { setMsg('그룹 이름을 입력하세요.'); return }
    setCreating(true); setMsg('')
    try {
      const res = await fetch('/api/admin/site-access-groups', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: createForm.name, description: createForm.description || null }),
      })
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? '생성 실패'); return }
      setMsg('그룹이 생성되었습니다.')
      setShowCreate(false)
      setCreateForm({ name: '', description: '' })
      load()
    } finally { setCreating(false) }
  }

  // ── 현장 추가/제거 ──────────────────────────────────────────────────────────

  const handleAddSite = async () => {
    if (!selected || !addSiteId) return
    setAddingSite(true); setMsg('')
    try {
      const res = await fetch(`/api/admin/site-access-groups/${selected.id}/sites`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ siteId: addSiteId }),
      })
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? '추가 실패'); return }
      setAddSiteId(''); load()
    } finally { setAddingSite(false) }
  }

  const handleRemoveSite = async (siteId: string, siteName: string) => {
    if (!selected) return
    if (!confirm(`"${siteName}" 현장을 그룹에서 제거하시겠습니까?`)) return
    await fetch(`/api/admin/site-access-groups/${selected.id}/sites?siteId=${siteId}`, { method: 'DELETE' })
    load()
  }

  // ── 사용자 할당/해제 ────────────────────────────────────────────────────────

  const handleAddUser = async () => {
    if (!selected || !addUserId) return
    setAddingUser(true); setMsg('')
    try {
      const res = await fetch(`/api/admin/site-access-groups/${selected.id}/users`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: addUserId }),
      })
      const data = await res.json()
      if (!data.success) { setMsg(data.message ?? '할당 실패'); return }
      setAddUserId(''); load()
    } finally { setAddingUser(false) }
  }

  const handleRevokeUser = async (userId: string, userName: string) => {
    if (!selected) return
    if (!confirm(`${userName}의 그룹 접근 권한을 해제하시겠습니까?`)) return
    await fetch(`/api/admin/site-access-groups/${selected.id}/users?userId=${userId}`, { method: 'DELETE' })
    load()
  }

  // ── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">현장 접근 그룹</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            EXTERNAL_SITE_ADMIN 사용자에게 복수 현장 접근 묶음을 부여합니다. 회사 데이터에는 접근 불가.
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setMsg('') }}
          className="text-sm bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          + 그룹 생성
        </button>
      </div>

      <div className="px-6 py-6 max-w-6xl mx-auto">

        {msg && (
          <p className={`mb-4 text-sm ${msg.includes('실패') || msg.includes('입력') ? 'text-red-600' : 'text-green-700'}`}>
            {msg}
          </p>
        )}

        {/* 생성 폼 */}
        {showCreate && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-purple-800 mb-3">새 접근 그룹 생성</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600 block mb-1">그룹 이름 *</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: A건설 2026 협력사"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">설명 (선택)</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="그룹 설명"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="text-sm bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {creating ? '생성 중...' : '생성'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="text-sm border px-4 py-2 rounded text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          {/* 그룹 목록 (좌측) */}
          <div className="w-72 flex-shrink-0">
            {loading ? (
              <div className="text-center text-gray-400 py-8 text-sm">불러오는 중...</div>
            ) : groups.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm bg-white border rounded-lg">그룹이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { setSelected(g); loadFormData(); setMsg('') }}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selected?.id === g.id
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-medium text-sm">{g.name}</p>
                    <p className={`text-xs mt-0.5 ${selected?.id === g.id ? 'text-purple-100' : 'text-gray-400'}`}>
                      현장 {g.siteCount}개 · 사용자 {g.activeUserCount}명
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 상세 패널 (우측) */}
          {selected ? (
            <div className="flex-1 space-y-5">
              {/* 현장 목록 */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">현장 목록 ({selected.sites.length}개)</h3>
                <div className="flex gap-2 mb-3">
                  <select
                    className="flex-1 border rounded px-2 py-1.5 text-sm bg-white"
                    value={addSiteId}
                    onChange={(e) => setAddSiteId(e.target.value)}
                  >
                    <option value="">현장 선택하여 추가</option>
                    {sites
                      .filter((s) => !selected.sites.some((ss) => ss.siteId === s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                  <button
                    onClick={handleAddSite}
                    disabled={!addSiteId || addingSite}
                    className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
                {selected.sites.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">등록된 현장이 없습니다.</p>
                ) : (
                  <div className="space-y-1">
                    {selected.sites.map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-sm">
                        <div>
                          <span className="font-medium text-gray-800">{s.site.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{s.site.address}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveSite(s.siteId, s.site.name)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          제거
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 사용자 목록 */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">할당된 사용자 ({selected.activeUsers.length}명)</h3>
                <div className="flex gap-2 mb-3">
                  <select
                    className="flex-1 border rounded px-2 py-1.5 text-sm bg-white"
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                  >
                    <option value="">EXTERNAL_SITE_ADMIN 선택하여 할당</option>
                    {extUsers
                      .filter((u) => !selected.activeUsers.some((au) => au.userId === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                  </select>
                  <button
                    onClick={handleAddUser}
                    disabled={!addUserId || addingUser}
                    className="text-sm bg-purple-600 text-white px-3 py-1.5 rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    할당
                  </button>
                </div>
                {selected.activeUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">할당된 사용자가 없습니다.</p>
                ) : (
                  <div className="space-y-1">
                    {selected.activeUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-sm">
                        <div>
                          <span className="font-medium text-gray-800">{u.user.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{u.user.email}</span>
                        </div>
                        <button
                          onClick={() => handleRevokeUser(u.userId, u.user.name)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          해제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 안내 */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
                <strong>EXTERNAL_SITE_ADMIN 접근 원칙</strong>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>이 그룹에 할당된 사용자는 그룹 내 현장의 출퇴근·작업일보·TBM·공지만 접근 가능합니다.</li>
                  <li>회사(업체) 정보, 인사/노무 데이터, 보험/계좌 정보에는 접근할 수 없습니다.</li>
                  <li>그룹 할당 해제 즉시 접근이 차단됩니다 (다음 API 요청부터 403).</li>
                  <li>현장이 여러 회사에 걸쳐 있어도 현장 운영 데이터만 노출됩니다.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm bg-white border rounded-lg">
              좌측에서 그룹을 선택하세요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
