'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

interface NavItem {
  href: string
  label: string
  badgeKey?: 'exceptions' | 'deviceRequests'
}

interface NavGroup {
  id: string
  icon: string
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'workforce',
    icon: '👷',
    label: '인력 관리',
    items: [
      { href: '/admin/workers',                label: '근로자 관리' },
      { href: '/admin/companies',              label: '회사 관리' },
      { href: '/admin/sites',                  label: '현장 관리' },
      { href: '/admin/registrations',          label: '등록 승인' },
      { href: '/admin/site-join-requests',     label: '현장 가입 요청' },
      { href: '/admin/site-admin-assignments', label: '현장 관리자 배정' },
      { href: '/admin/company-admins',         label: '회사 관리자' },
      { href: '/admin/company-admin-requests', label: '관리자 가입 요청' },
      { href: '/admin/site-access-groups',     label: '현장 접근 그룹' },
      { href: '/admin/site-imports',           label: '현장 데이터 가져오기' },
    ],
  },
  {
    id: 'attendance',
    icon: '📋',
    label: '근태 관리',
    items: [
      { href: '/admin/attendance',        label: '출퇴근 조회' },
      { href: '/admin/presence-checks',  label: '체류확인 현황' },
      { href: '/admin/presence-report',  label: '체류확인 리포트' },
      { href: '/admin/work-confirmations', label: '근무확정' },
      { href: '/admin/exceptions',       label: '예외 승인', badgeKey: 'exceptions' },
      { href: '/admin/corrections',      label: '정정 이력' },
    ],
  },
  {
    id: 'devices',
    icon: '📱',
    label: '기기 관리',
    items: [
      { href: '/admin/device-requests',  label: '기기 변경 요청', badgeKey: 'deviceRequests' },
      { href: '/admin/devices',          label: '등록 기기 목록' },
      { href: '/admin/devices-anomaly',  label: '이상 기기 감지' },
    ],
  },
  {
    id: 'contract',
    icon: '📄',
    label: '계약·보험·정산',
    items: [
      { href: '/admin/contracts',                  label: '계약 관리' },
      { href: '/admin/insurance-eligibility',       label: '4대보험 판정' },
      { href: '/admin/insurance-rates',             label: '보험요율 관리' },
      { href: '/admin/wage-calculations',           label: '세금/노임 계산' },
      { href: '/admin/filing-exports',              label: '신고자료 출력' },
      { href: '/admin/month-closings',              label: '월마감' },
      { href: '/admin/subcontractor-settlements',   label: '협력사 정산' },
      { href: '/admin/retirement-mutual',           label: '퇴직공제' },
      { href: '/admin/labor-cost-summaries',        label: '노임 원가 요약' },
    ],
  },
  {
    id: 'materials',
    icon: '📦',
    label: '자재 관리',
    items: [
      { href: '/admin/materials',                     label: '자재 목록' },
      { href: '/admin/materials/purchase-orders',     label: '구매 발주' },
      { href: '/admin/materials/requests',            label: '자재 요청' },
    ],
  },
  {
    id: 'documents',
    icon: '🖨️',
    label: '서류·운영',
    items: [
      { href: '/admin/document-center',          label: '문서 센터' },
      { href: '/admin/operations/print-center',  label: '출력 센터' },
      { href: '/admin/labor',                    label: '노무 일지' },
      { href: '/admin/operations/labor-review',  label: '노임 검토' },
      { href: '/admin/operations/today-tasks',   label: '오늘 업무' },
      { href: '/admin/labor-faqs',               label: '노동법 FAQ' },
      { href: '/admin/temp-docs',                label: '임시 서류' },
      { href: '/admin/policies',                 label: '정책 관리' },
    ],
  },
  {
    id: 'system',
    icon: '⚙️',
    label: '시스템',
    items: [
      { href: '/admin/settings',   label: '설정' },
      { href: '/admin/audit-logs', label: '감사 로그' },
      { href: '/admin/super-users', label: '슈퍼유저' },
      { href: '/admin/pilot',      label: '파일럿 모니터' },
    ],
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [badges, setBadges] = useState({ exceptions: 0, deviceRequests: 0 })
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(href + '/')
  }

  // 현재 경로 기반 자동 그룹 펼침
  useEffect(() => {
    const active = new Set<string>()
    NAV_GROUPS.forEach((g) => {
      if (g.items.some((item) => isActive(item.href))) active.add(g.id)
    })
    setOpenGroups(active)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // 페이지 이동 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // 뱃지 카운트 로드
  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setBadges({
            exceptions:     data.data.summary?.pendingExceptions ?? 0,
            deviceRequests: data.data.summary?.pendingDeviceRequests ?? 0,
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
    fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))
  }

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-4 z-50 flex flex-col gap-[5px] p-2.5 rounded-lg bg-[#071020] border border-[rgba(91,164,217,0.15)] shadow-lg"
        aria-label="메뉴"
      >
        <span className={`block w-5 h-[2px] bg-white transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
        <span className={`block w-5 h-[2px] bg-white transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-[2px] bg-white transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
      </button>

      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside className={`
        fixed top-0 left-0 h-screen w-[240px] flex flex-col z-40
        border-r border-[rgba(91,164,217,0.1)]
        transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        bg-[#071020]
      `}>
        {/* 상단 오렌지 라인 */}
        <div className="h-[3px] bg-gradient-to-r from-[#F47920] to-[#ff9a4d] shrink-0" />

        {/* 로고 */}
        <div className="h-[53px] flex items-center px-5 border-b border-[rgba(91,164,217,0.1)] shrink-0">
          <span className="text-[15px] font-bold text-white">
            해한<span className="text-[#F47920]">Ai</span>
            <span className="text-[#5a6a80] text-[12px] font-normal ml-1.5">출퇴근관리</span>
          </span>
        </div>

        {/* 메뉴 스크롤 영역 */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin">

          {/* 대시보드 */}
          <Link
            href="/admin"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
              pathname === '/admin'
                ? 'bg-[rgba(244,121,32,0.18)] text-[#F47920] font-bold'
                : 'text-[#8899aa] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
            }`}
          >
            <span>🏠</span><span>대시보드</span>
          </Link>

          {/* 운영 대시보드 */}
          <Link
            href="/admin/operations-dashboard"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] mb-1 transition-colors ${
              isActive('/admin/operations-dashboard')
                ? 'bg-[rgba(244,121,32,0.18)] text-[#F47920] font-bold'
                : 'text-[#8899aa] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
            }`}
          >
            <span>📊</span><span>운영 대시보드</span>
          </Link>

          <div className="my-2 border-t border-[rgba(91,164,217,0.08)]" />

          {/* 그룹 메뉴 */}
          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups.has(group.id)
            const hasActive = group.items.some((item) => isActive(item.href))

            return (
              <div key={group.id} className="mb-0.5">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-[9px] rounded-lg text-[13px] transition-colors ${
                    hasActive
                      ? 'text-white font-semibold'
                      : 'text-[#5a6a80] hover:text-[#8899aa] hover:bg-[rgba(255,255,255,0.04)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{group.icon}</span>
                    <span>{group.label}</span>
                  </span>
                  <span
                    className="text-[11px] text-[#5a6a80] transition-transform duration-200 leading-none"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >
                    ›
                  </span>
                </button>

                {isOpen && (
                  <div className="ml-5 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-[rgba(91,164,217,0.1)] pl-2">
                    {group.items.map((item) => {
                      const badge = item.badgeKey ? badges[item.badgeKey] : 0
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center justify-between px-2 py-[6px] rounded-md text-[12px] transition-colors ${
                            isActive(item.href)
                              ? 'bg-[rgba(244,121,32,0.14)] text-[#F47920] font-semibold'
                              : 'text-[#5a6a80] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
                          }`}
                        >
                          <span>{item.label}</span>
                          {badge > 0 && (
                            <span className="bg-[#e53935] text-white text-[10px] font-bold px-1.5 py-[2px] rounded-full min-w-[18px] text-center leading-none">
                              {badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* 하단 로그아웃 */}
        <div className="px-3 py-3 border-t border-[rgba(91,164,217,0.08)] shrink-0">
          <button
            onClick={handleLogout}
            className="w-full text-[12px] text-[#5a6a80] hover:text-white py-2 px-3 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors text-left"
          >
            로그아웃
          </button>
        </div>
      </aside>
    </>
  )
}
