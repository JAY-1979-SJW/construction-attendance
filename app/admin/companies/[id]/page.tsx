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
      <div className="p-8 overflow-auto">
          <div className="py-10 text-center text-[#999]">로딩 중...</div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-8 overflow-auto">
          <div className="text-[#c62828]">{msg || '업체를 찾을 수 없습니다.'}</div>
          <Link href="/admin/companies" className="text-secondary-brand text-sm mt-3 inline-block">← 목록으로</Link>
      </div>
    )
  }

  const statusStyle = STATUS_COLORS[company.status] ?? { bg: '#f5f5f5', color: '#A0AEC0' }

  return (
    <div className="p-8 overflow-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/companies" className="text-muted-brand text-[13px] no-underline">← 목록</Link>
          <h1 className="text-2xl font-bold m-0">{company.companyName}</h1>
          <span style={{ background: statusStyle.bg, color: statusStyle.color }} className="px-3 py-1 rounded-xl text-xs font-bold">
            {STATUS_LABELS[company.status] ?? company.status}
          </span>
        </div>

        {msg && (
          <div className={`rounded-lg px-4 py-3 mb-4 text-sm ${msg.includes('완료') || msg.includes('변경') || msg.includes('활성') ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#ffebee] text-[#c62828]'}`}>
            {msg}
          </div>
        )}

        {/* Section 1: 기본 정보 */}
        <div className="bg-white rounded-[12px] p-5 mb-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <h2 className="text-base font-bold m-0 mb-4 text-white">기본 정보</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            <div>
              <div className="text-[11px] text-muted-brand font-semibold uppercase tracking-[0.5px] mb-1">업체명</div>
              <div className="text-sm text-white font-medium">{company.companyName}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-brand font-semibold uppercase tracking-[0.5px] mb-1">요금제</div>
              <div className="text-sm text-white font-medium">{company.planType ?? '미설정'}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-brand font-semibold uppercase tracking-[0.5px] mb-1">만료일</div>
              <div className="text-sm text-white font-medium">
                {company.expiresAt ? new Date(company.expiresAt).toLocaleDateString('ko-KR') : '무기한'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-brand font-semibold uppercase tracking-[0.5px] mb-1">담당자</div>
              <div className="text-sm text-white font-medium">{company.contactName ?? '-'}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-brand font-semibold uppercase tracking-[0.5px] mb-1">연락처</div>
              <div className="text-sm text-white font-medium">{company.contactPhone ?? '-'}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-brand font-semibold uppercase tracking-[0.5px] mb-1">이메일</div>
              <div className="text-sm text-white font-medium">{company.email ?? '-'}</div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[rgba(91,164,217,0.15)]">
            <div className="text-[11px] text-muted-brand font-semibold uppercase tracking-[0.5px] mb-1">상태 변경</div>
            <div className="flex gap-2 mt-2 flex-wrap">
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
        <div className="bg-white rounded-[12px] p-5 mb-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <h2 className="text-base font-bold m-0 mb-4 text-white">기능 플래그 관리</h2>
          <p className="text-[13px] text-muted-brand mb-4">(유료) 표시 항목은 유료 플랜에서 제공되는 기능입니다.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5">
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
                    {isPaid && <span className="ml-1.5 text-[10px] bg-[#fff3e0] text-[#e65100] px-1.5 py-0.5 rounded-lg font-semibold">유료</span>}
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
                      background: '#E5E7EB',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 3: 업체 관리자 계정 */}
        <div className="bg-white rounded-[12px] p-5 mb-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <h2 className="text-base font-bold m-0 mb-4 text-white">업체 관리자 계정</h2>
          {admins.length === 0 ? (
            <div className="py-6 text-center text-[#718096] text-sm">등록된 관리자 계정이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[rgba(91,164,217,0.15)]">
                    {['이름', '이메일', '상태', '마지막 로그인', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-brand uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map(admin => (
                    <tr key={admin.id} className="border-b border-[rgba(91,164,217,0.08)] hover:bg-[rgba(91,164,217,0.04)] transition-colors">
                      <td className="px-4 py-3 text-sm text-[#CBD5E0]">{admin.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-brand">{admin.email}</td>
                      <td className="px-4 py-3 text-sm text-[#CBD5E0]">
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
                      <td className="px-4 py-3 text-xs text-muted-brand">
                        {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString('ko-KR') : '없음'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#CBD5E0]">
                        <button
                          onClick={() => handleToggleAdmin(admin.id, admin.isActive)}
                          disabled={togglingAdmin === admin.id}
                          style={{
                            padding: '4px 10px',
                            background: 'none',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
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
