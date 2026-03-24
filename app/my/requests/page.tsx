'use client'

import { useState, useEffect } from 'react'
import WorkerRequestForm from '@/components/worker/WorkerRequestForm'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerDisclaimerBanner from '@/components/worker/WorkerDisclaimerBanner'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

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
    <>
      <WorkerTopBar />
      <div className="min-h-screen bg-brand pb-20 pt-14">
      <WorkerDisclaimerBanner />

      {/* 헤더 */}
      <div className="bg-card border-b border-[rgba(91,164,217,0.15)] px-5 py-4 flex items-center gap-[10px]">
        <span className="text-xl">📝</span>
        <div>
          <div className="text-base font-bold text-white">요청 접수</div>
          <div className="text-xs text-muted-brand">업무 관련 요청만 처리합니다</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex bg-brand border-b border-[rgba(91,164,217,0.2)]">
        {(['new', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-[14px] border-none bg-transparent text-sm cursor-pointer"
            style={{
              fontWeight:   tab === t ? 700 : 400,
              color:        tab === t ? '#F47920' : '#718096',
              borderBottom: tab === t ? '2px solid #F47920' : '2px solid transparent',
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
        <div className="px-4 py-4 max-w-[480px] mx-auto">
          {loading ? (
            <div className="text-center py-10 text-[#999]">불러오는 중...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-10 text-[#718096] text-sm">
              접수된 요청이 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-card border border-[rgba(91,164,217,0.15)] rounded-[10px] p-[14px]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[13px] font-bold text-[#CBD5E0]">
                      {CATEGORY_LABEL[req.category] ?? req.category}
                    </span>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-[20px]"
                      style={{
                        color:      STATUS_COLOR[req.status] ?? '#666',
                        background: `${STATUS_COLOR[req.status] ?? '#666'}15`,
                      }}
                    >
                      {STATUS_LABEL[req.status] ?? req.status}
                    </span>
                  </div>
                  <p className="text-[13px] text-muted-brand mb-2 leading-[1.5]">
                    {req.content}
                  </p>
                  {req.adminMemo && (
                    <div className="bg-[rgba(91,164,217,0.08)] rounded-md px-[10px] py-2 text-xs text-muted-brand mb-[6px]">
                      <strong>관리자 답변:</strong> {req.adminMemo}
                    </div>
                  )}
                  <div className="text-[11px] text-[#bbb]">
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
    </>
  )
}
