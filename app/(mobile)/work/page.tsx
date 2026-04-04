'use client'

import { useState, useEffect, useRef } from 'react'
import WorkerTopBar from '@/components/worker/WorkerTopBar'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface TodayAttendance {
  siteId: string
  siteName: string
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

const todayKST = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function WorkPage() {
  const [tab, setTab] = useState<'report' | 'material'>('report')
  const [today, setToday] = useState<TodayAttendance | null>(null)

  useEffect(() => {
    fetch('/api/attendance/today', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setToday({ siteId: d.data.siteId, siteName: d.data.siteName }) })
      .catch(() => {})
  }, [])

  return (
    <>
      <WorkerTopBar />
      <div className="mobile-content">
        {/* 탭 선택 */}
        <div className="flex bg-card rounded-2xl p-1 mb-5 gap-1">
          {(['report', 'material'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-3 rounded-xl text-[14px] font-bold border-none cursor-pointer transition-all"
              style={{
                background: tab === t ? '#F97316' : 'transparent',
                color: tab === t ? '#fff' : '#5a6a7e',
              }}
            >
              {t === 'report' ? '작업기록' : '자재신청'}
            </button>
          ))}
        </div>

        {tab === 'report' && <WorkReportForm siteId={today?.siteId ?? null} siteName={today?.siteName ?? null} />}
        {tab === 'material' && <MaterialRequestForm siteId={today?.siteId ?? null} siteName={today?.siteName ?? null} />}
      </div>
      <WorkerBottomNav />
    </>
  )
}

// ── 작업기록 폼 ───────────────────────────────────────────────────────────────

