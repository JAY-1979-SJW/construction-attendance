'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.message ?? '이메일 또는 비밀번호를 확인해주세요.')
        return
      }
      router.push(data.portal ?? '/admin')
    } catch {
      setError('로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="font-sans min-h-screen bg-[#F9FAFB] text-[#111827]">

      {/* ── 헤더 (메인과 동일) ───────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div className="h-1 bg-[#F97316]" />
        <div className="bg-white border-b border-[#F3F4F6]">
          <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between" style={{ height: '60px' }}>
            {/* 로고 */}
            <Link href="/" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 bg-[#FFF7ED] rounded-[9px] flex items-center justify-center shrink-0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[15px] font-bold text-[#0F172A]">해한AI 출퇴근</span>
            </Link>

            {/* 네비게이션 */}
            <nav className="flex items-center gap-2">
              <Link href="/#features" className="hidden sm:block text-[13px] text-[#6B7280] hover:text-[#111827] transition-colors px-3 py-1.5 no-underline">
                기능 소개
              </Link>
              {/* 현재 페이지 — 활성 표시 */}
              <span className="text-[13px] font-semibold text-[#F97316] border border-[#FDBA74] bg-[#FFF7ED] rounded-[8px] px-4 py-[7px]">
                관리자 로그인
              </span>
              <Link href="/login"
                className="text-[13px] font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] rounded-[8px] px-4 py-2 no-underline transition-colors">
                근로자 시작하기
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ── 본문: 2단 레이아웃 ──────────────────────────────── */}
      <main className="max-w-[1100px] mx-auto px-6 py-16 flex items-start gap-16 flex-wrap lg:flex-nowrap">

        {/* 좌측: 안내 영역 */}
        <div className="flex-1 min-w-[260px] pt-4">
          <div className="inline-block bg-[#FFF7ED] text-[#F97316] text-[12px] font-semibold px-3 py-1 rounded-full mb-5 tracking-wide">
            관리자 포털
          </div>
          <h1 className="text-[32px] sm:text-[36px] font-bold text-[#0F172A] leading-[1.25] mb-5 tracking-[-0.3px]">
            현장 운영을 위한<br />관리자 전용 로그인
          </h1>
          <p className="text-[15px] text-[#4B5563] leading-[1.85] mb-8">
            오늘 출근 현황, 근로자 승인, 현장 관리를<br />
            한곳에서 확인할 수 있습니다.
          </p>

          {/* 기능 요약 (선택적 보조 정보) */}
          <ul className="space-y-3 m-0 p-0 list-none">
            {[
              '오늘 현장별 출근 인원 확인',
              '근로자 및 기기 승인 처리',
              '미퇴근 누락 즉시 파악',
            ].map(item => (
              <li key={item} className="flex items-center gap-2.5 text-[14px] text-[#374151]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F97316] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 우측: 로그인 카드 */}
        <div className="w-full lg:w-[440px] shrink-0">
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-8 py-9">

            {/* 카드 제목 */}
            <h2 className="text-[20px] font-semibold text-[#111827] mb-1.5 leading-snug">
              관리자 로그인
            </h2>
            <p className="text-[13px] text-[#6B7280] mb-7">
              관리자 계정으로 로그인하세요.
            </p>

            {/* 오류 메시지 */}
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-[10px] px-4 py-3 text-red-600 text-[13px] leading-relaxed mb-5">
                {error}
              </div>
            )}

            {/* 이메일 */}
            <div className="mb-4">
              <label htmlFor="admin-email" className="block text-[13px] font-semibold text-[#374151] mb-[6px]">
                이메일
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="admin@company.com"
                className="w-full h-12 px-4 text-[15px] text-[#111827] bg-white border border-[#E5E7EB] rounded-[10px] outline-none placeholder:text-[#9CA3AF] focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.12)] transition-colors"
              />
            </div>

            {/* 비밀번호 */}
            <div className="mb-6">
              <label htmlFor="admin-password" className="block text-[13px] font-semibold text-[#374151] mb-[6px]">
                비밀번호
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
                placeholder="비밀번호 입력"
                className="w-full h-12 px-4 text-[15px] text-[#111827] bg-white border border-[#E5E7EB] rounded-[10px] outline-none placeholder:text-[#9CA3AF] focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.12)] transition-colors"
              />
            </div>

            {/* 로그인 버튼 */}
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-12 text-[15px] font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] active:bg-[#C2410C] rounded-[12px] transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>

            {/* 보조 링크 */}
            <div className="mt-6 flex flex-col items-center gap-2.5 text-[13px] text-[#6B7280]">
              <a href="/login" className="hover:text-[#F97316] transition-colors py-1">
                근로자 로그인으로 이동
              </a>
              <a href="/" className="hover:text-[#F97316] transition-colors py-1">
                메인으로 돌아가기
              </a>
            </div>

          </div>
        </div>
      </main>

    </div>
  )
}
