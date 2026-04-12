'use client'

import { useEffect, useRef, useState } from 'react'

interface ContractSection {
  title:   string
  content: string
}

interface ContractInfo {
  id:             string
  contractStatus: string
  title:          string
  companyName:    string
  workerName:     string
  siteName:       string | null
  startDate:      string
  endDate:        string | null
  sections:       ContractSection[]
  generatedAt:    string | null
}

interface LaborContractModalProps {
  onClose:  () => void
  onAgreed: (agreedAt: string) => void
  agreedAt: string | null
}

export default function LaborContractModal({
  onClose,
  onAgreed,
  agreedAt,
}: LaborContractModalProps) {
  const [contract, setContract] = useState<ContractInfo | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [agreeing, setAgreeing] = useState(false)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/worker/my-contract', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.contract) {
          setContract(d.data.contract)
        } else {
          setError('계약서 정보를 불러올 수 없습니다.')
        }
      })
      .catch(() => setError('네트워크 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  // 스크롤 끝까지 내렸는지 감지
  const handleScroll = () => {
    const el = bodyRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (near) setScrolledToEnd(true)
  }

  const handleAgree = async () => {
    if (agreeing) return
    setAgreeing(true)
    try {
      const res = await fetch('/api/worker/my-contract/agree', {
        method: 'POST',
        credentials: 'include',
      })
      const d = await res.json()
      if (d.success) {
        onAgreed(d.data.agreedAt)
      }
    } catch {
      // 실패해도 닫기는 허용
    } finally {
      setAgreeing(false)
    }
  }

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
          <div className="text-[17px] font-bold text-title-brand">근로계약서</div>
          {contract && (
            <div className="text-[12px] text-muted-brand mt-[2px]">
              {contract.companyName} · {contract.workerName}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-footer border-none cursor-pointer text-muted-brand text-[18px]"
        >
          ✕
        </button>
      </div>

      {/* 동의 완료 배너 */}
      {agreedAt && (
        <div className="px-5 py-3 bg-green-light border-b border-green shrink-0">
          <div className="text-[13px] text-status-working font-medium">
            동의 완료 — {new Date(agreedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {/* 본문 */}
      <div
        ref={bodyRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-5"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="text-[14px] text-muted-brand">계약서 불러오는 중...</div>
          </div>
        )}
        {error && (
          <div className="text-center py-16">
            <div className="text-[14px] text-status-rejected mb-4">{error}</div>
            <div className="text-[13px] text-muted-brand">관리자에게 문의하세요.</div>
          </div>
        )}
        {!loading && !error && !contract && (
          <div className="text-center py-16">
            <div className="text-[14px] text-muted-brand mb-2">등록된 근로계약서가 없습니다.</div>
            <div className="text-[13px] text-muted2-brand">관리자가 계약서를 등록하면 여기서 확인할 수 있습니다.</div>
          </div>
        )}
        {!loading && contract && (
          <>
            {/* 계약서 타이틀 */}
            <div className="text-center mb-6">
              <div className="text-[20px] font-bold text-title-brand mb-1">{contract.title}</div>
              <div className="text-[13px] text-muted-brand">
                {contract.startDate}
                {contract.endDate ? ` ~ ${contract.endDate}` : ' ~'}
              </div>
              {contract.siteName && (
                <div className="text-[13px] text-muted-brand mt-1">현장: {contract.siteName}</div>
              )}
            </div>

            {/* 계약서 섹션들 */}
            {contract.sections.map((section, i) => (
              <div
                key={i}
                className="mb-6 pb-6"
                style={{ borderBottom: i < contract.sections.length - 1 ? '1px solid #F3F4F6' : 'none' }}
              >
                <div className="text-[15px] font-bold text-title-brand mb-3">{section.title}</div>
                <div
                  className="text-[14px] leading-[1.8] text-body-brand whitespace-pre-wrap"
                >
                  {section.content}
                </div>
              </div>
            ))}

            {/* 마지막 안내 */}
            <div
              className="rounded-xl p-4 mt-2 mb-4"
              style={{ background: '#F8F9FA', border: '1px solid #E9ECEF' }}
            >
              <div className="text-[13px] text-muted-brand leading-[1.7]">
                위 근로계약서의 내용을 충분히 읽었으며, 계약 내용에 동의합니다.<br />
                근로기준법 제17조에 따라 서면으로 교부받을 권리가 있습니다.
              </div>
            </div>

            {/* 스크롤 유도 안내 */}
            {!scrolledToEnd && (
              <div className="text-center py-3">
                <div className="text-[13px] text-muted2-brand animate-bounce">아래로 스크롤하여 전체 내용을 확인하세요</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 하단 버튼 */}
      {!loading && (
        <div
          className="shrink-0 px-5 py-4 flex gap-3"
          style={{ background: '#fff', borderTop: '1px solid #F3F4F6', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-[14px] rounded-xl border border-brand text-[15px] font-semibold text-muted-brand bg-transparent cursor-pointer"
          >
            닫기
          </button>
          {contract && !agreedAt && (
            <button
              onClick={handleAgree}
              disabled={agreeing}
              className="flex-[2] py-[14px] rounded-xl border-none text-[15px] font-bold text-white cursor-pointer"
              style={{
                background: agreeing ? '#9CA3AF' : '#2e7d32',
                boxShadow: agreeing ? 'none' : '0 4px 12px rgba(46,125,50,0.25)',
              }}
            >
              {agreeing ? '저장 중...' : '동의합니다'}
            </button>
          )}
          {agreedAt && (
            <button
              disabled
              className="flex-[2] py-[14px] rounded-xl border-none text-[15px] font-bold text-white cursor-default"
              style={{ background: '#4CAF50' }}
            >
              동의 완료
            </button>
          )}
        </div>
      )}
    </div>
  )
}
