'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageShell, PageHeader, StatusBadge, Btn, FilterInput,
  AdminTable, AdminTr, AdminTd, EmptyRow,
} from '@/components/admin/ui'

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface Summary {
  totalWorkers: number; activeSites: number
  todayTotal: number; todayCheckedIn: number; todayCompleted: number
  todayMissing: number; todayException: number
  pendingMissing: number; pendingExceptions: number; pendingDeviceRequests: number
  todayWage: number; monthWage: number; totalWage: number
  todayPresenceTotal: number; todayPresencePending: number
  todayPresenceNoResponse: number; todayPresenceReview: number
  materialRequestCount: number
  docIncompleteCount: number
  scopeLabel: string | null
}
interface IssueRecord {
  id: string; workerId: string; workerName: string
  teamName: string | null; siteName: string
  checkInAt: string | null; status: string
}
interface MaterialRecord {
  id: string; requestNo: string; title: string; status: string
  siteName: string; requestedByName: string; submittedAt: string | null
}
interface DocWorker {
  id: string; name: string; teamName: string | null; issues: string[]
}
interface SiteSummaryItem {
  id: string; name: string; working: number; completed: number; missing: number; exception: number; issue: number
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

const STATUS_LABEL: Record<string, string> = {
  MISSING_CHECKOUT: '미퇴근', EXCEPTION: '예외',
  WORKING: '근무중', COMPLETED: '퇴근',
}
const MAT_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: '검토대기', REVIEWED: '검토완료', APPROVED: '승인', REJECTED: '반려',
  DRAFT: '작성중', CANCELLED: '취소',
}
const ISSUE_COLORS: Record<string, string> = {
  MISSING_CHECKOUT: 'text-status-missing', EXCEPTION: 'text-status-rejected',
}

