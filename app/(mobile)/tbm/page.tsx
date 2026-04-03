'use client'

import { useState, useEffect } from 'react'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

interface TbmRecord {
  id: string
  siteId: string
  siteName: string
  title: string
  content: string | null
  conductedAt: string | null
  attendeeCount: number
  notes: string | null
}

export default function TbmPage() {
  const [records, setRecords] = useState<TbmRecord[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/worker/tbm')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setRecords(d.data.tbmRecords)
          setConfirmed(d.data.myConfirmation?.confirmed ?? false)
          setConfirmedAt(d.data.myConfirmation?.confirmedAt ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleConfirm = async (siteId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/worker/tbm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      })
      const json = await res.json()
      if (json.success) {
        setConfirmed(true)
        setConfirmedAt(new Date().toISOString())
      }
    } catch { /* */ }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <WorkerTopBar />
      <div className="px-4 pt-4">
        <h2 className="text-lg font-bold text-gray-800 mb-1">TBM 일지</h2>
        <p className="text-[13px] leading-5 text-gray-500 mb-4">오늘의 안전교육(Tool Box Meeting) 내용을 확인하고 참여를 서명합니다.</p>

        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">불러오는 중...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 mb-1">오늘 등록된 TBM이 없습니다</p>
            <p className="text-[13px] leading-5 text-gray-400">관리자가 TBM을 등록하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map(tbm => (
              <div key={tbm.id} className="bg-card rounded-2xl p-5 shadow-sm border border-brand">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-[13px] leading-5 text-gray-400 mb-1">{tbm.siteName}</div>
                    <div className="font-bold text-base leading-snug text-gray-800">{tbm.title}</div>
                  </div>
                  {tbm.conductedAt && (
                    <span className="text-xs text-gray-400">
                      {new Date(tbm.conductedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {tbm.content && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {tbm.content}
                  </div>
                )}

                {tbm.notes && (
                  <div className="text-[13px] leading-5 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                    {tbm.notes}
                  </div>
                )}

                <div className="text-[13px] leading-5 text-gray-400 mb-3">
                  참석 인원: {tbm.attendeeCount}명
                </div>

                {confirmed ? (
                  <div className="flex items-center gap-2 py-3 px-4 bg-green-50 rounded-xl border border-green-200">
                    <span className="text-green-600 text-[14px]">✓</span>
                    <div>
                      <div className="text-sm font-bold text-green-700">TBM 참여 확인 완료</div>
                      {confirmedAt && (
                        <div className="text-[13px] leading-5 text-green-600">
                          {new Date(confirmedAt).toLocaleString('ko-KR')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConfirm(tbm.siteId)}
                    disabled={submitting}
                    className="w-full h-11 rounded-xl text-sm font-bold bg-[#F97316] text-white border-none cursor-pointer disabled:bg-gray-300"
                  >
                    {submitting ? '처리 중...' : '위 내용을 확인하고 TBM 참여 서명합니다'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <WorkerBottomNav />
    </div>
  )
}
