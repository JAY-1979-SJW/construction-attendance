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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>오늘 처리할 일</h1>
          {data && (
            <div style={{ fontSize: '13px', color: '#A0AEC0', marginTop: '4px' }}>
              {data.todayStr} 기준 · {new Date(data.generatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 조회
            </div>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: '8px 16px', background: '#E06810', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '조회 중...' : '새로고침'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#c62828', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* 요약 배너 */}
          <div style={{
            background: data.summary.totalPending > 0 ? (data.summary.highCount > 0 ? '#ffebee' : '#fff8e1') : '#e8f5e9',
            border: `1px solid ${data.summary.totalPending > 0 ? (data.summary.highCount > 0 ? '#ef9a9a' : '#ffe082') : '#a5d6a7'}`,
            borderRadius: '10px', padding: '16px 20px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <div style={{ fontSize: '36px' }}>
              {data.summary.totalPending === 0 ? '✅' : data.summary.highCount > 0 ? '🚨' : '⚠️'}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: data.summary.totalPending === 0 ? '#2e7d32' : '#c62828' }}>
                {data.summary.totalPending === 0
                  ? '오늘 처리할 항목이 없습니다'
                  : `미처리 ${data.summary.totalPending}건${data.summary.highCount > 0 ? ` (즉시처리 ${data.summary.highCount}개 카테고리)` : ''}`
                }
              </div>
              <div style={{ fontSize: '12px', color: '#A0AEC0', marginTop: '2px' }}>
                6개 카테고리 기준 · 즉시처리 항목을 우선 처리하세요
              </div>
            </div>
          </div>

          {/* 카테고리 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.tasks.map(task => {
              const cfg = URGENCY_CONFIG[task.urgency]
              return (
                <Link
                  key={task.key}
                  href={task.href}
                  style={{
                    display: 'block', textDecoration: 'none',
                    background: task.count > 0 ? cfg.bg : '#fafafa',
                    border: `1px solid ${task.count > 0 ? cfg.border : '#e0e0e0'}`,
                    borderRadius: '10px', padding: '16px 20px',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: task.count > 0 ? cfg.color : '#333' }}>
                        {task.label}
                        {task.count > 0 && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', background: cfg.color, color: '#fff', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>
                            {cfg.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#A0AEC0', marginTop: '3px' }}>{task.description}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '20px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: task.count > 0 ? cfg.color : '#ccc' }}>
                        {task.count}
                      </div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>건</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* 출력물 센터 링크 */}
          <div style={{ marginTop: '24px', padding: '16px 20px', background: '#1B2838', borderRadius: '10px', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#CBD5E0', marginBottom: '10px' }}>관련 화면 바로가기</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link href="/admin/operations/attendance-exceptions" style={quickLink('#37474f')}>출퇴근 처리 센터</Link>
              <Link href="/admin/operations/labor-review" style={quickLink('#1b5e20')}>공수 검토 화면</Link>
              <Link href="/admin/operations/print-center" style={quickLink('#4a148c')}>출력물 센터</Link>
            </div>
          </div>
        </>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', color: '#A0AEC0', padding: '60px', fontSize: '14px' }}>
          조회 중...
        </div>
      )}
    </div>
  )
}

function quickLink(bg: string): React.CSSProperties {
  return {
    display: 'inline-block', padding: '8px 16px', background: bg, color: '#fff',
    borderRadius: '6px', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
  }
}
