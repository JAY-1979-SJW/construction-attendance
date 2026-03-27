'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Assignment {
  id: string
  isActive: boolean
  assignedAt: string
  revokedAt: string | null
  user:    { id: string; name: string; email: string; role: string }
  site:    { id: string; name: string; address: string }
  company: { id: string; companyName: string }
}

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
}

interface Site {
  id: string
  name: string
  address: string
}

interface Company {
  id: string
  companyName: string
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function SiteAdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)

  // 폼 상태
  const [admins, setAdmins]     = useState<AdminUser[]>([])
  const [sites, setSites]       = useState<Site[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [form, setForm]         = useState({ userId: '', siteId: '', companyId: '' })
  const [saving, setSaving]     = useState(false)

  // 필터
  const [filterActive, setFilterActive] = useState(true)

  // ── 로드 ─────────────────────────────────────────────────────────────────────

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/site-admin-assignments?activeOnly=${filterActive}`)
      if (res.ok) {
        const data = await res.json()
        setAssignments(data.data?.assignments ?? [])
      }
    } finally { setLoading(false) }
  }, [filterActive])

  const loadFormData = useCallback(async () => {
    const [adminRes, siteRes, companyRes] = await Promise.all([
      fetch('/api/admin/super-users?role=SITE_ADMIN&pageSize=200'),
      fetch('/api/admin/sites?pageSize=200'),
      fetch('/api/admin/companies?pageSize=200'),
    ])
    if (adminRes.ok)   { const d = await adminRes.json();   setAdmins(d.data?.items ?? []) }
    if (siteRes.ok)    { const d = await siteRes.json();    setSites(d.data?.items ?? []) }
    if (companyRes.ok) { const d = await companyRes.json(); setCompanies(d.data?.items ?? []) }
  }, [])

  useEffect(() => { loadAssignments() }, [loadAssignments])

  // ── 배정 생성 ─────────────────────────────────────────────────────────────────

  const submit = async () => {
    if (!form.userId || !form.siteId || !form.companyId) {
      alert('현장 관리자, 현장, 소속 회사를 모두 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/site-admin-assignments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ userId: '', siteId: '', companyId: '' })
        loadAssignments()
      } else {
        const d = await res.json()
        alert(d.message ?? d.error ?? '배정 실패')
      }
    } finally { setSaving(false) }
  }

  // ── 배정 해제 ─────────────────────────────────────────────────────────────────

  const revoke = async (id: string, userName: string, siteName: string) => {
    if (!confirm(`${userName}의 "${siteName}" 현장 배정을 해제하시겠습니까?`)) return
    const res = await fetch(`/api/admin/site-admin-assignments/${id}`, { method: 'DELETE' })
    if (res.ok) loadAssignments()
    else alert('해제 실패')
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  function fmtDate(d?: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('ko-KR')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">현장 관리자 배정</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            SITE_ADMIN 역할 사용자를 특정 현장에 배정하고 권한을 관리합니다.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); loadFormData() }}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + 현장 관리자 배정
        </button>
      </div>

      <div className="px-6 py-6 max-w-5xl mx-auto">

        {/* 배정 생성 폼 */}
        {showForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 space-y-4">
            <h3 className="font-semibold text-blue-800 text-sm">현장 관리자 신규 배정</h3>
            <p className="text-xs text-blue-600">
              ⚠ 대상 사용자의 역할이 <strong>SITE_ADMIN</strong>이어야 합니다.
              역할이 다른 경우 먼저 슈퍼유저 관리에서 역할을 변경하세요.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-600 block mb-1">현장 관리자 (SITE_ADMIN) *</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                >
                  <option value="">선택</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">담당 현장 *</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                  value={form.siteId}
                  onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
                >
                  <option value="">선택</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">소속 회사 *</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                  value={form.companyId}
                  onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                >
                  <option value="">선택</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '배정 등록'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm border px-4 py-2 rounded text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-600 font-medium">표시:</span>
          {[{ label: '활성 배정만', value: true }, { label: '전체 (해제 포함)', value: false }].map(({ label, value }) => (
            <button
              key={String(value)}
              onClick={() => setFilterActive(value)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                filterActive === value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">총 {assignments.length}건</span>
        </div>

        {/* 배정 목록 */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">불러오는 중...</div>
        ) : assignments.length === 0 ? (
          <div className="text-center text-gray-400 py-12 bg-white border border-[#E5E7EB] rounded-[12px]">
            배정 내역이 없습니다.
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-2.5 text-xs text-gray-600 font-medium">관리자</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-600 font-medium">담당 현장</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-600 font-medium">소속 회사</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-600 font-medium">배정일</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-600 font-medium">상태</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className={`border-b ${!a.isActive ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{a.user.name}</p>
                      <p className="text-xs text-gray-400">{a.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-700">{a.site.name}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[180px]">{a.site.address}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{a.company.companyName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(a.assignedAt)}</td>
                    <td className="px-4 py-3">
                      {a.isActive ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">활성</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                          해제 {fmtDate(a.revokedAt)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.isActive && (
                        <button
                          onClick={() => revoke(a.id, a.user.name, a.site.name)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          배정 해제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SITE_ADMIN 역할 안내 */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <strong>권한 구조 안내</strong>
          <ul className="mt-1 space-y-1 text-xs list-disc list-inside">
            <li>SITE_ADMIN은 배정된 현장의 출퇴근·작업일보·TBM·공지·일정·작업자 현황만 접근 가능합니다.</li>
            <li>같은 회사 내 다른 현장, 타 회사 현장 모두 API 레벨에서 차단됩니다.</li>
            <li>배정 해제 즉시 해당 현장 접근이 차단됩니다 (다음 요청부터 403).</li>
            <li>SITE_ADMIN 역할 부여는 슈퍼유저 관리 페이지에서 역할을 SITE_ADMIN으로 변경 후 이 페이지에서 현장을 배정하세요.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
