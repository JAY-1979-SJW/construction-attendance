'use client'

import { useEffect, useState, useCallback } from 'react'
import { Modal } from '@/components/admin/ui'

/**
 * 출퇴근 예외/누락 처리 센터
 * GET  /api/admin/attendance/exceptions
 * GET  /api/admin/attendance/exceptions/summary  (자동 탐지 요약)
 * POST /api/admin/attendance/exceptions/[id]/resolve
 */

interface ExceptionItem {
  id:              string
  workerId:        string
  workerName:      string
  workerPhone:     string
  company:         string
  siteId:          string
  siteName:        string
  workDate:        string
  checkInAt:       string | null
  checkOutAt:      string | null
  status:          string
  exceptionReason: string | null
  adminNote:       string | null
  daysBehind:      number
}

interface DetectionSummary {
  missingCheckout: number
  outsideGeofence: number
  missingPhoto:    number
  longShift:       number
  presenceMissed:  number
  total:           number
  dateFrom:        string
  dateTo:          string
}

interface DetectionDetail {
  id:          string
  workerName:  string
  workerPhone: string
  siteName:    string
  siteId:      string
  workDate?:   string
  checkDate?:  string
  checkInAt?:  string | null
  checkOutAt?: string | null
  workedMinutes?: number | null
  scheduledAt?: string
  status?:     string
}

const STATUS_LABEL: Record<string, string> = {
  EXCEPTION:        '예외',
  MISSING_CHECKOUT: '퇴근누락',
}

