'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

interface Props {
  /** 'login' | 'register' — register면 auth_intent=register 쿠키를 먼저 설정한다 */
  mode: 'login' | 'register'
}

/**
 * 카카오 소셜 로그인/가입 버튼 섹션.
 * REST API Key 기반 NextAuth Kakao 프로바이더 사용.
 * Kakao Developers에 등록된 Redirect URI:
 *   https://attendance.haehan-ai.kr/api/auth/callback/kakao
 */
export function KakaoSocialSection({ mode }: Props) {
  const [loading, setLoading] = useState(false)

  const handleKakao = async () => {
    setLoading(true)
    try {
      if (mode === 'register') {
        // 신규 가입 의도를 complete 핸들러에 전달
        document.cookie = 'auth_intent=register; path=/; max-age=300; SameSite=Lax'
      }
      await signIn('kakao')
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-brand" />
        <span className="text-[12px] text-muted2-brand shrink-0">또는</span>
        <div className="flex-1 h-px bg-brand" />
      </div>

      <button
        type="button"
        onClick={handleKakao}
        disabled={loading}
        data-testid="kakao-login-btn"
        className="w-full h-12 flex items-center justify-center gap-2 rounded-[12px] font-semibold text-[15px] text-[#191600] bg-[#FEE500] hover:bg-[#F0D900] active:bg-[#E0CA00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer"
      >
        {/* Kakao 말풍선 아이콘 */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2C5.582 2 2 4.925 2 8.5c0 2.278 1.407 4.277 3.54 5.48L4.75 17l3.82-2.35A9.5 9.5 0 0010 14.999c4.418 0 8-2.924 8-6.5S14.418 2 10 2z"
            fill="#191600"
          />
        </svg>
        {loading ? '카카오 연결 중...' : mode === 'register' ? '카카오로 가입하기' : '카카오로 로그인'}
      </button>
    </div>
  )
}
