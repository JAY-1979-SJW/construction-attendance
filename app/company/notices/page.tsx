'use client'

import { useState, useEffect, useCallback } from 'react'

interface Site {
  id: string
  name: string
}

interface Notice {
  id: string
  siteId: string
  title: string
  content: string
  noticeType: string
  visibilityScope: string
  startDate: string
  endDate: string | null
  isTodayHighlight: boolean
  isActive: boolean
  createdAt: string
}

const NOTICE_TYPE_LABELS: Record<string, string> = {
  GENERAL_NOTICE:        '일반',
  SAFETY_NOTICE:         '안전',
  SCHEDULE_NOTICE:       '일정',
  INSPECTION_NOTICE:     '검측',
  MATERIAL_NOTICE:       '자재',
  ACCESS_CONTROL_NOTICE: '출입통제',
  EMERGENCY_NOTICE:      '긴급',
}

const NOTICE_TYPE_COLORS: Record<string, React.CSSProperties> = {
  GENERAL_NOTICE:        { background: '#f3f4f6', color: '#374151' },
  SAFETY_NOTICE:         { background: '#fee2e2', color: '#991b1b' },
  SCHEDULE_NOTICE:       { background: '#dbeafe', color: '#1e40af' },
  INSPECTION_NOTICE:     { background: '#ede9fe', color: '#5b21b6' },
  MATERIAL_NOTICE:       { background: '#fef3c7', color: '#92400e' },
  ACCESS_CONTROL_NOTICE: { background: '#ffedd5', color: '#9a3412' },
  EMERGENCY_NOTICE:      { background: '#fee2e2', color: '#7f1d1d', fontWeight: 700 },
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('ko-KR') : '—'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function CompanyNoticesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', content: '', noticeType: 'GENERAL_NOTICE',
    visibilityScope: 'ALL_WORKERS', startDate: today(), endDate: '',
    isTodayHighlight: false,
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/sites?pageSize=200')
      .then(r => r.json())
      .then(d => setSites(d.items ?? d.data?.items ?? []))
  }, [])

  const load = useCallback(() => {
    if (!siteId) return
    setLoading(true)
    fetch(`/api/admin/sites/${siteId}/notices?activeOnly=false`)
      .then(r => r.json())
      .then(d => setNotices(d.data?.notices ?? []))
      .finally(() => setLoading(false))
  }, [siteId])

  useEffect(() => { if (siteId) load() }, [siteId, load])

  const handleSubmit = async () => {
    if (!siteId) { setMsg({ type: 'error', text: '현장을 선택하세요.' }); return }
    if (!form.title.trim()) { setMsg({ type: 'error', text: '제목을 입력하세요.' }); return }
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/sites/${siteId}/notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, endDate: form.endDate || null }),
      })
      const d = await res.json()
      if (res.ok) {
        setMsg({ type: 'success', text: '공지가 등록되었습니다.' })
        setShowForm(false)
        setForm({ title: '', content: '', noticeType: 'GENERAL_NOTICE', visibilityScope: 'ALL_WORKERS', startDate: today(), endDate: '', isTodayHighlight: false })
        load()
      } else {
        setMsg({ type: 'error', text: d.message ?? '등록 실패' })
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="p-8 max-w-[900px] font-sans">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-[22px] font-bold text-[#111827] m-0">공지/일정</h1>
        {siteId && (
          <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 bg-[#0f4c75] text-white border-none rounded-md cursor-pointer text-[13px]">
            {showForm ? '취소' : '+ 공지 등록'}
          </button>
        )}
      </div>

      <div className="flex gap-2 items-center mb-5">
        <select
          className="px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] min-w-[180px]"
          value={siteId}
          onChange={(e) => { setSiteId(e.target.value); setShowForm(false) }}
        >
          <option value="">현장 선택</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {msg && (
        <div
          className="px-[14px] py-[10px] rounded-md mb-4 text-[13px]"
          style={{
            background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: msg.type === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          {msg.text}
        </div>
      )}

      {/* 공지 등록 폼 */}
      {showForm && (
        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-[10px] p-5 mb-5">
          <h3 className="m-0 mb-4 text-[14px] font-semibold text-[#1e40af]">새 공지 등록</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[12px] text-[#6b7280] mb-1">제목 *</label>
              <input
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                placeholder="공지 제목"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#6b7280] mb-1">공지 유형</label>
              <select
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                value={form.noticeType}
                onChange={(e) => setForm(f => ({ ...f, noticeType: e.target.value }))}
              >
                {Object.entries(NOTICE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-[#6b7280] mb-1">노출 대상</label>
              <select
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                value={form.visibilityScope}
                onChange={(e) => setForm(f => ({ ...f, visibilityScope: e.target.value }))}
              >
                <option value="ALL_WORKERS">전체 근로자</option>
                <option value="SITE_MANAGERS_ONLY">현장 관리자 이상</option>
                <option value="HQ_AND_SITE_MANAGERS">본사+현장 관리자</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-[#6b7280] mb-1">시작일</label>
              <input
                type="date"
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                value={form.startDate}
                onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#6b7280] mb-1">종료일</label>
              <input
                type="date"
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border"
                value={form.endDate}
                onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] text-[#6b7280] mb-1">내용</label>
              <textarea
                rows={4}
                className="w-full border border-[rgba(91,164,217,0.3)] rounded-md px-[10px] py-2 text-[13px] box-border resize-y"
                value={form.content}
                onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="highlight"
                checked={form.isTodayHighlight}
                onChange={(e) => setForm(f => ({ ...f, isTodayHighlight: e.target.checked }))}
              />
              <label htmlFor="highlight" className="text-[13px] text-[#374151]">오늘 하이라이트 표시</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 bg-[#0f4c75] text-white border-none rounded-md cursor-pointer text-[13px]">
              {saving ? '등록 중...' : '등록'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-card text-[#374151] border border-[rgba(91,164,217,0.3)] rounded-md cursor-pointer text-[13px]">취소</button>
          </div>
        </div>
      )}

      {!siteId ? (
        <div className="text-center text-[#9ca3af] py-12 bg-card border border-[#e5e7eb] rounded-lg text-[14px]">현장을 선택하면 공지 목록을 확인할 수 있습니다.</div>
      ) : loading ? (
        <p className="text-[#9ca3af] text-center py-10">불러오는 중...</p>
      ) : notices.length === 0 ? (
        <div className="text-center text-[#9ca3af] py-12 bg-card border border-[#e5e7eb] rounded-lg text-[14px]">등록된 공지가 없습니다.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {notices.map(n => (
            <div
              key={n.id}
              className="bg-card border border-[#e5e7eb] rounded-lg px-4 py-[14px]"
              style={{ opacity: n.isActive ? 1 : 0.5 }}
            >
              <div className="flex gap-2 items-center mb-[6px]">
                <span
                  className="text-[11px] px-2 py-[2px] rounded"
                  style={NOTICE_TYPE_COLORS[n.noticeType] ?? { background: '#f3f4f6', color: '#374151' }}
                >
                  {NOTICE_TYPE_LABELS[n.noticeType] ?? n.noticeType}
                </span>
                {n.isTodayHighlight && (
                  <span className="text-[11px] px-2 py-[2px] rounded bg-[#fef9c3] text-[#713f12]">
                    오늘 강조
                  </span>
                )}
                {!n.isActive && (
                  <span className="text-[11px] text-[#9ca3af]">비활성</span>
                )}
              </div>
              <div
                className="cursor-pointer"
                onClick={() => setExpanded(expanded === n.id ? null : n.id)}
              >
                <div className="font-semibold text-[14px] text-[#111827] mb-1">
                  {n.title}
                </div>
                <div className="text-[12px] text-[#9ca3af]">
                  {fmtDate(n.startDate)}{n.endDate && ` ~ ${fmtDate(n.endDate)}`} · {fmtDate(n.createdAt)} 등록
                </div>
              </div>
              {expanded === n.id && (
                <div className="mt-[10px] p-[10px] bg-[#f9fafb] rounded-md text-[13px] text-[#374151] whitespace-pre-wrap">
                  {n.content || '내용 없음'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
