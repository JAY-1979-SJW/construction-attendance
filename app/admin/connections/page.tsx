'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageShell, PageHeader, MobileCardList, MobileCard, MobileCardField, MobileCardFields } from '@/components/admin/ui'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface AdminItem {
  id: string
  name: string
  email: string
  role: string
  companyName: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface WorkerItem {
  id: string
  workerId: string
  workerName: string
  workerPhone: string
  workerStatus: string
  deviceName: string | null
  platform: string | null
  isPrimary: boolean
  isBlocked: boolean
  blockReason: string | null
  lastLoginAt: string | null
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN:          '슈퍼관리자',
  ADMIN:                '관리자',
  VIEWER:               '뷰어',
  COMPANY_ADMIN:        '업체관리자',
  SITE_ADMIN:           '현장관리자',
  EXTERNAL_SITE_ADMIN:  '외부현장관리자',
}

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  SUPER_ADMIN:         { bg: '#EDE9FE', color: '#5B21B6' },
  ADMIN:               { bg: '#DBEAFE', color: '#1D4ED8' },
  VIEWER:              { bg: '#F3F4F6', color: '#6B7280' },
  COMPANY_ADMIN:       { bg: '#FEF3C7', color: '#92400E' },
  SITE_ADMIN:          { bg: '#D1FAE5', color: '#065F46' },
  EXTERNAL_SITE_ADMIN: { bg: '#FCE7F3', color: '#831843' },
}

function fmtDatetime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(iso: string | null) {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1)   return '방금'
  if (diffMin < 60)  return `${diffMin}분 전`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)    return `${diffH}시간 전`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30)    return `${diffD}일 전`
  return null
}

// ── 탭 버튼 ───────────────────────────────────────────────────────────────────

