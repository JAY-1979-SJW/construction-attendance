import type { Metadata } from 'next'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? '해한 현장 출퇴근'

export const metadata: Metadata = {
  title: APP_NAME,
  description: '건설현장 QR 출퇴근 관리 시스템',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  )
}
