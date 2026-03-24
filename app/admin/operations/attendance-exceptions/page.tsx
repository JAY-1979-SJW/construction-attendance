'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * 출퇴근 예외/누락 처리 센터
 * GET  /api/admin/attendance/exceptions
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

  // 처리 모달 상태
  const [target,    setTarget]    = useState<ExceptionItem | null>(null)
  const [action,    setAction]    = useState<string>('')
  const [checkOut,  setCheckOut]  = useState('')
  const [note,      setNote]      = useState('')
  const [saving,    setSaving]    = useState(false)

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

  useEffect(() => { load() }, [load])

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
        <div className="bg-[#ffebee] border border-[#ef9a9a] rounded-lg p-3 mb-3 text-[#c62828] text-[13px]">
          {error}
        </div>
      )}

      {/* 목록 */}
      <div className="bg-white border border-white/10 rounded-[10px] overflow-hidden">
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
                  <td className="px-3 py-[10px] border-b border-[#f0f0f0] align-top">
                    <div className="font-bold">{item.workerName}</div>
                    <div className="text-[11px] text-muted-brand">{item.workerPhone}</div>
                  </td>
                  <td className="px-3 py-[10px] border-b border-[#f0f0f0] align-top">{item.company || '—'}</td>
                  <td className="px-3 py-[10px] border-b border-[#f0f0f0] align-top">{item.siteName}</td>
                  <td className="px-3 py-[10px] border-b border-[#f0f0f0] align-top">{item.workDate}</td>
                  <td className="px-3 py-[10px] border-b border-[#f0f0f0] align-top">{fmtTime(item.checkInAt)}</td>
                  <td className="px-3 py-[10px] border-b border-[#f0f0f0] align-top">{fmtTime(item.checkOutAt)}</td>
                  <td className="px-3 py-[10px] border-b border-[#f0f0f0] align-top">
                    <span style={{ color: STATUS_COLOR[item.status] ?? '#333', fontWeight: 700 }}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    {item.exceptionReason && (
                      <div className="text-[11px] text-muted-brand">{item.exceptionReason}</div>
                    )}
                  </td>
                  <td className="px-3 py-[10px] border-b border-[#f0f0f0] align-top text-center">
                    <span style={{ color: item.daysBehind > 3 ? '#c62828' : item.daysBehind > 0 ? '#e65100' : '#333', fontWeight: item.daysBehind > 3 ? 700 : 400 }}>
                      {item.daysBehind}일
                    </span>
                  </td>
                  <td className="px-3 py-[10px] border-b border-[#f0f0f0] align-top">
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
      {target && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-xl p-7 w-[460px] max-w-[95vw]">
            <h2 className="m-0 mb-[6px] text-base font-black">출퇴근 처리</h2>
            <div className="text-[13px] text-muted-brand mb-5">
              {target.workerName} · {target.workDate} · {target.siteName}
            </div>

            <div className="mb-[14px]">
              <label className="block text-[12px] font-bold mb-[6px] text-muted-brand">처리 유형 *</label>
              <select value={action} onChange={e => setAction(e.target.value)} className="w-full px-3 py-[9px] border border-white/10 rounded-[7px] text-sm outline-none box-border">
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
                  className="w-full px-3 py-[9px] border border-white/10 rounded-[7px] text-sm outline-none box-border"
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
                className="w-full px-3 py-[9px] border border-white/10 rounded-[7px] text-sm outline-none box-border resize-y"
              />
            </div>

            <div className="flex gap-[10px]">
              <button onClick={() => setTarget(null)} className="flex-1 py-3 border border-white/10 rounded-lg bg-white cursor-pointer text-sm">
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
          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return { padding: '8px 16px', background: disabled ? '#bdbdbd' : bg, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700 }
}
function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return { padding: '6px 14px', border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px', background: disabled ? '#f5f5f5' : '#fff', color: disabled ? '#bbb' : '#333', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px' }
}
