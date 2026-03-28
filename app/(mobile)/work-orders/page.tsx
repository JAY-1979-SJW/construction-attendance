'use client'

import { useState, useEffect } from 'react'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

interface WorkOrder {
  id: string
  siteName: string
  title: string
  content: string
  priority: string
  targetScope: string
  createdAt: string
  myAck: { readAt: string; confirmedAt: string | null } | null
}

const PRIORITY_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  LOW: { label: '일반', bg: 'bg-gray-100', color: 'text-gray-600' },
  NORMAL: { label: '보통', bg: 'bg-blue-50', color: 'text-blue-700' },
  HIGH: { label: '중요', bg: 'bg-orange-50', color: 'text-orange-700' },
  URGENT: { label: '긴급', bg: 'bg-red-50', color: 'text-red-700' },
}

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/worker/work-orders')
      .then(r => r.json())
      .then(d => { if (d.success) setOrders(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleConfirm = async (orderId: string) => {
    setConfirming(orderId)
    try {
      const res = await fetch('/api/worker/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrderId: orderId }),
      })
      const json = await res.json()
      if (json.success) load()
    } catch { /* */ }
    setConfirming(null)
  }

  const unconfirmed = orders.filter(o => !o.myAck?.confirmedAt)
  const confirmed = orders.filter(o => o.myAck?.confirmedAt)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <WorkerTopBar />
      <div className="px-4 pt-4">
        <h2 className="text-[16px] font-bold text-gray-800 mb-1">작업지시</h2>
        <p className="text-[12px] text-gray-500 mb-4">관리자가 내린 작업지시를 확인하고 수신 확인합니다.</p>

        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">불러오는 중...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-500 mb-1">작업지시가 없습니다</p>
          </div>
        ) : (
          <>
            {unconfirmed.length > 0 && (
              <div className="mb-4">
                <div className="text-[12px] font-bold text-red-600 mb-2">미확인 지시 {unconfirmed.length}건</div>
                {unconfirmed.map(o => {
                  const pr = PRIORITY_STYLE[o.priority] || PRIORITY_STYLE.NORMAL
                  return (
                    <div key={o.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm border-2 border-orange-200">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pr.bg} ${pr.color}`}>{pr.label}</span>
                            <span className="text-[11px] text-gray-400">{o.siteName}</span>
                          </div>
                          <div className="font-bold text-[15px] text-gray-800">{o.title}</div>
                        </div>
                        <span className="text-[10px] text-gray-400">{new Date(o.createdAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 mb-3 text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {o.content}
                      </div>
                      <button onClick={() => handleConfirm(o.id)} disabled={confirming === o.id}
                        className="w-full py-3 rounded-xl text-[14px] font-bold bg-[#F97316] text-white border-none cursor-pointer disabled:bg-gray-300">
                        {confirming === o.id ? '처리 중...' : '작업지시 확인'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {confirmed.length > 0 && (
              <div>
                <div className="text-[12px] font-bold text-gray-500 mb-2">확인 완료 {confirmed.length}건</div>
                {confirmed.map(o => {
                  const pr = PRIORITY_STYLE[o.priority] || PRIORITY_STYLE.NORMAL
                  return (
                    <div key={o.id} className="bg-white rounded-2xl p-4 mb-2 shadow-sm border border-gray-100 opacity-80">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pr.bg} ${pr.color}`}>{pr.label}</span>
                        <span className="font-bold text-[14px] text-gray-700 flex-1">{o.title}</span>
                        <span className="text-[11px] text-green-600">확인 완료</span>
                      </div>
                      <div className="text-[12px] text-gray-500">{o.siteName} / {new Date(o.createdAt).toLocaleDateString('ko-KR')}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
      <WorkerBottomNav />
    </div>
  )
}
