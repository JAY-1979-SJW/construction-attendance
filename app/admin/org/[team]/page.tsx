'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageShell, PageHeader, Btn, FilterInput,
  AdminTable, AdminTr, AdminTd, EmptyRow,
} from '@/components/admin/ui'

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface OrgWorker {
  id: string
  name: string
  teamName: string | null
  supervisorName: string | null
  foremanName: string | null
  jobTitle: string | null
  siteName: string | null
}

interface TeamDetail {
  teamName: string | null
  workerCount: number
  supervisorNames: string[]
  foremanNames: string[]
  workers: OrgWorker[]
}

// ── 인라인 편집 입력 ──────────────────────────────────────────────────────────
function InlineEdit({
  label, value, onSave, disabled = false,
}: {
  label: string; value: string; onSave: (v: string) => Promise<void>; disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(value)
  const [saving,  setSaving]  = useState(false)

  const commit = async () => {
    setSaving(true)
    await onSave(val)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          className="h-8 px-2 border border-brand rounded-[6px] text-[12px] text-fore-brand focus:outline-none focus:border-accent min-w-[120px]"
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        />
        <Btn size="sm" variant="primary" onClick={commit} disabled={saving}>저장</Btn>
        <Btn size="sm" variant="ghost" onClick={() => { setEditing(false); setVal(value) }}>취소</Btn>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-fore-brand">{value || <span className="text-muted2-brand">미지정</span>}</span>
      {!disabled && (
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] text-accent hover:underline border-none bg-transparent cursor-pointer p-0"
        >
          수정
        </button>
      )}
    </div>
  )
}

