'use client'

import { useEffect, useRef, useState } from 'react'

export interface ConsentDocItem {
  id:         string
  docType:    string
  title:      string
  contentMd:  string
  isRequired: boolean
  scope:      string
  agreedAt:   string | null
}

interface DocumentConsentModalProps {
  /** 동의가 필요한 문서 목록 (미동의 + isRequired) */
  docs:       ConsentDocItem[]
  onAllDone:  (agreedDocIds: string[]) => void
  onClose?:   () => void
}

// 마크다운을 간단히 렌더링 (bold, heading, newline)
function renderMd(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<strong style="font-size:14px">$1</strong>')
    .replace(/^## (.+)$/gm,  '<strong style="font-size:15px">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />')
}

const DOC_TYPE_LABEL: Record<string, string> = {
  SAFETY_PLEDGE:    '안전교육 서약서',
  PRIVACY_CONSENT:  '개인정보 동의서',
  SITE_NOTICE:      '현장 유의사항',
  TBM_CONFIRMATION: 'TBM 확인서',
  LABOR_CONTRACT:   '근로계약서',
  GENERAL:          '공통 문서',
}

export default function DocumentConsentModal({
  docs,
  onAllDone,
  onClose,
}: DocumentConsentModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [agreedIds,  setAgreedIds]  = useState<string[]>([])
  const [agreeing,   setAgreeing]   = useState(false)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  // 근로계약서용 계약서 본문
  const [contractContent, setContractContent] = useState<string | null>(null)
  const [contractLoading, setContractLoading] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const pendingDocs = docs.filter(d => d.isRequired && !d.agreedAt)
  const total       = pendingDocs.length
  const doc         = pendingDocs[currentIdx] ?? null

  // 근로계약서일 때 내용 별도 로드
  useEffect(() => {
    if (!doc) return
    setScrolledToEnd(false)
    if (bodyRef.current) bodyRef.current.scrollTop = 0

    if (doc.docType === 'LABOR_CONTRACT') {
      setContractContent(null)
      setContractLoading(true)
      fetch('/api/worker/my-contract', { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.data?.contract?.sections) {
            const sections = d.data.contract.sections as { title: string; content: string }[]
            setContractContent(
              sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n')
            )
          } else {
            setContractContent('계약서 내용을 불러올 수 없습니다.')
          }
        })
        .catch(() => setContractContent('네트워크 오류가 발생했습니다.'))
        .finally(() => setContractLoading(false))
    }
  }, [currentIdx, doc?.id])

  const handleScroll = () => {
    const el = bodyRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setScrolledToEnd(true)
  }

  const handleAgree = async () => {
    if (!doc || agreeing) return
    setAgreeing(true)
    try {
      const res = await fetch('/api/worker/required-documents/agree', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: doc.id }),
      })
      const d = await res.json()
      if (!d.success) return
    } catch {
      // 실패해도 진행
    } finally {
      setAgreeing(false)
    }

    const newAgreed = [...agreedIds, doc.id]
    setAgreedIds(newAgreed)

    if (currentIdx + 1 < total) {
      setCurrentIdx(prev => prev + 1)
    } else {
      onAllDone(newAgreed)
    }
  }

  if (!doc) return null

  const content = doc.docType === 'LABOR_CONTRACT' ? contractContent ?? '' : doc.contentMd

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: '#fff' }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-brand shrink-0"
        style={{ background: '#fff' }}
      >
        <div>
          <div className="text-[17px] font-bold text-title-brand">
            {DOC_TYPE_LABEL[doc.docType] ?? doc.title}
          </div>
          <div className="text-[12px] text-muted-brand mt-[2px]">{doc.title}</div>
        </div>
        <div className="flex items-center gap-3">
          {/* 진행 표시 */}
          {total > 1 && (
            <div className="text-[12px] font-semibold text-muted-brand bg-footer px-3 py-1 rounded-full">
              {currentIdx + 1} / {total}
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-footer border-none cursor-pointer text-muted-brand text-[18px]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div
        ref={bodyRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-5"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {contractLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-[14px] text-muted-brand">계약서 불러오는 중...</div>
          </div>
        ) : (
          <>
            <div
              className="text-[14px] leading-[1.8] text-body-brand"
              dangerouslySetInnerHTML={{ __html: renderMd(content) }}
            />

            {/* 마지막 안내 박스 */}
            <div
              className="rounded-xl p-4 mt-6 mb-4"
              style={{ background: '#F8F9FA', border: '1px solid #E9ECEF' }}
            >
              <div className="text-[13px] text-muted-brand leading-[1.7]">
                위 내용을 충분히 읽었으며, 내용에 동의합니다.
              </div>
            </div>

            {!scrolledToEnd && (
              <div className="text-center py-3">
                <div className="text-[13px] text-muted2-brand animate-bounce">
                  아래로 스크롤하여 전체 내용을 확인하세요
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 하단 버튼 */}
      <div
        className="shrink-0 px-5 py-4 flex gap-3"
        style={{
          background:    '#fff',
          borderTop:     '1px solid #F3F4F6',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 py-[14px] rounded-xl border border-brand text-[15px] font-semibold text-muted-brand bg-transparent cursor-pointer"
          >
            나중에
          </button>
        )}
        <button
          onClick={handleAgree}
          disabled={agreeing}
          className="flex-[2] py-[14px] rounded-xl border-none text-[15px] font-bold text-white cursor-pointer"
          style={{
            background: agreeing ? '#9CA3AF' : '#2e7d32',
            boxShadow:  agreeing ? 'none' : '0 4px 12px rgba(46,125,50,0.25)',
          }}
        >
          {agreeing
            ? '저장 중...'
            : total > 1 && currentIdx + 1 < total
            ? `동의합니다 (${currentIdx + 1}/${total})`
            : '동의합니다'}
        </button>
      </div>
    </div>
  )
}
