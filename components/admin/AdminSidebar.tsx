'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

interface NavItem {
  href: string
  label: string
  badgeKey?: 'exceptions' | 'deviceRequests' | 'approvals'
}

interface NavGroup {
  id: string
  label: string
  icon: string
  items: NavItem[]
}

// ── 핵심 6개 그룹 ────────────────────────────────────────────────────
const CORE_GROUPS: NavGroup[] = [
  {
    id: 'attendance',
    icon: '📋',
    label: '출근 관리',
    items: [
      { href: '/admin/attendance',         label: '출퇴근 조회' },
      { href: '/admin/presence-checks',    label: '체류확인 현황' },
      { href: '/admin/exceptions',         label: '예외 승인', badgeKey: 'exceptions' },
      { href: '/admin/work-confirmations', label: '근무확정' },
      { href: '/admin/corrections',        label: '정정 이력' },
    ],
  },
  {
    id: 'workers',
    icon: '👷',
    label: '근로자 관리',
    items: [
      { href: '/admin/workers',   label: '근로자 목록' },
      { href: '/admin/companies', label: '회사 관리' },
    ],
  },
  {
    id: 'sites',
    icon: '🏗️',
    label: '현장 관리',
    items: [
      { href: '/admin/sites',                  label: '현장 목록' },
      { href: '/admin/site-access-groups',     label: '접근 그룹' },
      { href: '/admin/site-admin-assignments', label: '관리자 배정' },
      { href: '/admin/site-imports',           label: '데이터 가져오기' },
    ],
  },
  {
    id: 'approvals',
    icon: '✅',
    label: '승인 관리',
    items: [
      { href: '/admin/approvals',       label: '통합 승인 센터', badgeKey: 'approvals' },
      { href: '/admin/device-requests', label: '기기 변경 요청', badgeKey: 'deviceRequests' },
    ],
  },
  {
    id: 'org',
    icon: '⚙️',
    label: '조직/설정',
    items: [
      { href: '/admin/company-admins', label: '회사 관리자' },
      { href: '/admin/settings',       label: '설정' },
      { href: '/admin/audit-logs',     label: '감사 로그' },
      { href: '/admin/super-users',    label: '슈퍼유저' },
    ],
  },
]

// ── 더보기 (계약·보험·자재·서류 등) ─────────────────────────────────
const MORE_ITEMS: NavItem[] = [
  { href: '/admin/contracts',                  label: '계약 관리' },
  { href: '/admin/wage-calculations',          label: '세금/노임 계산' },
  { href: '/admin/month-closings',             label: '월마감' },
  { href: '/admin/insurance-eligibility',      label: '4대보험 판정' },
  { href: '/admin/insurance-rates',            label: '보험요율 관리' },
  { href: '/admin/subcontractor-settlements',  label: '협력사 정산' },
  { href: '/admin/retirement-mutual',          label: '퇴직공제' },
  { href: '/admin/materials',                  label: '자재 현황' },
  { href: '/admin/materials/purchase-orders',  label: '구매 발주' },
  { href: '/admin/materials/requests',         label: '자재 요청' },
  { href: '/admin/document-center',            label: '문서 센터' },
  { href: '/admin/labor',                      label: '노무 일지' },
  { href: '/admin/labor-faqs',                 label: '노동법 FAQ' },
  { href: '/admin/operations/print-center',    label: '출력 센터' },
  { href: '/admin/operations/today-tasks',     label: '오늘 업무' },
  { href: '/admin/pilot',                      label: '파일럿 모니터' },
]

const BORDER_SUBTLE  = 'rgba(255,255,255,0.06)'
const TEXT_DIM       = 'rgba(255,255,255,0.35)'
const TEXT_MID       = 'rgba(255,255,255,0.55)'
const TEXT_BRIGHT    = 'rgba(255,255,255,0.85)'
const ACTIVE_BG      = 'rgba(249,115,22,0.15)'
const HOVER_BG       = 'rgba(255,255,255,0.05)'

