'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { InfoRow, InfoSection } from '@/components/admin/ui'
import { DOC_PACKAGES, getDocPackageForTemplate } from '@/lib/contracts/index'
import { DANGER_PHRASE_UI } from '@/lib/policies/contract-policy'
import { FormInput, FormSelect, Modal, ModalFooter, Btn } from '@/components/admin/ui'

// ─── 타입 ─────────────────────────────────────────────────────

interface Contract {
  id: string
  contractKind: string | null
  contractTemplateType: string | null
  contractStatus: string
  laborRelationType: string | null
  startDate: string
  endDate: string | null
  dailyWage: number
  monthlySalary: number | null
  serviceFee: number | null
  paymentDay: number | null
  checkInTime: string | null
  checkOutTime: string | null
  breakStartTime: string | null
  breakEndTime: string | null
  workDays: string | null
  weeklyWorkDays: number | null
  weeklyWorkHours: number | null
  holidayRule: string | null
  paymentMethod: string | null
  allowanceJson: { name: string; amount: number }[] | null
  safetyClauseYn: boolean
  nationalPensionYn: boolean
  healthInsuranceYn: boolean
  employmentInsuranceYn: boolean
  industrialAccidentYn: boolean
  retirementMutualYn: boolean
  specialTerms: string | null
  notes: string | null
  businessRegistrationNo: string | null
  contractorName: string | null
  reviewFlags: string | null
  signedAt: string | null
  signedBy: string | null
  deliveredAt: string | null
  deliveredMethod: string | null
  currentVersion: number
  createdBy: string | null
  worker: { id: string; name: string; phone: string; jobTitle: string }
  site: { id: string; name: string } | null
  generatedDocuments: GeneratedDoc[]
}

interface ContractVersion {
  id: string
  versionNo: number
  changeNote: string | null
  draftDocId: string | null
  signedDocId: string | null
  deliveredDocId: string | null
  createdAt: string
}

interface GeneratedDoc {
  id: string
  documentType: string
  fileName: string
  status: string
  generatedAt: string
}

// ─── 상수 ─────────────────────────────────────────────────────

const TEMPLATE_LABEL: Record<string, string> = {
  DAILY_EMPLOYMENT:       '일용직 근로계약서',
  REGULAR_EMPLOYMENT:     '상용직 근로계약서',
  FIXED_TERM_EMPLOYMENT:  '기간제 근로계약서',
  OFFICE_SERVICE:         '사무보조 용역계약서',
  FREELANCER_SERVICE:     '프리랜서 용역계약서',
  SUBCONTRACT_WITH_BIZ:   '도급·용역계약서 (사업자 있음)',
  NONBUSINESS_TEAM_REVIEW: '팀장형 서면 세트 (검토 필요)',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안', SIGNED: '검토 대기', REVIEW_REQUESTED: '검토 대기', ACTIVE: '승인 (이행중)', REJECTED: '반려', ENDED: '종료',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT:  'bg-[rgba(255,255,255,0.04)] text-dim-brand',
  SIGNED: 'bg-yellow-100 text-yellow-700',
  REVIEW_REQUESTED: 'bg-yellow-100 text-yellow-700',
  ACTIVE: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
  ENDED:  'bg-[rgba(255,255,255,0.04)] text-[#718096]',
}
const DOC_STATUS_COLOR: Record<string, string> = {
  DRAFT:  'bg-[rgba(255,255,255,0.04)] text-[#718096]',
  ISSUED: 'bg-blue-100 text-blue-700',
  SIGNED: 'bg-green-100 text-green-700',
}

const won = (n: number | null | undefined) =>
  n != null ? n.toLocaleString('ko-KR') + '원' : '—'

