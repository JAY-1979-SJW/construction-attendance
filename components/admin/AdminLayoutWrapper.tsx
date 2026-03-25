'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AdminSidebar from './AdminSidebar'

const SECTION_MAP: Record<string, string> = {
  '/admin/attendance':              '출퇴근 조회',
  '/admin/presence-checks':        '체류확인 현황',
  '/admin/exceptions':              '예외 승인',
  '/admin/work-confirmations':      '근무확정',
  '/admin/corrections':             '정정 이력',
  '/admin/workers':                 '근로자 관리',
  '/admin/companies':               '회사 관리',
  '/admin/sites':                   '현장 관리',
  '/admin/site-access-groups':      '접근 그룹',
  '/admin/site-admin-assignments':  '관리자 배정',
  '/admin/site-imports':            '데이터 가져오기',
  '/admin/approvals':               '통합 승인 센터',
  '/admin/device-requests':         '기기 변경 요청',
  '/admin/company-admins':          '회사 관리자',
  '/admin/settings':                '설정',
  '/admin/audit-logs':              '감사 로그',
  '/admin/super-users':             '슈퍼유저',
  '/admin/contracts':               '계약 관리',
  '/admin/wage-calculations':       '세금/노임 계산',
  '/admin/month-closings':          '월마감',
  '/admin/insurance-eligibility':   '4대보험 판정',
  '/admin/insurance-rates':         '보험요율 관리',
  '/admin/subcontractor-settlements': '협력사 정산',
  '/admin/retirement-mutual':       '퇴직공제',
  '/admin/materials':               '자재 관리',
  '/admin/document-center':         '문서 센터',
  '/admin/labor':                   '노무 일지',
  '/admin/labor-faqs':              '노동법 FAQ',
  '/admin/operations/print-center': '출력 센터',
  '/admin/operations/today-tasks':  '오늘 업무',
  '/admin/pilot':                   '파일럿 모니터',
}

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1024)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [pathname])

  if (pathname === '/admin/login') return <>{children}</>

  const sectionName =
    SECTION_MAP[pathname] ??
    Object.entries(SECTION_MAP).find(([k]) => pathname.startsWith(k + '/'))?.[1] ??
    (pathname === '/admin' ? '대시보드' : '')

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 메인 영역 */}
      <div
        className="flex-1 min-h-screen flex flex-col transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 240 : 0 }}
      >
        {/* TopBar — 메인페이지 헤더 언어 */}
        <header className="sticky top-0 z-20 shrink-0">
          {/* 4px 오렌지 상단 라인 */}
          <div className="h-1 bg-[#F97316]" />
          {/* 흰색 헤더 바 */}
          <div className="bg-white border-b border-[#F3F4F6] flex items-center h-[52px] px-4 gap-3">
            {/* 햄버거 */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex flex-col gap-[5px] p-2 rounded-[8px] hover:bg-[#F3F4F6] transition-colors"
              aria-label="메뉴 토글"
            >
              <span
                className={`block w-5 h-[2px] bg-[#374151] transition-all duration-200 origin-center ${
                  sidebarOpen ? 'rotate-45 translate-y-[7px]' : ''
                }`}
              />
              <span
                className={`block w-5 h-[2px] bg-[#374151] transition-all duration-200 ${
                  sidebarOpen ? 'opacity-0 scale-x-0' : ''
                }`}
              />
              <span
                className={`block w-5 h-[2px] bg-[#374151] transition-all duration-200 origin-center ${
                  sidebarOpen ? '-rotate-45 -translate-y-[7px]' : ''
                }`}
              />
            </button>

            {/* 브랜드 (사이드바 접힌 상태에서 표시) */}
            {!sidebarOpen && (
              <Link href="/admin" className="flex items-center gap-2 no-underline">
                <div className="w-7 h-7 bg-[#FFF7ED] rounded-[8px] flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-[14px] font-bold text-[#0F172A]">
                  해한<span className="text-[#F97316]">AI</span>
                </span>
              </Link>
            )}

            {/* 현재 섹션 이름 */}
            {sectionName && (
              <span className="text-[13px] font-medium text-[#374151]">{sectionName}</span>
            )}

            {/* 관리자 포털 뱃지 */}
            <span className="ml-auto text-[11px] font-semibold text-[#F97316] border border-[#FDBA74] bg-[#FFF7ED] rounded-full px-3 py-[3px]">
              관리자 포털
            </span>
          </div>
        </header>

        {/* 콘텐츠 */}
        <div className="flex-1 bg-[#F5F7FA]">
          {children}
        </div>
      </div>
    </div>
  )
}
