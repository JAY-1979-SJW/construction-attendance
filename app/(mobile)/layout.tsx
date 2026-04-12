'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import DocumentConsentModal, {
  type ConsentDocItem,
} from '@/components/worker/DocumentConsentModal'

/**
 * 모바일 앱 공통 레이아웃
 *
 * - 페이지 진입 / 경로 변경 시 /api/worker/required-documents 를 폴링
 * - 미동의 필수 문서가 있으면 DocumentConsentModal을 전체화면으로 표시
 * - 모두 동의 후 자동으로 닫힘
 */
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [pendingDocs, setPendingDocs] = useState<ConsentDocItem[]>([])
  const [showModal,   setShowModal]   = useState(false)
  const [dismissed,   setDismissed]   = useState(false)   // 이 세션에서 "나중에" 클릭 시
  const [loaded,      setLoaded]      = useState(false)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/worker/required-documents', { credentials: 'include' })
      if (!res.ok) return
      const d = await res.json()
      if (!d.success) return
      const docs: ConsentDocItem[] = d.data.docs
      const pending = docs.filter((doc: ConsentDocItem) => doc.isRequired && !doc.agreedAt)
      setPendingDocs(pending)
      if (pending.length > 0 && !dismissed) {
        setShowModal(true)
      }
    } catch {
      // 인증 없는 페이지(onboarding 등)에서는 무시
    } finally {
      setLoaded(true)
    }
  }, [dismissed])

  // pathname 변경마다 재조회 (로그인 후 리다이렉트 포함)
  useEffect(() => {
    // onboarding 경로에서는 팝업 불필요
    if (pathname.startsWith('/onboarding') || pathname.startsWith('/qr')) return
    fetchDocs()
  }, [pathname, fetchDocs])

  const handleAllDone = (agreedDocIds: string[]) => {
    // 동의한 문서를 pendingDocs에서 제거
    setPendingDocs(prev => prev.filter(d => !agreedDocIds.includes(d.id)))
    setShowModal(false)
  }

  const handleClose = () => {
    setDismissed(true)
    setShowModal(false)
  }

  return (
    <>
      {children}
      {showModal && pendingDocs.length > 0 && (
        <DocumentConsentModal
          docs={pendingDocs}
          onAllDone={handleAllDone}
          onClose={handleClose}
        />
      )}
    </>
  )
}
