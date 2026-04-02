'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields } from '@/components/admin/ui'

interface AuditLog {
  id: string
  actorUserId: string | null
  actorType: string
  actionType: string
  targetType: string | null
  targetId: string | null
  summary: string
  metadataJson: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

const ACTOR_TYPE_COLOR: Record<string, string> = {
  ADMIN: '#1565c0', WORKER: '#2e7d32', SYSTEM: '#888',
}
const ACTOR_TYPE_BG: Record<string, string> = {
  ADMIN: '#e3f2fd', WORKER: '#e8f5e9', SYSTEM: '#f5f5f5',
}

const ACTION_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'ADMIN_LOGIN', label: 'ADMIN_LOGIN — 관리자 로그인' },
  { value: 'REGISTER_WORKER', label: 'REGISTER_WORKER — 근로자 등록' },
  { value: 'UPDATE_WORKER', label: 'UPDATE_WORKER — 근로자 수정' },
  { value: 'DEACTIVATE_WORKER', label: 'DEACTIVATE_WORKER — 근로자 비활성화' },
  { value: 'WORKER_COMPANY_ASSIGN', label: 'WORKER_COMPANY_ASSIGN — 근로자 회사배정' },
  { value: 'WORKER_SITE_ASSIGN', label: 'WORKER_SITE_ASSIGN — 근로자 현장배정' },
  { value: 'WORKER_INSURANCE_UPDATE', label: 'WORKER_INSURANCE_UPDATE — 보험 상태' },
  { value: 'COMPANY_CREATE', label: 'COMPANY_CREATE — 회사 등록' },
  { value: 'COMPANY_UPDATE', label: 'COMPANY_UPDATE — 회사 수정' },
  { value: 'CREATE_SITE', label: 'CREATE_SITE — 현장 등록' },
  { value: 'UPDATE_SITE', label: 'UPDATE_SITE — 현장 수정' },
  { value: 'SITE_COMPANY_ASSIGN', label: 'SITE_COMPANY_ASSIGN — 현장 회사배정' },
  { value: 'ATTENDANCE_CHECK_IN_DIRECT', label: 'ATTENDANCE_CHECK_IN_DIRECT — 직접 출근' },
  { value: 'ATTENDANCE_CHECK_OUT_DIRECT', label: 'ATTENDANCE_CHECK_OUT_DIRECT — 직접 퇴근' },
  { value: 'ATTENDANCE_EXCEPTION_CHECK_OUT', label: 'ATTENDANCE_EXCEPTION_CHECK_OUT — 예외 퇴근' },
  { value: 'ADJUST_ATTENDANCE', label: 'ADJUST_ATTENDANCE — 출퇴근 보정' },
  { value: 'APPROVE_DEVICE_CHANGE', label: 'APPROVE_DEVICE_CHANGE — 기기변경 승인' },
  { value: 'REJECT_DEVICE_CHANGE', label: 'REJECT_DEVICE_CHANGE — 기기변경 거절' },
  { value: 'APPROVE_EXCEPTION', label: 'APPROVE_EXCEPTION — 예외승인' },
  { value: 'REJECT_EXCEPTION', label: 'REJECT_EXCEPTION — 예외거절' },
]

const TARGET_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'Worker', label: 'Worker' },
  { value: 'Company', label: 'Company' },
  { value: 'Site', label: 'Site' },
  { value: 'AttendanceLog', label: 'AttendanceLog' },
  { value: 'Device', label: 'Device' },
  { value: 'ExceptionRequest', label: 'ExceptionRequest' },
]

