'use client'

import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const ERROR_MSG: Record<string, string> = {
  no_email: '이메일 정보를 가져올 수 없습니다.',
  inactive: '비활성화된 계정입니다. 관리자에게 문의하세요.',
  server: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
}

function LoginContent() {
  const [loading, setLoading] = useState<string | null>(null)
  const params = useSearchParams()
  const error = params.get('error')

  const handleSignIn = (provider: string) => {
    setLoading(provider)
    signIn(provider, { callbackUrl: '/api/auth/complete' })
  }

  return (
    <div className="font-sans min-h-screen bg-[#F9FAFB] text-[#111827]">

      {/* 헤더 */}
      <header className="sticky top-0 z-50">
        <div className="h-1 bg-[#F97316]" />
        <div className="bg-white border-b border-[#F3F4F6]">
          <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between" style={{ height: '60px' }}>
            <Link href="/" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 bg-[#FFF7ED] rounded-[9px] flex items-center justify-center shrink-0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 22V12h6v10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[15px] font-bold text-[#0F172A]">해한AI 출퇴근</span>
            </Link>
            <nav className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#F97316] border border-[#FDBA74] bg-[#FFF7ED] rounded-[8px] px-4 py-[7px]">
                근로자 로그인
              </span>
              <Link href="/admin/login"
                className="text-[13px] font-semibold text-[#374151] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] rounded-[8px] px-4 py-[7px] no-underline transition-colors">
                관리자
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-[1100px] mx-auto px-6 py-16 flex items-start gap-16 flex-wrap lg:flex-nowrap">

        {/* 좌측 안내 */}
        <div className="flex-1 min-w-[260px] pt-4">
          <div className="inline-block bg-[#FFF7ED] text-[#F97316] text-[12px] font-semibold px-3 py-1 rounded-full mb-5 tracking-wide">
            근로자 전용
          </div>
          <h1 className="text-[32px] sm:text-[36px] font-bold text-[#0F172A] leading-[1.25] mb-5 tracking-[-0.3px]">
            QR 출퇴근을 위한<br/>근로자 로그인
          </h1>
          <p className="text-[15px] text-[#4B5563] leading-[1.85] mb-8">
            소셜 계정으로 간편하게 로그인하고<br/>현장 출퇴근을 시작하세요.
          </p>
          <ul className="space-y-3 m-0 p-0 list-none">
            <li className="flex items-center gap-2.5 text-[14px] text-[#374151]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F97316] shrink-0" />
              QR 코드 스캔으로 간편 출퇴근
            </li>
            <li className="flex items-center gap-2.5 text-[14px] text-[#374151]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F97316] shrink-0" />
              내 출근 기록 실시간 확인
            </li>
            <li className="flex items-center gap-2.5 text-[14px] text-[#374151]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F97316] shrink-0" />
              현장 참여 신청 및 승인 처리
            </li>
          </ul>
        </div>

        {/* 우측 로그인 카드 */}
        <div className="w-full lg:w-[440px] shrink-0">
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-8 py-9">
            <h2 className="text-[20px] font-semibold text-[#111827] mb-1.5 leading-snug">
              소셜 로그인
            </h2>
            <p className="text-[13px] text-[#6B7280] mb-7">
              사용 중인 소셜 계정을 선택하세요.
            </p>

            {error && (
              <div className="mb-5 rounded-[10px] px-4 py-3 text-[13px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA]">
                {ERROR_MSG[error] ?? '로그인 중 오류가 발생했습니다.'}
              </div>
            )}

            <div className="space-y-3">
              {/* 구글 */}
              <button
                onClick={() => handleSignIn('google')}
                disabled={!!loading}
                className="w-full h-12 rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-3 transition-all border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-60 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              >
                {loading === 'google'
                  ? <span className="w-5 h-5 border-2 border-[#E5E7EB] border-t-[#6B7280] rounded-full animate-spin" />
                  : <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                }
                Google로 로그인
              </button>

              {/* 카카오 */}
              <button
                onClick={() => handleSignIn('kakao')}
                disabled={!!loading}
                className="w-full h-12 rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-3 transition-all disabled:opacity-60"
                style={{ background: '#FEE500', color: '#191919' }}
              >
                {loading === 'kakao'
                  ? <span className="w-5 h-5 border-2 border-yellow-400 border-t-yellow-700 rounded-full animate-spin" />
                  : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#191919">
                      <path d="M12 3C6.48 3 2 6.73 2 11.35c0 2.99 1.87 5.62 4.69 7.13l-1.2 4.41 5.13-3.4c.45.06.91.09 1.38.09 5.52 0 10-3.73 10-8.32C22 6.73 17.52 3 12 3z"/>
                    </svg>
                }
                카카오로 로그인
              </button>
            </div>

            <p className="text-center text-[11px] text-[#9CA3AF] mt-6">
              위치 정보는 출퇴근 판정에만 사용됩니다
            </p>

            <div className="mt-6 flex flex-col items-center gap-2 text-[13px] text-[#6B7280]">
              <Link href="/" className="hover:text-[#F97316] transition-colors py-1">
                메인으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