// ── 요약 카드 ─────────────────────────────────────────────────────────────────
function SummaryCard({
  label, value, unit, sub, alert = false,
}: {
  label: string; value: number; unit?: string; sub?: string; alert?: boolean
}) {
  return (
    <div className="bg-card rounded-[12px] border border-brand px-4 py-4">
      <div className="text-[11px] font-semibold text-muted-brand mb-2 uppercase tracking-wide">{label}</div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className={`text-[26px] font-bold leading-none tabular-nums ${alert && value > 0 ? 'text-status-missing' : 'text-title-brand'}`}>
          {value}
        </span>
        {unit && <span className="text-[12px] text-muted2-brand">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-muted2-brand leading-snug">{sub}</div>}
    </div>
  )
}

// ── 섹션 헤더 ──────────────────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[13px] font-semibold text-fore-brand">{title}</span>
      {count !== undefined && (
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-surface text-muted-brand border border-brand tabular-nums">
          {count}
        </span>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()

  const todayIso = useMemo(() => {
    const d = new Date(Date.now() + 9 * 3600000)
    return d.toISOString().slice(0, 10)
  }, [])

  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [summary,      setSummary]      = useState<Summary | null>(null)
  const [issues,       setIssues]       = useState<IssueRecord[]>([])
  const [materials,    setMaterials]    = useState<MaterialRecord[]>([])
  const [docWorkers,   setDocWorkers]   = useState<DocWorker[]>([])
  const [siteSummary,  setSiteSummary]  = useState<SiteSummaryItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setLoadError('')
    fetch(`/api/admin/dashboard?date=${selectedDate}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        const d = data.data
        setSummary(d.summary)
        setIssues(d.recentIssues ?? [])
        setMaterials(d.recentMaterialRequests ?? [])
        setDocWorkers(d.docIncompleteWorkers ?? [])
        setSiteSummary(d.siteSummary ?? [])
        setLoading(false)
      })
      .catch(() => {
        setLoadError('대시보드를 불러올 수 없습니다.')
        setLoading(false)
      })
  }, [selectedDate, router])

  useEffect(() => { load() }, [load])

  const reviewCount = (summary?.todayException ?? 0) + (summary?.todayPresenceReview ?? 0)

  return (
    <PageShell>
      <PageHeader
        title="현황판"
        description={`${selectedDate} 기준 운영 요약`}
        actions={
          <>
            <FilterInput
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
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

      {/* scope 배지 (팀장/반장 전용) */}
      {summary?.scopeLabel && (
        <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-light border border-accent text-[12px] font-semibold text-accent">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {summary.scopeLabel} 기준
        </div>
      )}

      {loading ? (
        <div className="text-muted2-brand text-[13px] py-20 text-center">로딩 중...</div>
      ) : loadError ? (
        <div className="text-center py-20">
          <div className="text-status-rejected text-[14px] mb-2">{loadError}</div>
          <button onClick={load} className="px-4 py-2 bg-brand-accent text-white rounded-lg text-[13px] border-none cursor-pointer">다시 시도</button>
        </div>
      ) : (
        <>
          {/* ── 요약 카드 5개 ───────────────────────────────────────────── */}
          <div data-testid="summary-cards" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <SummaryCard
              label="오늘 출근 인원"
              value={summary?.todayTotal ?? 0}
              unit="명"
              sub={`근무중 ${summary?.todayCheckedIn ?? 0} · 퇴근 ${summary?.todayCompleted ?? 0}`}
            />
            <SummaryCard
              label="미출근 인원"
              value={summary?.todayMissing ?? 0}
              unit="명"
              sub="오늘 미퇴근 처리"
              alert
            />
            <SummaryCard
              label="검토 필요"
              value={reviewCount}
              unit="건"
              sub={`예외 ${summary?.todayException ?? 0} · 체류검토 ${summary?.todayPresenceReview ?? 0}`}
              alert
            />
            <SummaryCard
              label="자재 신청"
              value={summary?.materialRequestCount ?? 0}
              unit="건"
              sub="검토대기 + 검토완료"
            />
            <SummaryCard
              label="서류 미완료"
              value={summary?.docIncompleteCount ?? 0}
              unit="명"
              sub="온보딩 미처리"
              alert
            />
          </div>

          {/* ── 중간 영역 2행 ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

            {/* 최근 출근 이상 건 */}
            <div className="bg-card rounded-[12px] border border-brand p-4">
              <SectionHeader title="최근 출근 이상" count={issues.length} />
              <AdminTable headers={['근로자', '현장', '출근시각', '상태']}>
                {issues.length === 0 ? (
                  <EmptyRow colSpan={4} message="오늘 이상 건 없음" />
                ) : issues.map(r => (
                  <AdminTr key={r.id}>
                    <AdminTd>
                      <div className="font-medium text-fore-brand">{r.workerName}</div>
                      {r.teamName && <div className="text-[11px] text-muted2-brand">{r.teamName}</div>}
                    </AdminTd>
                    <AdminTd>
                      <span className="text-[12px] text-body-brand">{r.siteName}</span>
                    </AdminTd>
                    <AdminTd>
                      <span className="tabular-nums text-[12px]">{fmtTime(r.checkInAt)}</span>
                    </AdminTd>
                    <AdminTd>
                      <StatusBadge
                        status={r.status}
                        label={STATUS_LABEL[r.status] ?? r.status}
                      />
                    </AdminTd>
                  </AdminTr>
                ))}
              </AdminTable>
            </div>

            {/* 현장별 인원 요약 */}
            <div className="bg-card rounded-[12px] border border-brand p-4">
              <SectionHeader title="현장별 인원 요약" count={siteSummary.length} />
              <AdminTable headers={['현장', '출근중', '퇴근', '확인필요']}>
                {siteSummary.length === 0 ? (
                  <EmptyRow colSpan={4} message="오늘 출근 현장 없음" />
                ) : siteSummary.map(s => (
                  <AdminTr key={s.id}>
                    <AdminTd>
                      <span className="text-[12px] font-medium text-fore-brand">{s.name}</span>
                    </AdminTd>
                    <AdminTd>
                      <span className={`tabular-nums font-semibold text-[13px] ${s.working > 0 ? 'text-status-working' : 'text-muted2-brand'}`}>
                        {s.working}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <span className="tabular-nums text-[13px] text-muted-brand">{s.completed}</span>
                    </AdminTd>
                    <AdminTd>
                      {s.issue > 0 ? (
                        <span className="text-[12px] font-semibold px-1.5 py-0.5 rounded-full bg-red-light text-status-missing border border-[#F87171] tabular-nums">
                          {s.issue}
                        </span>
                      ) : (
                        <span className="text-muted2-brand text-[12px]">-</span>
                      )}
                    </AdminTd>
                  </AdminTr>
                ))}
              </AdminTable>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* 최근 자재신청 */}
            <div className="bg-card rounded-[12px] border border-brand p-4">
              <SectionHeader title="최근 자재 신청" count={materials.length} />
              <AdminTable headers={['신청번호', '품목', '현장', '상태']}>
                {materials.length === 0 ? (
                  <EmptyRow colSpan={4} message="검토 대기 건 없음" />
                ) : materials.map(r => (
                  <AdminTr key={r.id}>
                    <AdminTd>
                      <span className="tabular-nums text-[11px] text-muted-brand font-mono">{r.requestNo}</span>
                    </AdminTd>
                    <AdminTd>
                      <div className="text-[12px] font-medium text-fore-brand truncate max-w-[160px]">{r.title}</div>
                      <div className="text-[11px] text-muted2-brand">{r.requestedByName}</div>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-[12px] text-body-brand">{r.siteName}</span>
                    </AdminTd>
                    <AdminTd>
                      <StatusBadge
                        status={r.status === 'SUBMITTED' ? 'PENDING' : r.status}
                        label={MAT_STATUS_LABEL[r.status] ?? r.status}
                      />
                    </AdminTd>
                  </AdminTr>
                ))}
              </AdminTable>
            </div>

            {/* 서류/안전교육 미완료 근로자 */}
            <div className="bg-card rounded-[12px] border border-brand p-4">
              <SectionHeader title="서류/안전교육 미완료" count={docWorkers.length} />
              <AdminTable headers={['근로자', '팀', '미처리 항목']}>
                {docWorkers.length === 0 ? (
                  <EmptyRow colSpan={3} message="미완료 근로자 없음" />
                ) : docWorkers.map(w => (
                  <AdminTr key={w.id}>
                    <AdminTd>
                      <a href={`/admin/workers/${w.id}`} className="text-[12px] font-medium text-accent hover:underline">
                        {w.name}
                      </a>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-[12px] text-muted-brand">{w.teamName ?? '-'}</span>
                    </AdminTd>
                    <AdminTd>
                      <div className="flex flex-wrap gap-1">
                        {w.issues.slice(0, 2).map((issue, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-light text-status-pending border border-yellow">
                            {issue}
                          </span>
                        ))}
                        {w.issues.length > 2 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-muted2-brand border border-brand">
                            +{w.issues.length - 2}
                          </span>
                        )}
                      </div>
                    </AdminTd>
                  </AdminTr>
                ))}
              </AdminTable>
            </div>
          </div>
        </>
      )}
    </PageShell>
  )
}