export default function AuditLogsPage() {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom]       = useState(today)
  const [dateTo, setDateTo]           = useState(today)
  const [actionType, setActionType]   = useState('')
  const [actorUserId, setActorUserId] = useState('')
  const [targetType, setTargetType]   = useState('')
  const [items, setItems]             = useState<AuditLog[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(false)
  const [expanded, setExpanded]       = useState<string | null>(null)

  const pageSize = 50

  const load = (pg = 1) => {
    setLoading(true)
    setPage(pg)
    const params = new URLSearchParams({ dateFrom, dateTo, pageSize: String(pageSize), page: String(pg) })
    if (actionType) params.set('actionType', actionType)
    if (actorUserId.trim()) params.set('actorUserId', actorUserId.trim())
    if (targetType) params.set('targetType', targetType)
    fetch(`/api/admin/audit-logs?${params}`)
      .then((r) => {
        if (r.status === 401) { router.push('/admin/login'); return null }
        if (r.status === 403) { router.push('/admin'); return null }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        if (!data.success) { router.push('/admin'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / pageSize)

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })

  const shortId = (id: string | null) => id ? id.slice(-8) : '-'

  return (
    <div className="p-8 min-w-0">
        <h1 className="text-[22px] font-bold mb-1 mt-0">감사 로그</h1>
        <p className="text-[13px] text-muted-brand mb-5 -mt-3">
          시스템 내 모든 주요 이벤트 기록 (출퇴근·기기·회사·현장·근로자·보험)
        </p>

        {/* 필터 */}
        <div className="bg-card rounded-[12px] p-5 mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted-brand">시작일</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted-brand">종료일</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted-brand">액션 유형</label>
              <select value={actionType} onChange={(e) => setActionType(e.target.value)}
                className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] min-w-[240px]">
                {ACTION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted-brand">대상 유형</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value)}
                className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px]">
                {TARGET_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted-brand">행위자 ID</label>
              <input
                type="text"
                placeholder="actorUserId"
                value={actorUserId}
                onChange={(e) => setActorUserId(e.target.value)}
                className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] w-40"
              />
            </div>
            <button onClick={() => load(1)}
              className="px-5 py-2 bg-brand-accent text-white border-none rounded-md cursor-pointer text-[14px]">
              조회
            </button>
          </div>
        </div>

        <div className="text-[13px] text-muted-brand mb-3 flex justify-between items-center">
          <span>총 {total.toLocaleString()}건 · {page}/{totalPages || 1} 페이지</span>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button onClick={() => load(page - 1)} disabled={page <= 1}
                className="px-[14px] py-1.5 bg-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px] text-muted-brand disabled:opacity-50">
                ← 이전
              </button>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages}
                className="px-[14px] py-1.5 bg-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px] text-muted-brand disabled:opacity-50">
                다음 →
              </button>
            </div>
          )}
        </div>

        {loading ? <p className="text-muted-brand">로딩 중...</p> : (
          <div className="bg-card rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
            <MobileCardList
              items={items}
              emptyMessage="로그가 없습니다."
              keyExtractor={(item) => item.id}
              renderCard={(item) => (
                <MobileCard
                  title={<ActionTypeBadge actionType={item.actionType} />}
                  subtitle={formatDateTime(item.createdAt)}
                  badge={
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                      color: ACTOR_TYPE_COLOR[item.actorType] ?? '#555',
                      background: ACTOR_TYPE_BG[item.actorType] ?? '#f5f5f5',
                    }}>
                      {item.actorType}
                    </span>
                  }
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  <MobileCardFields>
                    <MobileCardField label="내용" value={item.summary} />
                    {item.targetType && <MobileCardField label="대상 유형" value={item.targetType} />}
                    {item.targetId && <MobileCardField label="대상 ID" value={shortId(item.targetId)} />}
                    {item.ipAddress && <MobileCardField label="IP" value={item.ipAddress} />}
                  </MobileCardFields>
                  {expanded === item.id && item.metadataJson && (
                    <div className="mt-2 pt-2 border-t border-brand">
                      <div className="text-[11px] font-bold text-muted-brand mb-1 uppercase">메타데이터</div>
                      <pre className="text-[11px] text-dim-brand whitespace-pre-wrap break-all m-0">
                        {JSON.stringify(item.metadataJson, null, 2)}
                      </pre>
                    </div>
                  )}
                </MobileCard>
              )}
              renderTable={() => (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['시각', '행위자', '유형', '액션', '대상', '내용'].map((h) => (
                    <th key={h} className="text-left px-[14px] py-3 text-[11px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] whitespace-nowrap bg-surface">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-[#999]">로그가 없습니다.</td></tr>
                ) : items.map((item) => (
                  <>
                    <tr
                      key={item.id}
                      className="cursor-pointer"
                      style={{ background: expanded === item.id ? '#fafafa' : 'white' }}
                      onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                    >
                      <td className="px-[14px] py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                        <span className="text-[12px] text-muted-brand whitespace-nowrap">{formatDateTime(item.createdAt)}</span>
                      </td>
                      <td className="px-[14px] py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                        <div>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                            color: ACTOR_TYPE_COLOR[item.actorType] ?? '#555',
                            background: ACTOR_TYPE_BG[item.actorType] ?? '#f5f5f5',
                          }}>
                            {item.actorType}
                          </span>
                          {item.actorUserId && (
                            <div className="text-[11px] text-muted-brand mt-0.5">
                              {shortId(item.actorUserId)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-[14px] py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                        {item.targetType && (
                          <span className="text-[11px] text-muted-brand bg-footer px-1.5 py-0.5 rounded-md">
                            {item.targetType}
                          </span>
                        )}
                      </td>
                      <td className="px-[14px] py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                        <ActionTypeBadge actionType={item.actionType} />
                      </td>
                      <td className="px-[14px] py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top">
                        {item.targetId && (
                          <span className="text-[11px] text-[#718096] font-mono">{shortId(item.targetId)}</span>
                        )}
                      </td>
                      <td className="px-[14px] py-[10px] text-[13px] border-b border-[rgba(91,164,217,0.1)] align-top max-w-[320px]">
                        <span className="text-[13px] text-dim-brand">{item.summary}</span>
                      </td>
                    </tr>
                    {expanded === item.id && (
                      <tr key={`${item.id}-detail`} className="bg-surface">
                        <td colSpan={6} className="px-4 py-3 border-b-2 border-[#e3f2fd]">
                          <div className="flex gap-6 flex-wrap">
                            <div>
                              <div className={detailLabelCls}>전체 ID</div>
                              <div className={detailValueCls}>{item.id}</div>
                            </div>
                            {item.actorUserId && (
                              <div>
                                <div className={detailLabelCls}>행위자 ID</div>
                                <div className={detailValueCls}>{item.actorUserId}</div>
                              </div>
                            )}
                            {item.targetId && (
                              <div>
                                <div className={detailLabelCls}>대상 ID</div>
                                <div className={detailValueCls}>{item.targetId}</div>
                              </div>
                            )}
                            {item.ipAddress && (
                              <div>
                                <div className={detailLabelCls}>IP</div>
                                <div className={detailValueCls}>{item.ipAddress}</div>
                              </div>
                            )}
                            {item.metadataJson && (
                              <div>
                                <div className={detailLabelCls}>메타데이터</div>
                                <pre className="text-[11px] text-muted-brand m-0 bg-brand px-2.5 py-1.5 rounded-md max-w-[400px] overflow-x-auto">
                                  {JSON.stringify(item.metadataJson, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
                  </table>
                </div>
              )}
            />
          </div>
        )}

        {/* 페이지네이션 하단 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => load(1)} disabled={page <= 1}
              className="px-[14px] py-1.5 bg-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px] text-muted-brand disabled:opacity-50">
              처음
            </button>
            <button onClick={() => load(page - 1)} disabled={page <= 1}
              className="px-[14px] py-1.5 bg-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px] text-muted-brand disabled:opacity-50">
              ← 이전
            </button>
            <span className="text-[13px] text-muted-brand px-3 py-1.5">{page} / {totalPages}</span>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages}
              className="px-[14px] py-1.5 bg-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px] text-muted-brand disabled:opacity-50">
              다음 →
            </button>
            <button onClick={() => load(totalPages)} disabled={page >= totalPages}
              className="px-[14px] py-1.5 bg-brand border border-[rgba(91,164,217,0.2)] rounded-md cursor-pointer text-[13px] text-muted-brand disabled:opacity-50">
              마지막
            </button>
          </div>
        )}
    </div>
  )
}

/* ── ActionType 배지 ────────────────────────────────────── */
function ActionTypeBadge({ actionType }: { actionType: string }) {
  let color = '#555'
  let bg = '#f5f5f5'

  if (actionType.startsWith('ATTENDANCE')) { color = '#1565c0'; bg = '#e3f2fd' }
  else if (actionType.includes('APPROVE')) { color = '#2e7d32'; bg = '#e8f5e9' }
  else if (actionType.includes('REJECT'))  { color = '#b71c1c'; bg = '#ffebee' }
  else if (actionType.includes('CREATE') || actionType.includes('REGISTER')) { color = '#4a148c'; bg = '#f3e5f5' }
  else if (actionType.includes('UPDATE') || actionType.includes('ADJUST'))   { color = '#e65100'; bg = '#fff3e0' }
  else if (actionType.includes('DEACTIVATE') || actionType.includes('DELETE')) { color = '#b71c1c'; bg = '#ffebee' }
  else if (actionType.includes('ASSIGN'))  { color = '#00695c'; bg = '#e0f2f1' }
  else if (actionType === 'ADMIN_LOGIN')   { color = '#1565c0'; bg = '#e3f2fd' }

  return (
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color, background: bg, whiteSpace: 'nowrap' as const }}>
      {actionType}
    </span>
  )
}

/* ── 스타일 상수 ─────────────────────────────────────────── */
const detailLabelCls = 'text-[11px] text-[#aaa] font-semibold uppercase mb-0.5'
const detailValueCls = 'text-[12px] text-dim-brand font-mono'
