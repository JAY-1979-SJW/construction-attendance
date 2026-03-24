'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * 관리자 오늘 처리할 일 패널
 * GET /api/admin/dashboard/today-tasks
 */

interface TaskItem {
  key:         string
  label:       string
  count:       number
  href:        string
  urgency:     'OK' | 'MED' | 'HIGH'
  description: string
}

interface TodayTasksData {
  generatedAt: string
  todayStr:    string
  summary:     { totalPending: number; highCount: number }
  tasks:       TaskItem[]
}

const URGENCY_CONFIG = {
  OK:  { color: '#2e7d32', bg: '#e8f5e9', border: '#a5d6a7', badge: '처리 없음' },
  MED: { color: '#f57f17', bg: '#fff8e1', border: '#ffe082', badge: '확인 필요' },
  HIGH:{ color: '#c62828', bg: '#ffebee', border: '#ef9a9a', badge: '즉시 처리' },
}

export default function TodayTasksPage() {
  const [data,    setData]    = useState<TodayTasksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/dashboard/today-tasks')
      const json = await res.json()
      if (json.success) setData(json)
      else setError(json.error ?? '오류가 발생했습니다.')
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-[800px] mx-auto px-4 py-6 font-[system-ui,sans-serif]">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="m-0 text-[22px] font-black">오늘 처리할 일</h1>
          {data && (
            <div className="text-[13px] text-muted-brand mt-1">
              {data.todayStr} 기준 · {new Date(data.generatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 조회
            </div>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          className="px-4 py-2 bg-[#E06810] text-white border-0 rounded-md text-[13px]"
        >
          {loading ? '조회 중...' : '새로고침'}
        </button>
      </div>

      {error && (
        <div className="bg-[#ffebee] border border-[#ef9a9a] rounded-lg px-4 py-3 mb-4 text-[#c62828] text-sm">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* 요약 배너 */}
          <div
            className="rounded-[10px] px-5 py-4 mb-5 flex items-center gap-4"
            style={{
              background: data.summary.totalPending > 0 ? (data.summary.highCount > 0 ? '#ffebee' : '#fff8e1') : '#e8f5e9',
              border: `1px solid ${data.summary.totalPending > 0 ? (data.summary.highCount > 0 ? '#ef9a9a' : '#ffe082') : '#a5d6a7'}`,
            }}
          >
            <div className="text-[36px]">
              {data.summary.totalPending === 0 ? '✅' : data.summary.highCount > 0 ? '🚨' : '⚠️'}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: data.summary.totalPending === 0 ? '#2e7d32' : '#c62828' }}>
                {data.summary.totalPending === 0
                  ? '오늘 처리할 항목이 없습니다'
                  : `미처리 ${data.summary.totalPending}건${data.summary.highCount > 0 ? ` (즉시처리 ${data.summary.highCount}개 카테고리)` : ''}`
                }
              </div>
              <div className="text-[12px] text-muted-brand mt-[2px]">
                6개 카테고리 기준 · 즉시처리 항목을 우선 처리하세요
              </div>
            </div>
          </div>

          {/* 카테고리 목록 */}
          <div className="flex flex-col gap-[10px]">
            {data.tasks.map(task => {
              const cfg = URGENCY_CONFIG[task.urgency]
              return (
                <Link
                  key={task.key}
                  href={task.href}
                  className="block no-underline rounded-[10px] px-5 py-4 transition-shadow"
                  style={{
                    background: task.count > 0 ? cfg.bg : '#fafafa',
                    border: `1px solid ${task.count > 0 ? cfg.border : '#e0e0e0'}`,
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div style={{ fontSize: '15px', fontWeight: 700, color: task.count > 0 ? cfg.color : '#333' }}>
                        {task.label}
                        {task.count > 0 && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', background: cfg.color, color: '#fff', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>
                            {cfg.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-muted-brand mt-[3px]">{task.description}</div>
                    </div>
                    <div className="text-right shrink-0 ml-5">
                      <div style={{ fontSize: '28px', fontWeight: 800, color: task.count > 0 ? cfg.color : '#ccc' }}>
                        {task.count}
                      </div>
                      <div className="text-[11px] text-[#aaa]">건</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* 출력물 센터 링크 */}
          <div className="mt-6 px-5 py-4 bg-brand rounded-[10px] border border-[#e0e0e0]">
            <div className="text-sm font-bold text-[#CBD5E0] mb-[10px]">관련 화면 바로가기</div>
            <div className="flex gap-[10px] flex-wrap">
              <Link href="/admin/operations/attendance-exceptions" className="inline-block px-4 py-2 bg-[#37474f] text-white rounded-md text-[13px] font-bold no-underline">출퇴근 처리 센터</Link>
              <Link href="/admin/operations/labor-review" className="inline-block px-4 py-2 bg-[#1b5e20] text-white rounded-md text-[13px] font-bold no-underline">공수 검토 화면</Link>
              <Link href="/admin/operations/print-center" className="inline-block px-4 py-2 bg-[#4a148c] text-white rounded-md text-[13px] font-bold no-underline">출력물 센터</Link>
            </div>
          </div>
        </>
      )}

      {loading && !data && (
        <div className="text-center text-muted-brand py-[60px] text-sm">
          조회 중...
        </div>
      )}
    </div>
  )
}
