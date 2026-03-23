'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Worker {
  id: string
  name: string
  phone: string
  jobTitle: string
  employmentType: string
  isActive: boolean
  activeSites?: { id: string; name: string }[]
}

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  DAILY_CONSTRUCTION: '일용직',
  REGULAR: '정규직',
  BUSINESS_33: '사업소득(3.3%)',
  OTHER: '기타',
}

const emptyForm = { name: '', phone: '', jobTitle: '', employmentType: 'DAILY_CONSTRUCTION' }

export default function CompanyWorkersPage() {
  const router = useRouter()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = (s = search) => {
    setLoading(true)
    fetch(`/api/company/workers?search=${encodeURIComponent(s)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/company/login'); return }
        setWorkers(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search)
  }

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/company/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) { setFormError(data.message); return }
      setMsg('근로자가 등록되었습니다.')
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch {
      setFormError('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const formatPhone = (p: string) => p.length === 11 ? `${p.slice(0,3)}-${p.slice(3,7)}-${p.slice(7)}` : p

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>근로자 관리 ({total}명)</h1>
        <button onClick={() => { setShowForm(true); setFormError('') }} style={styles.primaryBtn}>
          + 근로자 등록
        </button>
      </div>

      {msg && <p style={styles.successMsg}>{msg}</p>}

      <form onSubmit={handleSearch} style={styles.searchRow}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름으로 검색"
          style={styles.searchInput}
        />
        <button type="submit" style={styles.searchBtn}>검색</button>
      </form>

      {loading ? (
        <p style={styles.loading}>불러오는 중...</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['이름', '연락처', '직종', '고용형태', '출근현장', '상태'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.length === 0 ? (
                <tr><td colSpan={6} style={styles.empty}>근로자가 없습니다.</td></tr>
              ) : workers.map((w) => (
                <tr key={w.id} style={styles.tr}>
                  <td style={styles.td}>{w.name}</td>
                  <td style={styles.td}>{formatPhone(w.phone)}</td>
                  <td style={styles.td}>{w.jobTitle}</td>
                  <td style={styles.td}>{EMPLOYMENT_TYPE_LABEL[w.employmentType] ?? w.employmentType}</td>
                  <td style={styles.td}>{w.activeSites?.map((s) => s.name).join(', ') || '-'}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: w.isActive ? '#e8f5e9' : '#fafafa', color: w.isActive ? '#2e7d32' : '#888' }}>
                      {w.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>근로자 등록</h2>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>이름</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={styles.input} placeholder="홍길동" />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>연락처</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={styles.input} placeholder="01012345678" />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>직종</label>
              <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} style={styles.input} placeholder="철근공" />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>고용형태</label>
              <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} style={styles.select}>
                <option value="DAILY_CONSTRUCTION">일용직</option>
                <option value="REGULAR">정규직</option>
                <option value="BUSINESS_33">사업소득(3.3%)</option>
                <option value="OTHER">기타</option>
              </select>
            </div>
            {formError && <p style={styles.error}>{formError}</p>}
            <div style={styles.modalBtns}>
              <button onClick={() => setShowForm(false)} style={styles.cancelBtn}>취소</button>
              <button onClick={handleSave} disabled={saving} style={{ ...styles.primaryBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? '저장 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '32px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
  title: { fontSize: '22px', fontWeight: 700, margin: 0, color: '#1a1a2e' },
  primaryBtn: { padding: '9px 18px', background: '#0f4c75', color: 'white', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  successMsg: { background: '#e8f5e9', color: '#2e7d32', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  searchRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  searchInput: { padding: '9px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '7px', fontSize: '14px', width: '220px', outline: 'none' },
  searchBtn: { padding: '9px 16px', background: '#555', color: 'white', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '14px' },
  loading: { color: '#A0AEC0', fontSize: '15px' },
  tableWrapper: { background: '#243144', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666', borderBottom: '1px solid #eee', background: '#fafafa', whiteSpace: 'nowrap' as const },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#CBD5E0', whiteSpace: 'nowrap' as const },
  empty: { padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '14px' },
  badge: { padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#243144', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '420px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: '18px', fontWeight: 700, margin: '0 0 20px', color: '#1a1a2e' },
  fieldGroup: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '5px' },
  input: { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '7px', outline: 'none', boxSizing: 'border-box' as const },
  select: { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '7px', outline: 'none', background: 'white', boxSizing: 'border-box' as const },
  error: { color: '#e53935', fontSize: '13px', marginBottom: '10px' },
  modalBtns: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' },
  cancelBtn: { padding: '9px 18px', background: '#eee', color: '#555', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '14px' },
}
