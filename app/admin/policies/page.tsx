'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

interface PolicyDoc {
  id: string
  documentType: string
  title: string
  version: string
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
  isRequired: boolean
  createdAt: string
  _count: { consents: number }
}

const DOC_TYPE_LABEL: Record<string, string> = {
  TERMS_OF_SERVICE: '이용약관',
  PRIVACY_POLICY: '개인정보처리방침',
  LOCATION_POLICY: '위치정보 이용약관',
  MARKETING_NOTICE: '마케팅 수신 동의',
}

const EMPTY_FORM = {
  documentType: 'TERMS_OF_SERVICE',
  title: '',
  version: '',
  effectiveFrom: '',
  contentMd: '',
  isRequired: true,
}

export default function PoliciesPage() {
  const router = useRouter()
  const role = useAdminRole()
  const isSuperAdmin = role === 'SUPER_ADMIN'

  const [docs, setDocs] = useState<PolicyDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedContent, setExpandedContent] = useState<string>('')

  const load = () => {
    setLoading(true)
    fetch('/api/admin/policies')
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setDocs(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!form.title || !form.version || !form.effectiveFrom || !form.contentMd) {
      setMsg({ text: '모든 필드를 입력해 주세요.', ok: false })
      return
    }
    setSubmitting(true)
    setMsg(null)
    const res = await fetch('/api/admin/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, effectiveFrom: new Date(form.effectiveFrom).toISOString() }),
    })
    const data = await res.json()
    setMsg({ text: data.success ? '새 버전이 등록되었습니다.' : (data.message ?? '등록 실패'), ok: data.success })
    if (data.success) { setShowForm(false); setForm(EMPTY_FORM); load() }
    setSubmitting(false)
  }

  const toggleContent = async (doc: PolicyDoc) => {
    if (expandedId === doc.id) { setExpandedId(null); return }
    setExpandedId(doc.id)
    setExpandedContent('로딩 중...')
    fetch(`/api/admin/policies/${doc.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setExpandedContent(data.data.contentMd ?? '(내용 없음)')
        else setExpandedContent('조회 실패')
      })
      .catch(() => setExpandedContent('조회 실패'))
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  const grouped = Object.keys(DOC_TYPE_LABEL).map(type => ({
    type,
    label: DOC_TYPE_LABEL[type],
    docs: docs.filter(d => d.documentType === type),
  }))

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 승인'],
          ['/admin/devices', '기기 차단 관리'], ['/admin/policies', '약관 관리'],
        ].map(([href, label]) => <Link key={href} href={href} style={styles.navItem}>{label}</Link>)}
      </nav>

      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={styles.pageTitle}>약관/정책 문서 관리</h1>
          {isSuperAdmin && (
            <button onClick={() => setShowForm(!showForm)} style={styles.primaryBtn}>
              {showForm ? '취소' : '+ 새 버전 등록'}
            </button>
          )}
        </div>

        {msg && (
          <div style={{ ...styles.msgBox, background: msg.ok ? '#e8f5e9' : '#ffebee', borderColor: msg.ok ? '#a5d6a7' : '#ef9a9a', color: msg.ok ? '#2e7d32' : '#c62828' }}>
            {msg.text}
          </div>
        )}

        {/* 새 버전 등록 폼 */}
        {showForm && isSuperAdmin && (
          <div style={styles.formCard}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>새 정책 문서 버전 등록</h3>
            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>문서 유형</label>
                <select value={form.documentType} onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))} style={styles.select}>
                  {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>버전 (예: 2.0)</label>
                <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} style={styles.input} placeholder="2.0" />
              </div>
              <div>
                <label style={styles.label}>제목</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={styles.input} placeholder="개인정보처리방침 v2.0" />
              </div>
              <div>
                <label style={styles.label}>시행일</label>
                <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} style={styles.input} />
              </div>
            </div>
            <div>
              <label style={styles.label}>필수 동의 여부</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isRequired} onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))} />
                필수 동의 항목
              </label>
            </div>
            <div style={{ marginTop: '12px' }}>
              <label style={styles.label}>내용 (Markdown)</label>
              <textarea
                value={form.contentMd}
                onChange={e => setForm(f => ({ ...f, contentMd: e.target.value }))}
                style={{ ...styles.input, height: '200px', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                placeholder="# 약관 내용&#10;&#10;본 약관은..."
              />
            </div>
            <button onClick={handleSubmit} disabled={submitting} style={{ ...styles.primaryBtn, marginTop: '12px' }}>
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        )}

        {loading ? <p>로딩 중...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {grouped.map(group => (
              <div key={group.type} style={styles.groupCard}>
                <h2 style={styles.groupTitle}>{group.label}</h2>
                {group.docs.length === 0 ? (
                  <p style={{ color: '#718096', fontSize: '14px' }}>등록된 문서가 없습니다.</p>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['버전', '제목', '시행일', '종료일', '상태', '필수', '동의자수', ''].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.docs.map(doc => (
                        <>
                          <tr key={doc.id} style={{ background: doc.isActive ? '#f0fdf4' : 'white' }}>
                            <td style={styles.td}><span style={{ fontWeight: 700, fontFamily: 'monospace' }}>v{doc.version}</span></td>
                            <td style={styles.td}>{doc.title}</td>
                            <td style={styles.td}>{fmt(doc.effectiveFrom)}</td>
                            <td style={styles.td}>{doc.effectiveTo ? fmt(doc.effectiveTo) : '-'}</td>
                            <td style={styles.td}>
                              {doc.isActive ? (
                                <span style={styles.activeBadge}>현행</span>
                              ) : (
                                <span style={styles.inactiveBadge}>구버전</span>
                              )}
                            </td>
                            <td style={styles.td}>{doc.isRequired ? '필수' : '선택'}</td>
                            <td style={styles.td}>{doc._count.consents}명</td>
                            <td style={styles.td}>
                              <button onClick={() => toggleContent(doc)} style={styles.viewBtn}>
                                {expandedId === doc.id ? '닫기' : '내용 보기'}
                              </button>
                            </td>
                          </tr>
                          {expandedId === doc.id && (
                            <tr key={`${doc.id}_content`}>
                              <td colSpan={8} style={{ padding: '16px', background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: '#444', margin: 0 }}>{expandedContent}</pre>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar: { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main: { flex: 1, padding: '32px' },
  pageTitle: { fontSize: '22px', fontWeight: 700, margin: 0 },
  msgBox: { border: '1px solid', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', marginBottom: '16px' },
  primaryBtn: { padding: '8px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  formCard: { background: '#243144', borderRadius: '10px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', color: '#A0AEC0', marginBottom: '4px', fontWeight: 600 },
  input: { width: '100%', padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' },
  select: { width: '100%', padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px' },
  groupCard: { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  groupTitle: { fontSize: '16px', fontWeight: 700, marginTop: 0, marginBottom: '16px', borderBottom: '2px solid #f0f0f0', paddingBottom: '8px' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '8px 12px', fontSize: '12px', color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)' },
  td: { padding: '10px 12px', fontSize: '14px', borderBottom: '1px solid #f5f5f5' },
  activeBadge: { fontSize: '11px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 },
  inactiveBadge: { fontSize: '11px', background: '#1B2838', color: '#A0AEC0', padding: '2px 8px', borderRadius: '10px' },
  viewBtn: { padding: '4px 10px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' },
}