// ─── 페이지 ───────────────────────────────────────────────────

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [contract, setContract] = useState<Contract | null>(null)
  const [versions, setVersions] = useState<ContractVersion[]>([])
  const [loading, setLoading]   = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{ docType: string; content: string; title: string } | null>(null)
  const [error, setError] = useState('')
  const [showSignModal, setShowSignModal] = useState(false)
  const [showDeliverModal, setShowDeliverModal] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [deliverMethod, setDeliverMethod] = useState<'EMAIL' | 'KAKAO' | 'PAPER' | 'APP'>('APP')
  const [processing, setProcessing] = useState(false)
  const [dangerWarnings, setDangerWarnings] = useState<string[]>([])
  // 승인/반려 모달
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [rejectReason, setRejectReason] = useState('')

  async function load() {
    const [res1, res2] = await Promise.all([
      fetch(`/api/admin/contracts/${params.id}`),
      fetch(`/api/admin/contracts/${params.id}/versions`),
    ])
    const [j1, j2] = await Promise.all([res1.json(), res2.json()])
    if (j1.success) setContract(j1.data)
    if (j2.success) setVersions(j2.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  async function generateDoc(docType: string) {
    setGenerating(docType)
    setError('')
    const res  = await fetch(`/api/admin/contracts/${params.id}/generate-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType }),
    })
    const json = await res.json()
    setGenerating(null)
    if (json.success) {
      setPreviewDoc({ docType, content: json.data.contentText, title: json.data.fileName })
      load()
    } else {
      setError(json.error || '문서 생성 실패')
    }
  }

  async function generatePdf() {
    setProcessing(true)
    setError('')
    setDangerWarnings([])
    const res  = await fetch(`/api/admin/contracts/${params.id}/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docVariant: 'DRAFT' }),
    })
    const json = await res.json()
    setProcessing(false)
    if (json.success) {
      setPreviewDoc({ docType: 'CONTRACT', content: json.data.contentText, title: json.data.fileName })
      if (json.data.warnings?.length) setDangerWarnings(json.data.warnings)
      load()
    } else {
      setError(json.error || '계약서 생성 실패')
    }
  }

  async function handleSign() {
    if (!signerName.trim()) { alert('서명자 이름을 입력하세요'); return }
    setProcessing(true)
    const res  = await fetch(`/api/admin/contracts/${params.id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedBy: signerName }),
    })
    const json = await res.json()
    setProcessing(false)
    if (json.success) { setShowSignModal(false); load() }
    else setError(json.error || '서명 처리 실패')
  }

  async function handleReview() {
    if (reviewAction === 'REJECT' && !rejectReason.trim()) { alert('반려 사유를 입력하세요'); return }
    setProcessing(true)
    const res = await fetch(`/api/admin/contracts/${params.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: reviewAction, rejectReason: reviewAction === 'REJECT' ? rejectReason : undefined }),
    })
    const json = await res.json()
    setProcessing(false)
    if (json.success) { setShowReviewModal(false); setRejectReason(''); load() }
    else setError(json.message || '검토 처리 실패')
  }

  async function handleDeliver() {
    setProcessing(true)
    const res  = await fetch(`/api/admin/contracts/${params.id}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveredMethod: deliverMethod }),
    })
    const json = await res.json()
    setProcessing(false)
    if (json.success) { setShowDeliverModal(false); load() }
    else setError(json.error || '교부 처리 실패')
  }

  async function activateContract() {
    if (!confirm('이 계약을 활성화하시겠습니까?')) return
    const res  = await fetch(`/api/admin/contracts/${params.id}/activate`, { method: 'POST' })
    const json = await res.json()
    json.success ? load() : alert(json.error)
  }

  async function endContract() {
    if (!confirm('이 계약을 종료하시겠습니까?')) return
    const res  = await fetch(`/api/admin/contracts/${params.id}/end`, { method: 'POST' })
    const json = await res.json()
    json.success ? load() : alert(json.error)
  }

  if (loading) return <div className="p-8 text-[#718096] text-center">로딩 중...</div>
  if (!contract) return <div className="p-8 text-red-500 text-center">계약을 찾을 수 없습니다.</div>

  // contractTemplateType 기준으로 패키지 결정 (상용직/일용직 분리)
  const packageKey = getDocPackageForTemplate(contract.contractTemplateType)
  const docPackage = DOC_PACKAGES[packageKey] || DOC_PACKAGES.DIRECT_EMPLOYEE
  const generatedMap = new Map(contract.generatedDocuments.map(d => [d.documentType, d]))
  const reviewFlags  = contract.reviewFlags?.split(',').filter(Boolean) || []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[#718096] hover:text-dim-brand text-sm">← 뒤로</button>
          <div>
            <h1 className="text-xl font-bold">{contract.worker.name} — {TEMPLATE_LABEL[contract.contractTemplateType || ''] || '계약'}</h1>
            <div className="text-sm text-[#718096] mt-0.5">{contract.site?.name || '현장 미지정'} · {contract.startDate} ~ {contract.endDate || '무기한'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLOR[contract.contractStatus] || ''}`}>
            {STATUS_LABEL[contract.contractStatus] || contract.contractStatus}
          </span>
          <span className="text-xs text-[#718096]">v{contract.currentVersion}</span>

          <button onClick={generatePdf} disabled={processing}
            className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">
            계약서 생성
          </button>

          {/* 서명 처리: DRAFT 또는 REJECTED 상태에서만 */}
          {(contract.contractStatus === 'DRAFT' || contract.contractStatus === 'REJECTED') && (
            <button onClick={() => { setSignerName(contract.worker.name); setShowSignModal(true) }}
              className="px-3 py-1.5 text-xs bg-violet-100 text-violet-700 rounded hover:bg-violet-200">
              서명 → 검토요청
            </button>
          )}

          {/* 승인/반려: REVIEW_REQUESTED 또는 레거시 SIGNED 상태에서 */}
          {(contract.contractStatus === 'REVIEW_REQUESTED' || contract.contractStatus === 'SIGNED') && (
            <>
              <button onClick={() => { setReviewAction('APPROVE'); setShowReviewModal(true) }}
                className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                승인
              </button>
              <button onClick={() => { setReviewAction('REJECT'); setShowReviewModal(true) }}
                className="px-3 py-1.5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">
                반려
              </button>
            </>
          )}

          {/* 교부: 서명 후 + 아직 교부 안 됨 */}
          {contract.signedAt && !contract.deliveredAt && (
            <button onClick={() => setShowDeliverModal(true)}
              className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200">
              교부처리
            </button>
          )}
          {contract.signedAt && (
            <span className="text-xs text-green-600">✓ 서명 {new Date(contract.signedAt).toLocaleDateString('ko-KR')}</span>
          )}
          {contract.deliveredAt && (
            <span className="text-xs text-blue-600">✓ 교부 {new Date(contract.deliveredAt).toLocaleDateString('ko-KR')} ({contract.deliveredMethod})</span>
          )}

          {contract.contractStatus === 'ACTIVE' && (
            <button onClick={endContract}
              className="px-3 py-1.5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">
              종료
            </button>
          )}
          <Link href={`/admin/contracts/new?workerId=${contract.worker.id}`}
            className="px-3 py-1.5 text-xs bg-[rgba(255,255,255,0.04)] rounded hover:bg-[rgba(255,255,255,0.08)]">
            신규 계약
          </Link>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{error}</div>}

      {/* 위험 문구 경고 — 일용직 계약서 생성 후 Advisory 표시 */}
      {dangerWarnings.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-red-800 text-sm space-y-2">
          <div className="font-semibold">⚠ {DANGER_PHRASE_UI.title}</div>
          <p className="text-xs text-red-700">{DANGER_PHRASE_UI.description}</p>
          <ul className="space-y-1 text-xs font-mono bg-red-100 rounded p-3">
            {dangerWarnings.map((w, i) => (
              <li key={i} className="border-b border-red-200 pb-1 last:border-b-0 last:pb-0">{w}</li>
            ))}
          </ul>
          <p className="text-xs text-red-600">
            확인 사항: {DANGER_PHRASE_UI.checklist.map((c, i) => `(${i + 1}) ${c}`).join(' ')}
          </p>
          <button onClick={() => setDangerWarnings([])} className="text-xs text-red-500 underline">경고 닫기</button>
        </div>
      )}

      {/* 검토 플래그 경고 */}
      {reviewFlags.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-800 text-sm">
          <div className="font-semibold mb-1">⚠ 검토 필요 플래그</div>
          <div className="flex flex-wrap gap-2">
            {reviewFlags.map(f => (
              <span key={f} className="px-2 py-0.5 bg-amber-200 rounded text-xs font-mono">{f}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* 계약 정보 */}
        <div className="col-span-1 space-y-4">
          <div className="bg-card border rounded-[12px] p-5">
            <div className="space-y-5">
              <InfoSection title="계약 기본 정보">
                <InfoRow label="근로자" value={<Link href={`/admin/workers/${contract.worker.id}`} className="text-blue-600 hover:underline">{contract.worker.name}</Link>} />
                <InfoRow label="직종" value={contract.worker.jobTitle} />
                <InfoRow label="현장" value={contract.site?.name || '—'} />
                <InfoRow label="계약 유형" value={contract.laborRelationType || '직접고용'} />
                {contract.businessRegistrationNo && <InfoRow label="사업자번호" value={contract.businessRegistrationNo} mono />}
                <InfoRow label="근무시간" value={`${contract.checkInTime || '08:00'} ~ ${contract.checkOutTime || '17:00'}`} mono />
                <InfoRow label="근무요일" value={contract.workDays || '—'} />
              </InfoSection>

              <InfoSection title="임금 조건">
                {contract.dailyWage > 0 && <InfoRow label="일당" value={won(contract.dailyWage)} mono />}
                {contract.monthlySalary && <InfoRow label="월급" value={won(contract.monthlySalary)} mono />}
                {contract.serviceFee && <InfoRow label="계약금액" value={won(contract.serviceFee)} mono />}
                <InfoRow label="지급일" value={contract.paymentDay ? `매월 ${contract.paymentDay}일` : '—'} />
                <InfoRow label="지급방법" value={contract.paymentMethod || '—'} />
              </InfoSection>

              <InfoSection title="4대보험">
                {([
                  ['국민연금', contract.nationalPensionYn],
                  ['건강보험', contract.healthInsuranceYn],
                  ['고용보험', contract.employmentInsuranceYn],
                  ['산재보험', contract.industrialAccidentYn],
                  ['퇴직공제', contract.retirementMutualYn],
                ] as [string, boolean][]).map(([label, yn]) => (
                  <InfoRow key={label} label={label} value={
                    <span className={yn ? 'text-green-700 font-semibold' : 'text-[#718096]'}>{yn ? '✓ 가입' : '○ 미가입'}</span>
                  } />
                ))}
              </InfoSection>
            </div>
          </div>
        </div>

        {/* 문서 패키지 */}
        <div className="col-span-2 space-y-4">
          <div className="bg-card border rounded-[12px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">문서 패키지 — {
                packageKey === 'DIRECT_EMPLOYEE'  ? 'A. 직접고용 (일용직)' :
                packageKey === 'REGULAR_EMPLOYEE' ? 'D. 직접고용 (상용직/기간제)' :
                packageKey === 'SUBCONTRACT_BIZ'  ? 'B. 하도급/외주' :
                'C. 팀장형'
              }</h2>
              <span className="text-xs text-[#718096]">
                {docPackage.filter(d => generatedMap.has(d.type)).length} / {docPackage.length} 생성됨
              </span>
            </div>

            <div className="space-y-2">
              {docPackage.map(({ type, label, required }) => {
                const generated = generatedMap.get(type)
                const isGenerating = generating === type

                return (
                  <div key={type}
                    className={`flex items-center justify-between p-3 rounded-lg border
                      ${generated ? 'bg-green-50 border-green-200' : 'bg-[rgba(255,255,255,0.04)] border-[rgba(91,164,217,0.15)]'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${generated ? '✅' : required ? '📋' : '📄'}`}>
                        {generated ? '✅' : required ? '📋' : '📄'}
                      </span>
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        {required && !generated && (
                          <div className="text-xs text-amber-600">필수 서류</div>
                        )}
                        {generated && (
                          <div className="text-xs text-[#718096]">
                            {new Date(generated.generatedAt).toLocaleDateString('ko-KR')} 생성
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${DOC_STATUS_COLOR[generated.status] || ''}`}>
                              {generated.status === 'DRAFT' ? '초안' : generated.status === 'ISSUED' ? '발행' : '서명완료'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {generated && (
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/admin/contracts/${params.id}/docs/${generated.id}`)
                            const json = await res.json()
                            if (json.success) setPreviewDoc({ docType: type, content: json.data.contentText || '', title: json.data.fileName })
                          }}
                          className="px-2 py-1 text-xs bg-card border rounded hover:bg-[rgba(255,255,255,0.04)]">
                          미리보기
                        </button>
                      )}
                      <button
                        onClick={() => generateDoc(type)}
                        disabled={isGenerating}
                        className={`px-2 py-1 text-xs rounded
                          ${generated
                            ? 'bg-card border text-dim-brand hover:bg-[rgba(255,255,255,0.04)]'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                          } disabled:opacity-50`}>
                        {isGenerating ? '생성 중...' : generated ? '재생성' : '생성'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 패키지 일괄 생성 */}
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => {
                  const requiredDocs = docPackage.filter(d => d.required && !generatedMap.has(d.type))
                  requiredDocs.forEach(d => generateDoc(d.type))
                }}
                disabled={!!generating}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50">
                필수 서류 일괄 생성 ({docPackage.filter(d => d.required && !generatedMap.has(d.type)).length}건 미생성)
              </button>
            </div>
          </div>

          {/* 특약사항 */}
          {contract.specialTerms && (
            <div className="bg-card border rounded-[12px] p-5">
              <h2 className="font-semibold text-dim-brand text-sm mb-2">특약사항</h2>
              <p className="text-sm text-dim-brand whitespace-pre-wrap">{contract.specialTerms}</p>
            </div>
          )}

          {/* 근로시간 상세 */}
          {(contract.breakStartTime || contract.weeklyWorkDays || contract.holidayRule) && (
            <div className="bg-card border rounded-[12px] p-5">
              <InfoSection title="근로시간 상세">
                {contract.breakStartTime && <InfoRow label="휴게시간" value={`${contract.breakStartTime} ~ ${contract.breakEndTime || '—'}`} mono />}
                {contract.weeklyWorkDays != null && <InfoRow label="주 소정근로일" value={`${contract.weeklyWorkDays}일`} mono />}
                {contract.weeklyWorkHours != null && <InfoRow label="주 소정근로시간" value={`${contract.weeklyWorkHours}시간`} mono />}
                {contract.holidayRule && <InfoRow label="주휴일" value={contract.holidayRule} />}
              </InfoSection>
            </div>
          )}

          {/* 수당 */}
          {contract.allowanceJson && contract.allowanceJson.length > 0 && (
            <div className="bg-card border rounded-[12px] p-5">
              <InfoSection title="수당 항목">
                {contract.allowanceJson.map((a: { name: string; amount: number }, i: number) => (
                  <InfoRow key={i} label={a.name} value={`${a.amount.toLocaleString()}원`} mono />
                ))}
              </InfoSection>
            </div>
          )}

          {/* 버전 이력 */}
          {versions.length > 0 && (
            <div className="bg-card border rounded-[12px] p-5">
              <h2 className="font-semibold text-dim-brand text-sm mb-3">버전 이력</h2>
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-b-0 text-xs">
                    <div>
                      <span className="font-medium">v{v.versionNo}</span>
                      <span className="ml-2 text-[#718096]">{new Date(v.createdAt).toLocaleDateString('ko-KR')}</span>
                      {v.changeNote && <span className="ml-2 text-[#718096]">{v.changeNote}</span>}
                    </div>
                    <div className="flex gap-2">
                      {v.draftDocId && <span className="px-1.5 py-0.5 bg-[rgba(255,255,255,0.04)] rounded text-[#718096]">초안</span>}
                      {v.signedDocId && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">서명</span>}
                      {v.deliveredDocId && <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded">교부</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 메모 */}
          {contract.notes && (
            <div className="bg-card border rounded-[12px] p-5">
              <h2 className="font-semibold text-dim-brand text-sm mb-2">내부 메모</h2>
              <p className="text-sm text-[#718096]">{contract.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* 문서 미리보기 모달 */}
      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.title ?? ''} width={768}>
            <div className="flex-1 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-dim-brand">
                {previewDoc?.content}
              </pre>
            </div>
            <ModalFooter>
              <Btn
                variant="secondary"
                onClick={() => {
                  if (!previewDoc) return
                  const blob = new Blob([previewDoc.content], { type: 'text/plain; charset=utf-8' })
                  const url  = URL.createObjectURL(blob)
                  const a    = document.createElement('a')
                  a.href = url; a.download = previewDoc.title; a.click()
                  URL.revokeObjectURL(url)
                }}>
                다운로드 (.txt)
              </Btn>
              <Btn variant="ghost" onClick={() => setPreviewDoc(null)}>닫기</Btn>
            </ModalFooter>
      </Modal>

      {/* 서명 모달 */}
      <Modal open={showSignModal} onClose={() => setShowSignModal(false)} title="계약서 서명 처리">
            <p className="text-sm text-[#718096] mb-4">
              서명 처리 시 계약 상태가 검토 대기(REVIEW_REQUESTED)로 변경됩니다.
            </p>
            <FormInput
              label="서명자 이름"
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder={contract.worker.name}
            />
            <ModalFooter>
              <Btn variant="ghost" onClick={() => setShowSignModal(false)}>취소</Btn>
              <Btn variant="primary" onClick={handleSign} disabled={processing}>
                {processing ? '처리 중...' : '서명 완료'}
              </Btn>
            </ModalFooter>
      </Modal>

      {/* 교부 모달 */}
      <Modal open={showDeliverModal} onClose={() => setShowDeliverModal(false)} title="계약서 교부 처리">
            <FormSelect
              label="교부 방법"
              value={deliverMethod}
              onChange={e => setDeliverMethod(e.target.value as 'EMAIL' | 'KAKAO' | 'PAPER' | 'APP')}
              options={[
                { value: 'APP', label: '앱 내 전달' },
                { value: 'KAKAO', label: '카카오톡' },
                { value: 'EMAIL', label: '이메일' },
                { value: 'PAPER', label: '서면 교부' },
              ]}
            />
            <ModalFooter>
              <Btn variant="ghost" onClick={() => setShowDeliverModal(false)}>취소</Btn>
              <Btn variant="orange" onClick={handleDeliver} disabled={processing}>
                {processing ? '처리 중...' : '교부 완료'}
              </Btn>
            </ModalFooter>
      </Modal>

      {/* 승인/반려 모달 */}
      <Modal open={showReviewModal} onClose={() => setShowReviewModal(false)} title={reviewAction === 'APPROVE' ? '계약서 승인' : '계약서 반려'}>
            <p className="text-sm text-[#718096] mb-4">
              {reviewAction === 'APPROVE'
                ? '승인 시 계약 상태가 ACTIVE(이행중)로 변경됩니다.'
                : '반려 시 근로자에게 알림이 발송됩니다.'}
            </p>
            {reviewAction === 'REJECT' && (
              <FormInput
                label="반려 사유 *"
                type="text"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력하세요"
              />
            )}
            <ModalFooter>
              <Btn variant="ghost" onClick={() => { setShowReviewModal(false); setRejectReason('') }}>취소</Btn>
              <Btn
                variant={reviewAction === 'APPROVE' ? 'success' : 'danger'}
                onClick={handleReview}
                disabled={processing || (reviewAction === 'REJECT' && !rejectReason.trim())}
              >
                {processing ? '처리 중...' : reviewAction === 'APPROVE' ? '승인' : '반려'}
              </Btn>
            </ModalFooter>
      </Modal>
    </div>
  )
}