const STATUS_COLOR: Record<string, string> = {
  EXCEPTION:        '#c62828',
  MISSING_CHECKOUT: '#e65100',
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function AttendanceExceptionsPage() {
  const [type,    setType]    = useState<'ALL' | 'EXCEPTION' | 'MISSING_CHECKOUT'>('ALL')
  const [items,   setItems]   = useState<ExceptionItem[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // 자동 탐지 요약
  const [detection, setDetection] = useState<DetectionSummary | null>(null)
  const [detailType, setDetailType] = useState<string | null>(null)
  const [detailItems, setDetailItems] = useState<DetectionDetail[]>([])
  const [detectionLoading, setDetectionLoading] = useState(false)

  // 처리 모달 상태
  const [target,    setTarget]    = useState<ExceptionItem | null>(null)
  const [action,    setAction]    = useState<string>('')
  const [checkOut,  setCheckOut]  = useState('')
  const [note,      setNote]      = useState('')
  const [saving,    setSaving]    = useState(false)

  // 자동 탐지 요약 로드
  const loadDetection = useCallback(async () => {
    setDetectionLoading(true)
    try {
      const res  = await fetch('/api/admin/attendance/exceptions/summary')
      const data = await res.json()
      if (data.success) {
        setDetection(data.summary)
        // 기본으로 가장 많은 항목 상세 표시
        const cats = [
          { key: 'missingCheckout', count: data.summary.missingCheckout },
          { key: 'outsideGeofence', count: data.summary.outsideGeofence },
          { key: 'missingPhoto',    count: data.summary.missingPhoto },
          { key: 'longShift',       count: data.summary.longShift },
          { key: 'presenceMissed',  count: data.summary.presenceMissed },
        ].sort((a, b) => b.count - a.count)
        if (cats[0].count > 0) {
          setDetailType(cats[0].key)
          setDetailItems(data.details[cats[0].key] ?? [])
        }
      }
    } catch { /* silent */ }
    setDetectionLoading(false)
  }, [])

  const showDetail = (key: string, items: DetectionDetail[]) => {
    setDetailType(key)
    setDetailItems(items)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/admin/attendance/exceptions?type=${type}&page=${page}&pageSize=30`)
      const data = await res.json()
      if (data.success) {
        setItems(data.items)
        setTotal(data.total)
      } else {
        setError(data.error ?? '조회 오류')
      }
    } catch {
      setError('서버 연결 오류')
    } finally {
      setLoading(false)
    }
  }, [type, page])

  useEffect(() => { load(); loadDetection() }, [load, loadDetection])

  async function handleResolve() {
    if (!target || !action) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/attendance/exceptions/${target.id}/resolve`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, checkOutAt: checkOut || undefined, note: note || undefined }),
      })
      const data = await res.json()
      if (data.success) {
        setTarget(null)
        setAction('')
        setCheckOut('')
        setNote('')
        load()
      } else {
        alert(data.error ?? '처리 오류')
      }
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / 30)

  return (
    <div className="max-w-[960px] mx-auto px-4 py-6 font-[system-ui,sans-serif]">
      <div className="flex justify-between items-center mb-5">
        <h1 className="m-0 text-[20px] font-black">출퇴근 예외/누락 처리 센터</h1>
        <button onClick={load} disabled={loading} style={btnStyle('#1565c0', loading)}>
          {loading ? '조회 중...' : '새로고침'}
        </button>
      </div>

      {/* ── 자동 탐지 요약 위젯 ── */}
      {detection && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="m-0 text-[15px] font-bold">자동 탐지 요약</h2>
            <span className="text-[12px] text-[#999]">
              {detection.dateFrom} ~ {detection.dateTo}
            </span>
            {detection.total > 0 && (
              <span style={{ background: '#c62828', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                {detection.total}건
              </span>
            )}
            <button
              onClick={loadDetection}
              disabled={detectionLoading}
              style={{ marginLeft: 'auto', padding: '4px 10px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', fontSize: '12px', cursor: detectionLoading ? 'not-allowed' : 'pointer', background: '#fff' }}
            >
              {detectionLoading ? '...' : '갱신'}
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {([
              { key: 'missingCheckout', label: '퇴근 누락',      icon: '⏰', color: '#e65100' },
              { key: 'outsideGeofence', label: '지오펜스 밖 출근', icon: '📍', color: '#c62828' },
              { key: 'missingPhoto',    label: '사진 누락',      icon: '📷', color: '#4527a0' },
              { key: 'longShift',       label: '장시간 근무',    icon: '⚠️', color: '#e65100' },
              { key: 'presenceMissed',  label: '재실확인 미응답', icon: '🔔', color: '#283593' },
            ] as const).map(cat => {
              const count = detection[cat.key as keyof DetectionSummary] as number
              const isActive = detailType === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={async () => {
                    if (isActive) { setDetailType(null); setDetailItems([]); return }
                    // 상세 데이터를 다시 가져오기
                    try {
                      const res = await fetch('/api/admin/attendance/exceptions/summary')
                      const data = await res.json()
                      if (data.success) {
                        showDetail(cat.key, data.details[cat.key] ?? [])
                      }
                    } catch { /* silent */ }
                  }}
                  style={{
                    padding: '12px 8px', borderRadius: '10px', border: isActive ? '2px solid ' + cat.color : '1px solid rgba(91,164,217,0.15)',
                    background: isActive ? '#fafafa' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{cat.icon}</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: count > 0 ? cat.color : '#bbb' }}>{count}</div>
                  <div style={{ fontSize: '11px', color: '#666', fontWeight: 600, marginTop: '2px' }}>{cat.label}</div>
                </button>
              )
            })}
          </div>

          {/* 상세 목록 */}
          {detailType && detailItems.length > 0 && (
            <div className="mt-3 bg-card border border-brand rounded-[10px] overflow-hidden">
              <div className="px-3 py-2 bg-[#f5f5f5] text-[12px] font-bold text-[#333] border-b border-brand">
                {{
                  missingCheckout: '퇴근 누락 상세',
                  outsideGeofence: '지오펜스 밖 출근 상세',
                  missingPhoto: '사진 누락 상세',
                  longShift: '장시간 근무 상세',
                  presenceMissed: '재실확인 미응답 상세',
                }[detailType]} (최근 10건)
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#fafafa]">
                    <th className="px-3 py-2 text-left font-bold">근로자</th>
                    <th className="px-3 py-2 text-left font-bold">현장</th>
                    <th className="px-3 py-2 text-left font-bold">날짜</th>
                    <th className="px-3 py-2 text-left font-bold">출근</th>
                    <th className="px-3 py-2 text-left font-bold">퇴근</th>
                    {detailType === 'longShift' && <th className="px-3 py-2 text-left font-bold">근무(분)</th>}
                    {detailType === 'presenceMissed' && <th className="px-3 py-2 text-left font-bold">상태</th>}
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map((d, i) => (
                    <tr key={d.id} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                      <td className="px-3 py-2 border-t border-brand">
                        <div className="font-bold">{d.workerName}</div>
                        <div className="text-[10px] text-[#999]">{d.workerPhone}</div>
                      </td>
                      <td className="px-3 py-2 border-t border-brand">{d.siteName}</td>
                      <td className="px-3 py-2 border-t border-brand">{d.workDate ?? d.checkDate ?? '—'}</td>
                      <td className="px-3 py-2 border-t border-brand">{fmtTime(d.checkInAt ?? d.scheduledAt ?? null)}</td>
                      <td className="px-3 py-2 border-t border-brand">{fmtTime(d.checkOutAt ?? null)}</td>
                      {detailType === 'longShift' && (
                        <td className="px-3 py-2 border-t border-brand font-bold text-[#c62828]">
                          {d.workedMinutes != null ? `${Math.floor(d.workedMinutes / 60)}h ${d.workedMinutes % 60}m` : '—'}
                        </td>
                      )}
                      {detailType === 'presenceMissed' && (
                        <td className="px-3 py-2 border-t border-brand font-bold text-[#c62828]">
                          {d.status === 'NO_RESPONSE' ? '미응답' : d.status === 'MISSED' ? '미응답(레거시)' : d.status}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 타입 탭 */}
      <div className="flex gap-2 mb-4">
        {(['ALL', 'EXCEPTION', 'MISSING_CHECKOUT'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setType(t); setPage(1) }}
            style={{
              padding: '7px 16px', borderRadius: '6px', border: 'none', fontSize: '13px',
              fontWeight: type === t ? 700 : 400, cursor: 'pointer',
              background: type === t ? '#263238' : '#f5f5f5',
              color: type === t ? '#fff' : '#555',
            }}
          >
            {t === 'ALL' ? '전체' : t === 'EXCEPTION' ? '예외' : '퇴근누락'}
          </button>
        ))}
        <span className="ml-auto text-[13px] text-muted-brand self-center">
          총 {total}건
        </span>
      </div>

      {error && (
        <div className="bg-red-light border border-[#ef9a9a] rounded-lg p-3 mb-3 text-[#c62828] text-[13px]">
          {error}
        </div>
      )}

      {/* 목록 */}
      <div className="bg-card border border-brand rounded-[12px] overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#263238] text-white">
              <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">근로자</th>
              <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">소속</th>
              <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">현장</th>
              <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">작업일</th>
              <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">출근</th>
              <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">퇴근</th>
              <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">상태</th>
              <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">경과일</th>
              <th className="px-3 py-[10px] text-left font-bold text-[12px] whitespace-nowrap">처리</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-[#999]">
                  {loading ? '조회 중...' : '처리 대기 항목이 없습니다.'}
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr key={item.id} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td className="px-3 py-[10px] border-b border-brand align-top">
                    <div className="font-bold">{item.workerName}</div>
                    <div className="text-[11px] text-muted-brand">{item.workerPhone}</div>
                  </td>
                  <td className="px-3 py-[10px] border-b border-brand align-top">{item.company || '—'}</td>
                  <td className="px-3 py-[10px] border-b border-brand align-top">{item.siteName}</td>
                  <td className="px-3 py-[10px] border-b border-brand align-top">{item.workDate}</td>
                  <td className="px-3 py-[10px] border-b border-brand align-top">{fmtTime(item.checkInAt)}</td>
                  <td className="px-3 py-[10px] border-b border-brand align-top">{fmtTime(item.checkOutAt)}</td>
                  <td className="px-3 py-[10px] border-b border-brand align-top">
                    <span style={{ color: STATUS_COLOR[item.status] ?? '#333', fontWeight: 700 }}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    {item.exceptionReason && (
                      <div className="text-[11px] text-muted-brand">{item.exceptionReason}</div>
                    )}
                  </td>
                  <td className="px-3 py-[10px] border-b border-brand align-top text-center">
                    <span style={{ color: item.daysBehind > 3 ? '#c62828' : item.daysBehind > 0 ? '#e65100' : '#333', fontWeight: item.daysBehind > 3 ? 700 : 400 }}>
                      {item.daysBehind}일
                    </span>
                  </td>
                  <td className="px-3 py-[10px] border-b border-brand align-top">
                    <button
                      onClick={() => { setTarget(item); setAction(''); setCheckOut(''); setNote('') }}
                      className="px-3 py-1 bg-[#E06810] text-white border-0 rounded text-[12px] cursor-pointer font-bold"
                    >
                      처리
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(page === 1)}>
            이전
          </button>
          <span className="text-[13px] self-center text-muted-brand">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(page === totalPages)}>
            다음
          </button>
        </div>
      )}

      {/* 처리 모달 */}
      <Modal open={!!target} onClose={() => setTarget(null)} title="출퇴근 처리">
        {target && (
          <>
            <div className="text-[13px] text-muted-brand mb-5">
              {target.workerName} · {target.workDate} · {target.siteName}
            </div>

            <div className="mb-[14px]">
              <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">처리 유형 *</label>
              <select value={action} onChange={e => setAction(e.target.value)} className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border">
                <option value="">선택하세요</option>
                {target.status === 'MISSING_CHECKOUT' && (
                  <option value="SET_CHECKOUT">퇴근시간 설정</option>
                )}
                {target.status === 'EXCEPTION' && (
                  <>
                    <option value="APPROVE_EXCEPTION">예외 승인 (정상 처리)</option>
                    <option value="REJECT_EXCEPTION">예외 거부 → 퇴근누락으로</option>
                  </>
                )}
                <option value="MARK_ABSENT">결근 처리 (공수 0)</option>
              </select>
            </div>

            {(action === 'SET_CHECKOUT' || action === 'APPROVE_EXCEPTION') && (
              <div className="mb-[14px]">
                <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">퇴근 시간 (설정 시)</label>
                <input
                  type="datetime-local"
                  value={checkOut}
                  onChange={e => setCheckOut(e.target.value)}
                  className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border"
                />
              </div>
            )}

            <div className="mb-5">
              <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">처리 사유 / 메모</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="처리 사유를 입력하세요 (감사로그에 기록됨)"
                rows={3}
                className="w-full px-3 py-[9px] border border-brand rounded-[7px] text-sm outline-none box-border resize-y"
              />
            </div>

            <div className="flex gap-[10px]">
              <button onClick={() => setTarget(null)} className="flex-1 py-3 border border-brand rounded-lg bg-card cursor-pointer text-sm">
                취소
              </button>
              <button
                onClick={handleResolve}
                disabled={!action || saving}
                style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '8px', background: (!action || saving) ? '#bdbdbd' : '#c62828', color: '#fff', cursor: (!action || saving) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700 }}
              >
                {saving ? '처리 중...' : '처리 확정'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function btnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return { padding: '8px 16px', background: disabled ? '#bdbdbd' : bg, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700 }
}
function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return { padding: '6px 14px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', background: disabled ? '#f5f5f5' : '#fff', color: disabled ? '#bbb' : '#333', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px' }
}
