'use client'

import { useState, useEffect } from 'react'
import WorkerRequestForm from '@/components/worker/WorkerRequestForm'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerDisclaimerBanner from '@/components/worker/WorkerDisclaimerBanner'

interface MyRequest {
  id: string
  category: string
  content: string
  status: string
  adminMemo: string | null
  createdAt: string
  reviewedAt: string | null
}

const CATEGORY_LABEL: Record<string, string> = {
  MISSING_CHECKIN:   '출근 누락 신고',
  MISSING_CHECKOUT:  '퇴근 누락 신고',
  CONTACT_CHANGE:    '연락처 변경 요청',
  CONTRACT_REVIEW:   '계약서 재열람 요청',
  DOCUMENT_REQUEST:  '서류 발급 요청',
  DEVICE_CHANGE:     '기기 변경 요청',
  OTHER:             '기타 업무 문의',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:  '접수됨',
  REVIEWED: '확인됨',
  RESOLVED: '처리 완료',
  REJECTED: '반려',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING:  '#ff9800',
  REVIEWED: '#1565c0',
  RESOLVED: '#2e7d32',
  REJECTED: '#c62828',
}

export default function MyRequestsPage() {
  const [tab,      setTab]      = useState<'new' | 'history'>('new')
  const [requests, setRequests] = useState<MyRequest[]>([])
  const [loading,  setLoading]  = useState(false)

  async function fetchRequests() {
    setLoading(true)
    try {
      const res  = await fetch('/api/worker/requests')
      const data = await res.json()
      setRequests(data.requests ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'history') fetchRequests()
  }, [tab])

  return (
    <div style={{ minHeight: '100vh', background: '#1B2838', paddingBottom: '80px' }}>
      <WorkerDisclaimerBanner />

      {/* 헤더 */}
      <div style={{ background: '#1565c0', color: '#fff', padding: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>📝</span>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>요청 접수</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>업무 관련 요청만 처리합니다</div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', background: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        {(['new', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex:       1,
              padding:    '14px',
              border:     'none',
              background: 'transparent',
              fontSize:   '14px',
              fontWeight: tab === t ? 700 : 400,
              color:      tab === t ? '#1565c0' : '#666',
              borderBottom: tab === t ? '2px solid #1565c0' : '2px solid transparent',
              cursor:     'pointer',
            }}
          >
            {t === 'new' ? '새 요청' : '내 요청 내역'}
          </button>
        ))}
      </div>

      {/* 내용 */}
      {tab === 'new' ? (
        <WorkerRequestForm />
      ) : (
        <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>불러오는 중...</div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#718096', fontSize: '14px' }}>
              접수된 요청이 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {requests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    background:   '#ffffff',
                    border:       '1px solid #e0e0e0',
                    borderRadius: '10px',
                    padding:      '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#333' }}>
                      {CATEGORY_LABEL[req.category] ?? req.category}
                    </span>
                    <span style={{
                      fontSize:     '11px',
                      fontWeight:   700,
                      color:        STATUS_COLOR[req.status] ?? '#666',
                      background:   `${STATUS_COLOR[req.status] ?? '#666'}15`,
                      padding:      '2px 8px',
                      borderRadius: '20px',
                    }}>
                      {STATUS_LABEL[req.status] ?? req.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#555', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                    {req.content}
                  </p>
                  {req.adminMemo && (
                    <div style={{
                      background:   '#f5f5f5',
                      borderRadius: '6px',
                      padding:      '8px 10px',
                      fontSize:     '12px',
                      color:        '#555',
                      marginBottom: '6px',
                    }}>
                      <strong>관리자 답변:</strong> {req.adminMemo}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#bbb' }}>
                    {new Date(req.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 접수
                    {req.reviewedAt && ` · ${new Date(req.reviewedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 검토`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <WorkerBottomNav />
    </div>
  )
}
