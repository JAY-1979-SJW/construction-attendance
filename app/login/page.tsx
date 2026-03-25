'use client'

import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { AuthCard, AuthBrand, AuthTitle, AuthError, AuthFooter } from '@/components/auth/AuthCard'

const ERROR_MSG: Record<string, string> = {
  no_email: '이메일 정보를 가져올 수 없습니다.',
  inactive: '비활성화된 계정입니다. 관리자에게 문의하세요.',
  server: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
}

function LoginContent() {
  const [loading, setLoading] = useState<string | null>(null)
  const params = useSearchParams()
  const errorKey = params.get('error') ?? ''

  const handleSignIn = (provider: string) => {
    setLoading(provider)
    signIn(provider, { callbackUrl: '/api/auth/complete' })
  }

  return (
    <AuthPageShell>
      <AuthCard>
        <AuthBrand />
        <AuthTitle
          title="근로자 로그인"
          description="Google 또는 카카오 계정으로 로그인 후 출퇴근을 진행합니다."
        />

        <AuthError message={ERROR_MSG[errorKey] ?? (errorKey ? '로그인 중 오류가 발생했습니다.' : '')} />

        <div className="space-y-3">
          {/* Google */}
          <button
            onClick={() => handleSignIn('google')}
            disabled={!!loading}
            className="w-full h-12 rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-3 transition-all border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-60 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            {loading === 'google'
              ? <span className="w-5 h-5 border-2 border-[#E5E7EB] border-t-[#6B7280] rounded-full animate-spin" />
              : <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
              : <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#191919">
                  <path d="M12 3C6.48 3 2 6.73 2 11.35c0 2.99 1.87 5.62 4.69 7.13l-1.2 4.41 5.13-3.4c.45.06.91.09 1.38.09 5.52 0 10-3.73 10-8.32C22 6.73 17.52 3 12 3z"/>
                </svg>
            }
            카카오로 로그인
          </button>
        </div>

        <p className="text-center text-[11px] text-[#9CA3AF] mt-5">
          위치 정보는 출퇴근 판정에만 사용됩니다
        </p>

        <AuthFooter links={[
          { label: '메인으로 돌아가기', href: '/' },
          { label: '관리자 로그인', href: '/admin/login' },
        ]} />
      </AuthCard>
    </AuthPageShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
