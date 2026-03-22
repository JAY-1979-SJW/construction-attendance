import type { Metadata, Viewport } from 'next'
import Script from 'next/script'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? '해한 현장 출퇴근'

export const metadata: Metadata = {
  title: APP_NAME,
  description: '건설현장 QR 출퇴근 관리 시스템',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-152x152.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1565c0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f5f5' }}>
        {children}
        {/* Service Worker 등록 */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .catch(function(err) { console.warn('[SW] 등록 실패', err); });
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}
