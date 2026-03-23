'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
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

export default function WorkerSensitivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workerId } = use(params)
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

  if (loading) return <div style={{ padding: '32px' }}>로딩 중...</div>

  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.sidebarTitle}>해한 출퇴근</div>
        {[['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/attendance', '출퇴근 조회'],
          ['/admin/device-requests', '기기 승인'], ['/admin/devices', '기기 차단'], ['/admin/policies', '약관 관리']
        ].map(([href, label]) => <Link key={href} href={href} style={s.navItem}>{label}</Link>)}
      </nav>

      <main style={s.main}>
        <div style={{ marginBottom: '20px' }}>
          <Link href={`/admin/workers/${workerId}`} style={{ color: '#A0AEC0', fontSize: '14px' }}>← {workerName}</Link>
          <h1 style={s.pageTitle}>개인정보 관리 — {workerName}</h1>
        </div>

        <div style={s.notice}>
          출퇴근 가능 여부(계정 승인)와 노무/4대보험 완료 상태는 별도로 관리됩니다.
          신분증 파일은 시스템에 저장하지 않습니다.
        </div>

        {msg && <div style={{ ...s.msgBox, background: msg.ok ? '#e8f5e9' : '#ffebee', borderColor: msg.ok ? '#a5d6a7' : '#ef9a9a', color: msg.ok ? '#2e7d32' : '#c62828', marginBottom: '16px' }}>{msg.text}</div>}

        <div style={s.tabRow}>
          {[['sensitive', '민감정보'], ['bank', '계좌정보'], ['compliance', '노무/보험 상태'],
            ...(isSuperAdmin ? [['decrypt', '원문 복호화']] : [])
          ].map(([v, label]) => (
            <button key={v} onClick={() => { setActiveTab(v as never); setMsg(null) }}
              style={{ ...s.tab, ...(activeTab === v ? s.tabActive : {}) }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 민감정보 ── */}
        {activeTab === 'sensitive' && (
          <div style={s.card}>
            <h3 style={s.sectionTitle}>현재 저장값 (마스킹)</h3>
            {sensitive ? (
              <div style={s.rows}>
                <Row k="법적 성명" v={sensitive.legalName} />
                <Row k="주민등록번호" v={sensitive.rrnMasked} mono />
                <Row k="휴대폰 원문" v={sensitive.phoneMasked} mono />
                <Row k="주소" v={sensitive.addressMasked} />
                <Row k="신분증 확인" v={sensitive.idVerified ? `완료 — ${sensitive.idDocumentType ?? ''}` : '미확인'} />
                <Row k="확인 방식" v={sensitive.idVerificationMethod ?? '-'} />
                <Row k="확인 메모" v={sensitive.idVerificationNote} />
                <Row k="최종 수정" v={fmt(sensitive.updatedAt)} />
              </div>
            ) : <p style={{ color: '#718096', margin: 0 }}>등록된 정보가 없습니다.</p>}

            {canMutate && (
              <>
                <hr style={{ margin: '20px 0', borderColor: '#f0f0f0' }} />
                <h3 style={s.sectionTitle}>입력/수정</h3>
                <p style={s.notice}>신분증 파일은 시스템에 저장하지 않습니다. 필요 시 본사 보안 채널로 별도 처리하세요.</p>
                <div style={s.grid2}>
                  <F label="법적 성명" value={sensForm.legalName} onChange={v => setSensForm(f => ({ ...f, legalName: v }))} />
                  <F label="주민등록번호 (13자리)" value={sensForm.rrn} onChange={v => setSensForm(f => ({ ...f, rrn: v }))} type="password" placeholder="갱신 시에만 입력" />
                  <F label="휴대폰 원문 (하이픈 제외)" value={sensForm.phone} onChange={v => setSensForm(f => ({ ...f, phone: v }))} placeholder="갱신 시에만 입력" />
                  <F label="주소" value={sensForm.address} onChange={v => setSensForm(f => ({ ...f, address: v }))} />
                  <F label="신분증 종류" value={sensForm.idDocumentType} onChange={v => setSensForm(f => ({ ...f, idDocumentType: v }))} placeholder="주민등록증, 운전면허증 등" />
                  <div>
                    <label style={s.label}>확인 방식</label>
                    <select value={sensForm.idVerificationMethod} onChange={e => setSensForm(f => ({ ...f, idVerificationMethod: e.target.value }))} style={s.select}>
                      <option value="IN_PERSON">대면 확인</option>
                      <option value="SECURE_DOCUMENT">보안 채널 서류</option>
                      <option value="ADMIN_MANUAL">관리자 수동</option>
                    </select>
                  </div>
                  <F label="확인 메모" value={sensForm.idVerificationNote} onChange={v => setSensForm(f => ({ ...f, idVerificationNote: v }))} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="idVerified" checked={sensForm.idVerified} onChange={e => setSensForm(f => ({ ...f, idVerified: e.target.checked }))} />
                    <label htmlFor="idVerified" style={{ fontSize: '14px', cursor: 'pointer' }}>신분증 확인 완료</label>
                  </div>
                </div>
                <button onClick={handleSensSubmit} disabled={submitting} style={s.btn}>저장</button>
              </>
            )}
          </div>
        )}

        {/* ── 계좌정보 ── */}
        {activeTab === 'bank' && (
          <div style={s.card}>
            <h3 style={s.sectionTitle}>현재 저장값 (마스킹)</h3>
            {bank ? (
              <div style={s.rows}>
                <Row k="은행명" v={bank.bankName} />
                <Row k="계좌번호" v={bank.accountNumberMasked} mono />
                <Row k="예금주명" v={bank.accountHolderNameMasked} />
                <Row k="최종 수정" v={fmt(bank.updatedAt)} />
              </div>
            ) : <p style={{ color: '#718096', margin: 0 }}>등록된 계좌정보가 없습니다.</p>}

            {canMutate && (
              <>
                <hr style={{ margin: '20px 0', borderColor: '#f0f0f0' }} />
                <h3 style={s.sectionTitle}>계좌 입력/수정</h3>
                <div style={s.grid2}>
                  <F label="은행 코드" value={bankForm.bankCode} onChange={v => setBankForm(f => ({ ...f, bankCode: v }))} placeholder="예: 004 (국민은행)" />
                  <F label="은행명" value={bankForm.bankName} onChange={v => setBankForm(f => ({ ...f, bankName: v }))} />
                  <F label="계좌번호 (숫자만)" value={bankForm.accountNumber} onChange={v => setBankForm(f => ({ ...f, accountNumber: v }))} type="password" placeholder="갱신 시에만 입력" />
                  <F label="예금주명" value={bankForm.accountHolderName} onChange={v => setBankForm(f => ({ ...f, accountHolderName: v }))} />
                </div>
                <button onClick={handleBankSubmit} disabled={submitting} style={s.btn}>저장</button>
              </>
            )}
          </div>
        )}

        {/* ── 노무/보험 상태 ── */}
        {activeTab === 'compliance' && (
          <div style={s.card}>
            <div style={s.notice}>출퇴근 가능 여부와 이 상태는 별도입니다. 근로자가 출퇴근 가능해도 보험 미완료일 수 있습니다.</div>
            {compliance ? (
              <>
                <div style={s.rows}>
                  <Row k="기본 신원 확인" v={compliance.basicIdentityChecked ? '완료' : '미완료'} />
                  <Row k="주민번호 수집" v={compliance.rrnCollected ? '완료' : '미완료'} />
                  <Row k="주소 수집" v={compliance.addressCollected ? '완료' : '미완료'} />
                  <Row k="계좌 수집" v={compliance.bankInfoCollected ? '완료' : '미완료'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                  {[['국민연금', 'nationalPensionStatus'], ['건강보험', 'healthInsuranceStatus'],
                    ['고용보험', 'employmentInsuranceStatus'], ['산재보험', 'industrialAccidentStatus'],
                    ['퇴직공제', 'retirementMutualStatus']].map(([label, key]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9f9f9', borderRadius: '6px', fontSize: '14px' }}>
                      <span>{label}</span>
                      <span style={{ color: STATUS_COLOR[compliance[key as keyof ComplianceStatus] as string] ?? '#888', fontWeight: 600 }}>
                        {STATUS_LABEL[compliance[key as keyof ComplianceStatus] as string] ?? '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p style={{ color: '#999' }}>노무/보험 상태가 아직 등록되지 않았습니다.</p>}

            {canMutate && (
              <>
                <hr style={{ margin: '20px 0', borderColor: '#f0f0f0' }} />
                <h3 style={s.sectionTitle}>상태 갱신</h3>
                <div style={s.grid2}>
                  {[['nationalPensionStatus', '국민연금'], ['healthInsuranceStatus', '건강보험'],
                    ['employmentInsuranceStatus', '고용보험'], ['industrialAccidentStatus', '산재보험'],
                    ['retirementMutualStatus', '퇴직공제']].map(([key, label]) => (
                    <div key={key}>
                      <label style={s.label}>{label}</label>
                      <select value={compForm[key] ?? compliance?.[key as keyof ComplianceStatus] ?? 'NOT_STARTED'}
                        onChange={e => setCompForm(f => ({ ...f, [key]: e.target.value }))} style={s.select}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <button onClick={handleCompSubmit} disabled={submitting} style={s.btn}>저장</button>
              </>
            )}
          </div>
        )}

        {/* ── 원문 복호화 (SUPER_ADMIN만) ── */}
        {activeTab === 'decrypt' && isSuperAdmin && (
          <div style={s.card}>
            <div style={{ background: '#fff3e0', border: '1px solid #ff9800', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#e65100' }}>
              복호화 조회는 감사로그에 기록됩니다. 반드시 업무상 필요한 경우에만 사용하세요.
              <br />화면 캡처 · 공유 · 재저장을 금지합니다.
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>조회 항목 (복수 선택)</label>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
                {[['rrn', '주민등록번호'], ['phone', '휴대폰 원문'], ['address', '주소'], ['legalName', '법적 성명']].map(([v, l]) => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={decryptFields.includes(v)}
                      onChange={e => setDecryptFields(f => e.target.checked ? [...f, v] : f.filter(x => x !== v))} />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>복호화 사유 (필수, 5자 이상)</label>
              <input value={decryptReason} onChange={e => setDecryptReason(e.target.value)}
                style={{ ...s.input, width: '100%' }} placeholder="예: 4대보험 신고를 위한 주민등록번호 확인" />
            </div>
            <button onClick={handleDecrypt}
              disabled={submitting || decryptFields.length === 0 || decryptReason.length < 5}
              style={{ ...s.btn, background: '#c62828' }}>
              원문 조회
            </button>

            {decryptResult && (
              <div style={{ marginTop: '20px', background: '#fff3e0', border: '1px solid #ff9800', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#e65100', marginBottom: '12px', fontWeight: 600 }}>
                  복호화된 원문 데이터 (페이지를 벗어나면 사라집니다)
                </div>
                {Object.entries(decryptResult).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: '16px', padding: '6px 0', fontSize: '14px', borderBottom: '1px solid #ffe0b2' }}>
                    <span style={{ color: '#e65100', minWidth: '120px', fontWeight: 600 }}>{k}</span>
                    <span style={{ fontFamily: 'monospace' }}>{v ?? '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Row({ k, v, mono }: { k: string; v: string | null | undefined; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '16px', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
      <span style={{ color: '#A0AEC0', minWidth: '140px', flexShrink: 0 }}>{k}</span>
      <span style={{ fontFamily: mono ? 'monospace' : 'inherit' }}>{v ?? '-'}</span>
    </div>
  )
}

function F({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s.input} />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: '#1B2838' },
  sidebar: { width: '220px', background: '#141E2A', padding: '24px 0', flexShrink: 0 },
  sidebarTitle: { color: 'white', fontSize: '16px', fontWeight: 700, padding: '0 20px 24px' },
  navItem: { display: 'block', color: 'rgba(255,255,255,0.8)', padding: '10px 20px', fontSize: '14px', textDecoration: 'none' },
  main: { flex: 1, padding: '32px' },
  pageTitle: { fontSize: '22px', fontWeight: 700, margin: '4px 0 16px' },
  notice: { background: 'rgba(91,164,217,0.1)', border: '1px solid #90caf9', borderRadius: '6px', padding: '8px 14px', fontSize: '13px', color: '#4A93C8', marginBottom: '16px' },
  msgBox: { border: '1px solid', borderRadius: '8px', padding: '12px 16px', fontSize: '14px' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tab: { padding: '8px 20px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', background: '#243144', cursor: 'pointer', fontSize: '14px', color: '#A0AEC0' },
  tabActive: { background: '#1a1a2e', color: 'white', borderColor: '#1a1a2e' },
  card: { background: '#243144', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  sectionTitle: { fontSize: '15px', fontWeight: 700, marginTop: 0, marginBottom: '12px' },
  rows: { display: 'flex', flexDirection: 'column' as const },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', color: '#A0AEC0', marginBottom: '4px', fontWeight: 600 },
  input: { width: '100%', padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' as const },
  select: { width: '100%', padding: '8px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '14px' },
  btn: { padding: '8px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
}
