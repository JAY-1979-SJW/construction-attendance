'use client'

import { useState, useEffect } from 'react'

interface Manager {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  companyId: string | null
  lastLoginAt: string | null
  createdAt: string
}

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: '전체 현장 관리',
  SITE_ADMIN: '담당 현장 관리',
  EXTERNAL_SITE_ADMIN: '지정 현장 운영형',
}

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  COMPANY_ADMIN:       { bg: '#dbeafe', color: '#1e40af' },
  SITE_ADMIN:          { bg: '#d1fae5', color: '#065f46' },
  EXTERNAL_SITE_ADMIN: { bg: '#fef3c7', color: '#92400e' },
}

export default function CompanyManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'SITE_ADMIN' })
  const [inviting, setInviting] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/admin-users')
      .then(r => r.json())
      .then(d => setManagers(d.data ?? d.items ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleInvite = async () => {
    if (!form.name || !form.email) return
    setInviting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (res.ok) {
        setMsg({ type: 'success', text: '관리자가 생성되었습니다.' })
        setShowInvite(false)
        setForm({ name: '', email: '', role: 'SITE_ADMIN' })
        load()
      } else {
        setMsg({ type: 'error', text: d.message ?? '오류가 발생했습니다.' })
      }
    } finally {
      setInviting(false)
    }
  }

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`${name} 관리자를 비활성화하시겠습니까?`)) return
    const res = await fetch(`/api/admin/admin-users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    if (res.ok) {
      setMsg({ type: 'success', text: '비활성화 처리되었습니다.' })
      load()
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>관리자 관리</h1>
        <button style={styles.inviteBtn} onClick={() => setShowInvite(true)}>+ 관리자 추가</button>
      </div>

      {msg && (
        <div style={{ ...styles.alert, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b' }}>
          {msg.text}
        </div>
      )}

      <div style={styles.infoBox}>
        <strong>관리 범위 안내</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '13px', color: '#374151' }}>
          <li><strong>전체 현장 관리</strong> — 회사 전체 현장 접근</li>
          <li><strong>담당 현장 관리</strong> — 배정된 현장만 접근</li>
          <li><strong>지정 현장 운영형</strong> — 그룹 지정 현장 접근 (읽기 위주)</li>
        </ul>
      </div>

      {loading ? (
        <p style={styles.muted}>로딩 중...</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>이름</th>
                <th style={styles.th}>이메일</th>
                <th style={styles.th}>관리 범위</th>
                <th style={styles.th}>최근 로그인</th>
                <th style={styles.th}>상태</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {managers.map(m => {
                const rc = ROLE_COLOR[m.role] ?? { bg: '#f3f4f6', color: '#6b7280' }
                return (
                  <tr key={m.id} style={styles.tr}>
                    <td style={styles.td}><span style={{ fontWeight: 600 }}>{m.name}</span></td>
                    <td style={{ ...styles.td, color: '#6b7280', fontSize: '13px' }}>{m.email}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: rc.bg, color: rc.color }}>
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#9ca3af', fontSize: '12px' }}>
                      {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString('ko-KR') : '없음'}
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: m.isActive ? '#d1fae5' : '#f3f4f6', color: m.isActive ? '#065f46' : '#9ca3af' }}>
                        {m.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {m.isActive && (
                        <button style={styles.deactivateBtn} onClick={() => handleDeactivate(m.id, m.name)}>
                          비활성화
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 관리자 추가 모달 */}
      {showInvite && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>관리자 추가</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>이름 *</label>
              <input style={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="담당자명" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>이메일 *</label>
              <input style={styles.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="이메일 주소" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>관리 범위</label>
              <select style={styles.input} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="SITE_ADMIN">담당 현장 관리</option>
                <option value="EXTERNAL_SITE_ADMIN">지정 현장 운영형</option>
                <option value="COMPANY_ADMIN">전체 현장 관리</option>
              </select>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setShowInvite(false)}>취소</button>
              <button style={styles.confirmBtn} disabled={inviting || !form.name || !form.email} onClick={handleInvite}>
                {inviting ? '처리 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 },
  inviteBtn: { padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  alert: { padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  infoBox: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px', fontSize: '14px', color: '#1e40af' },
  muted: { color: '#6b7280' },
  tableWrap: { border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '11px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '13px 14px', fontSize: '14px', color: '#1f2937', verticalAlign: 'middle' },
  badge: { fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: 500 },
  deactivateBtn: { padding: '4px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', color: '#6b7280' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: '10px', padding: '28px', width: '380px', maxWidth: '90vw' },
  modalTitle: { fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '20px', marginTop: 0 },
  formGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' },
  modalActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' },
  cancelBtn: { padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '14px' },
  confirmBtn: { padding: '7px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
}
