'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { hasFeaturePermission, type AdminFeature } from '@/lib/policies/security-policy'

/* ─── 아이콘 헬퍼 ─────────────────────────────────────────────── */
function I({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      {children}
    </svg>
  )
}
const S = { stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

/* ─── 타입 ────────────────────────────────────────────────────── */
interface SubItem { href: string; label: string; requiredFeature?: AdminFeature }
interface MenuItem {
  key: string
  label: string
  icon: React.ReactNode
  href?: string        // standalone link (no children)
  exact?: boolean
  children?: SubItem[] // group with sub-items
  requiredFeature?: AdminFeature  // 그룹 전체 숨김 조건
}

/* ─── 메뉴 정의 ──────────────────────────────────────────────── */
const MENU: MenuItem[] = [
  /* ── 대시보드 ── */
  {
    key: 'dashboard', label: '대시보드', exact: true, href: '/admin',
    icon: <I><rect x="3" y="3" width="7" height="7" rx="1.5" {...S}/><rect x="14" y="3" width="7" height="7" rx="1.5" {...S}/><rect x="3" y="14" width="7" height="7" rx="1.5" {...S}/><rect x="14" y="14" width="7" height="7" rx="1.5" {...S}/></I>,
  },

  /* ── 1. 승인 ── */
  {
    key: 'approval', label: '승인',
    icon: <I><path d="M9 12l2 2 4-4" {...S}/><path d="M12 3a9 9 0 100 18A9 9 0 0012 3z" {...S}/></I>,
    children: [
      { href: '/admin/registrations',          label: '회원가입 승인' },
      { href: '/admin/approvals',              label: '승인 관리' },
      { href: '/admin/company-admin-requests',  label: '업체관리자 신청', requiredFeature: 'COMPANY_MANAGE' },
      { href: '/admin/company-admins',          label: '업체관리자',      requiredFeature: 'COMPANY_MANAGE' },
      { href: '/admin/site-join-requests',      label: '현장 참여 신청',  requiredFeature: 'SITE_WRITE' },
      { href: '/admin/device-requests',         label: '기기 등록 신청' },
    ],
  },

  /* ── 2. 출퇴근 ── */
  {
    key: 'attendance', label: '출퇴근',
    icon: <I><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" {...S}/><rect x="9" y="3" width="6" height="4" rx="1" {...S}/><path d="M9 12l2 2 4-4" {...S}/></I>,
    children: [
      { href: '/admin/attendance',         label: '출퇴근관리',   requiredFeature: 'WORKER_VIEW' },
      { href: '/admin/presence-checks',    label: '중간 체류확인', requiredFeature: 'ATTENDANCE_APPROVE' },
      { href: '/admin/exceptions',         label: '예외 승인',    requiredFeature: 'ATTENDANCE_APPROVE' },
      { href: '/admin/work-confirmations', label: '근무확정',     requiredFeature: 'ATTENDANCE_APPROVE' },
      { href: '/admin/corrections',        label: '정정 이력',    requiredFeature: 'ATTENDANCE_APPROVE' },
      { href: '/admin/presence-report',    label: '체류 리포트',  requiredFeature: 'STATS_VIEW' },
    ],
  },

  /* ── 근로자 (standalone) ── */
  {
    key: 'workers', label: '근로자관리', href: '/admin/workers',
    requiredFeature: 'WORKER_VIEW',
    icon: <I><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" {...S}/><circle cx="9" cy="7" r="4" {...S}/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" {...S}/></I>,
  },

  /* ── 3. 현장 ── */
  {
    key: 'sites', label: '현장',
    icon: <I><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" {...S}/><path d="M9 22V12h6v10" {...S}/></I>,
    children: [
      { href: '/admin/sites',                  label: '현장관리' },
      { href: '/admin/site-access-groups',      label: '접근 그룹' },
      { href: '/admin/site-admin-assignments',  label: '관리자 배치' },
      { href: '/admin/site-imports',            label: '현장 Import' },
      { href: '/admin/site-locations',          label: '위치 마스터' },
    ],
  },

  /* ── 서류 (근로계약서 + 안전서류) ── */
  {
    key: 'docs', label: '서류',
    requiredFeature: 'DOCUMENT_DOWNLOAD',
    icon: <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" {...S}/><path d="M14 2v6h6M9 15l2 2 4-4" {...S}/></I>,
    children: [
      { href: '/admin/contracts',          label: '근로계약서' },
      { href: '/admin/safety-docs',        label: '안전서류' },
      { href: '/admin/document-packages',  label: '제출 서류 검토' },
    ],
  },

  /* ── 4. 노무 ── */
  {
    key: 'labor', label: '노무',
    icon: <I><rect x="2" y="7" width="20" height="14" rx="2" {...S}/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" {...S}/><path d="M12 12v4M10 14h4" {...S}/></I>,
    children: [
      { href: '/admin/labor',              label: '노무관리' },
      { href: '/admin/labor-faqs',         label: '노무 FAQ' },
      { href: '/admin/labor-cost-summaries', label: '노무비 집계' },
    ],
  },

  /* ── 5. 보험/정산 ── */
  {
    key: 'finance', label: '보험/정산',
    icon: <I><circle cx="12" cy="12" r="9" {...S}/><path d="M12 7v1m0 8v1M9.5 9.5C9.5 8.12 10.62 7 12 7s2.5 1.12 2.5 2.5c0 1.5-2.5 2-2.5 3.5m0 1h.01" {...S}/></I>,
    children: [
      { href: '/admin/wage',                      label: '노임관리' },
      { href: '/admin/wage-calculations',          label: '급여 계산' },
      { href: '/admin/month-closings',             label: '월 마감' },
      { href: '/admin/insurance-eligibility',      label: '보험 자격 판정' },
      { href: '/admin/insurance-rates',            label: '보험요율 관리' },
      { href: '/admin/retirement-mutual',          label: '퇴직공제' },
      { href: '/admin/subcontractor-settlements',  label: '협력사 정산' },
    ],
  },

  /* ── 6. 자재 ── */
  {
    key: 'materials', label: '자재',
    icon: <I><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" {...S}/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" {...S}/></I>,
    children: [
      { href: '/admin/materials',                 label: '자재 관리' },
      { href: '/admin/materials/requests',        label: '자재 청구' },
      { href: '/admin/materials/purchase-orders',  label: '발주 관리' },
      { href: '/admin/materials/inventory',        label: '자재 재고' },
      { href: '/admin/materials/estimates',            label: '내역서 분석' },
    ],
  },

  /* ── 7. 운영 ── */
  {
    key: 'operations', label: '운영',
    icon: <I><path d="M12 20V10M18 20V4M6 20v-4" {...S}/></I>,
    children: [
      { href: '/admin/reports',                          label: '작업일보' },
      { href: '/admin/work-orders',                      label: '작업지시' },
      { href: '/admin/operations/print-center',          label: '출력 센터' },
      { href: '/admin/operations/today-tasks',           label: '오늘 업무' },
      { href: '/admin/operations/attendance-exceptions',  label: '출퇴근 이상' },
      { href: '/admin/operations/labor-review',          label: '노무 검토' },
    ],
  },

  /* ── 8. 시스템 ── */
  {
    key: 'system', label: '시스템',
    icon: <I><circle cx="12" cy="12" r="3" {...S}/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" {...S}/></I>,
    children: [
      { href: '/admin/settings',       label: '설정' },
      { href: '/admin/companies',      label: '회사 정보',   requiredFeature: 'COMPANY_MANAGE' },
      { href: '/admin/document-center', label: '문서 센터',  requiredFeature: 'DOCUMENT_DOWNLOAD' },
      { href: '/admin/connections',      label: '접속 현황' },
      { href: '/admin/audit-logs',      label: '감사 로그' },
      { href: '/admin/super-users',     label: '관리자 계정' },
      { href: '/admin/policies',        label: '정책 관리' },
      { href: '/admin/devices',         label: '기기 관리' },
      { href: '/admin/devices-anomaly', label: '기기 이상 탐지' },
      { href: '/admin/pilot',           label: '파일럿 모니터' },
      { href: '/admin/temp-docs',       label: '임시 문서',  requiredFeature: 'DOCUMENT_DOWNLOAD' },
    ],
  },
]

/* ─── 그룹에 현재 경로가 포함되는지 확인 ──────────────────────── */
function groupContains(item: MenuItem, pathname: string): boolean {
  if (item.children) {
    return item.children.some(
      (c) => pathname === c.href || pathname.startsWith(c.href + '/')
    )
  }
  if (item.href) {
    return item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/')
  }
  return false
}

/* ─── 네비 링크 (standalone) ─────────────────────────────────── */
function NavLink({ href, label, icon, active }: {
  href: string; label: string; icon: React.ReactNode; active: boolean
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-[10px] text-[13px] transition-colors relative no-underline"
      style={{
        background: active ? '#FFF7ED' : 'transparent',
        color: active ? '#F97316' : '#6B7280',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#374151' } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' } }}
    >
      {active && <span className="absolute left-0 top-0 bottom-0 rounded-r-full" style={{ width: 3, background: '#F97316' }} />}
      <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

/* ─── 그룹 헤더 (토글) ───────────────────────────────────────── */
function GroupHeader({ label, icon, open, active, onClick }: {
  label: string; icon: React.ReactNode; open: boolean; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-[10px] text-[13px] transition-colors relative border-none cursor-pointer text-left"
      style={{
        background: active ? '#FFF7ED' : 'transparent',
        color: active ? '#F97316' : '#6B7280',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#374151' } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = active ? '#F97316' : '#6B7280' } }}
    >
      {active && <span className="absolute left-0 top-0 bottom-0 rounded-r-full" style={{ width: 3, background: '#F97316' }} />}
      <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      <svg
        width="12" height="12" viewBox="0 0 24 24" fill="none"
        className="shrink-0 transition-transform duration-200"
        style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
      >
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

/* ─── 서브 메뉴 링크 ─────────────────────────────────────────── */
function SubLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="flex items-center pl-11 pr-4 py-[7px] text-[12px] transition-colors no-underline"
      style={{
        color: active ? '#F97316' : '#9CA3AF',
        fontWeight: active ? 600 : 400,
        background: active ? '#FFF7ED' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#F9FAFB' } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent' } }}
    >
      {label}
    </Link>
  )
}

/* ─── AdminSidebar ───────────────────────────────────────────── */
export default function AdminSidebar({
  isOpen,
  onClose,
  role,
}: {
  isOpen: boolean
  onClose: () => void
  role?: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  // 열린 그룹 키 목록
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  // 현재 경로가 속한 그룹 자동 열기
  useEffect(() => {
    const next = new Set<string>()
    for (const item of MENU) {
      if (item.children && groupContains(item, pathname)) {
        next.add(item.key)
      }
    }
    setOpenGroups((prev) => {
      const merged = new Set(prev)
      next.forEach((k) => merged.add(k))
      return merged
    })
  }, [pathname])

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() =>
      router.push('/admin/login')
    )
  }

  return (
    <aside
      className={`fixed top-0 left-0 h-screen w-[220px] flex flex-col z-40 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ background: '#FFFFFF', borderRight: '1px solid #E5E7EB' }}
    >
      {/* 상단 4px 오렌지 라인 */}
      <div className="h-1 shrink-0 bg-brand-accent" />

      {/* 로고 */}
      <div className="h-[56px] flex items-center px-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent-light rounded-[8px] flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[14px] font-bold text-title-brand">
            해한<span className="text-accent">AI</span>
            <span className="text-[11px] font-normal text-muted2-brand ml-1">출퇴근</span>
          </span>
        </div>
      </div>

      {/* 메인 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'thin' }}>
        {MENU.filter(item =>
          !item.requiredFeature || hasFeaturePermission(role, item.requiredFeature)
        ).map((item) => {
          if (item.children) {
            // 그룹 메뉴
            const visibleChildren = item.children.filter(sub =>
              !sub.requiredFeature || hasFeaturePermission(role, sub.requiredFeature)
            )
            if (visibleChildren.length === 0) return null
            const isGroupActive = groupContains(item, pathname)
            const isOpen = openGroups.has(item.key)
            return (
              <div key={item.key}>
                <GroupHeader
                  label={item.label}
                  icon={item.icon}
                  open={isOpen}
                  active={isGroupActive}
                  onClick={() => toggleGroup(item.key)}
                />
                {isOpen && (
                  <div>
                    {visibleChildren.map((sub) => (
                      <SubLink
                        key={sub.href}
                        href={sub.href}
                        label={sub.label}
                        active={pathname === sub.href || pathname.startsWith(sub.href + '/')}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          }

          // standalone 메뉴
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href! + '/')
          return (
            <NavLink
              key={item.key}
              href={item.href!}
              label={item.label}
              icon={item.icon}
              active={active}
            />
          )
        })}
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid #E5E7EB' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-[12px] py-2 px-3 rounded-[8px] transition-colors text-left text-muted2-brand border-none bg-transparent cursor-pointer"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#FFF1F2'; e.currentTarget.style.color = '#B91C1C' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}
