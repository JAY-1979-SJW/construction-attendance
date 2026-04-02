'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  PageShell, PageHeader, FilterBar, FilterInput,
  AdminTable, AdminTr, AdminTd, StatusBadge,
  Btn, FormTextarea, ModalFooter, Modal, MetaRow,
} from '@/components/admin/ui'
import { DetailPanel } from '@/components/admin/ui/DetailPanel'

/* ═══════════════════════════════════════════════════════════
   1. 서류 규칙 정의
   ═══════════════════════════════════════════════════════════ */

type DocRule = 'COMPANY_REQUIRED' | 'SITE_CONDITIONAL' | 'OPTIONAL'

interface DocDef {
  key: string
  name: string
  rule: DocRule
  check: (r: Registration) => boolean
}

const RULE_LABEL: Record<DocRule, string> = {
  COMPANY_REQUIRED: '전사 필수',
  SITE_CONDITIONAL: '현장 조건부',
  OPTIONAL: '선택',
}
const RULE_COLOR: Record<DocRule, string> = {
  COMPANY_REQUIRED: '#dc2626',
  SITE_CONDITIONAL: '#F97316',
  OPTIONAL: '#6B7280',
}

const DOC_DEFS: DocDef[] = [
  { key: 'privacyConsent', name: '개인정보 동의서', rule: 'COMPANY_REQUIRED',
    check: (r) => r.consents.some(c => c.consentType === 'PRIVACY_POLICY' && c.agreed) },
  { key: 'safetyEducation', name: '안전교육 확인서', rule: 'COMPANY_REQUIRED',
    check: (r) => r.safetyDocuments.some(d => d.documentType === 'SAFETY_EDUCATION_NEW_HIRE') },
  { key: 'laborContract', name: '근로계약서', rule: 'SITE_CONDITIONAL',
    check: (r) => r.contracts.length > 0 },
  { key: 'healthDeclaration', name: '건강 각서', rule: 'SITE_CONDITIONAL',
    check: (r) => r.safetyDocuments.some(d => d.documentType === 'HEALTH_DECLARATION') },
  { key: 'healthCert', name: '건강 진단서', rule: 'SITE_CONDITIONAL',
    check: (r) => r.safetyDocuments.some(d => d.documentType === 'HEALTH_CERTIFICATE') },
  { key: 'siteRules', name: '현장 안전수칙 확인서', rule: 'SITE_CONDITIONAL',
    check: (r) => r.safetyDocuments.some(d => d.documentType === 'SITE_SAFETY_RULES_CONFIRM') },
  { key: 'idCard', name: '신분증 사본', rule: 'OPTIONAL',
    check: (r) => r.workerDocuments.some(d => d.documentType === 'ID_CARD') },
  { key: 'insuranceDoc', name: '보험 증빙', rule: 'OPTIONAL',
    check: (r) => r.workerDocuments.some(d => d.documentType === 'INSURANCE_DOC') },
]

const REQUIRED_DOCS = DOC_DEFS.filter(d => d.rule === 'COMPANY_REQUIRED')
const SITE_DOCS = DOC_DEFS.filter(d => d.rule === 'SITE_CONDITIONAL')

/* ═══════════════════════════════════════════════════════════
   2. 승인 가능 조건 체크 (기본정보 + 서류 + PENDING)
   ═══════════════════════════════════════════════════════════ */

interface ApprovalCheck {
  key: string
  label: string
  met: boolean
}

function getApprovalChecks(r: Registration): ApprovalCheck[] {
  return [
    { key: 'status', label: '계정 상태: PENDING', met: r.accountStatus === 'PENDING' },
    { key: 'name', label: '이름 입력', met: !!r.name && r.name.trim() !== '' && r.name !== '미설정' },
    { key: 'phone', label: '전화번호 입력', met: !!r.phone && r.phone.trim() !== '' },
    { key: 'jobTitle', label: '직종 입력', met: !!r.jobTitle && r.jobTitle !== '미설정' },
    { key: 'org', label: '소속 정보 (직영/외주)', met: !!r.organizationType },
    ...REQUIRED_DOCS.map(d => ({
      key: `doc_${d.key}`,
      label: `서류: ${d.name}`,
      met: d.check(r),
    })),
  ]
}