function WorkReportForm({ siteId, siteName }: { siteId: string | null; siteName: string | null }) {
  const [workDetail, setWorkDetail]   = useState('')
  const [issue, setIssue]             = useState('')
  const [memo, setMemo]               = useState('')
  const [photos, setPhotos]           = useState<File[]>([])
  const [previews, setPreviews]       = useState<string[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [msg, setMsg]                 = useState('')
  const fileRef                        = useRef<HTMLInputElement>(null)

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const merged = [...photos, ...files].slice(0, 5)
    setPhotos(merged)
    setPreviews(merged.map(f => URL.createObjectURL(f)))
  }

  const removePhoto = (i: number) => {
    const next = photos.filter((_, idx) => idx !== i)
    setPhotos(next)
    setPreviews(next.map(f => URL.createObjectURL(f)))
  }

  const handleSubmit = async () => {
    if (!workDetail.trim()) { setMsg('작업내용을 입력하세요.'); return }
    if (!siteId) { setMsg('출근한 현장 정보가 없습니다.'); return }
    setSubmitting(true)
    setMsg('')

    try {
      // 1. 작업기록 생성
      const res = await fetch('/api/worker/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          reportDate: todayKST(),
          workDetail: workDetail.trim(),
          notes: [issue.trim(), memo.trim()].filter(Boolean).join('\n[전달사항] ') || null,
          todayWork: workDetail.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.message ?? '저장 실패'); return }

      const reportId = data.data?.id
      // 2. 사진 업로드 (있을 때만)
      if (reportId && photos.length > 0) {
        for (const photo of photos) {
          const fd = new FormData()
          fd.append('file', photo)
          fd.append('reportId', reportId)
          await fetch('/api/worker/daily-reports/photos/upload', { method: 'POST', body: fd }).catch(() => {})
        }
      }

      setMsg('작업기록이 저장되었습니다.')
      setWorkDetail(''); setIssue(''); setMemo(''); setPhotos([]); setPreviews([])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-card rounded-2xl p-5 mb-4">
      {siteName && (
        <div className="text-[13px] text-muted-brand mb-3">현장: <span className="font-semibold text-body-brand">{siteName}</span></div>
      )}

      {/* 사진 */}
      <div className="mb-4">
        <div className="text-[13px] font-semibold text-body-brand mb-2">사진 <span className="text-muted-brand font-normal">(최대 5장)</span></div>
        <div className="flex gap-2 flex-wrap">
          {previews.map((src, i) => (
            <div key={i} className="relative w-[70px] h-[70px] rounded-xl overflow-hidden bg-gray-100 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-0 right-0 w-5 h-5 bg-black/60 text-white border-none rounded-bl-xl text-xs cursor-pointer flex items-center justify-center"
              >×</button>
            </div>
          ))}
          {photos.length < 5 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-[70px] h-[70px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 text-[24px] cursor-pointer flex items-center justify-center shrink-0"
            >+</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
      </div>

      {/* 텍스트 입력 */}
      <div className="space-y-3">
        <div>
          <div className="text-[13px] font-semibold text-body-brand mb-1">오늘 작업내용 <span className="text-red-500">*</span></div>
          <input
            type="text"
            placeholder="한 줄로 입력"
            value={workDetail}
            onChange={e => setWorkDetail(e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-brand text-[14px] box-border"
          />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-body-brand mb-1">문제사항 <span className="text-muted-brand font-normal">(선택)</span></div>
          <input
            type="text"
            placeholder="이상 있을 때만 입력"
            value={issue}
            onChange={e => setIssue(e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-brand text-[14px] box-border"
          />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-body-brand mb-1">관리자 전달사항 <span className="text-muted-brand font-normal">(선택)</span></div>
          <input
            type="text"
            placeholder="전달할 내용 한 줄"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-brand text-[14px] box-border"
          />
        </div>
      </div>

      {msg && (
        <div
          className="mt-3 rounded-xl px-3 py-2 text-[13px] font-medium"
          style={{
            background: msg.includes('저장') ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
            color: msg.includes('저장') ? '#16a34a' : '#dc2626',
          }}
        >{msg}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !workDetail.trim()}
        className="w-full mt-4 py-4 text-[17px] font-bold text-white border-none rounded-2xl cursor-pointer"
        style={{ background: '#2e7d32', opacity: submitting || !workDetail.trim() ? 0.5 : 1, boxShadow: '0 4px 12px rgba(46,125,50,0.25)' }}
      >
        {submitting ? '저장 중...' : '작업기록 저장'}
      </button>
    </div>
  )
}

// ── 자재신청 폼 ───────────────────────────────────────────────────────────────

function MaterialRequestForm({ siteId, siteName }: { siteId: string | null; siteName: string | null }) {
  const [itemName, setItemName]   = useState('')
  const [memo, setMemo]           = useState('')
  const [qty, setQty]             = useState('1')
  const [isUrgent, setIsUrgent]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg]             = useState('')

  const handleSubmit = async () => {
    if (!itemName.trim()) { setMsg('품목을 입력하세요.'); return }
    if (!siteId) { setMsg('출근한 현장 정보가 없습니다.'); return }
    setSubmitting(true)
    setMsg('')
    try {
      const res = await fetch('/api/worker/materials/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          title: `${isUrgent ? '[긴급] ' : ''}${itemName.trim()}`,
          items: [{
            itemName: itemName.trim(),
            spec: '',
            unit: '개',
            requestedQty: parseInt(qty, 10) || 1,
            notes: [memo.trim(), isUrgent ? '긴급' : ''].filter(Boolean).join(' / ') || undefined,
          }],
        }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.message ?? '신청 실패'); return }

      setMsg('자재신청이 접수되었습니다.')
      setItemName(''); setMemo(''); setQty('1'); setIsUrgent(false)
    } catch {
      setMsg('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-card rounded-2xl p-5 mb-4">
      {siteName && (
        <div className="text-[13px] text-muted-brand mb-3">현장: <span className="font-semibold text-body-brand">{siteName}</span></div>
      )}

      {/* 입력 */}
      <div className="space-y-3">
        <div>
          <div className="text-[13px] font-semibold text-body-brand mb-1">품목 <span className="text-red-500">*</span></div>
          <input
            type="text"
            placeholder="필요한 자재 이름"
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-brand text-[14px] box-border"
          />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-body-brand mb-1">메모 <span className="text-muted-brand font-normal">(선택)</span></div>
          <input
            type="text"
            placeholder="규격, 색상 등 간단히"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-brand text-[14px] box-border"
          />
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-body-brand mb-1">수량</div>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-brand text-[14px] box-border"
            />
          </div>
          <button
            onClick={() => setIsUrgent(u => !u)}
            className="py-3 px-4 rounded-xl border-2 text-[13px] font-bold cursor-pointer transition-all"
            style={{
              background: isUrgent ? 'rgba(198,40,40,0.08)' : '#fff',
              borderColor: isUrgent ? '#c62828' : '#E5E7EB',
              color: isUrgent ? '#c62828' : '#5a6a7e',
            }}
          >
            {isUrgent ? '긴급 ✓' : '긴급'}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className="mt-3 rounded-xl px-3 py-2 text-[13px] font-medium"
          style={{
            background: msg.includes('접수') ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
            color: msg.includes('접수') ? '#16a34a' : '#dc2626',
          }}
        >{msg}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !itemName.trim()}
        className="w-full mt-4 py-4 text-[17px] font-bold text-white border-none rounded-2xl cursor-pointer"
        style={{ background: '#1565c0', opacity: submitting || !itemName.trim() ? 0.5 : 1, boxShadow: '0 4px 12px rgba(21,101,192,0.25)' }}
      >
        {submitting ? '신청 중...' : '자재신청'}
      </button>
    </div>
  )
}
