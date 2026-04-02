'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AdminSidebar from './AdminSidebar'
import BusinessFooter from '@/components/BusinessFooter'

// 사이드바 폭과 동기화
const SIDEBAR_WIDTH = 220

// 경로 → 상단 섹션 이름 매핑
// 숨긴 라우트도 포함(직접 접근 시 이름 표시 유지)
const SECTION_MAP: Record<string, string> = {
  '/admin':                          '대시보드',
  // 승인
  '/admin/registrations':            '승인',
  '/admin/approvals':                '승인',
  '/admin/company-admin-requests':   '승인',
  '/admin/company-admins':           '승인',
  '/admin/site-join-requests':       '승인',
  '/admin/device-requests':          '승인',
  // 출퇴근
  '/admin/attendance':               '출퇴근',
  '/admin/presence-checks':          '출퇴근',
  '/admin/exceptions':               '출퇴근',
  '/admin/work-confirmations':       '출퇴근',
  '/admin/corrections':              '출퇴근',
  '/admin/presence-report':          '출퇴근',
  // 근로자
  '/admin/workers':                  '근로자관리',
  '/admin/companies':                '근로자관리',
  // 현장
  '/admin/sites':                    '현장',
  '/admin/site-access-groups':       '현장',
  '/admin/site-admin-assignments':   '현장',
  '/admin/site-imports':             '현장',
  '/admin/site-locations':           '현장',
  // 서류
  '/admin/contracts':                '서류',
  '/admin/safety-docs':              '서류',
  // 노무
  '/admin/labor':                    '노무',
  '/admin/labor-faqs':               '노무',
  '/admin/labor-cost-summaries':     '노무',
  // 보험/정산
  '/admin/wage':                     '보험/정산',
  '/admin/wage-calculations':        '보험/정산',
  '/admin/month-closings':           '보험/정산',
  '/admin/insurance-eligibility':    '보험/정산',
  '/admin/insurance-rates':          '보험/정산',
  '/admin/retirement-mutual':        '보험/정산',
  '/admin/subcontractor-settlements':'보험/정산',
  // 자재
  '/admin/materials':                '자재',
  // 운영
  '/admin/reports':                  '운영',
  '/admin/operations/print-center':  '운영',
  '/admin/operations/today-tasks':   '운영',
  '/admin/operations/attendance-exceptions': '운영',
  '/admin/operations/labor-review':  '운영',
  // 시스템
  '/admin/settings':                 '시스템',
  '/admin/document-center':          '시스템',
  '/admin/audit-logs':               '시스템',
  '/admin/super-users':              '시스템',
  '/admin/policies':                 '시스템',
  '/admin/devices':                  '시스템',
  '/admin/devices-anomaly':          '시스템',
  '/admin/pilot':                    '시스템',
  '/admin/temp-docs':                '시스템',
}

