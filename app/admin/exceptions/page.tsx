'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminRole } from '@/lib/hooks/useAdminRole'
import { Modal, Toast } from '@/components/admin/ui'

interface ExceptionRecord {
  id: string
  workerName: string
  workerPhone: string
  company: string
  siteName: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  exceptionReason: string | null
  createdAt: string
}

export default function ExceptionsPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [items, setItems] = useState<ExceptionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ExceptionRecord | null>(null)
  const [approveData, setApproveData] = useState({ checkInAt: '', checkOutAt: '', note: '' })
  const [processing, setProcessing] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/admin/exceptions')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
  }

  useEffect(load, [router])

  const handleAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selected) return
    setProcessing(true)
    setMsg('')
    const res = await fetch('/api/admin/exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceLogId: selected.id, action, ...approveData }),
    })
    const data = await res.json()
    setMsg(data.message)
    if (data.success) { setSelected(null); load() }
    setProcessing(false)
  }

  const formatDt = (iso: string | null) => iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold mb-5">예외 승인 ({total}건)</h1>

      {loading ? <p>로딩 중...</p> : (
        <div className="bg-card rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>{['날짜', '이름', '현장', '사유', '요청일', '처리'].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs text-muted-brand border-b-2 border-secondary-brand/20">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-[#999]">대기 중인 예외 요청이 없습니다.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 text-sm border-b border-[#f5f5f5]">{item.workDate}</td>
                  <td className="px-3 py-3 text-sm border-b border-[#f5f5f5]">{item.workerName}<br /><span className="text-xs text-[#999]">{item.company}</span></td>
                  <td className="px-3 py-3 text-sm border-b border-[#f5f5f5]">{item.siteName}</td>
                  <td className="px-3 py-3 text-sm border-b border-[#f5f5f5]"><span className="text-xs">{item.exceptionReason}</span></td>
                  <td className="px-3 py-3 text-sm border-b border-[#f5f5f5]">{formatDt(item.createdAt)}</td>
                  <td className="px-3 py-3 text-sm border-b border-[#f5f5f5]">
                    {canMutate
                      ? <button onClick={() => { setSelected(item); setApproveData({ checkInAt: item.checkInAt?.slice(0, 16) ?? '', checkOutAt: item.checkOutAt?.slice(0, 16) ?? '', note: '' }) }} className="px-3.5 py-1.5 bg-accent text-white border-none rounded-md cursor-pointer text-[13px]">처리</button>
                      : <span className="text-xs text-[#bbb]">조회 전용</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 처리 모달 */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="예외 처리">
        {selected && (
          <>
            <p className="text-sm text-muted-brand mb-4">
              {selected.workerName} · {selected.siteName} · {selected.workDate}
            </p>
            <div className="mb-3">
              <label className="block text-[13px] text-muted-brand mb-1">출근 시각 수정 (선택)</label>
              <input type="datetime-local" value={approveData.checkInAt} onChange={(e) => setApproveData({ ...approveData, checkInAt: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-brand/30 rounded-md box-border" />
            </div>
            <div className="mb-3">
              <label className="block text-[13px] text-muted-brand mb-1">퇴근 시각 수정 (선택)</label>
              <input type="datetime-local" value={approveData.checkOutAt} onChange={(e) => setApproveData({ ...approveData, checkOutAt: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-brand/30 rounded-md box-border" />
            </div>
            <div className="mb-3">
              <label className="block text-[13px] text-muted-brand mb-1">메모</label>
              <input type="text" value={approveData.note} onChange={(e) => setApproveData({ ...approveData, note: e.target.value })} className="w-full px-3 py-2 text-sm border border-secondary-brand/30 rounded-md box-border" placeholder="처리 메모 (선택)" />
            </div>
            {msg && <Toast message={msg} variant="success" />}
            <div className="flex gap-2 mt-4">
              {canMutate && <button onClick={() => handleAction('APPROVE')} disabled={processing} className="flex-1 py-2.5 bg-[#2e7d32] text-white border-none rounded-md cursor-pointer font-bold">승인</button>}
              {canMutate && <button onClick={() => handleAction('REJECT')} disabled={processing} className="flex-1 py-2.5 bg-[#e53935] text-white border-none rounded-md cursor-pointer font-bold">반려</button>}
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 bg-brand text-[#CBD5E0] border-none rounded-md cursor-pointer">닫기</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
