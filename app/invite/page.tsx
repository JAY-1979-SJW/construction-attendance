import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://attendance.haehan-ai.kr'

export const metadata: Metadata = {
  title: '해한 현장 출퇴근 — 설치 안내',
  description: '앱 설치 없이 홈 화면에 추가하면 바로 사용할 수 있습니다. GPS 출퇴근, 서류 관리, 현장 관리를 모바일에서.',
  openGraph: {
    title: '해한 현장 출퇴근',
    description: '앱 설치 없이 바로 사용하는 건설현장 출퇴근 관리',
    url: `${BASE_URL}/invite`,
    siteName: '해한 현장 출퇴근',
    images: [{ url: `${BASE_URL}/icons/icon-512x512.png`, width: 512, height: 512 }],
    locale: 'ko_KR',
    type: 'website',
  },
}

export default function InvitePage() {
  return <InvitePageClient />
}

// 클라이언트 컴포넌트를 별도 파일 없이 인라인
import InvitePageClient from './client'