// ── 근로자 배정 행 ─────────────────────────────────────────────────────────────
function WorkerAssignRow({
  worker, allTeams, canMutate, onAssigned,
}: {
  worker: OrgWorker
  allTeams: string[]
  canMutate: boolean
  onAssigned: () => void
}) {
  const [editing,   setEditing]   = useState(false)
  const [teamVal,   setTeamVal]   = useState(worker.teamName ?? '')
  const [foremanVal, setForemanVal] = useState(worker.foremanName ?? '')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  const save = async () => {
    setSaving(true)
    setErr('')
    try {
      const res = await fetch(`/api/admin/workers/${worker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName:    teamVal   || null,
          foremanName: foremanVal || null,
        }),
      })
      const data = await res.json()
      if (!data.success) { setErr(data.error ?? '저장 실패'); setSaving(false); return }
      setEditing(false)
      onAssigned()
    } catch {
      setErr('네트워크 오류')
      setSaving(false)
    }
  }

  return (
    <>
      <AdminTr>
        <AdminTd>
          <a href={`/admin/workers/${worker.id}`} className="text-[12px] font-medium text-accent hover:underline">
            {worker.name}
          </a>
          {worker.jobTitle && (
            <div className="text-[11px] text-muted2-brand">{worker.jobTitle}</div>
          )}
        </AdminTd>
        <AdminTd>
          {editing ? (
            <input
              value={foremanVal}
              onChange={e => setForemanVal(e.target.value)}
              list={`foreman-list-${worker.id}`}
              className="h-7 px-2 border border-brand rounded-[6px] text-[11px] text-fore-brand focus:outline-none focus:border-accent w-[100px]"
              placeholder="반장 이름"
            />
          ) : (
            <span className="text-[12px] text-muted-brand">{worker.foremanName || '—'}</span>
          )}
        </AdminTd>
        <AdminTd>
          {editing ? (
            <input
              value={teamVal}
              onChange={e => setTeamVal(e.target.value)}
              list={`team-list-${worker.id}`}
              className="h-7 px-2 border border-brand rounded-[6px] text-[11px] text-fore-brand focus:outline-none focus:border-accent w-[100px]"
              placeholder="팀명"
            />
          ) : (
            <span className="text-[12px] text-muted-brand">{worker.teamName || <span className="text-status-missing">미배정</span>}</span>
          )}
        </AdminTd>
        <AdminTd>
          <span className="text-[11px] text-muted2-brand">{worker.siteName ?? '—'}</span>
        </AdminTd>
        <AdminTd>
          {canMutate && (
            editing ? (
              <div className="flex items-center gap-1.5">
                <Btn size="sm" variant="primary" onClick={save} disabled={saving}>저장</Btn>
                <Btn size="sm" variant="ghost" onClick={() => {
                  setEditing(false)
                  setTeamVal(worker.teamName ?? '')
                  setForemanVal(worker.foremanName ?? '')
                  setErr('')
                }}>취소</Btn>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] text-accent hover:underline border-none bg-transparent cursor-pointer p-0"
                data-testid={`edit-worker-${worker.id}`}
              >
                배정 변경
              </button>
            )
          )}
        </AdminTd>
      </AdminTr>
      {err && (
        <tr>
          <td colSpan={5} className="px-4 py-1">
            <span className="text-[11px] text-status-rejected">{err}</span>
          </td>
        </tr>
      )}
      {/* datalist for autocomplete */}
      <datalist id={`foreman-list-${worker.id}`}>
        {/* filled dynamically – parent passes foremanNames */}
      </datalist>
      <datalist id={`team-list-${worker.id}`}>
        {allTeams.map(t => <option key={t} value={t} />)}
      </datalist>
    </>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function OrgDetailPage({ params }: { params: Promise<{ team: string }> }) {
  const router = useRouter()
  const { team: encodedTeam } = use(params)
  const teamParam = decodeURIComponent(encodedTeam)
  const isUnassigned = teamParam === '__unassigned__'

  const [detail,    setDetail]    = useState<TeamDetail | null>(null)
  const [allTeams,  setAllTeams]  = useState<string[]>([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [canMutate, setCanMutate] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([
      fetch(`/api/admin/org/teams/${encodeURIComponent(teamParam)}`).then(r => r.json()),
      fetch('/api/admin/org/teams').then(r => r.json()),
      fetch('/api/admin/auth/me').then(r => r.json()),
    ])
      .then(([detailData, listData, meData]) => {
        if (!detailData.success) { router.push('/admin/login'); return }
        setDetail(detailData.data)
        if (listData.success) setAllTeams(listData.data.teams.map((t: { teamName: string }) => t.teamName))
        if (meData.success) {
          const role = meData.data.role ?? ''
          setCanMutate(!['VIEWER', 'TEAM_LEADER', 'FOREMAN'].includes(role))
        }
        setLoading(false)
      })
      .catch(() => { setError('데이터를 불러올 수 없습니다.'); setLoading(false) })
  }, [teamParam, router])

  useEffect(() => { load() }, [load])

  const saveTeamField = async (field: 'supervisorName' | 'newTeamName', value: string) => {
    const res = await fetch(`/api/admin/org/teams/${encodeURIComponent(teamParam)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    })
    const data = await res.json()
    if (data.success) {
      if (field === 'newTeamName' && data.data.teamName) {
        router.replace(`/admin/org/${encodeURIComponent(data.data.teamName)}`)
      } else {
        load()
      }
    }
  }

  const filtered = detail
    ? (search.trim()
        ? detail.workers.filter(w =>
            w.name.includes(search) ||
            (w.foremanName ?? '').includes(search) ||
            (w.teamName ?? '').includes(search)
          )
        : detail.workers)
    : []

  const pageTitle = isUnassigned ? '미배정 근로자' : (detail?.teamName ?? teamParam)

  return (
    <PageShell>
      <PageHeader
        title={pageTitle}
        description={isUnassigned ? '팀 미배정 근로자 목록' : '팀 구성원 및 배정 관리'}
        actions={
          <>
            <FilterInput
              placeholder="근로자·반장 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Btn variant="ghost" size="sm" onClick={() => router.push('/admin/org')}>
              ← 목록
            </Btn>
            <Btn variant="ghost" size="sm" onClick={load}>새로고침</Btn>
          </>
        }
      />

      {loading ? (
        <div className="py-20 text-center text-[13px] text-muted2-brand">로딩 중...</div>
      ) : error ? (
        <div className="py-20 text-center text-status-rejected text-[14px]">{error}</div>
      ) : detail ? (
        <>
          {/* ── 팀 정보 카드 (미배정 제외) ─────────────────────────── */}
          {!isUnassigned && (
            <div data-testid="team-info" className="bg-card rounded-[12px] border border-brand px-5 py-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] font-semibold text-muted-brand mb-1.5 uppercase tracking-wide">팀명</div>
                <InlineEdit
                  label="팀명"
                  value={detail.teamName ?? ''}
                  onSave={v => saveTeamField('newTeamName', v)}
                  disabled={!canMutate}
                />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-muted-brand mb-1.5 uppercase tracking-wide">팀장</div>
                <InlineEdit
                  label="팀장"
                  value={detail.supervisorNames[0] ?? ''}
                  onSave={v => saveTeamField('supervisorName', v)}
                  disabled={!canMutate}
                />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-muted-brand mb-1.5 uppercase tracking-wide">반장</div>
                <div className="flex flex-wrap gap-1">
                  {detail.foremanNames.length > 0
                    ? detail.foremanNames.map(f => (
                        <span key={f} className="text-[11px] px-1.5 py-0.5 rounded bg-surface border border-brand text-body-brand">{f}</span>
                      ))
                    : <span className="text-[12px] text-muted2-brand">미지정</span>
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── 근로자 목록 + 배정 ──────────────────────────────────── */}
          <div className="bg-card rounded-[12px] border border-brand overflow-hidden">
            <div className="px-4 py-3 border-b border-brand flex items-center justify-between">
              <span className="text-[13px] font-semibold text-fore-brand">
                소속 근로자 <span className="text-muted2-brand font-normal tabular-nums ml-1">{filtered.length}명</span>
              </span>
            </div>
            <AdminTable headers={['근로자', '반장', '팀', '현장', '']}>
              {filtered.length === 0 ? (
                <EmptyRow colSpan={5} message="근로자가 없습니다." />
              ) : filtered.map(w => (
                <WorkerAssignRow
                  key={w.id}
                  worker={w}
                  allTeams={allTeams}
                  canMutate={canMutate}
                  onAssigned={load}
                />
              ))}
            </AdminTable>
          </div>
        </>
      ) : null}
    </PageShell>
  )
}
