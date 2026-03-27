'use client'

import { useState, useEffect, useRef } from 'react'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

interface DocItem {
  id: string
  docType: string
  status: string
  label: string
  title: string | null
  rejectionReason: string | null
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  expiresAt: string | null
  versionNo: number
}

interface PackageInfo {
  id: string
  overallStatus: string
  requiredDocCount: number
  approvedDocCount: number
  rejectedDocCount: number
  pendingDocCount: number
  missingDocCount: number
  expiredDocCount: number
  site: { id: string; name: string } | null
}

const OVERALL_STATUS: Record<string, { text: string; bg: string; color: string }> = {
  NOT_READY: { text: '준비 필요', bg: 'bg-gray-100', color: 'text-gray-700' },
  UNDER_REVIEW: { text: '검토 중', bg: 'bg-amber-50', color: 'text-amber-700' },
  READY: { text: '투입 가능', bg: 'bg-green-50', color: 'text-green-700' },
  REJECTED: { text: '보완 필요', bg: 'bg-red-50', color: 'text-red-700' },
  EXPIRED: { text: '만료 재제출 필요', bg: 'bg-orange-50', color: 'text-orange-700' },
}

const DOC_STATUS: Record<string, { text: string; bg: string; color: string }> = {
  NOT_SUBMITTED: { text: '미제출', bg: 'bg-gray-100', color: 'text-gray-600' },
  SUBMITTED: { text: '검토 대기', bg: 'bg-amber-50', color: 'text-amber-700' },
  APPROVED: { text: '승인 완료', bg: 'bg-green-50', color: 'text-green-700' },
  REJECTED: { text: '반려', bg: 'bg-red-50', color: 'text-red-700' },
  EXPIRED: { text: '만료', bg: 'bg-orange-50', color: 'text-orange-700' },
  NOT_REQUIRED: { text: '불필요', bg: 'bg-gray-50', color: 'text-gray-400' },
}

const DOC_ACTIONS: Record<string, Record<string, { label: string; style: string }>> = {
  CONTRACT: {
    NOT_SUBMITTED: { label: '계약서 확인', style: 'bg-blue-500 text-white' },
    REJECTED: { label: '재서명', style: 'bg-red-500 text-white' },
    EXPIRED: { label: '재서명', style: 'bg-orange-500 text-white' },
  },
  PRIVACY_CONSENT: {
    NOT_SUBMITTED: { label: '동의하기', style: 'bg-blue-500 text-white' },
    REJECTED: { label: '다시 제출', style: 'bg-red-500 text-white' },
    EXPIRED: { label: '다시 제출', style: 'bg-orange-500 text-white' },
  },
  HEALTH_DECLARATION: {
    NOT_SUBMITTED: { label: '서명하기', style: 'bg-blue-500 text-white' },
    REJECTED: { label: '다시 제출', style: 'bg-red-500 text-white' },
    EXPIRED: { label: '다시 제출', style: 'bg-orange-500 text-white' },
  },
  HEALTH_CERTIFICATE: {
    NOT_SUBMITTED: { label: '업로드', style: 'bg-blue-500 text-white' },
    REJECTED: { label: '다시 업로드', style: 'bg-red-500 text-white' },
    EXPIRED: { label: '재업로드', style: 'bg-orange-500 text-white' },
  },
  SAFETY_ACK: {
    NOT_SUBMITTED: { label: '서명하기', style: 'bg-blue-500 text-white' },
    REJECTED: { label: '다시 제출', style: 'bg-red-500 text-white' },
    EXPIRED: { label: '다시 제출', style: 'bg-orange-500 text-white' },
  },
}