function canApprove(r: Registration): boolean {
  return getApprovalChecks(r).every(c => c.met)
}

/* ═══════════════════════════════════════════════════════════
   3. 현장 투입 가능 상태 (assignmentEligibility)
   ═══════════════════════════════════════════════════════════ */

type AssignmentEligibility = 'READY' | 'NEEDS_CONTRACT' | 'NEEDS_HEALTH_DOCS' | 'NEEDS_SITE_DOCS' | 'NOT_APPROVED'

const ELIGIBILITY_LABEL: Record<AssignmentEligibility, string> = {
  READY: '현장 투입 가능',
  NEEDS_CONTRACT: '계약서 미제출',
  NEEDS_HEALTH_DOCS: '건강서류 미제출',
  NEEDS_SITE_DOCS: '현장서류 미제출',
  NOT_APPROVED: '승인 전',
}
const ELIGIBILITY_COLOR: Record<AssignmentEligibility, string> = {
  READY: '#16a34a',
  NEEDS_CONTRACT: '#F97316',
  NEEDS_HEALTH_DOCS: '#F97316',
  NEEDS_SITE_DOCS: '#F97316',
  NOT_APPROVED: '#9CA3AF',
}

function getAssignmentEligibility(r: Registration): AssignmentEligibility {
  if (r.accountStatus !== 'APPROVED') return 'NOT_APPROVED'
  const hasContract = r.contracts.length > 0
  const hasHealth = r.safetyDocuments.some(d => d.documentType === 'HEALTH_DECLARATION') ||
                    r.safetyDocuments.some(d => d.documentType === 'HEALTH_CERTIFICATE')
  const hasSiteRules = r.safetyDocuments.some(d => d.documentType === 'SITE_SAFETY_RULES_CONFIRM')
  if (!hasContract) return 'NEEDS_CONTRACT'
  if (!hasHealth) return 'NEEDS_HEALTH_DOCS'
  if (!hasSiteRules) return 'NEEDS_SITE_DOCS'
  return 'READY'
}

/** 서류 요약 (테이블 컬럼용) */
function getDocSummary(r: Registration) {
  const requiredDone = REQUIRED_DOCS.filter(d => d.check(r)).length
  const requiredTotal = REQUIRED_DOCS.length
  const allDone = DOC_DEFS.filter(d => d.check(r)).length
  const allTotal = DOC_DEFS.length
  return { requiredDone, requiredTotal, allDone, allTotal, requiredMet: requiredDone === requiredTotal }
}

/* ═══════════════════════════════════════════════════════════
   4. 타입 / 상수
   ═══════════════════════════════════════════════════════════ */

interface Registration {
  id: string
  name: string
  phone: string | null
  jobTitle: string
  username: string | null
  email: string | null
  birthDate: string | null
  accountStatus: string
  rejectReason: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
  organizationType: string | null
  companyAssignments: { companyId: string; employmentType: string; company: { name: string } }[]
  devices: { deviceName: string; approvedAt: string | null }[]
  siteJoinRequests: { siteId: string; status: string }[]
  consents: { consentType: string; agreed: boolean; agreedAt: string | null }[]
  safetyDocuments: { documentType: string; status: string; createdAt: string }[]
  workerDocuments: { documentType: string; status: string; createdAt: string }[]
  contracts: { id: string; status: string; createdAt: string }[]
  _count: { safetyDocuments: number; contracts: number; consents: number; workerDocuments: number }
}

interface Counts { PENDING: number; APPROVED: number; REJECTED: number; SUSPENDED: number }

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', APPROVED: '승인', REJECTED: '반려', SUSPENDED: '정지',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F97316', APPROVED: '#16a34a', REJECTED: '#dc2626', SUSPENDED: '#6B7280',
}
const ORG_LABEL: Record<string, string> = {
  DIRECT: '직영', SUBCONTRACTOR: '외주(협력사)',
}

