'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Worker {
  id: string
  name: string
  phone: string
  company: string
  jobTitle: string
  isActive: boolean
  deviceCount: number
  createdAt: string
}

export default function WorkersPage() {
  const router = useRouter()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', company: '', jobTitle: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = (s = search) => {
    setLoading(true)
    fetch(`/api/admin/workers?search=${encodeURIComponent(s)}&pageSize=50`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setWorkers(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [router])

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/admin/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!data.success) { setFormError(data.message); setSaving(false); return }
    setShowForm(false)
    setForm({ name: '', phone: '', company: '', jobTitle: '' })
    load()
    setSaving(false)
  }

  const formatPhone = (p: string) => p.length === 11 ? `${p.slice(0,3)}-${p.slice(3,7)}-${p.slice(7)}` : p

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 변경'],
        ].map(([href, label]) => <Link key={href} href={href} style={styles.navItem}>{label}</Link>)}
      </nav>
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.pageTitle}>근로자 관리 ({total}명)</h1>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ 근로자 등록</button>
        </div>

        <div style={styles.searchRow}>
          <input
            type="text"
            placeholder="이름, 연락처, 회사 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            style={styles.searchInput}
          />
          <button onClick={() => load()} style={styles.searchBtn}>검색</button>
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>{['이름', '연락처', '회사', '직종', '기기', '상태', '등록일'].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {workers.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>등록된 근로자가 없습니다.</td></tr>
                ) : workers.map((w) => (
                  <tr key={w.id} style={styles.tr}>
                    <td style={styles.td}>{w.name}</td>
                    <td style={styles.td}>{formatPhone(w.phone)}</td>
                    <td style={styles.td}>{w.company}</td>
                    <td style={styles.td}>{w.jobTitle}</td>
                    <td style={styles.td}>{w.deviceCount > 0 ? `${w.deviceCount}대 등록` : '미등록'}</td>
                    <td style={styles.td}><span style={{ color: w.isActive ? '#2e7d32' : '#999', fontSize: '12px', fontWeight: 600 }}>{w.isActive ? '활성' : '비활성'}</span></td>
                    <td style={styles.td}>{new Date(w.createdAt).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={{ margin: '0 0 20px' }}>근로자 등록</h3>
              {[
                { label: '이름', key: 'name', placeholder: '홍길동' },
                { label: '휴대폰', key: 'phone', placeholder: '01012345678 (숫자만)' },
                { label: '회사/협력업체', key: 'company', placeholder: '해한건설' },
                { label: '직종/역할', key: 'jobTitle', placeholder: '형틀목공' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={styles.input}
                  />
                </div>
              ))}
              {formError && <p style={{ color: '#e53935', fontSize: '13px' }}>{formError}</p>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>{saving ? '저장 중...' : '등록'}</button>
                <button onClick={() => setShowForm(false)} style={styles.cancelBtn}>취소</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar: { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main: { flex: 1, padding: '32px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { fontSize: '22px', fontWeight: 700, margin: 0 },
  addBtn: { padding: '10px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  searchRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  searchInput: { flex: 1, padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', maxWidth: '360px' },
  searchBtn: { padding: '10px 20px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  tableCard: { background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: '12px', color: '#888', borderBottom: '2px solid #f0f0f0' },
  td: { padding: '12px', fontSize: '14px', borderBottom: '1px solid #f5f5f5' },
  tr: {},
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'white', borderRadius: '12px', padding: '32px', width: '400px', maxWidth: '90vw' },
  label: { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' },
  input: { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' as const },
  saveBtn: { flex: 1, padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 },
  cancelBtn: { flex: 1, padding: '12px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' },
}