function getSectionName(pathname: string): string {
  if (pathname === '/admin') return '대시보드'
  // 정확히 일치하는 경로 우선
  if (SECTION_MAP[pathname]) return SECTION_MAP[pathname]
  // 접두사 매핑 (가장 긴 일치 우선)
  const match = Object.entries(SECTION_MAP)
    .filter(([k]) => k !== '/admin' && pathname.startsWith(k + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0]
  return match ? match[1] : ''
}

// 경로 → 페이지 타이틀 (전체 admin 페이지 커버)
const PAGE_TITLE_MAP: Record<string, string> = {
  '/admin':                                    '운영 대시보드',
  '/admin/attendance':                         '출퇴근관리',
  '/admin/presence-checks':                    '중간 체류확인',
  '/admin/exceptions':                         '예외 승인',
  '/admin/work-confirmations':                 '근무확정',
  '/admin/corrections':                        '정정 이력',
  '/admin/workers':                            '근로자관리',
  '/admin/companies':                          '회사관리',
  '/admin/registrations':                      '회원가입 승인',
  '/admin/approvals':                          '승인 관리',
  '/admin/device-requests':                    '기기 등록 신청',
  '/admin/company-admin-requests':             '업체관리자 신청',
  '/admin/company-admins':                     '업체관리자',
  '/admin/sites':                              '현장관리',
  '/admin/site-access-groups':                 '현장 접근 그룹',
  '/admin/site-admin-assignments':             '현장관리자 배치',
  '/admin/site-imports':                       '현장 Import',
  '/admin/site-join-requests':                 '현장 참여 신청',
  '/admin/site-locations':                     '현장 위치 마스터',
  '/admin/settings':                           '시스템 설정',
  '/admin/audit-logs':                         '감사 로그',
  '/admin/super-users':                        '관리자 계정',
  '/admin/policies':                           '정책 관리',
  '/admin/contracts':                          '근로계약서',
  '/admin/safety-docs':                       '안전서류 관리',
  '/admin/wage-calculations':                  '급여 계산',
  '/admin/month-closings':                     '월 마감',
  '/admin/wage':                               '노임관리',
  '/admin/labor':                              '노무관리',
  '/admin/labor-faqs':                         '노무 FAQ',
  '/admin/insurance-eligibility':              '보험 자격 판정',
  '/admin/insurance-rates':                    '보험요율 관리',
  '/admin/subcontractor-settlements':          '협력사 정산',
  '/admin/retirement-mutual':                  '퇴직공제',
  '/admin/materials':                          '내역서 분석',
  '/admin/materials/requests':                 '자재 청구',
  '/admin/materials/purchase-orders':          '발주 관리',
  '/admin/materials/inventory':                '자재 재고',
  '/admin/document-center':                    '문서 센터',
  '/admin/operations/print-center':            '출력 센터',
  '/admin/operations/today-tasks':             '오늘 업무',
  '/admin/operations/attendance-exceptions':   '출퇴근 이상 센터',
  '/admin/operations/labor-review':            '노무 검토',
  '/admin/operations-dashboard':               '운영 대시보드',
  '/admin/pilot':                              '파일럿 모니터',
  '/admin/devices':                            '기기 관리',
  '/admin/devices-anomaly':                    '기기 이상 탐지',
  '/admin/presence-report':                    '체류 리포트',
  '/admin/labor-cost-summaries':               '노무비 집계',
  '/admin/temp-docs':                          '임시 문서',
  '/admin/reports':                            '작업일보 관리',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLE_MAP[pathname]) return PAGE_TITLE_MAP[pathname]
  // 동적 라우트: 상위 경로 순서대로 탐색
  const segments = pathname.split('/')
  while (segments.length > 2) {
    segments.pop()
    const parent = segments.join('/')
    if (PAGE_TITLE_MAP[parent]) return PAGE_TITLE_MAP[parent]
  }
  return ''
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

  const sectionName = getSectionName(pathname)
  const pageTitle = getPageTitle(pathname)

  return (
    <div className="flex min-h-screen bg-brand">
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
        className="flex-1 h-screen flex flex-col overflow-hidden transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? SIDEBAR_WIDTH : 0 }}
      >
        {/* TopBar */}
        <header className="shrink-0 z-20">
          {/* 4px 오렌지 상단 라인 */}
          <div className="h-1 bg-brand-accent" />
          {/* 헤더 바 */}
          <div
            className="bg-card flex items-center h-[52px] px-4 gap-3"
            style={{ borderBottom: '1px solid #F3F4F6' }}
          >
            {/* 햄버거 */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex flex-col gap-[5px] p-2 rounded-[8px] hover:bg-footer transition-colors shrink-0"
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
              <Link href="/admin" className="flex items-center gap-2 no-underline shrink-0">
                <div className="w-7 h-7 bg-accent-light rounded-[8px] flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-[14px] font-bold text-title-brand">
                  해한<span className="text-accent">AI</span>
                </span>
              </Link>
            )}

            {/* 현재 섹션명 */}
            {sectionName && (
              <span className="text-[13px] font-medium text-body-brand">{sectionName}</span>
            )}

            {/* 관리자 포털 뱃지 */}
            <span className="ml-auto text-[11px] font-semibold text-accent border border-accent-pale bg-accent-light rounded-full px-3 py-[3px] shrink-0">
              관리자 포털
            </span>
          </div>
        </header>

        {/* 페이지 타이틀 — shrink-0, 스크롤 영역 밖 (절대 고정) */}
        {pageTitle && (
          <div className="shrink-0 bg-brand px-5 md:px-6 pt-4 pb-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
            <h1 className="text-[18px] font-bold text-title-brand">{pageTitle}</h1>
          </div>
        )}

        {/* 콘텐츠 (독립 스크롤) */}
        <div className="flex-1 overflow-auto bg-brand">
          {children}
          <BusinessFooter />
        </div>
      </div>
    </div>
  )
}
