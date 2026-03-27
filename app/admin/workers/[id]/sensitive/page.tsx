'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

interface SensitiveProfile {
  id: string
  legalName: string | null
  rrnMasked: string | null
  phoneMasked: string | null
  addressMasked: string | null
  idVerified: boolean
  idDocumentType: string | null
  idVerificationMethod: string | null
  idVerificationNote: string | null
  collectedBy: string | null
  updatedAt: string
}

interface BankInfo {
  id: string
  bankName: string | null
  accountNumberMasked: string | null
  accountHolderNameMasked: string | null
  updatedAt: string
}

interface ComplianceStatus {
  basicIdentityChecked: boolean
  rrnCollected: boolean
  addressCollected: boolean
  bankInfoCollected: boolean
  nationalPensionStatus: string
  healthInsuranceStatus: string
  employmentInsuranceStatus: string
  industrialAccidentStatus: string
  retirementMutualStatus: string
  notes: string | null
  updatedAt: string
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: '미시작', IN_PROGRESS: '진행중', READY: '준비완료', COMPLETED: '신고완료', EXEMPT: '해당없음',
}
const STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: '#9e9e9e', IN_PROGRESS: '#e65100', READY: '#1565c0', COMPLETED: '#2e7d32', EXEMPT: '#bdbdbd',
}

