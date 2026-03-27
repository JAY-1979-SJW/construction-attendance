'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/admin/ui'

interface PrecheckResult {
  canClose: boolean
  errors: string[]
  warnings: string[]
  summary: {
    totalWorkers: number
    draftConfirmations: number
    missingInsurance: number
    missingWage: number
    missingRetirement: number
    missingExports: number
  }
}

interface MonthClosing {
  id: string
  monthKey: string
  status: 'OPEN' | 'CLOSING' | 'CLOSED' | 'REOPENED'
  closedAt: string | null
  closedBy: string | null
  reopenedAt: string | null
  reopenReason: string | null
}

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

const statusBadgeClass: Record<string, string> = {
  OPEN:     'bg-[rgba(91,164,217,0.1)] text-muted-brand',
  CLOSING:  'bg-[#fff8e1] text-[#f9a825]',
  CLOSED:   'bg-[#e8f5e9] text-[#2e7d32]',
  REOPENED: 'bg-[#fff3e0] text-[#e65100]',
}

const statusLabel: Record<string, string> = {
  OPEN:     '미마감',
  CLOSING:  '마감 중',
  CLOSED:   '마감 완료',
  REOPENED: '재오픈',
}

export default function MonthClosingsPage() {
  const router = useRouter()
  const [monthKey, setMonthKey] = useState(getMonthKey())
  const [closing, setClosing] = useState<MonthClosing | null>(null)
  const [precheck, setPrecheck] = useState<PrecheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [msg, setMsg] = useState('')

  const fetchClosing = useCallback(async () => {
    const res = await fetch(`/api/admin/month-closings?monthKey=${monthKey}`)
    const data = await res.json()
    if (!data.success) { router.push('/admin/login'); return }
    setClosing(data.data?.closings?.[0] ?? null)
  }, [monthKey, router])

  useEffect(() => {
    fetchClosing()
    setPrecheck(null)
    setMsg('')
  }, [monthKey, fetchClosing])

  const runPrecheck = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/month-closings/precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey }),
      })
      const data = await res.json()
      setPrecheck(data.data ?? data)
    } finally {
      setLoading(false)
    }
  }

  const runClose = async () => {
    if (!precheck?.canClose) return
    if (!confirm(`${monthKey} 월을 마감하시겠습니까?`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/month-closings/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`완료: ${data.message ?? '마감 처리되었습니다'}`)
        fetchClosing()
      } else {
        setMsg(`오류: ${data.error ?? '마감 실패'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const runReopen = async () => {
    if (!reopenReason.trim()) { alert('재오픈 사유를 입력하세요.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/month-closings/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, reason: reopenReason }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`완료: ${data.message ?? '재오픈 처리되었습니다'}`)
        setShowReopenModal(false)
        setReopenReason('')
        fetchClosing()
      } else {
        setMsg(`오류: ${data.error ?? '재오픈 실패'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const currentStatus = closing?.status ?? 'OPEN'
  const isClosed = closing?.status === 'CLOSED'

  return (
    <div className="p-8 overflow-auto">
        <h1 className="text-2xl font-bold mb-6">월마감 관리</h1>

        {/* 월 선택 + 상태 배지 */}
        <div className="flex items-center gap-4 mb-6">
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-card"
          />
          <span className={`px-[14px] py-1 rounded-full text-[13px] font-semibold ${statusBadgeClass[currentStatus]}`}>
            {statusLabel[currentStatus]}
          </span>
        </div>

        {/* 마감 정보 박스 */}
        {closing?.status === 'CLOSED' && (
          <div className="px-4 py-3 rounded-lg border border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32] text-[13px] leading-relaxed mb-4">
            마감일시: {closing.closedAt ? new Date(closing.closedAt).toLocaleString('ko-KR') : '-'}
            {closing.closedBy && <span className="ml-4 text-[12px]">처리자: {closing.closedBy}</span>}
          </div>
        )}
        {closing?.status === 'REOPENED' && (
          <div className="px-4 py-3 rounded-lg border border-[#ffcc80] bg-[#fff3e0] text-[#e65100] text-[13px] leading-relaxed mb-4">
            재오픈 사유: {closing.reopenReason}
            <br />
            재오픈 일시: {closing.reopenedAt ? new Date(closing.reopenedAt).toLocaleString('ko-KR') : '-'}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-3 mb-5">
          <button
            onClick={runPrecheck}
            disabled={loading}
            className="px-4 py-2 text-white border-none rounded-md cursor-pointer text-[14px] font-semibold"
            style={{ background: '#F47920', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '처리 중...' : '사전검사 실행'}
          </button>
          <button
            onClick={runClose}
            disabled={loading || !precheck?.canClose || isClosed}
            className="px-4 py-2 text-white border-none rounded-md cursor-pointer text-[14px] font-semibold"
            style={{ background: '#2e7d32', opacity: (loading || !precheck?.canClose || isClosed) ? 0.5 : 1 }}
          >
            마감 실행
          </button>
          <button
            onClick={() => setShowReopenModal(true)}
            disabled={loading || !isClosed}
            className="px-4 py-2 text-white border-none rounded-md cursor-pointer text-[14px] font-semibold"
            style={{ background: '#e65100', opacity: (loading || !isClosed) ? 0.5 : 1 }}
          >
            재오픈
          </button>
        </div>

        {msg && (
          <div className={`px-4 py-3 rounded-lg mb-4 text-[14px] ${msg.startsWith('오류') ? 'bg-[#ffebee] text-[#c62828]' : 'bg-[#e8f5e9] text-[#2e7d32]'}`}>
            {msg}
          </div>
        )}

        {/* 사전검사 결과 */}
        {precheck && (
          <div className="bg-card rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f0f0] font-bold text-[14px]">
              사전검사 결과
            </div>
            <div className="p-5">

              {/* 요약 카드 */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: '전체 근로자', value: precheck.summary.totalWorkers, warn: false },
                  { label: '미확정 근무', value: precheck.summary.draftConfirmations, warn: precheck.summary.draftConfirmations > 0 },
                  { label: '보험 미생성', value: precheck.summary.missingInsurance, warn: precheck.summary.missingInsurance > 0 },
                  { label: '세금 미생성', value: precheck.summary.missingWage, warn: precheck.summary.missingWage > 0 },
                  { label: '퇴직공제 미생성', value: precheck.summary.missingRetirement, warn: precheck.summary.missingRetirement > 0 },
                  { label: '신고자료 미생성', value: precheck.summary.missingExports, warn: precheck.summary.missingExports > 0 },
                ].map((card) => (
                  <div key={card.label} className="bg-card rounded-[10px] px-3 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.35)] text-center"
                    style={{ borderTop: `4px solid ${card.warn ? '#e53935' : '#e0e0e0'}` }}>
                    <div className="text-[28px] font-bold" style={{ color: card.warn ? '#e53935' : '#333' }}>
                      {card.value}
                    </div>
                    <div className="text-[12px] text-muted-brand">{card.label}</div>
                  </div>
                ))}
              </div>

              {/* 오류 */}
              {precheck.errors.length > 0 && (
                <div className="mb-3">
                  <div className="text-[13px] font-semibold text-[#c62828] mb-1.5">
                    오류 (마감 불가)
                  </div>
                  {precheck.errors.map((e, i) => (
                    <div key={i} className="text-[13px] text-[#c62828] bg-[#ffebee] px-3 py-2 rounded-md mb-1">
                      x {e}
                    </div>
                  ))}
                </div>
              )}

              {/* 경고 */}
              {precheck.warnings.length > 0 && (
                <div className="mb-3">
                  <div className="text-[13px] font-semibold text-[#f57f17] mb-1.5">
                    경고
                  </div>
                  {precheck.warnings.map((w, i) => (
                    <div key={i} className="text-[13px] text-[#f57f17] bg-[#fff8e1] px-3 py-2 rounded-md mb-1">
                      ! {w}
                    </div>
                  ))}
                </div>
              )}

              {precheck.canClose && (
                <div className="text-[13px] text-[#2e7d32] bg-[#e8f5e9] px-4 py-2.5 rounded-md">
                  모든 필수 조건이 충족되었습니다. 마감을 진행할 수 있습니다.
                </div>
              )}
            </div>
          </div>
        )}

      {/* 재오픈 모달 */}
      <Modal open={showReopenModal} onClose={() => { setShowReopenModal(false); setReopenReason('') }} title="재오픈 사유 입력">
        <textarea
          value={reopenReason}
          onChange={(e) => setReopenReason(e.target.value)}
          placeholder="재오픈 사유를 입력하세요"
          className="w-full border border-[rgba(91,164,217,0.2)] rounded-md px-2.5 py-2.5 h-24 text-[13px] resize-y box-border"
        />
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={() => { setShowReopenModal(false); setReopenReason('') }}
            className="px-4 py-2 border border-[rgba(91,164,217,0.2)] rounded-md bg-card cursor-pointer text-[13px]"
          >
            취소
          </button>
          <button
            onClick={runReopen}
            disabled={loading || !reopenReason.trim()}
            className="px-4 py-2 text-white border-none rounded-md cursor-pointer text-[13px] font-semibold"
            style={{ background: '#e65100', opacity: (loading || !reopenReason.trim()) ? 0.5 : 1 }}
          >
            재오픈
          </button>
        </div>
      </Modal>
    </div>
  )
}
