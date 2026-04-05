'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageShell, PageHeader, Btn, FilterInput,
  AdminTable, AdminTr, AdminTd, EmptyRow,
} from '@/components/admin/ui'

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface Team {
  teamName: string
  workerCount: number
  supervisorName: string | null
  foremanNames: string[]
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function OrgPage() {
  const router = useRouter()
  const [teams,          setTeams]          = useState<Team[]>([])
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [search,         setSearch]         = useState('')
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetch('/api/admin/org/teams')
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setTeams(data.data.teams)
        setUnassignedCount(data.data.unassignedCount)
        setLoading(false)
      })
      .catch(() => { setError('조직 정보를 불러올 수 없습니다.'); setLoading(false) })
  }, [router])

  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? teams.filter(t =>
        t.teamName.includes(search) ||
        (t.supervisorName ?? '').includes(search) ||
        t.foremanNames.some(f => f.includes(search))
      )
    : teams

  const goDetail = (name: string) =>
    router.push(`/admin/org/${encodeURIComponent(name)}`)

  return (
    <PageShell>
      <PageHeader
        title="조직 관리"
        description="팀 구성, 팀장·반장 배정, 근로자 소속 관리"
        actions={
          <>
            <FilterInput
              placeholder="팀명·팀장·반장 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Btn variant="ghost" size="sm" onClick={load}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              새로고침
            </Btn>
          </>
        }
      />

      {loading ? (
        <div className="py-20 text-center text-[13px] text-muted2-brand">로딩 중...</div>
      ) : error ? (
        <div className="py-20 text-center">
          <div className="text-status-rejected text-[14px] mb-2">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-brand-accent text-white rounded-lg text-[13px] border-none cursor-pointer">다시 시도</button>
        </div>
      ) : (
        <div data-testid="org-list" className="bg-card rounded-[12px] border border-brand overflow-hidden">
          <AdminTable headers={['팀명', '팀장', '반장', '인원', '']}>
            {filtered.length === 0 && unassignedCount === 0 ? (
              <EmptyRow colSpan={5} message="등록된 팀이 없습니다." />
            ) : (
              <>
                {filtered.map(team => (
                  <AdminTr
                    key={team.teamName}
                    onClick={() => goDetail(team.teamName)}
                    className="cursor-pointer hover:bg-surface"
                  >
                    <AdminTd>
                      <span className="text-[13px] font-semibold text-fore-brand">{team.teamName}</span>
                    </AdminTd>
                    <AdminTd>
                      {team.supervisorName
                        ? <span className="text-[12px] text-body-brand">{team.supervisorName}</span>
                        : <span className="text-[12px] text-muted2-brand">미지정</span>
                      }
                    </AdminTd>
                    <AdminTd>
                      {team.foremanNames.length > 0
                        ? (
                          <div className="flex flex-wrap gap-1">
                            {team.foremanNames.slice(0, 3).map(f => (
                              <span key={f} className="text-[11px] px-1.5 py-0.5 rounded bg-surface border border-brand text-body-brand">{f}</span>
                            ))}
                            {team.foremanNames.length > 3 && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface border border-brand text-muted2-brand">+{team.foremanNames.length - 3}</span>
                            )}
                          </div>
                        )
                        : <span className="text-[12px] text-muted2-brand">미지정</span>
                      }
                    </AdminTd>
                    <AdminTd>
                      <span className="tabular-nums font-semibold text-[14px] text-fore-brand">{team.workerCount}</span>
                      <span className="text-[11px] text-muted2-brand ml-0.5">명</span>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-[12px] text-accent">상세 →</span>
                    </AdminTd>
                  </AdminTr>
                ))}

                {/* 미배정 행 */}
                {unassignedCount > 0 && (
                  <AdminTr
                    onClick={() => goDetail('__unassigned__')}
                    className="cursor-pointer hover:bg-surface"
                  >
                    <AdminTd>
                      <span className="text-[13px] font-semibold text-muted-brand">미배정</span>
                    </AdminTd>
                    <AdminTd><span className="text-[12px] text-muted2-brand">—</span></AdminTd>
                    <AdminTd><span className="text-[12px] text-muted2-brand">—</span></AdminTd>
                    <AdminTd>
                      <span className="tabular-nums font-semibold text-[14px] text-status-missing">{unassignedCount}</span>
                      <span className="text-[11px] text-muted2-brand ml-0.5">명</span>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-[12px] text-accent">배정 →</span>
                    </AdminTd>
                  </AdminTr>
                )}
              </>
            )}
          </AdminTable>
        </div>
      )}
    </PageShell>
  )
}
