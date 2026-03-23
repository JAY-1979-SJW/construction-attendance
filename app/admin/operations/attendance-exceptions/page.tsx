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
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>출퇴근 예외/누락 처리 센터</h1>
        <button onClick={load} disabled={loading} style={btnStyle('#1565c0', loading)}>
          {loading ? '조회 중...' : '새로고침'}
        </button>
      </div>

      {/* 타입 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
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
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#888', alignSelf: 'center' }}>
          총 {total}건
        </span>
      </div>

      {error && (
        <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '12px', marginBottom: '12px', color: '#c62828', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* 목록 */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#263238', color: '#fff' }}>
              <th style={th}>근로자</th>
              <th style={th}>소속</th>
              <th style={th}>현장</th>
              <th style={th}>작업일</th>
              <th style={th}>출근</th>
              <th style={th}>퇴근</th>
              <th style={th}>상태</th>
              <th style={th}>경과일</th>
              <th style={th}>처리</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  {loading ? '조회 중...' : '처리 대기 항목이 없습니다.'}
                </td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr key={item.id} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{item.workerName}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{item.workerPhone}</div>
                  </td>
                  <td style={td}>{item.company || '—'}</td>
                  <td style={td}>{item.siteName}</td>
                  <td style={td}>{item.workDate}</td>
                  <td style={td}>{fmtTime(item.checkInAt)}</td>
                  <td style={td}>{fmtTime(item.checkOutAt)}</td>
                  <td style={td}>
                    <span style={{ color: STATUS_COLOR[item.status] ?? '#333', fontWeight: 700 }}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    {item.exceptionReason && (
                      <div style={{ fontSize: '11px', color: '#888' }}>{item.exceptionReason}</div>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{ color: item.daysBehind > 3 ? '#c62828' : item.daysBehind > 0 ? '#e65100' : '#333', fontWeight: item.daysBehind > 3 ? 700 : 400 }}>
                      {item.daysBehind}일
                    </span>
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => { setTarget(item); setAction(''); setCheckOut(''); setNote('') }}
                      style={{ padding: '4px 12px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}
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
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle(page === 1)}>
            이전
          </button>
          <span style={{ fontSize: '13px', alignSelf: 'center', color: '#666' }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtnStyle(page === totalPages)}>
            다음
          </button>
        </div>
      )}

      {/* 처리 모달 */}
      {target && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '460px', maxWidth: '95vw' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800 }}>출퇴근 처리</h2>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
              {target.workerName} · {target.workDate} · {target.siteName}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>처리 유형 *</label>
              <select value={action} onChange={e => setAction(e.target.value)} style={inputStyle}>
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
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>퇴근 시간 (설정 시)</label>
                <input
                  type="datetime-local"
                  value={checkOut}
                  onChange={e => setCheckOut(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>처리 사유 / 메모</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="처리 사유를 입력하세요 (감사로그에 기록됨)"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setTarget(null)} style={{ flex: 1, padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>
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

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '7px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#555' }

function btnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return { padding: '8px 16px', background: disabled ? '#bdbdbd' : bg, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700 }
}
function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return { padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', background: disabled ? '#f5f5f5' : '#fff', color: disabled ? '#bbb' : '#333', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px' }
}