export default function MyOnboardingPage() {
  const [pkg, setPkg] = useState<PackageInfo | null>(null)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDoc, setActiveDoc] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadDoc, setUploadDoc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/my/documents')
      const json = await res.json()
      if (json.success) {
        setPkg(json.data.package)
        setDocs(json.data.documents || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSign = async (docType: string, isResubmit: boolean) => {
    setSubmitting(true)
    try {
      const endpoint = isResubmit
        ? `/api/my/documents/${docType}/resubmit`
        : `/api/my/documents/${docType}/submit-sign`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: 'confirmed', agreedItems: ['all'] }),
      })
      const json = await res.json()
      if (json.success) {
        setActiveDoc(null)
        await load()
      } else {
        alert(json.message || '제출 실패')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpload = async (file: File) => {
    setSubmitting(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        const res = await fetch('/api/my/documents/health-certificate/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64,
            fileName: file.name,
            mimeType: file.type,
          }),
        })
        const json = await res.json()
        if (json.success) {
          setUploadDoc(null)
          await load()
        } else {
          alert(json.message || '업로드 실패')
        }
        setSubmitting(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setSubmitting(false)
    }
  }

  const overall = OVERALL_STATUS[pkg?.overallStatus ?? ''] ?? OVERALL_STATUS.NOT_READY

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <WorkerTopBar />

      <div className="px-4 pt-4">
        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <>
            {/* 진행 상태 카드 */}
            <div className={`rounded-2xl p-5 mb-5 ${overall.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-lg font-bold ${overall.color}`}>{overall.text}</span>
                {pkg?.site && <span className="text-xs text-gray-500">{pkg.site.name}</span>}
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-white/70 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{pkg?.approvedDocCount ?? 0}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">승인</div>
                </div>
                <div className="flex-1 bg-white/70 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">{pkg?.pendingDocCount ?? 0}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">검토중</div>
                </div>
                <div className="flex-1 bg-white/70 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-400">{pkg?.missingDocCount ?? 0}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">미제출</div>
                </div>
                {(pkg?.rejectedDocCount ?? 0) > 0 && (
                  <div className="flex-1 bg-white/70 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{pkg?.rejectedDocCount}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">반려</div>
                  </div>
                )}
                {(pkg?.expiredDocCount ?? 0) > 0 && (
                  <div className="flex-1 bg-white/70 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">{pkg?.expiredDocCount}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">만료</div>
                  </div>
                )}
              </div>
              {/* 프로그레스 바 */}
              <div className="mt-3 bg-white/50 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${((pkg?.approvedDocCount ?? 0) / (pkg?.requiredDocCount ?? 5)) * 100}%` }} />
              </div>
              <div className="text-[11px] text-gray-500 mt-1 text-right">{pkg?.approvedDocCount ?? 0} / {pkg?.requiredDocCount ?? 5} 완료</div>
            </div>

            {/* 문서 카드 리스트 */}
            <div className="space-y-3">
              {docs.map((doc) => {
                const st = DOC_STATUS[doc.status] ?? DOC_STATUS.NOT_SUBMITTED
                const action = DOC_ACTIONS[doc.docType]?.[doc.status]
                const isResubmit = doc.status === 'REJECTED' || doc.status === 'EXPIRED'

                return (
                  <div key={doc.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-[15px] text-gray-800">{doc.label}</div>
                        {doc.submittedAt && (
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            제출: {new Date(doc.submittedAt).toLocaleDateString('ko-KR')}
                          </div>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${st.bg} ${st.color}`}>
                        {st.text}
                      </span>
                    </div>

                    {/* 반려 사유 */}
                    {doc.rejectionReason && doc.status === 'REJECTED' && (
                      <div className="bg-red-50 rounded-lg px-3 py-2 mb-2 text-[12px] text-red-700">
                        반려 사유: {doc.rejectionReason}
                      </div>
                    )}

                    {/* 만료 경고 */}
                    {doc.expiresAt && doc.status !== 'EXPIRED' && (
                      <div className="text-[11px] text-orange-600 mb-2">
                        유효기간: {new Date(doc.expiresAt).toLocaleDateString('ko-KR')}까지
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    {action && (
                      <button
                        onClick={() => {
                          if (doc.docType === 'HEALTH_CERTIFICATE') {
                            setUploadDoc(doc.docType)
                            setTimeout(() => fileInputRef.current?.click(), 100)
                          } else if (doc.docType === 'CONTRACT') {
                            // 계약서는 기존 계약 페이지로 이동
                            window.location.href = '/my/documents'
                          } else {
                            setActiveDoc(doc.docType)
                          }
                        }}
                        disabled={submitting}
                        className={`w-full py-3 rounded-xl text-[14px] font-bold border-none cursor-pointer mt-1 ${action.style}`}>
                        {action.label}
                      </button>
                    )}

                    {/* 승인 완료 표시 */}
                    {doc.status === 'APPROVED' && (
                      <div className="flex items-center gap-1.5 mt-1 text-green-600 text-[12px]">
                        <span>✓</span> 승인 완료
                        {doc.approvedAt && <span className="text-gray-400">({new Date(doc.approvedAt).toLocaleDateString('ko-KR')})</span>}
                      </div>
                    )}

                    {/* 검토중 표시 */}
                    {doc.status === 'SUBMITTED' && (
                      <div className="text-center py-2 text-[12px] text-amber-600 mt-1">
                        관리자 검토 대기 중입니다
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 전자서명 모달 */}
      {activeDoc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-8 animate-[slideUp_0.3s_ease]">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {docs.find(d => d.docType === activeDoc)?.label}
            </h3>
            <p className="text-[13px] text-gray-500 mb-6">
              아래 내용을 확인하고 동의하면 제출됩니다.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-[13px] text-gray-600 leading-relaxed max-h-[40vh] overflow-y-auto">
              {activeDoc === 'PRIVACY_CONSENT' && (
                <div>
                  <p className="font-bold mb-2">개인정보 수집·이용 동의서</p>
                  <p>1. 수집 항목: 성명, 연락처, 주민등록번호(뒷자리), 계좌정보</p>
                  <p>2. 수집 목적: 근로계약 체결, 4대보험 신고, 급여 지급</p>
                  <p>3. 보유 기간: 고용관계 종료 후 3년</p>
                  <p>4. 동의를 거부할 권리가 있으며, 거부 시 근로계약 체결이 제한될 수 있습니다.</p>
                </div>
              )}
              {activeDoc === 'HEALTH_DECLARATION' && (
                <div>
                  <p className="font-bold mb-2">건강 이상 없음 각서</p>
                  <p>본인은 현재 건설현장 근로에 지장을 줄 수 있는 건강상의 이상이 없음을 확인합니다.</p>
                  <p className="mt-2">고혈압, 당뇨, 심장질환, 간질 등 중대한 질환이 있는 경우 사전에 고지하여야 하며, 미고지로 인한 사고 발생 시 본인에게 책임이 있음을 확인합니다.</p>
                </div>
              )}
              {activeDoc === 'SAFETY_ACK' && (
                <div>
                  <p className="font-bold mb-2">안전서류 확인 및 서명</p>
                  <p>1. 현장 안전수칙을 숙지하고 준수할 것을 서약합니다.</p>
                  <p>2. 안전보호구를 착용하고 안전교육에 성실히 참여합니다.</p>
                  <p>3. 위험 상황 발견 시 즉시 관리자에게 보고합니다.</p>
                  <p>4. 음주 상태에서의 작업을 절대 하지 않습니다.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setActiveDoc(null)}
                className="flex-1 py-3.5 rounded-xl text-[14px] font-bold border border-gray-300 bg-white text-gray-600 cursor-pointer">
                취소
              </button>
              <button onClick={() => {
                const isResubmit = docs.find(d => d.docType === activeDoc)?.status === 'REJECTED'
                handleSign(activeDoc, isResubmit ?? false)
              }}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-xl text-[14px] font-bold border-none bg-blue-500 text-white cursor-pointer disabled:bg-gray-300">
                {submitting ? '처리 중...' : '동의 및 제출'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 파일 업로드 input (숨김) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
          e.target.value = ''
        }}
      />

      <WorkerBottomNav />
    </div>
  )
}
