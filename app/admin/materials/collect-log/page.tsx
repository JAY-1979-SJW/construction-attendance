'use client'

import { useState, useEffect, useCallback } from 'react'

interface SyncLogItem {
  id: number
  source: string
  syncedAt: string
  totalCount: number
  inserted: number
  updated: number
  failed: number
  note: string | null
}

interface SyncLogData {
  total: number
  page: number
  pageSize: number
  totalPages: number
  items: SyncLogItem[]
}

function nextMondayAt11(): string {
  const now = new Date()
  // Asia/Seoul 기준 다음 월요일 11:00
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const day = kst.getDay() // 0=일 1=월
  const daysToMonday = day === 1 ? 7 : (8 - day) % 7 || 7
  const next = new Date(kst)
  next.setDate(kst.getDate() + daysToMonday)
  next.setHours(11, 0, 0, 0)
  return next.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
}

export default function CollectLogPage() {
  const [data, setData]         = useState<SyncLogData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [page, setPage]         = useState(1)
  const [apiStatus, setApiStatus] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  const [apiChecking, setApiChecking] = useState(false)

  const fetchLog = useCallback((p: number) => {
    setLoading(true)
    setError('')
    fetch(`/api/proxy/material-sync-log?page=${p}&pageSize=20`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setError(d.message ?? '조회 실패'); return }
        setData(d.data)
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLog(page) }, [fetchLog, page])

  const checkApi = async () => {
    setApiChecking(true)
    setApiStatus('unknown')
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 12000)
      const res = await fetch('/api/proxy/material-sync-status', { signal: ctrl.signal, cache: 'no-store' })
      clearTimeout(timer)
      // sync-status가 200이어도 실제 NARA API와는 별개 — 여기선 단순 connectivity 확인
      const d = await res.json()
      // sourceStatus에서 nara 상태 확인
      const nara = d.data?.sourceStatus?.find((s: { source: string; status: string }) => s.source === 'nara')
      setApiStatus(nara?.status === 'ok' ? 'ok' : 'fail')
    } catch {
      setApiStatus('fail')
    } finally {
      setApiChecking(false)
    }
  }

  const lastRun = data?.items?.[0]

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">나라장터 자재물가 수집 이력</h1>
        <p className="text-sm text-muted-brand">매주 월요일 11:00 KST — PriceInfoService 자동 수집</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
        {/* 다음 수집 예정 */}
        <div className="rounded-[12px] px-5 py-4 col-span-2 md:col-span-2"
             style={{ background: 'rgba(91,164,217,0.06)', border: '1px solid rgba(91,164,217,0.18)' }}>
          <div className="text-[11px] text-muted-brand mb-1">다음 수집 예정</div>
          <div className="text-[13px] font-semibold">{nextMondayAt11()}</div>
          <div className="text-[11px] text-muted-brand mt-1">크론: <code className="font-mono">0 11 * * 1</code></div>
        </div>

        {/* 최근 수집 */}
        <div className="rounded-[12px] px-5 py-4"
             style={{ background: 'rgba(91,164,217,0.06)', border: '1px solid rgba(91,164,217,0.18)' }}>
          <div className="text-[11px] text-muted-brand mb-1">최근 수집</div>
          {lastRun ? (
            <>
              <div className="text-[13px] font-semibold"
                   style={{ color: lastRun.failed > 0 ? '#ef5350' : '#5BA4D9' }}>
                {lastRun.failed > 0 ? `실패 ${lastRun.failed}건` : `성공 ${lastRun.inserted + lastRun.updated}건`}
              </div>
              <div className="text-[11px] text-muted-brand mt-1">
                {new Date(lastRun.syncedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-muted-brand">기록 없음</div>
          )}
        </div>

        {/* API 상태 */}
        <div className="rounded-[12px] px-5 py-4"
             style={{ background: 'rgba(91,164,217,0.06)', border: '1px solid rgba(91,164,217,0.18)' }}>
          <div className="text-[11px] text-muted-brand mb-1">NARA API 상태</div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{
              color: apiStatus === 'ok' ? '#4caf50' : apiStatus === 'fail' ? '#ef5350' : 'rgba(255,255,255,0.5)',
            }}>
              {apiStatus === 'ok' ? '정상' : apiStatus === 'fail' ? '장애' : '미확인'}
            </span>
            <button
              onClick={checkApi}
              disabled={apiChecking}
              className="text-[11px] border border-[rgba(91,164,217,0.3)] rounded px-2 py-[2px] cursor-pointer bg-transparent disabled:opacity-50"
              style={{ color: '#5BA4D9' }}
            >
              {apiChecking ? '확인 중...' : '확인'}
            </button>
          </div>
          <div className="text-[11px] text-muted-brand mt-1">PriceInfoService</div>
        </div>
      </div>

      {/* 이력 테이블 */}
      <div className="rounded-[12px] overflow-hidden"
           style={{ border: '1px solid rgba(91,164,217,0.18)' }}>
        <div className="px-5 py-3 flex items-center justify-between"
             style={{ borderBottom: '1px solid rgba(91,164,217,0.12)', background: 'rgba(91,164,217,0.04)' }}>
          <span className="text-sm font-semibold">수집 이력</span>
          {data && <span className="text-[12px] text-muted-brand">전체 {data.total}건</span>}
          <button
            onClick={() => fetchLog(page)}
            disabled={loading}
            className="text-[12px] border border-[rgba(91,164,217,0.3)] rounded px-3 py-[4px] cursor-pointer bg-transparent disabled:opacity-50"
            style={{ color: '#5BA4D9' }}
          >
            {loading ? '로딩...' : '새로고침'}
          </button>
        </div>

        {error && (
          <div className="px-5 py-4 text-sm" style={{ color: '#ef5350' }}>{error}</div>
        )}

        {!error && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {['수집일시', '소스', '전체', '신규', '갱신', '실패', '비고'].map(h => (
                    <th key={h}
                        className="text-left px-4 py-[10px] text-[12px] text-muted-brand font-semibold whitespace-nowrap"
                        style={{ borderBottom: '1px solid rgba(91,164,217,0.15)', background: 'rgba(91,164,217,0.03)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-brand">로딩 중...</td>
                  </tr>
                )}
                {!loading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-brand">수집 이력 없음</td>
                  </tr>
                )}
                {!loading && data?.items.map(item => {
                  const hasFail = item.failed > 0
                  const isFirst = item.id === data.items[0]?.id
                  return (
                    <tr key={item.id}
                        style={{ background: isFirst ? 'rgba(91,164,217,0.05)' : undefined }}>
                      <td className="px-4 py-[9px] border-b border-[rgba(91,164,217,0.08)] whitespace-nowrap text-[12px]">
                        {new Date(item.syncedAt).toLocaleString('ko-KR', {
                          timeZone: 'Asia/Seoul',
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-[9px] border-b border-[rgba(91,164,217,0.08)]">
                        <span className="text-[11px] px-2 py-[2px] rounded-[10px] font-mono"
                              style={{ background: 'rgba(91,164,217,0.12)', color: '#5BA4D9' }}>
                          {item.source}
                        </span>
                      </td>
                      <td className="px-4 py-[9px] border-b border-[rgba(91,164,217,0.08)] text-right font-mono text-[12px]">
                        {item.totalCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-[9px] border-b border-[rgba(91,164,217,0.08)] text-right font-mono text-[12px]"
                          style={{ color: item.inserted > 0 ? '#5BA4D9' : undefined }}>
                        {item.inserted.toLocaleString()}
                      </td>
                      <td className="px-4 py-[9px] border-b border-[rgba(91,164,217,0.08)] text-right font-mono text-[12px]"
                          style={{ color: item.updated > 0 ? '#f9a825' : undefined }}>
                        {item.updated.toLocaleString()}
                      </td>
                      <td className="px-4 py-[9px] border-b border-[rgba(91,164,217,0.08)] text-right font-mono text-[12px]"
                          style={{ color: hasFail ? '#ef5350' : 'rgba(255,255,255,0.3)' }}>
                        {item.failed.toLocaleString()}
                      </td>
                      <td className="px-4 py-[9px] border-b border-[rgba(91,164,217,0.08)] text-[11px] text-muted-brand max-w-[240px] truncate"
                          title={item.note ?? ''}>
                        {item.note ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {data && data.totalPages > 1 && (
          <div className="px-5 py-3 flex items-center gap-2 justify-end"
               style={{ borderTop: '1px solid rgba(91,164,217,0.1)' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-[5px] rounded border border-[rgba(91,164,217,0.3)] text-[12px] bg-transparent cursor-pointer disabled:opacity-40"
              style={{ color: '#5BA4D9' }}
            >이전</button>
            <span className="text-[12px] text-muted-brand">{page} / {data.totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="px-3 py-[5px] rounded border border-[rgba(91,164,217,0.3)] text-[12px] bg-transparent cursor-pointer disabled:opacity-40"
              style={{ color: '#5BA4D9' }}
            >다음</button>
          </div>
        )}
      </div>

      {/* 크론 안내 */}
      <div className="mt-6 px-5 py-4 rounded-[12px] text-[12px]"
           style={{ background: 'rgba(91,164,217,0.04)', border: '1px solid rgba(91,164,217,0.12)' }}>
        <div className="font-semibold mb-2 text-[13px]">크론 설정</div>
        <div className="font-mono text-muted-brand leading-relaxed">
          <div># 매주 월요일 11:00 KST</div>
          <div className="text-white">0 11 * * 1 bash ~/app/attendance/scripts/nara-collect-weekly.sh {'>> '}~/app/attendance/logs/nara_weekly.log 2&gt;&amp;1</div>
        </div>
        <div className="mt-2 text-muted-brand">
          스크립트: <code className="font-mono">scripts/nara-collect-weekly.sh</code>
          &nbsp;—&nbsp; API 응답 없으면 SKIP (장애 지속 시 자동 건너뜀)
        </div>
      </div>
    </div>
  )
}
