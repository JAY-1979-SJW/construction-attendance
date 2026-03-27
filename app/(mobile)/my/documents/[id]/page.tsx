'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

const DOC_TYPE_LABELS: Record<string, string> = {
  SAFETY_EDUCATION_NEW_HIRE: '신규채용 안전교육',
  SAFETY_EDUCATION_TASK_CHANGE: '작업변경 교육',
  PPE_PROVISION: '보호구 지급',
  SAFETY_PLEDGE: '안전수칙 서약',
  WORK_CONDITIONS_RECEIPT: '근로조건 수령확인',
  PRIVACY_CONSENT: '개인정보 동의',
  BASIC_SAFETY_EDU_CONFIRM: '기초안전교육 확인',
  SITE_SAFETY_RULES_CONFIRM: '현장 안전수칙 확인',
  HEALTH_DECLARATION: '건강 이상 없음 각서',
  HEALTH_CERTIFICATE: '건강 증명서',
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  DRAFT: { text: '작성 필요', color: 'bg-gray-100 text-gray-700' },
  ISSUED: { text: '확인 요청', color: 'bg-blue-100 text-blue-700' },
  SIGNED: { text: '검토중', color: 'bg-blue-100 text-blue-700' },
  REVIEW_REQUESTED: { text: '검토중', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { text: '승인 완료', color: 'bg-green-100 text-green-700' },
  REJECTED: { text: '반려 / 보완 필요', color: 'bg-red-100 text-red-700' },
}

interface DocDetail {
  id: string
  documentType: string
  status: string
  documentDate: string | null
  educationDate: string | null
  educationPlace: string | null
  educatorName: string | null
  educationHours: string | null
  signedAt: string | null
  signedBy: string | null
  rejectReason: string | null
  contentText: string | null
  worker: { id: string; name: string }
  site: { id: string; name: string } | null
  createdAt: string
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [doc, setDoc] = useState<DocDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signing, setSigning] = useState(false)
  const [showSignConfirm, setShowSignConfirm] = useState(false)

  const loadDoc = () => {
    fetch(`/api/worker/documents/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setDoc(res.data)
        else setError(res.message || '문서를 불러올 수 없습니다.')
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDoc() }, [id]) // eslint-disable-line

  const handleSign = async () => {
    setSigning(true)
    try {
      const res = await fetch(`/api/worker/documents/${id}/sign`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setShowSignConfirm(false)
        loadDoc()
      } else {
        alert(data.message || '서명 실패')
      }
    } catch (e) {
      alert('네트워크 오류')
    } finally {
      setSigning(false)
    }
  }

  const handleDownload = () => {
    window.open(`/api/worker/documents/${id}/download`, '_blank')
  }

  const status = doc ? STATUS_LABELS[doc.status] ?? { text: doc.status, color: 'bg-gray-100 text-gray-600' } : null

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <WorkerTopBar />

      <main className="flex-1 pb-20 pt-14">
        {/* 뒤로가기 */}
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 bg-transparent border-none cursor-pointer flex items-center gap-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            돌아가기
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : error ? (
          <div className="px-4 py-10 text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={() => router.push('/my/documents')}
              className="mt-4 text-sm text-blue-600 bg-transparent border-none cursor-pointer"
            >
              목록으로 돌아가기
            </button>
          </div>
        ) : doc ? (<>
          <div className="px-4 space-y-4">
            {/* 헤더 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-[16px] font-bold text-[#0F172A] m-0">
                  {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                </h1>
                {status && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.color}`}>
                    {status.text}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-[13px]">
                <div className="flex">
                  <span className="text-gray-400 w-20 shrink-0">현장</span>
                  <span className="text-gray-700">{doc.site?.name ?? '-'}</span>
                </div>
                <div className="flex">
                  <span className="text-gray-400 w-20 shrink-0">작성일</span>
                  <span className="text-gray-700">{doc.documentDate ?? '-'}</span>
                </div>
                {doc.educationDate && (
                  <div className="flex">
                    <span className="text-gray-400 w-20 shrink-0">교육일</span>
                    <span className="text-gray-700">{doc.educationDate}</span>
                  </div>
                )}
                {doc.educationPlace && (
                  <div className="flex">
                    <span className="text-gray-400 w-20 shrink-0">교육장소</span>
                    <span className="text-gray-700">{doc.educationPlace}</span>
                  </div>
                )}
                {doc.educatorName && (
                  <div className="flex">
                    <span className="text-gray-400 w-20 shrink-0">담당자</span>
                    <span className="text-gray-700">{doc.educatorName}</span>
                  </div>
                )}
                {doc.signedAt && (
                  <div className="flex">
                    <span className="text-gray-400 w-20 shrink-0">서명일시</span>
                    <span className="text-gray-700">{new Date(doc.signedAt).toLocaleString('ko-KR')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 문서 내용 */}
            {doc.contentText && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="text-[14px] font-semibold text-[#374151] m-0">문서 내용</h2>
                </div>
                <div className="p-4 max-h-[400px] overflow-y-auto">
                  <pre className="text-[12px] text-gray-600 whitespace-pre-wrap m-0 font-[inherit] leading-relaxed">
                    {doc.contentText}
                  </pre>
                </div>
              </div>
            )}

            {/* 반려 사유 표시 */}
            {doc.status === 'REJECTED' && doc.rejectReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="text-[13px] font-bold text-red-700 mb-1">반려 사유</div>
                <div className="text-[13px] text-red-600">{doc.rejectReason}</div>
              </div>
            )}

            {/* 서명 버튼 (초안/발행/반려 상태에서만) */}
            {(doc.status === 'DRAFT' || doc.status === 'ISSUED' || doc.status === 'REJECTED') && (
              <button
                onClick={() => setShowSignConfirm(true)}
                className="w-full py-3.5 bg-[#16A34A] text-white text-[15px] font-bold rounded-xl border-none cursor-pointer active:bg-[#15803D] transition-colors flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                내용 확인 후 서명하기
              </button>
            )}

            {/* 서명/승인 완료 안내 */}
            {(doc.status === 'REVIEW_REQUESTED' || doc.status === 'SIGNED') && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <div className="text-[15px] font-bold text-blue-700 mb-1">검토 중</div>
                <div className="text-[13px] text-blue-600">관리자가 서류를 검토하고 있습니다.</div>
              </div>
            )}
            {doc.status === 'APPROVED' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-[15px] font-bold text-green-700 mb-1">서명 완료</div>
                <div className="text-[13px] text-green-600">
                  {doc.signedAt ? new Date(doc.signedAt).toLocaleString('ko-KR') : ''} {doc.signedBy ? `(${doc.signedBy})` : ''}
                </div>
              </div>
            )}

            {/* 다운로드 버튼 */}
            <button
              onClick={handleDownload}
              className="w-full py-3 bg-[#F97316] text-white text-[14px] font-semibold rounded-xl border-none cursor-pointer active:bg-[#EA580C] transition-colors flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              문서 다운로드
            </button>
          </div>

          {/* 서명 확인 모달 */}
          {showSignConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
              <div className="bg-white w-full max-w-md rounded-t-2xl p-6 pb-8">
                <h3 className="text-[16px] font-bold text-[#0F172A] m-0 mb-3">서명 확인</h3>
                <p className="text-[13px] text-gray-600 mb-1">
                  <strong>{DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}</strong> 문서의 내용을 확인했으며, 이에 동의하여 서명합니다.
                </p>
                <p className="text-[12px] text-gray-400 mb-5">
                  서명 후에는 취소할 수 없습니다.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSignConfirm(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 text-[14px] font-semibold rounded-xl border-none cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSign}
                    disabled={signing}
                    className="flex-1 py-3 bg-[#16A34A] text-white text-[14px] font-bold rounded-xl border-none cursor-pointer disabled:opacity-50"
                  >
                    {signing ? '서명 중...' : '서명하기'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
        ) : null}
      </main>

      <WorkerBottomNav />
    </div>
  )
}