function Tab({ active, onClick, children, count }: {
  active: boolean; onClick: () => void; children: React.ReactNode; count?: number
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-[8px] transition-colors"
      style={{
        background: active ? '#F97316' : 'transparent',
        color:      active ? '#fff' : '#6B7280',
      }}
    >
      {children}
      {count !== undefined && (
        <span
          className="text-[11px] px-1.5 py-0.5 rounded-full"
          style={{
            background: active ? 'rgba(255,255,255,0.25)' : '#F3F4F6',
            color:      active ? '#fff' : '#6B7280',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<'admin' | 'worker'>('admin')

  const [adminItems,  setAdminItems]  = useState<AdminItem[]>([])
  const [workerItems, setWorkerItems] = useState<WorkerItem[]>([])
  const [adminTotal,  setAdminTotal]  = useState(0)
  const [workerTotal, setWorkerTotal] = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [adminSearch, setAdminSearch] = useState('')
  const [workerSearch, setWorkerSearch] = useState('')

  const loadTab = useCallback(async (tab: 'admin' | 'worker') => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/connections?tab=${tab}`)
      const json = await res.json()
      if (!json.success) return
      if (tab === 'admin') {
        setAdminItems(json.data.items)
        setAdminTotal(json.data.total)
      } else {
        setWorkerItems(json.data.items)
        setWorkerTotal(json.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTab('admin') }, [loadTab])

  function handleTabChange(tab: 'admin' | 'worker') {
    setActiveTab(tab)
    if (tab === 'admin'  && adminItems.length  === 0) loadTab('admin')
    if (tab === 'worker' && workerItems.length === 0) loadTab('worker')
  }

  // 검색 필터
  const filteredAdmins = adminItems.filter(a => {
    const q = adminSearch.trim().toLowerCase()
    return !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.companyName ?? '').toLowerCase().includes(q)
  })

  const filteredWorkers = workerItems.filter(w => {
    const q = workerSearch.trim().toLowerCase()
    return !q || w.workerName.toLowerCase().includes(q) || w.workerPhone.includes(q)
  })

  return (
    <PageShell>
      <PageHeader
        title="접속 현황"
        description="관리자 및 근로자의 최근 접속 기록을 확인합니다."
        actions={
          <button
            onClick={() => loadTab(activeTab)}
            disabled={loading}
            className="px-4 py-2 bg-brand-accent text-white rounded-[8px] text-[13px] font-semibold border-none cursor-pointer disabled:opacity-50"
          >
            {loading ? '로딩중...' : '새로고침'}
          </button>
        }
      />

      {/* 탭 */}
      <div className="flex items-center gap-1 mb-5 bg-card border border-brand rounded-[10px] p-1 w-fit">
        <Tab active={activeTab === 'admin'}  onClick={() => handleTabChange('admin')}  count={adminTotal}>
          관리자
        </Tab>
        <Tab active={activeTab === 'worker'} onClick={() => handleTabChange('worker')} count={workerTotal}>
          근로자
        </Tab>
      </div>

      {/* ── 관리자 탭 ── */}
      {activeTab === 'admin' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              placeholder="이름·이메일·업체 검색"
              value={adminSearch}
              onChange={e => setAdminSearch(e.target.value)}
              className="text-[12px] border border-brand rounded-[8px] px-3 py-1.5 w-[200px] focus:outline-none focus:border-accent"
            />
            <span className="ml-auto text-[12px] text-muted2-brand">{filteredAdmins.length}명</span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-muted2-brand text-[13px]">로딩 중...</div>
          ) : (
            <MobileCardList
              items={filteredAdmins}
              keyExtractor={a => a.id}
              emptyMessage="관리자 계정이 없습니다."
              renderCard={a => {
                const rs    = ROLE_STYLE[a.role] ?? { bg: '#F3F4F6', color: '#6B7280' }
                const ago   = timeAgo(a.lastLoginAt)
                return (
                  <MobileCard
                    title={a.name}
                    subtitle={a.email}
                    badge={
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: rs.bg, color: rs.color }}>
                        {ROLE_LABEL[a.role] ?? a.role}
                      </span>
                    }
                  >
                    <MobileCardFields>
                      {a.companyName && <MobileCardField label="업체" value={a.companyName} />}
                      <MobileCardField label="상태" value={a.isActive ? '활성' : '비활성'} />
                      <MobileCardField
                        label="마지막 접속"
                        value={
                          <span>
                            {fmtDatetime(a.lastLoginAt)}
                            {ago && <span className="ml-1 text-[11px] text-muted2-brand">({ago})</span>}
                          </span>
                        }
                      />
                    </MobileCardFields>
                  </MobileCard>
                )
              }}
              renderTable={() => (
                <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                  <table className="w-full text-[12px]">
                    <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      <tr>
                        {['이름', '이메일', '역할', '업체', '상태', '마지막 접속'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-brand">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdmins.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-muted2-brand">관리자 계정이 없습니다.</td>
                        </tr>
                      ) : filteredAdmins.map(a => {
                        const rs  = ROLE_STYLE[a.role] ?? { bg: '#F3F4F6', color: '#6B7280' }
                        const ago = timeAgo(a.lastLoginAt)
                        return (
                          <tr key={a.id} style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-surface">
                            <td className="px-3 py-2.5 font-medium text-title-brand">{a.name}</td>
                            <td className="px-3 py-2.5 text-muted-brand">{a.email}</td>
                            <td className="px-3 py-2.5">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: rs.bg, color: rs.color }}>
                                {ROLE_LABEL[a.role] ?? a.role}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-brand">{a.companyName ?? '-'}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  background: a.isActive ? '#F0FDF4' : '#F3F4F6',
                                  color:      a.isActive ? '#16A34A' : '#9CA3AF',
                                }}
                              >
                                {a.isActive ? '활성' : '비활성'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-brand tabular-nums">
                              {fmtDatetime(a.lastLoginAt)}
                              {ago && <span className="ml-1 text-muted2-brand">({ago})</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            />
          )}
        </div>
      )}

      {/* ── 근로자 탭 ── */}
      {activeTab === 'worker' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              placeholder="이름·전화번호 검색"
              value={workerSearch}
              onChange={e => setWorkerSearch(e.target.value)}
              className="text-[12px] border border-brand rounded-[8px] px-3 py-1.5 w-[200px] focus:outline-none focus:border-accent"
            />
            <span className="ml-auto text-[12px] text-muted2-brand">{filteredWorkers.length}명</span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-muted2-brand text-[13px]">로딩 중...</div>
          ) : (
            <MobileCardList
              items={filteredWorkers}
              keyExtractor={w => w.id}
              emptyMessage="근로자 기기 정보가 없습니다."
              renderCard={w => {
                const ago = timeAgo(w.lastLoginAt)
                return (
                  <MobileCard
                    title={w.workerName}
                    subtitle={w.workerPhone}
                    badge={
                      w.isBlocked ? (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#B91C1C' }}>차단</span>
                      ) : (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F0FDF4', color: '#16A34A' }}>정상</span>
                      )
                    }
                  >
                    <MobileCardFields>
                      <MobileCardField label="기기명" value={w.deviceName ?? '-'} />
                      <MobileCardField label="플랫폼" value={w.platform ?? '-'} />
                      <MobileCardField label="주 기기" value={w.isPrimary ? '예' : '아니오'} />
                      <MobileCardField
                        label="마지막 접속"
                        value={
                          <span>
                            {fmtDatetime(w.lastLoginAt)}
                            {ago && <span className="ml-1 text-[11px] text-muted2-brand">({ago})</span>}
                          </span>
                        }
                      />
                      {w.isBlocked && w.blockReason && (
                        <MobileCardField label="차단 사유" value={w.blockReason} />
                      )}
                    </MobileCardFields>
                  </MobileCard>
                )
              }}
              renderTable={() => (
                <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                  <table className="w-full text-[12px]">
                    <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      <tr>
                        {['근로자명', '전화번호', '기기명', '플랫폼', '주 기기', '상태', '마지막 접속'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-brand">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-muted2-brand">근로자 기기 정보가 없습니다.</td>
                        </tr>
                      ) : filteredWorkers.map(w => {
                        const ago = timeAgo(w.lastLoginAt)
                        return (
                          <tr key={w.id} style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-surface">
                            <td className="px-3 py-2.5 font-medium text-title-brand">{w.workerName}</td>
                            <td className="px-3 py-2.5 text-muted-brand tabular-nums">{w.workerPhone}</td>
                            <td className="px-3 py-2.5 text-muted-brand">{w.deviceName ?? '-'}</td>
                            <td className="px-3 py-2.5 text-muted-brand">{w.platform ?? '-'}</td>
                            <td className="px-3 py-2.5 text-muted-brand">{w.isPrimary ? '예' : '-'}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  background: w.isBlocked ? '#FEE2E2' : '#F0FDF4',
                                  color:      w.isBlocked ? '#B91C1C' : '#16A34A',
                                }}
                              >
                                {w.isBlocked ? '차단' : '정상'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-brand tabular-nums">
                              {fmtDatetime(w.lastLoginAt)}
                              {ago && <span className="ml-1 text-muted2-brand">({ago})</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            />
          )}
        </div>
      )}
    </PageShell>
  )
}