export default function WorkerSensitivePage() {
  const { id: workerId } = useParams<{ id: string }>()
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const isSuperAdmin = role === 'SUPER_ADMIN'

  const [workerName, setWorkerName] = useState('')
  const [sensitive, setSensitive] = useState<SensitiveProfile | null>(null)
  const [bank, setBank] = useState<BankInfo | null>(null)
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'sensitive' | 'bank' | 'compliance' | 'decrypt'>('sensitive')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 입력 폼
  const [sensForm, setSensForm] = useState({
    legalName: '', rrn: '', phone: '', address: '',
    idVerified: false, idDocumentType: '', idVerificationMethod: 'IN_PERSON', idVerificationNote: '',
  })
  const [bankForm, setBankForm] = useState({ bankCode: '', bankName: '', accountNumber: '', accountHolderName: '' })
  const [compForm, setCompForm] = useState<Record<string, string>>({})
  const [decryptFields, setDecryptFields] = useState<string[]>([])
  const [decryptReason, setDecryptReason] = useState('')
  const [decryptResult, setDecryptResult] = useState<Record<string, string | null> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wRes, sRes, bRes, cRes] = await Promise.all([
        fetch(`/api/admin/workers/${workerId}`),
        fetch(`/api/admin/workers/${workerId}/sensitive`),
        fetch(`/api/admin/workers/${workerId}/bank`),
        fetch(`/api/admin/workers/${workerId}/compliance`),
      ])
      const [wd, sd, bd, cd] = await Promise.all([wRes.json(), sRes.json(), bRes.json(), cRes.json()])
      if (!wd.success) { router.push('/admin/workers'); return }
      setWorkerName(wd.data?.name ?? '')
      setSensitive(sd.data)
      setBank(bd.data)
      if (cd.success) setCompliance(cd.data?.compliance ?? null)
    } finally {
      setLoading(false)
    }
  }, [workerId, router])

  useEffect(() => { load() }, [load])

  const post = async (url: string, body: object) => {
    setSubmitting(true); setMsg(null)
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setMsg({ text: data.message ?? (data.success ? '저장되었습니다.' : '저장 실패'), ok: data.success })
    setSubmitting(false)
    return data
  }

  const handleSensSubmit = async () => {
    const payload: Record<string, unknown> = {}
    if (sensForm.legalName) payload.legalName = sensForm.legalName
    if (sensForm.rrn) payload.rrn = sensForm.rrn
    if (sensForm.phone) payload.phone = sensForm.phone
    if (sensForm.address) payload.address = sensForm.address
    if (sensForm.idVerified) payload.idVerified = true
    if (sensForm.idDocumentType) payload.idDocumentType = sensForm.idDocumentType
    payload.idVerificationMethod = sensForm.idVerificationMethod
    if (sensForm.idVerificationNote) payload.idVerificationNote = sensForm.idVerificationNote
    const data = await post(`/api/admin/workers/${workerId}/sensitive`, payload)
    if (data.success) { load(); setSensForm(f => ({ ...f, rrn: '', phone: '' })) }
  }

  const handleBankSubmit = async () => {
    const data = await post(`/api/admin/workers/${workerId}/bank`, bankForm)
    if (data.success) { load(); setBankForm({ bankCode: '', bankName: '', accountNumber: '', accountHolderName: '' }) }
  }

  const handleCompSubmit = async () => {
    const data = await post(`/api/admin/workers/${workerId}/compliance`, compForm)
    if (data.success) load()
  }

  const handleDecrypt = async () => {
    if (decryptFields.length === 0 || decryptReason.length < 5) return
    setSubmitting(true); setMsg(null); setDecryptResult(null)
    const res = await fetch(`/api/admin/workers/${workerId}/sensitive/decrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: decryptFields, reason: decryptReason }),
    })
    const data = await res.json()
    if (data.success) setDecryptResult(data.data)
    else setMsg({ text: data.message ?? '복호화 실패', ok: false })
    setSubmitting(false)
  }

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString('ko-KR') : '-'

  if (loading) return <div className="p-8">로딩 중...</div>

  return (
    <div className="p-8">
        <div className="mb-5">
          <Link href={`/admin/workers/${workerId}`} className="text-muted-brand text-[14px]">← {workerName}</Link>
          <h1 className="text-[22px] font-bold mt-1 mb-4">개인정보 관리 — {workerName}</h1>
        </div>

        <div className="bg-[rgba(91,164,217,0.1)] border border-[#90caf9] rounded-md px-3.5 py-2 text-[13px] text-[#4A93C8] mb-4">
          출퇴근 가능 여부(계정 승인)와 노무/4대보험 완료 상태는 별도로 관리됩니다.
          신분증 파일은 시스템에 저장하지 않습니다.
        </div>

        {msg && (
          <div className="border rounded-lg px-4 py-3 text-[14px] mb-4"
            style={{
              background: msg.ok ? '#e8f5e9' : '#ffebee',
              borderColor: msg.ok ? '#a5d6a7' : '#ef9a9a',
              color: msg.ok ? '#2e7d32' : '#c62828',
            }}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {[['sensitive', '민감정보'], ['bank', '계좌정보'], ['compliance', '노무/보험 상태'],
            ...(isSuperAdmin ? [['decrypt', '원문 복호화']] : [])
          ].map(([v, label]) => (
            <button key={v} onClick={() => { setActiveTab(v as never); setMsg(null) }}
              className="px-5 py-2 border rounded-md cursor-pointer text-[14px]"
              style={activeTab === v
                ? { background: '#F97316', color: 'white', borderColor: '#F97316' }
                : { background: '#F3F4F6', color: '#6B7280', borderColor: '#E5E7EB' }
              }>
              {label}
            </button>
          ))}
        </div>

        {/* ── 민감정보 ── */}
        {activeTab === 'sensitive' && (
          <div className="bg-white rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <h3 className="text-[15px] font-bold mt-0 mb-3">현재 저장값 (마스킹)</h3>
            {sensitive ? (
              <div className="flex flex-col">
                <Row k="법적 성명" v={sensitive.legalName} />
                <Row k="주민등록번호" v={sensitive.rrnMasked} mono />
                <Row k="휴대폰 원문" v={sensitive.phoneMasked} mono />
                <Row k="주소" v={sensitive.addressMasked} />
                <Row k="신분증 확인" v={sensitive.idVerified ? `완료 — ${sensitive.idDocumentType ?? ''}` : '미확인'} />
                <Row k="확인 방식" v={sensitive.idVerificationMethod ?? '-'} />
                <Row k="확인 메모" v={sensitive.idVerificationNote} />
                <Row k="최종 수정" v={fmt(sensitive.updatedAt)} />
              </div>
            ) : <p className="text-[#718096] m-0">등록된 정보가 없습니다.</p>}

            {canMutate && (
              <>
                <hr className="my-5 border-[#f0f0f0]" />
                <h3 className="text-[15px] font-bold mt-0 mb-3">입력/수정</h3>
                <p className="bg-[rgba(91,164,217,0.1)] border border-[#90caf9] rounded-md px-3.5 py-2 text-[13px] text-[#4A93C8] mb-4">
                  신분증 파일은 시스템에 저장하지 않습니다. 필요 시 본사 보안 채널로 별도 처리하세요.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <F label="법적 성명" value={sensForm.legalName} onChange={v => setSensForm(f => ({ ...f, legalName: v }))} />
                  <F label="주민등록번호 (13자리)" value={sensForm.rrn} onChange={v => setSensForm(f => ({ ...f, rrn: v }))} type="password" placeholder="갱신 시에만 입력" />
                  <F label="휴대폰 원문 (하이픈 제외)" value={sensForm.phone} onChange={v => setSensForm(f => ({ ...f, phone: v }))} placeholder="갱신 시에만 입력" />
                  <F label="주소" value={sensForm.address} onChange={v => setSensForm(f => ({ ...f, address: v }))} />
                  <F label="신분증 종류" value={sensForm.idDocumentType} onChange={v => setSensForm(f => ({ ...f, idDocumentType: v }))} placeholder="주민등록증, 운전면허증 등" />
                  <div>
                    <label className="block text-[12px] text-muted-brand mb-1 font-semibold">확인 방식</label>
                    <select value={sensForm.idVerificationMethod} onChange={e => setSensForm(f => ({ ...f, idVerificationMethod: e.target.value }))}
                      className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[14px]">
                      <option value="IN_PERSON">대면 확인</option>
                      <option value="SECURE_DOCUMENT">보안 채널 서류</option>
                      <option value="ADMIN_MANUAL">관리자 수동</option>
                    </select>
                  </div>
                  <F label="확인 메모" value={sensForm.idVerificationNote} onChange={v => setSensForm(f => ({ ...f, idVerificationNote: v }))} />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="idVerified" checked={sensForm.idVerified} onChange={e => setSensForm(f => ({ ...f, idVerified: e.target.checked }))} />
                    <label htmlFor="idVerified" className="text-[14px] cursor-pointer">신분증 확인 완료</label>
                  </div>
                </div>
                <button onClick={handleSensSubmit} disabled={submitting}
                  className="px-5 py-2 bg-[#1a1a2e] text-white border-none rounded-md cursor-pointer text-[14px]">저장</button>
              </>
            )}
          </div>
        )}

        {/* ── 계좌정보 ── */}
        {activeTab === 'bank' && (
          <div className="bg-white rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <h3 className="text-[15px] font-bold mt-0 mb-3">현재 저장값 (마스킹)</h3>
            {bank ? (
              <div className="flex flex-col">
                <Row k="은행명" v={bank.bankName} />
                <Row k="계좌번호" v={bank.accountNumberMasked} mono />
                <Row k="예금주명" v={bank.accountHolderNameMasked} />
                <Row k="최종 수정" v={fmt(bank.updatedAt)} />
              </div>
            ) : <p className="text-[#718096] m-0">등록된 계좌정보가 없습니다.</p>}

            {canMutate && (
              <>
                <hr className="my-5 border-[#f0f0f0]" />
                <h3 className="text-[15px] font-bold mt-0 mb-3">계좌 입력/수정</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <F label="은행 코드" value={bankForm.bankCode} onChange={v => setBankForm(f => ({ ...f, bankCode: v }))} placeholder="예: 004 (국민은행)" />
                  <F label="은행명" value={bankForm.bankName} onChange={v => setBankForm(f => ({ ...f, bankName: v }))} />
                  <F label="계좌번호 (숫자만)" value={bankForm.accountNumber} onChange={v => setBankForm(f => ({ ...f, accountNumber: v }))} type="password" placeholder="갱신 시에만 입력" />
                  <F label="예금주명" value={bankForm.accountHolderName} onChange={v => setBankForm(f => ({ ...f, accountHolderName: v }))} />
                </div>
                <button onClick={handleBankSubmit} disabled={submitting}
                  className="px-5 py-2 bg-[#1a1a2e] text-white border-none rounded-md cursor-pointer text-[14px]">저장</button>
              </>
            )}
          </div>
        )}

        {/* ── 노무/보험 상태 ── */}
        {activeTab === 'compliance' && (
          <div className="bg-white rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="bg-[rgba(91,164,217,0.1)] border border-[#90caf9] rounded-md px-3.5 py-2 text-[13px] text-[#4A93C8] mb-4">
              출퇴근 가능 여부와 이 상태는 별도입니다. 근로자가 출퇴근 가능해도 보험 미완료일 수 있습니다.
            </div>
            {compliance ? (
              <>
                <div className="flex flex-col">
                  <Row k="기본 신원 확인" v={compliance.basicIdentityChecked ? '완료' : '미완료'} />
                  <Row k="주민번호 수집" v={compliance.rrnCollected ? '완료' : '미완료'} />
                  <Row k="주소 수집" v={compliance.addressCollected ? '완료' : '미완료'} />
                  <Row k="계좌 수집" v={compliance.bankInfoCollected ? '완료' : '미완료'} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[['국민연금', 'nationalPensionStatus'], ['건강보험', 'healthInsuranceStatus'],
                    ['고용보험', 'employmentInsuranceStatus'], ['산재보험', 'industrialAccidentStatus'],
                    ['퇴직공제', 'retirementMutualStatus']].map(([label, key]) => (
                    <div key={key} className="flex justify-between px-3 py-2 bg-[#f9f9f9] rounded-md text-[14px]">
                      <span>{label}</span>
                      <span className="font-semibold" style={{ color: STATUS_COLOR[compliance[key as keyof ComplianceStatus] as string] ?? '#888' }}>
                        {STATUS_LABEL[compliance[key as keyof ComplianceStatus] as string] ?? '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-[#999]">노무/보험 상태가 아직 등록되지 않았습니다.</p>}

            {canMutate && (
              <>
                <hr className="my-5 border-[#f0f0f0]" />
                <h3 className="text-[15px] font-bold mt-0 mb-3">상태 갱신</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {[['nationalPensionStatus', '국민연금'], ['healthInsuranceStatus', '건강보험'],
                    ['employmentInsuranceStatus', '고용보험'], ['industrialAccidentStatus', '산재보험'],
                    ['retirementMutualStatus', '퇴직공제']].map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-[12px] text-muted-brand mb-1 font-semibold">{label}</label>
                      <select value={compForm[key] ?? compliance?.[key as keyof ComplianceStatus] ?? 'NOT_STARTED'}
                        onChange={e => setCompForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[14px]">
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <button onClick={handleCompSubmit} disabled={submitting}
                  className="px-5 py-2 bg-[#1a1a2e] text-white border-none rounded-md cursor-pointer text-[14px]">저장</button>
              </>
            )}
          </div>
        )}

        {/* ── 원문 복호화 (SUPER_ADMIN만) ── */}
        {activeTab === 'decrypt' && isSuperAdmin && (
          <div className="bg-white rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="bg-[#fff3e0] border border-[#ff9800] rounded-lg px-4 py-3 mb-5 text-[13px] text-[#e65100]">
              복호화 조회는 감사로그에 기록됩니다. 반드시 업무상 필요한 경우에만 사용하세요.
              <br />화면 캡처 · 공유 · 재저장을 금지합니다.
            </div>
            <div className="mb-4">
              <label className="block text-[12px] text-muted-brand mb-1 font-semibold">조회 항목 (복수 선택)</label>
              <div className="flex gap-4 flex-wrap mt-2">
                {[['rrn', '주민등록번호'], ['phone', '휴대폰 원문'], ['address', '주소'], ['legalName', '법적 성명']].map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5 text-[14px] cursor-pointer">
                    <input type="checkbox" checked={decryptFields.includes(v)}
                      onChange={e => setDecryptFields(f => e.target.checked ? [...f, v] : f.filter(x => x !== v))} />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[12px] text-muted-brand mb-1 font-semibold">복호화 사유 (필수, 5자 이상)</label>
              <input value={decryptReason} onChange={e => setDecryptReason(e.target.value)}
                className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[14px] box-border"
                placeholder="예: 4대보험 신고를 위한 주민등록번호 확인" />
            </div>
            <button onClick={handleDecrypt}
              disabled={submitting || decryptFields.length === 0 || decryptReason.length < 5}
              className="px-5 py-2 bg-[#c62828] text-white border-none rounded-md cursor-pointer text-[14px]">
              원문 조회
            </button>

            {decryptResult && (
              <div className="mt-5 bg-[#fff3e0] border border-[#ff9800] rounded-lg p-4">
                <div className="text-[12px] text-[#e65100] mb-3 font-semibold">
                  복호화된 원문 데이터 (페이지를 벗어나면 사라집니다)
                </div>
                {Object.entries(decryptResult).map(([k, v]) => (
                  <div key={k} className="flex gap-4 py-1.5 text-[14px] border-b border-[#ffe0b2]">
                    <span className="text-[#e65100] min-w-[120px] font-semibold">{k}</span>
                    <span className="font-mono">{v ?? '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  )
}

function Row({ k, v, mono }: { k: string; v: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex gap-4 py-2 border-b border-[#f0f0f0] text-[14px]">
      <span className="text-muted-brand min-w-[140px] shrink-0">{k}</span>
      <span style={{ fontFamily: mono ? 'monospace' : 'inherit' }}>{v ?? '-'}</span>
    </div>
  )
}

function F({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[12px] text-muted-brand mb-1 font-semibold">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[14px] box-border" />
    </div>
  )
}
