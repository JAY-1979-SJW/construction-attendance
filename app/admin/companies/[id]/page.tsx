'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { FEATURE_FLAG_LABELS, DEFAULT_FEATURE_FLAGS, FeatureFlagKey } from '@/lib/feature-flags'

interface CompanyDetail {
  id: string
  companyName: string
  status: string
  planType: string | null
  expiresAt: string | null
  contactName: string | null
  contactPhone: string | null
  email: string | null
  featureFlagsJson: Record<FeatureFlagKey, boolean> | null
}

interface CompanyAdmin {
  id: string
  name: string
  email: string
  companyId: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '정상',
  SUSPENDED: '일시정지',
  EXPIRED: '만료',
  DELETED: '삭제',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: '#e8f5e9', color: '#2e7d32' },
  SUSPENDED: { bg: '#fff3e0', color: '#e65100' },
  EXPIRED:   { bg: '#fce4ec', color: '#880e4f' },
  DELETED:   { bg: '#f5f5f5', color: '#9e9e9e' },
}

const FLAG_KEYS = Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagKey[]

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [flags, setFlags] = useState<Record<FeatureFlagKey, boolean>>({ ...DEFAULT_FEATURE_FLAGS })
  const [admins, setAdmins] = useState<CompanyAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [statusChanging, setStatusChanging] = useState(false)
  const [togglingFlag, setTogglingFlag] = useState<FeatureFlagKey | null>(null)
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null)

  const loadCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/companies/${id}`)
      if (res.status === 401) { router.push('/admin/login'); return }
      const data = await res.json()
      if (!res.ok) { setMsg(data.error ?? '불러오기 실패'); return }
      const c: CompanyDetail = data.data
      setCompany(c)
      const stored = (c.featureFlagsJson ?? {}) as Partial<Record<FeatureFlagKey, boolean>>
      setFlags({ ...DEFAULT_FEATURE_FLAGS, ...stored })
    } catch {
      setMsg('네트워크 오류')
    }
  }, [id, router])

  const loadAdmins = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/company-admins')
      if (!res.ok) return
      const data = await res.json()
      const all: CompanyAdmin[] = data.data ?? []
      setAdmins(all.filter(a => a.companyId === id))
    } catch {
      // silently ignore
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadCompany(), loadAdmins()]).finally(() => setLoading(false))
  }, [loadCompany, loadAdmins])

  const handleStatusChange = async (newStatus: string) => {
    if (!company) return
    if (newStatus === 'DELETED') {
      if (!confirm(`정말로 "${company.companyName}" 업체를 삭제 처리하시겠습니까?\n이 작업은 되돌리기 어렵습니다.`)) return
    } else {
      if (!confirm(`상태를 "${STATUS_LABELS[newStatus]}"으로 변경하시겠습니까?`)) return
    }
    setStatusChanging(true)
    setMsg('')
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (res.ok) {
        setCompany(prev => prev ? { ...prev, status: newStatus } : prev)
        setMsg('상태가 변경되었습니다.')
      } else {
        setMsg(data.error ?? '변경 실패')
      }
    } finally {
      setStatusChanging(false)
    }
  }

  const handleToggleFlag = async (key: FeatureFlagKey) => {
    const newValue = !flags[key]
    const newFlags = { ...flags, [key]: newValue }
    setTogglingFlag(key)
    setMsg('')
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureFlagsJson: newFlags }),
      })
      const data = await res.json()
      if (res.ok) {
        setFlags(newFlags)
        setMsg(`${FEATURE_FLAG_LABELS[key]} ${newValue ? '활성화' : '비활성화'} 완료`)
      } else {
        setMsg(data.error ?? '변경 실패')
      }
    } finally {
      setTogglingFlag(null)
    }
  }

  const handleToggleAdmin = async (adminId: string, currentActive: boolean) => {
    setTogglingAdmin(adminId)
    setMsg('')
    try {
      const res = await fetch(`/api/admin/company-admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })
      const data = await res.json()
      if (res.ok) {
        setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, isActive: !currentActive } : a))
        setMsg(`계정이 ${!currentActive ? '활성화' : '비활성화'}되었습니다.`)
      } else {
        setMsg(data.error ?? '변경 실패')
      }
    } finally {
      setTogglingAdmin(null)
    }
  }

  if (loading) {
    return (
      <div style={s.layout}>
        <nav style={s.sidebar}>
          <div style={s.sidebarTitle}>해한 출퇴근</div>
          <div style={s.navSection}>관리</div>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} style={s.navItem}>{item.label}</Link>
          ))}
        </nav>
        <main style={s.main}>
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>로딩 중...</div>
        </main>
      </div>
    )
  }

  if (!company) {
    return (
      <div style={s.layout}>
        <nav style={s.sidebar}>
          <div style={s.sidebarTitle}>해한 출퇴근</div>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} style={s.navItem}>{item.label}</Link>
          ))}
        </nav>
        <main style={s.main}>
          <div style={{ color: '#c62828' }}>{msg || '업체를 찾을 수 없습니다.'}</div>
          <Link href="/admin/companies" style={{ color: '#1976d2', fontSize: '14px', marginTop: '12px', display: 'inline-block' }}>← 목록으로</Link>
        </main>
      </div>
    )
  }

  const statusStyle = STATUS_COLORS[company.status] ?? { bg: '#f5f5f5', color: '#555' }

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        <div style={s.navSection}>관리</div>
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            style={{ ...s.navItem, ...(item.href === '/admin/companies' ? s.navActive : {}) }}>
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))}
          style={s.logoutBtn}
        >로그아웃</button>
      </nav>

      <main style={s.main}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Link href="/admin/companies" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>← 목록</Link>
          <h1 style={s.pageTitle}>{company.companyName}</h1>
          <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
            {STATUS_LABELS[company.status] ?? company.status}
          </span>
        </div>

        {msg && (
          <div style={{ background: msg.includes('완료') || msg.includes('변경') || msg.includes('활성') ? '#e8f5e9' : '#ffebee', color: msg.includes('완료') || msg.includes('변경') || msg.includes('활성') ? '#2e7d32' : '#c62828', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' }}>
            {msg}
          </div>
        )}

        {/* Section 1: 기본 정보 */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>기본 정보</h2>
          <div style={s.infoGrid}>
            <div style={s.infoItem}>
              <div style={s.infoLabel}>업체명</div>
              <div style={s.infoValue}>{company.companyName}</div>
            </div>
            <div style={s.infoItem}>
              <div style={s.infoLabel}>요금제</div>
              <div style={s.infoValue}>{company.planType ?? '미설정'}</div>
            </div>
            <div style={s.infoItem}>
              <div style={s.infoLabel}>만료일</div>
              <div style={s.infoValue}>
                {company.expiresAt ? new Date(company.expiresAt).toLocaleDateString('ko-KR') : '무기한'}
              </div>
            </div>
            <div style={s.infoItem}>
              <div style={s.infoLabel}>담당자</div>
              <div style={s.infoValue}>{company.contactName ?? '-'}</div>
            </div>
            <div style={s.infoItem}>
              <div style={s.infoLabel}>연락처</div>
              <div style={s.infoValue}>{company.contactPhone ?? '-'}</div>
            </div>
            <div style={s.infoItem}>
              <div style={s.infoLabel}>이메일</div>
              <div style={s.infoValue}>{company.email ?? '-'}</div>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
            <div style={s.infoLabel}>상태 변경</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {(['ACTIVE', 'SUSPENDED', 'EXPIRED', 'DELETED'] as const).map(st => {
                const sc = STATUS_COLORS[st]
                const isCurrent = company.status === st
                return (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={isCurrent || statusChanging}
                    style={{
                      padding: '7px 16px',
                      background: isCurrent ? sc.bg : 'white',
                      color: isCurrent ? sc.color : '#555',
                      border: `1px solid ${isCurrent ? sc.color : '#e0e0e0'}`,
                      borderRadius: '6px',
                      cursor: isCurrent ? 'default' : 'pointer',
                      fontSize: '13px',
                      fontWeight: isCurrent ? 700 : 400,
                      opacity: statusChanging && !isCurrent ? 0.5 : 1,
                    }}
                  >
                    {STATUS_LABELS[st]}
                    {isCurrent && ' ✓'}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Section 2: 기능 플래그 관리 */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>기능 플래그 관리</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>(유료) 표시 항목은 유료 플랜에서 제공되는 기능입니다.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {FLAG_KEYS.map(key => {
              const label = FEATURE_FLAG_LABELS[key]
              const isPaid = label.includes('(유료)')
              const isOn = flags[key]
              const isToggling = togglingFlag === key
              return (
                <div key={key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: isOn ? '#f0faf0' : '#fafafa',
                  border: `1px solid ${isOn ? '#a5d6a7' : '#e0e0e0'}`,
                  borderRadius: '8px',
                }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: isOn ? '#2e7d32' : '#555' }}>{label}</span>
                    {isPaid && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#fff3e0', color: '#e65100', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>유료</span>}
                  </div>
                  <button
                    onClick={() => handleToggleFlag(key)}
                    disabled={isToggling}
                    style={{
                      width: '48px',
                      height: '26px',
                      borderRadius: '13px',
                      background: isOn ? '#43a047' : '#bdbdbd',
                      border: 'none',
                      cursor: isToggling ? 'default' : 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s',
                      opacity: isToggling ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                    aria-label={`${label} ${isOn ? '끄기' : '켜기'}`}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '3px',
                      left: isOn ? '24px' : '3px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 3: 업체 관리자 계정 */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>업체 관리자 계정</h2>
          {admins.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '14px' }}>등록된 관리자 계정이 없습니다.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['이름', '이메일', '상태', '마지막 로그인', ''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map(admin => (
                    <tr key={admin.id}>
                      <td style={s.td}>{admin.name}</td>
                      <td style={{ ...s.td, fontSize: '12px', color: '#666' }}>{admin.email}</td>
                      <td style={s.td}>
                        <span style={{
                          background: admin.isActive ? '#e8f5e9' : '#f5f5f5',
                          color: admin.isActive ? '#2e7d32' : '#9e9e9e',
                          padding: '3px 10px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}>
                          {admin.isActive ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontSize: '12px', color: '#888' }}>
                        {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString('ko-KR') : '없음'}
                      </td>
                      <td style={s.td}>
                        <button
                          onClick={() => handleToggleAdmin(admin.id, admin.isActive)}
                          disabled={togglingAdmin === admin.id}
                          style={{
                            ...s.actionBtn,
                            color: admin.isActive ? '#c62828' : '#1976d2',
                            opacity: togglingAdmin === admin.id ? 0.5 : 1,
                          }}
                        >
                          {admin.isActive ? '비활성화' : '활성화'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                           label: '대시보드' },
  { href: '/admin/companies',                 label: '회사 관리' },
  { href: '/admin/workers',                   label: '근로자 관리' },
  { href: '/admin/sites',                     label: '현장 관리' },
  { href: '/admin/attendance',                label: '출퇴근 조회' },
  { href: '/admin/presence-checks',           label: '체류확인 현황' },
  { href: '/admin/presence-report',           label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',        label: '근무확정' },
  { href: '/admin/contracts',                 label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility',     label: '보험판정' },
  { href: '/admin/wage-calculations',         label: '세금/노임 계산' },
  { href: '/admin/filing-exports',            label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',         label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',      label: '노무비 집계' },
  { href: '/admin/subcontractor-settlements', label: '협력사 정산' },
  { href: '/admin/document-center',           label: '서식 출력 센터' },
  { href: '/admin/month-closings',            label: '월마감' },
  { href: '/admin/corrections',               label: '정정 이력' },
  { href: '/admin/exceptions',                label: '예외 승인' },
  { href: '/admin/device-requests',           label: '기기 변경' },
  { href: '/admin/devices-anomaly',           label: '기기 이상 감지' },
]

const s: Record<string, React.CSSProperties> = {
  layout:       { display: 'flex', minHeight: '100vh', background: '#f5f5f5' },
  sidebar:      { width: '220px', background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  navSection:   { color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: '1px' },
  navItem:      { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '13px', textDecoration: 'none' },
  navActive:    { background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700 },
  logoutBtn:    { margin: '24px 20px 0', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, margin: '0' },
  card:         { background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: '16px', fontWeight: 700, margin: '0 0 16px', color: '#1a1a2e' },
  infoGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' },
  infoItem:     {},
  infoLabel:    { fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' },
  infoValue:    { fontSize: '14px', color: '#1a1a2e', fontWeight: 500 },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:           { background: '#f8f9fa', padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '1px solid #e0e0e0', whiteSpace: 'nowrap' },
  td:           { padding: '12px 14px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle' },
  actionBtn:    { padding: '4px 10px', background: 'none', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
}