/* ═══════════════════════════════════════════════════════════
   5. 페이지 컴포넌트
   ═══════════════════════════════════════════════════════════ */

export default function RegistrationsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [data, setData] = useState<Registration[]>([])
  const [counts, setCounts] = useState<Counts>({ PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [modalTarget, setModalTarget] = useState<{ id: string; action: 'reject' | 'suspend' } | null>(null)
  const [modalReason, setModalReason] = useState('')
  const [processing, setProcessing] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'warning'>('success')
  const [selected, setSelected] = useState<Registration | null>(null)

  const loadCounts = useCallback(async () => {
    const results = await Promise.all(
      (['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map(st =>
        fetch(`/api/admin/registrations?status=${st}&limit=0`).then(r => r.json()).then(d => [st, d.pagination?.total ?? 0] as const)
      )
    )
    setCounts(Object.fromEntries(results) as unknown as Counts)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/admin/registrations?status=${filter}&limit=100`)
    const d = await res.json()
    setData(d.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { loadCounts() }, [loadCounts])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q) ||
      (r.phone ?? '').includes(q)
    )
  }, [data, search])

  /* ── 액션 ── */

  function showMsg(message: string, warning?: string) {
    if (warning) {
      setMsg(warning)
      setMsgType('warning')
    } else {
      setMsg(message)
      setMsgType('success')
    }
  }

  async function approve(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/admin/registrations/${id}/approve`, { method: 'POST' })
    const d = await res.json()
    showMsg(d.message ?? '', d.warning)
    setProcessing('')
    setSelected(null)
    load()
    loadCounts()
  }

  async function submitRejectOrSuspend() {
    if (!modalTarget) return
    if (!modalReason.trim()) {
      showMsg(modalTarget.action === 'reject' ? '반려 사유를 입력하세요.' : '정지 사유를 입력하세요.')
      return
    }
    setProcessing(modalTarget.id)
    const endpoint = modalTarget.action === 'reject'
      ? `/api/admin/registrations/${modalTarget.id}/reject`
      : `/api/admin/registrations/${modalTarget.id}/suspend`
    const bodyKey = modalTarget.action === 'reject' ? 'rejectReason' : 'reason'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [bodyKey]: modalReason }),
    })
    const d = await res.json()
    showMsg(d.message ?? '', d.warning)
    setProcessing('')
    closeModal()
    setSelected(null)
    load()
    loadCounts()
  }

  function closeModal() {
    setModalTarget(null)
    setModalReason('')
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  // 선택된 항목의 승인 체크
  const approvalChecks = selected ? getApprovalChecks(selected) : []
  const isApprovable = selected ? canApprove(selected) : false

  return (
    <PageShell>
      <PageHeader title="회원가입 승인" description="신규 가입 요청을 확인하고 승인합니다" />

      {/* ── 요약 카드 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
        {(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map(st => (
          <button key={st} onClick={() => { setFilter(st); setSelected(null) }}
            className={`rounded-xl px-4 py-3 text-left border transition-colors cursor-pointer ${
              filter === st ? 'border-accent bg-[rgba(249,115,22,0.08)]' : 'border-[rgba(91,164,217,0.15)] bg-card'
            }`}>
            <div className="text-[12px] text-muted-brand mb-1">{STATUS_LABEL[st]}</div>
            <div className="text-[22px] font-bold" style={{ color: STATUS_COLOR[st] }}>{counts[st]}</div>
          </button>
        ))}
      </div>

      {/* ── 검색 ── */}
      <FilterBar>
        <FilterInput
          placeholder="이름, 이메일, 전화번호 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-[360px]"
        />
      </FilterBar>

      {msg && (
        <div
          className="rounded-lg px-4 py-[10px] mb-4 text-[13px]"
          style={{
            backgroundColor: msgType === 'warning' ? 'rgba(249,115,22,0.1)' : 'rgba(22,163,74,0.1)',
            borderColor: msgType === 'warning' ? 'rgba(249,115,22,0.3)' : 'rgba(22,163,74,0.3)',
            color: msgType === 'warning' ? '#F97316' : '#16a34a',
            borderWidth: 1,
            borderStyle: 'solid',
          }}
        >
          {msg}
        </div>
      )}

      {/* ── 반려/정지 사유 모달 ── */}
      <Modal
        open={!!modalTarget}
        onClose={closeModal}
        title={modalTarget?.action === 'reject' ? '반려 사유 입력' : '정지 사유 입력'}
      >
        <p className="text-[13px] text-muted-brand mb-3">
          {modalTarget?.action === 'reject'
            ? '반려 사유를 입력하면 근로자에게 이메일로 안내됩니다.'
            : '정지 사유를 입력하세요. 정지된 계정은 로그인이 차단됩니다.'}
        </p>
        <FormTextarea
          value={modalReason}
          onChange={e => setModalReason(e.target.value)}
          placeholder={modalTarget?.action === 'reject' ? '반려 사유를 입력하세요. (1~200자)' : '정지 사유를 입력하세요. (1~200자)'}
          rows={3}
        />
        {modalReason.length > 200 && (
          <p className="text-[12px] text-status-rejected mt-1">{modalReason.length}/200자 — 초과</p>
        )}
        <ModalFooter>
          <Btn variant="ghost" onClick={closeModal}>취소</Btn>
          <Btn
            variant="danger"
            onClick={submitRejectOrSuspend}
            disabled={
              (!!modalTarget && processing === modalTarget.id) ||
              !modalReason.trim() ||
              modalReason.length > 200
            }
          >
            {modalTarget && processing === modalTarget.id
              ? '처리 중...'
              : modalTarget?.action === 'reject' ? '반려' : '정지'}
          </Btn>
        </ModalFooter>
      </Modal>

      {/* ── 목록 테이블 ── */}
      {loading ? (
        <div className="text-center py-16 text-muted2-brand">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted2-brand">
          {search ? '검색 결과가 없습니다.' : `${STATUS_LABEL[filter]} 상태의 신청이 없습니다.`}
        </div>
      ) : (
        <AdminTable headers={[
          '이름', '이메일', '직종', '필수서류', '전체서류',
          ...(filter === 'APPROVED' ? ['투입 가능'] : []),
          '가입일시', '상태', '',
        ]}>
          {filtered.map(r => {
            const ds = getDocSummary(r)
            const eligibility = r.accountStatus === 'APPROVED' ? getAssignmentEligibility(r) : null
            return (
            <AdminTr key={r.id} onClick={() => setSelected(r)} highlighted={selected?.id === r.id}>
              <AdminTd>
                <div className="font-semibold text-[13px] text-fore-brand">{r.name}</div>
                {r.phone && <div className="text-[11px] text-muted2-brand">{r.phone}</div>}
              </AdminTd>
              <AdminTd>{r.email ?? <span className="text-muted2-brand">-</span>}</AdminTd>
              <AdminTd>{r.jobTitle}</AdminTd>
              <AdminTd>
                <div className="flex items-center gap-1 text-[12px]">
                  <span style={{ color: ds.requiredMet ? '#16a34a' : '#dc2626' }}>
                    {ds.requiredMet ? '●' : '○'}
                  </span>
                  <span className={ds.requiredMet ? 'text-status-working font-medium' : 'text-status-rejected'}>
                    {ds.requiredDone}/{ds.requiredTotal}
                  </span>
                </div>
              </AdminTd>
              <AdminTd>
                <span className="text-[12px] text-muted-brand">{ds.allDone}/{ds.allTotal}</span>
              </AdminTd>
              {/* 승인 탭에서만 투입 가능 상태 표시 */}
              {filter === 'APPROVED' && eligibility && (
                <AdminTd>
                  <span
                    className="text-[11px] px-[6px] py-[2px] rounded font-medium"
                    style={{
                      backgroundColor: `${ELIGIBILITY_COLOR[eligibility]}14`,
                      color: ELIGIBILITY_COLOR[eligibility],
                    }}
                  >
                    {ELIGIBILITY_LABEL[eligibility]}
                  </span>
                </AdminTd>
              )}
              <AdminTd className="text-[12px] text-muted2-brand">{fmtDate(r.createdAt)}</AdminTd>
              <AdminTd>
                <StatusBadge status={r.accountStatus} label={STATUS_LABEL[r.accountStatus]} />
              </AdminTd>
              <AdminTd>
                {r.accountStatus === 'PENDING' && (
                  <div className="flex gap-[6px]" onClick={e => e.stopPropagation()}>
                    <Btn variant="success" size="xs" onClick={() => approve(r.id)}
                      disabled={processing === r.id || !canApprove(r)}>승인</Btn>
                    <Btn variant="danger" size="xs"
                      onClick={() => setModalTarget({ id: r.id, action: 'reject' })}>반려</Btn>
                  </div>
                )}
                {r.accountStatus === 'APPROVED' && (
                  <div onClick={e => e.stopPropagation()}>
                    <Btn variant="ghost" size="xs"
                      onClick={() => setModalTarget({ id: r.id, action: 'suspend' })}>정지</Btn>
                  </div>
                )}
              </AdminTd>
            </AdminTr>
            )
          })}
        </AdminTable>
      )}

      {/* ── 상세 패널 ── */}
      <DetailPanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? `${selected.jobTitle} · ${STATUS_LABEL[selected.accountStatus]}` : undefined}
        actions={selected ? (
          <>
            {selected.accountStatus === 'PENDING' && (
              <>
                <Btn variant="danger" size="sm"
                  onClick={() => setModalTarget({ id: selected.id, action: 'reject' })}>반려</Btn>
                <Btn
                  variant="success" size="sm"
                  onClick={() => approve(selected.id)}
                  disabled={processing === selected.id || !isApprovable}
                  title={!isApprovable ? '승인 조건을 확인하세요' : undefined}
                >
                  {processing === selected.id ? '처리 중...' : '승인'}
                </Btn>
              </>
            )}
            {selected.accountStatus === 'APPROVED' && (
              <Btn variant="danger" size="sm"
                onClick={() => setModalTarget({ id: selected.id, action: 'suspend' })}>계정 정지</Btn>
            )}
          </>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-5">
            {/* ── 기본 정보 ── */}
            <section>
              <h4 className="text-[12px] font-semibold text-muted2-brand uppercase tracking-wider mb-3">기본 정보</h4>
              <div className="space-y-2">
                <MetaRow label="이메일">{selected.email ?? '-'}</MetaRow>
                <MetaRow label="전화번호">{selected.phone ?? '-'}</MetaRow>
                <MetaRow label="생년월일">{selected.birthDate ?? '-'}</MetaRow>
                <MetaRow label="직종">{selected.jobTitle}</MetaRow>
                <MetaRow label="소속 유형">{ORG_LABEL[selected.organizationType ?? ''] ?? '-'}</MetaRow>
                {selected.companyAssignments.length > 0 && (
                  <MetaRow label="소속 업체">{selected.companyAssignments[0].company.name}</MetaRow>
                )}
                <MetaRow label="가입일시">{new Date(selected.createdAt).toLocaleString('ko-KR')}</MetaRow>
                <MetaRow label="상태">
                  <StatusBadge status={selected.accountStatus} label={STATUS_LABEL[selected.accountStatus]} />
                </MetaRow>
                {selected.reviewedAt && (
                  <MetaRow label="검토일시">{new Date(selected.reviewedAt).toLocaleString('ko-KR')}</MetaRow>
                )}
                {selected.rejectReason && (
                  <MetaRow label="반려/정지 사유">
                    <span className="text-status-rejected">{selected.rejectReason}</span>
                  </MetaRow>
                )}
                {selected.devices.length > 0 && (
                  <MetaRow label="등록 기기">{selected.devices[0].deviceName}</MetaRow>
                )}
                {selected.siteJoinRequests.length > 0 && (
                  <MetaRow label="현장 참여">{selected.siteJoinRequests.length}건</MetaRow>
                )}
              </div>
            </section>

            {/* ── 승인 가능 조건 (PENDING) ── */}
            {selected.accountStatus === 'PENDING' && (
              <section>
                <h4 className="text-[12px] font-semibold text-muted2-brand uppercase tracking-wider mb-3">승인 가능 조건</h4>
                <div
                  className="rounded-lg px-3 py-2 mb-3 text-[13px] font-medium"
                  style={{
                    backgroundColor: isApprovable ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                    color: isApprovable ? '#16a34a' : '#dc2626',
                    border: `1px solid ${isApprovable ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
                  }}
                >
                  {isApprovable ? '모든 조건 충족 — 승인 가능' : '승인 불가 — 아래 항목 확인'}
                </div>
                <div className="space-y-[4px]">
                  {approvalChecks.map(c => (
                    <div key={c.key} className="flex items-center gap-2 text-[12px]">
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                        backgroundColor: c.met ? '#16a34a' : '#dc2626',
                      }} />
                      <span className={c.met ? 'text-body-brand' : 'text-status-rejected font-medium'}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── 현장 투입 가능 상태 (APPROVED) ── */}
            {selected.accountStatus === 'APPROVED' && (() => {
              const elig = getAssignmentEligibility(selected)
              const siteMissing = SITE_DOCS.filter(d => !d.check(selected))
              return (
                <section>
                  <h4 className="text-[12px] font-semibold text-muted2-brand uppercase tracking-wider mb-3">현장 투입 가능 상태</h4>
                  <div
                    className="rounded-lg px-3 py-2 mb-3 text-[13px] font-medium"
                    style={{
                      backgroundColor: elig === 'READY' ? 'rgba(22,163,74,0.08)' : 'rgba(249,115,22,0.08)',
                      color: ELIGIBILITY_COLOR[elig],
                      border: `1px solid ${elig === 'READY' ? 'rgba(22,163,74,0.2)' : 'rgba(249,115,22,0.2)'}`,
                    }}
                  >
                    {ELIGIBILITY_LABEL[elig]}
                  </div>
                  {siteMissing.length > 0 && (
                    <div className="space-y-[4px]">
                      <p className="text-[11px] text-muted2-brand mb-1">미제출 현장 서류:</p>
                      {siteMissing.map(d => (
                        <div key={d.key} className="flex items-center gap-2 text-[12px]">
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                            backgroundColor: '#F97316',
                          }} />
                          <span className="text-accent">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })()}

            {/* ── 서류 현황 ── */}
            <section>
              <h4 className="text-[12px] font-semibold text-muted2-brand uppercase tracking-wider mb-3">서류 현황</h4>
              <div className="space-y-[6px]">
                {DOC_DEFS.map((doc) => {
                  const submitted = doc.check(selected)
                  return (
                    <div key={doc.key} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 text-[13px]">
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                          backgroundColor: submitted ? '#16a34a' : '#E5E7EB',
                        }} />
                        <span className={submitted ? 'text-fore-brand' : 'text-muted2-brand'}>{doc.name}</span>
                      </div>
                      <span
                        className="text-[11px] px-[6px] py-[1px] rounded"
                        style={{
                          backgroundColor: `${RULE_COLOR[doc.rule]}12`,
                          color: RULE_COLOR[doc.rule],
                        }}
                      >
                        {RULE_LABEL[doc.rule]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── 동의 현황 ── */}
            {selected.consents.length > 0 && (
              <section>
                <h4 className="text-[12px] font-semibold text-muted2-brand uppercase tracking-wider mb-3">동의 현황</h4>
                <div className="space-y-[4px]">
                  {selected.consents.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px]">
                      <span style={{ color: c.agreed ? '#16a34a' : '#dc2626' }}>
                        {c.agreed ? '●' : '○'}
                      </span>
                      <span className="text-body-brand">{c.consentType.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </DetailPanel>
    </PageShell>
  )
}
