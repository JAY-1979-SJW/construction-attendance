import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  other: { 'X-Robots-Tag': 'noindex, nofollow' },
}

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
