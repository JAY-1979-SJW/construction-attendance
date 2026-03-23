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
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={styles.title}>공지/일정</h1>
        {siteId && (
          <button onClick={() => setShowForm(v => !v)} style={styles.addBtn}>
            {showForm ? '취소' : '+ 공지 등록'}
          </button>
        )}
      </div>

      <div style={styles.filterRow}>
        <select
          style={styles.select}
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
        <div style={{
          padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px',
          background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: msg.type === 'success' ? '#065f46' : '#991b1b',
        }}>
          {msg.text}
        </div>
      )}

      {/* 공지 등록 폼 */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>새 공지 등록</h3>
          <div style={styles.grid}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={styles.label}>제목 *</label>
              <input style={styles.input} placeholder="공지 제목" value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>공지 유형</label>
              <select style={styles.input} value={form.noticeType}
                onChange={(e) => setForm(f => ({ ...f, noticeType: e.target.value }))}>
                {Object.entries(NOTICE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>노출 대상</label>
              <select style={styles.input} value={form.visibilityScope}
                onChange={(e) => setForm(f => ({ ...f, visibilityScope: e.target.value }))}>
                <option value="ALL_WORKERS">전체 근로자</option>
                <option value="SITE_MANAGERS_ONLY">현장 관리자 이상</option>
                <option value="HQ_AND_SITE_MANAGERS">본사+현장 관리자</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>시작일</label>
              <input type="date" style={styles.input} value={form.startDate}
                onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>종료일</label>
              <input type="date" style={styles.input} value={form.endDate}
                onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={styles.label}>내용</label>
              <textarea rows={4} style={{ ...styles.input, resize: 'vertical' }} value={form.content}
                onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="highlight" checked={form.isTodayHighlight}
                onChange={(e) => setForm(f => ({ ...f, isTodayHighlight: e.target.checked }))} />
              <label htmlFor="highlight" style={{ fontSize: '13px', color: '#374151' }}>오늘 하이라이트 표시</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={handleSubmit} disabled={saving} style={styles.saveBtn}>
              {saving ? '등록 중...' : '등록'}
            </button>
            <button onClick={() => setShowForm(false)} style={styles.cancelBtn}>취소</button>
          </div>
        </div>
      )}

      {!siteId ? (
        <div style={styles.empty}>현장을 선택하면 공지 목록을 확인할 수 있습니다.</div>
      ) : loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>불러오는 중...</p>
      ) : notices.length === 0 ? (
        <div style={styles.empty}>등록된 공지가 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notices.map(n => (
            <div key={n.id} style={{ ...styles.noticeCard, ...(!n.isActive ? { opacity: 0.5 } : {}) }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                  ...(NOTICE_TYPE_COLORS[n.noticeType] ?? { background: '#f3f4f6', color: '#374151' }),
                }}>
                  {NOTICE_TYPE_LABELS[n.noticeType] ?? n.noticeType}
                </span>
                {n.isTodayHighlight && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#fef9c3', color: '#713f12' }}>
                    오늘 강조
                  </span>
                )}
                {!n.isActive && (
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>비활성</span>
                )}
              </div>
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === n.id ? null : n.id)}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {fmtDate(n.startDate)}{n.endDate && ` ~ ${fmtDate(n.endDate)}`} · {fmtDate(n.createdAt)} 등록
                </div>
              </div>
              {expanded === n.id && (
                <div style={{
                  marginTop: '10px', padding: '10px', background: '#f9fafb',
                  borderRadius: '6px', fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap',
                }}>
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

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '900px', fontFamily: 'sans-serif' },
  title: { fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 },
  filterRow: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' },
  select: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', minWidth: '180px' },
  addBtn: {
    padding: '8px 16px', background: '#0f4c75', color: 'white',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
  },
  empty: {
    textAlign: 'center', color: '#9ca3af', padding: '48px 0',
    background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px',
  },
  formCard: {
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px',
    padding: '20px', marginBottom: '20px',
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' },
  input: {
    width: '100%', border: '1px solid #d1d5db', borderRadius: '6px',
    padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box',
  },
  saveBtn: {
    padding: '8px 20px', background: '#0f4c75', color: 'white',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
  },
  cancelBtn: {
    padding: '8px 16px', background: 'white', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
  },
  noticeCard: {
    background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '14px 16px',
  },
}
