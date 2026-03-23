'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DOC_PACKAGES, getDocPackageKey } from '@/lib/contracts/index'

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
  DRAFT: '초안', SIGNED: '서명완료', ACTIVE: '활성', ENDED: '종료',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT:  'bg-gray-100 text-gray-600',
  SIGNED: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  ENDED:  'bg-red-100 text-red-600',
}
const DOC_STATUS_COLOR: Record<string, string> = {
  DRAFT:  'bg-gray-100 text-gray-500',
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
    const res  = await fetch(`/api/admin/contracts/${params.id}/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docVariant: 'DRAFT' }),
    })
    const json = await res.json()
    setProcessing(false)
    if (json.success) {
      setPreviewDoc({ docType: 'CONTRACT', content: json.data.contentText, title: json.data.fileName })
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

  if (loading) return <div className="p-8 text-gray-400 text-center">로딩 중...</div>
  if (!contract) return <div className="p-8 text-red-500 text-center">계약을 찾을 수 없습니다.</div>

  const packageKey = getDocPackageKey(contract.laborRelationType)
  const docPackage = DOC_PACKAGES[packageKey] || DOC_PACKAGES.DIRECT_EMPLOYEE
  const generatedMap = new Map(contract.generatedDocuments.map(d => [d.documentType, d]))
  const reviewFlags  = contract.reviewFlags?.split(',').filter(Boolean) || []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">← 뒤로</button>
          <div>
            <h1 className="text-xl font-bold">{contract.worker.name} — {TEMPLATE_LABEL[contract.contractTemplateType || ''] || '계약'}</h1>
            <div className="text-sm text-gray-500 mt-0.5">{contract.site?.name || '현장 미지정'} · {contract.startDate} ~ {contract.endDate || '무기한'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLOR[contract.contractStatus] || ''}`}>
            {STATUS_LABEL[contract.contractStatus] || contract.contractStatus}
          </span>
          <span className="text-xs text-gray-400">v{contract.currentVersion}</span>

          <button onClick={generatePdf} disabled={processing}
            className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">
            계약서 생성
          </button>

          {!contract.signedAt && (
            <button onClick={() => { setSignerName(contract.worker.name); setShowSignModal(true) }}
              className="px-3 py-1.5 text-xs bg-violet-100 text-violet-700 rounded hover:bg-violet-200">
              서명처리
            </button>
          )}
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

          {(contract.contractStatus === 'DRAFT' || contract.contractStatus === 'SIGNED') && (
            <button onClick={activateContract}
              className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
              활성화
            </button>
          )}
          {contract.contractStatus === 'ACTIVE' && (
            <button onClick={endContract}
              className="px-3 py-1.5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">
              종료
            </button>
          )}
          <Link href={`/admin/contracts/new?workerId=${contract.worker.id}`}
            className="px-3 py-1.5 text-xs bg-gray-100 rounded hover:bg-gray-200">
            신규 계약
          </Link>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{error}</div>}

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
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-gray-700 text-sm">계약 기본 정보</h2>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-500">근로자</dt>
                <dd className="font-medium">
                  <Link href={`/admin/workers/${contract.worker.id}`} className="text-blue-600 hover:underline">
                    {contract.worker.name}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">직종</dt>
                <dd>{contract.worker.jobTitle}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">현장</dt>
                <dd>{contract.site?.name || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">계약 유형</dt>
                <dd>{contract.laborRelationType || '직접고용'}</dd>
              </div>
              {contract.businessRegistrationNo && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">사업자번호</dt>
                  <dd>{contract.businessRegistrationNo}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">근무시간</dt>
                <dd>{contract.checkInTime || '08:00'} ~ {contract.checkOutTime || '17:00'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">근무요일</dt>
                <dd>{contract.workDays || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-gray-700 text-sm">임금 조건</h2>
            <dl className="space-y-1.5 text-xs">
              {contract.dailyWage > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">일당</dt>
                  <dd className="font-mono">{won(contract.dailyWage)}</dd>
                </div>
              )}
              {contract.monthlySalary && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">월급</dt>
                  <dd className="font-mono">{won(contract.monthlySalary)}</dd>
                </div>
              )}
              {contract.serviceFee && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">계약금액</dt>
                  <dd className="font-mono">{won(contract.serviceFee)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">지급일</dt>
                <dd>{contract.paymentDay ? `매월 ${contract.paymentDay}일` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">지급방법</dt>
                <dd>{contract.paymentMethod || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border rounded-lg p-4 space-y-2">
            <h2 className="font-semibold text-gray-700 text-sm">4대보험</h2>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {[
                ['국민연금', contract.nationalPensionYn],
                ['건강보험', contract.healthInsuranceYn],
                ['고용보험', contract.employmentInsuranceYn],
                ['산재보험', contract.industrialAccidentYn],
                ['퇴직공제', contract.retirementMutualYn],
              ].map(([label, yn]) => (
                <div key={label as string} className={`flex items-center gap-1 ${yn ? 'text-green-700' : 'text-gray-400'}`}>
                  <span>{yn ? '✓' : '○'}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 문서 패키지 */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">문서 패키지 — {packageKey === 'DIRECT_EMPLOYEE' ? 'A. 직접고용' : packageKey === 'SUBCONTRACT_BIZ' ? 'B. 하도급/외주' : 'C. 팀장형'}</h2>
              <span className="text-xs text-gray-500">
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
                      ${generated ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
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
                          <div className="text-xs text-gray-500">
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
                          className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">
                          미리보기
                        </button>
                      )}
                      <button
                        onClick={() => generateDoc(type)}
                        disabled={isGenerating}
                        className={`px-2 py-1 text-xs rounded
                          ${generated
                            ? 'bg-white border text-gray-600 hover:bg-gray-50'
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
            <div className="bg-white border rounded-lg p-4">
              <h2 className="font-semibold text-gray-700 text-sm mb-2">특약사항</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{contract.specialTerms}</p>
            </div>
          )}

          {/* 근로시간 상세 */}
          {(contract.breakStartTime || contract.weeklyWorkDays || contract.holidayRule) && (
            <div className="bg-white border rounded-lg p-4 space-y-2">
              <h2 className="font-semibold text-gray-700 text-sm">근로시간 상세</h2>
              <dl className="space-y-1.5 text-xs">
                {contract.breakStartTime && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">휴게시간</dt>
                    <dd>{contract.breakStartTime} ~ {contract.breakEndTime || '—'}</dd>
                  </div>
                )}
                {contract.weeklyWorkDays != null && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">주 소정근로일</dt>
                    <dd>{contract.weeklyWorkDays}일</dd>
                  </div>
                )}
                {contract.weeklyWorkHours != null && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">주 소정근로시간</dt>
                    <dd>{contract.weeklyWorkHours}시간</dd>
                  </div>
                )}
                {contract.holidayRule && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">주휴일</dt>
                    <dd>{contract.holidayRule}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* 수당 */}
          {contract.allowanceJson && contract.allowanceJson.length > 0 && (
            <div className="bg-white border rounded-lg p-4 space-y-2">
              <h2 className="font-semibold text-gray-700 text-sm">수당 항목</h2>
              <dl className="space-y-1.5 text-xs">
                {contract.allowanceJson.map((a, i) => (
                  <div key={i} className="flex justify-between">
                    <dt className="text-gray-500">{a.name}</dt>
                    <dd className="font-mono">{a.amount.toLocaleString()}원</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* 버전 이력 */}
          {versions.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h2 className="font-semibold text-gray-700 text-sm mb-3">버전 이력</h2>
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-b-0 text-xs">
                    <div>
                      <span className="font-medium">v{v.versionNo}</span>
                      <span className="ml-2 text-gray-500">{new Date(v.createdAt).toLocaleDateString('ko-KR')}</span>
                      {v.changeNote && <span className="ml-2 text-gray-400">{v.changeNote}</span>}
                    </div>
                    <div className="flex gap-2">
                      {v.draftDocId && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">초안</span>}
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
            <div className="bg-white border rounded-lg p-4">
              <h2 className="font-semibold text-gray-700 text-sm mb-2">내부 메모</h2>
              <p className="text-sm text-gray-500">{contract.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* 문서 미리보기 모달 */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{previewDoc.title}</h3>
              <button onClick={() => setPreviewDoc(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-gray-700">
                {previewDoc.content}
              </pre>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  const blob = new Blob([previewDoc.content], { type: 'text/plain; charset=utf-8' })
                  const url  = URL.createObjectURL(blob)
                  const a    = document.createElement('a')
                  a.href = url; a.download = previewDoc.title; a.click()
                  URL.revokeObjectURL(url)
                }}
                className="px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700">
                다운로드 (.txt)
              </button>
              <button onClick={() => setPreviewDoc(null)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 서명 모달 */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">계약서 서명 처리</h3>
            <p className="text-sm text-gray-500 mb-4">
              서명 처리 시 계약 상태가 ACTIVE로 변경됩니다.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">서명자 이름</label>
              <input
                type="text"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder={contract.worker.name}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSignModal(false)}
                className="flex-1 px-4 py-2 border rounded text-sm hover:bg-gray-50">취소</button>
              <button onClick={handleSign} disabled={processing}
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded text-sm hover:bg-violet-700 disabled:opacity-50">
                {processing ? '처리 중...' : '서명 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 교부 모달 */}
      {showDeliverModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">계약서 교부 처리</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">교부 방법</label>
              <select value={deliverMethod} onChange={e => setDeliverMethod(e.target.value as 'EMAIL' | 'KAKAO' | 'PAPER' | 'APP')}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="APP">앱 내 전달</option>
                <option value="KAKAO">카카오톡</option>
                <option value="EMAIL">이메일</option>
                <option value="PAPER">서면 교부</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeliverModal(false)}
                className="flex-1 px-4 py-2 border rounded text-sm hover:bg-gray-50">취소</button>
              <button onClick={handleDeliver} disabled={processing}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50">
                {processing ? '처리 중...' : '교부 완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