export default function AdminSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [moreOpen, setMoreOpen] = useState(false)
  const [badges, setBadges] = useState({ exceptions: 0, deviceRequests: 0, approvals: 0 })

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(href + '/')
  }

  // 현재 경로 기반 자동 그룹 펼침
  useEffect(() => {
    const active = new Set<string>()
    CORE_GROUPS.forEach((g) => {
      if (g.items.some((item) => isActive(item.href))) active.add(g.id)
    })
    if (MORE_ITEMS.some((item) => isActive(item.href))) setMoreOpen(true)
    setOpenGroups(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // 뱃지 카운트
  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const s = data.data.summary ?? {}
          setBadges({
            exceptions:     s.pendingExceptions ?? 0,
            deviceRequests: s.pendingDeviceRequests ?? 0,
            approvals:
              (s.pendingRegistrations ?? 0) +
              (s.pendingSiteJoins ?? 0) +
              (s.pendingAdminRequests ?? 0),
          })
        }
      })
      .catch(() => {})
  }, [pathname])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleLogout = () => {
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() =>
      router.push('/admin/login')
    )
  }

  const renderItem = (item: NavItem) => {
    const badge = item.badgeKey ? badges[item.badgeKey] : 0
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        className="flex items-center justify-between px-2 py-[6px] rounded-[6px] text-[12px] transition-colors"
        style={{
          background: active ? ACTIVE_BG : 'transparent',
          color: active ? '#F97316' : TEXT_MID,
          fontWeight: active ? 600 : 400,
        }}
        onMouseEnter={(e) => {
          if (!active) {
            ;(e.currentTarget as HTMLElement).style.background = HOVER_BG
            ;(e.currentTarget as HTMLElement).style.color = TEXT_BRIGHT
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = TEXT_MID
          }
        }}
      >
        <span>{item.label}</span>
        {badge > 0 && (
          <span className="bg-[#DC2626] text-white text-[10px] font-bold px-1.5 py-[2px] rounded-full min-w-[18px] text-center leading-none">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside
      className={`fixed top-0 left-0 h-screen w-[240px] flex flex-col z-40 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ background: '#071020', borderRight: `1px solid ${BORDER_SUBTLE}` }}
    >
      {/* 오렌지 상단 라인 */}
      <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #F97316, #FDBA74)' }} />

      {/* 로고 */}
      <div
        className="h-[53px] flex items-center px-5 shrink-0"
        style={{ borderBottom: `1px solid ${BORDER_SUBTLE}` }}
      >
        <span className="text-[15px] font-bold text-white">
          해한<span style={{ color: '#F97316' }}>Ai</span>
          <span className="text-[12px] font-normal ml-1.5" style={{ color: TEXT_DIM }}>
            출퇴근관리
          </span>
        </span>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" style={{ scrollbarWidth: 'thin' }}>

        {/* 대시보드 */}
        <Link
          href="/admin"
          className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[13px] mb-1 transition-colors"
          style={{
            background: pathname === '/admin' ? ACTIVE_BG : 'transparent',
            color: pathname === '/admin' ? '#F97316' : TEXT_MID,
            fontWeight: pathname === '/admin' ? 600 : 400,
          }}
        >
          <span>🏠</span>
          <span>대시보드</span>
        </Link>

        <div className="my-2" style={{ borderTop: `1px solid ${BORDER_SUBTLE}` }} />

        {/* 핵심 6개 그룹 */}
        {CORE_GROUPS.map((group) => {
          const open = openGroups.has(group.id)
          const hasActive = group.items.some((item) => isActive(item.href))

          return (
            <div key={group.id} className="mb-0.5">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 py-[9px] rounded-[8px] text-[13px] transition-colors"
                style={{
                  background: 'transparent',
                  color: hasActive ? TEXT_BRIGHT : TEXT_DIM,
                  fontWeight: hasActive ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = HOVER_BG
                  ;(e.currentTarget as HTMLElement).style.color = TEXT_BRIGHT
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = hasActive ? TEXT_BRIGHT : TEXT_DIM
                }}
              >
                <span className="flex items-center gap-2">
                  <span>{group.icon}</span>
                  <span>{group.label}</span>
                </span>
                <span
                  className="text-[11px] transition-transform duration-200 leading-none"
                  style={{
                    color: TEXT_DIM,
                    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  ›
                </span>
              </button>

              {open && (
                <div
                  className="ml-4 mt-0.5 mb-1 flex flex-col gap-0.5 pl-2"
                  style={{ borderLeft: `1px solid ${BORDER_SUBTLE}` }}
                >
                  {group.items.map(renderItem)}
                </div>
              )}
            </div>
          )
        })}

        <div className="my-2" style={{ borderTop: `1px solid ${BORDER_SUBTLE}` }} />

        {/* 더보기 */}
        <div className="mb-0.5">
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="w-full flex items-center justify-between px-3 py-[9px] rounded-[8px] text-[13px] transition-colors"
            style={{ background: 'transparent', color: TEXT_DIM }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = HOVER_BG
              ;(e.currentTarget as HTMLElement).style.color = TEXT_BRIGHT
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = TEXT_DIM
            }}
          >
            <span className="flex items-center gap-2">
              <span>⋯</span>
              <span>더보기</span>
            </span>
            <span
              className="text-[11px] transition-transform duration-200 leading-none"
              style={{ color: TEXT_DIM, transform: moreOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ›
            </span>
          </button>

          {moreOpen && (
            <div
              className="ml-4 mt-0.5 mb-1 flex flex-col gap-0.5 pl-2"
              style={{ borderLeft: `1px solid ${BORDER_SUBTLE}` }}
            >
              {MORE_ITEMS.map(renderItem)}
            </div>
          )}
        </div>
      </nav>

      {/* 로그아웃 */}
      <div
        className="px-3 py-3 shrink-0"
        style={{ borderTop: `1px solid ${BORDER_SUBTLE}` }}
      >
        <button
          onClick={handleLogout}
          className="w-full text-[12px] py-2 px-3 rounded-[8px] transition-colors text-left"
          style={{ color: TEXT_DIM }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = HOVER_BG
            ;(e.currentTarget as HTMLElement).style.color = TEXT_BRIGHT
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = TEXT_DIM
          }}
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}
