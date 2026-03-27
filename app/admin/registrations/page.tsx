'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageShell, PageHeader, SectionCard, FilterBar, FilterInput, AdminTable, AdminTr, AdminTd, StatusBadge, Btn, FormTextarea, ModalFooter } from '@/components/admin/ui'

/** 서류 항목 정의 */
const DOCUMENTS = [
  { key: 'privacyConsent', name: '개인정보 동의서', auto: true },
  { key: 'laborContract', name: '근로계약서', auto: false },
  { key: 'safetyTraining', name: '안전교육 확인서', auto: false },
  { key: 'healthPledge', name: '건강 각서', auto: false },
  { key: 'healthCert', name: '건강 증명서', auto: false },
] as const

/** 서류 제출 현황 계산 (API _count 기반) */
function getDocStatus(r: Registration) {
  let done = 0
  if (r._count.consents > 0) done++       // 개인정보 동의
  if (r._count.contracts > 0) done++       // 근로계약서
  if (r._count.safetyDocuments > 0) done++ // 안전서류 (건강 포함)
  return { done, total: DOCUMENTS.length }
}

interface Registration {
  id: string
  name: string
  phone: string | null
  jobTitle: string
  username: string | null
  email: string | null
  accountStatus: string
  rejectReason: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
  devices: { deviceName: string; approvedAt: string | null }[]
  siteJoinRequests: { siteId: string; status: string }[]
  _count: { safetyDocuments: number; contracts: number; consents: number }
}

interface Counts { PENDING: number; APPROVED: number; REJECTED: number; SUSPENDED: number }

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', APPROVED: '승인', REJECTED: '반려', SUSPENDED: '정지',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F97316', APPROVED: '#16a34a', REJECTED: '#dc2626', SUSPENDED: '#6B7280',
}

export default function RegistrationsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [data, setData] = useState<Registration[]>([])
  const [counts, setCounts] = useState<Counts>({ PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState('')
  const [msg, setMsg] = useState('')
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

  const filtered = search.trim()
    ? data.filter(r =>
        r.name.includes(search) ||
        (r.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.phone ?? '').includes(search)
      )
    : data

  async function approve(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/admin/registrations/${id}/approve`, { method: 'POST' })
    const d = await res.json()
    setMsg(d.message ?? '')
    setProcessing('')
    load()
    loadCounts()
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) { setMsg('반려 사유를 입력하세요.'); return }
    setProcessing(id)
    const res = await fetch(`/api/admin/registrations/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectReason }),
    })
    const d = await res.json()
    setMsg(d.message ?? '')
    setProcessing('')
    setRejectId(null)
    setRejectReason('')
    load()
    loadCounts()
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <PageShell>
      <PageHeader title="회원가입 승인" description="신규 가입 요청을 확인하고 승인합니다" />

      {/* ── 요약 카드 ── */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map(st => (
          <button key={st} onClick={() => { setFilter(st); setSelected(null) }}
            className={`rounded-xl px-4 py-3 text-left border transition-colors cursor-pointer ${
              filter === st ? 'border-[#F97316] bg-[rgba(249,115,22,0.08)]' : 'border-[rgba(91,164,217,0.15)] bg-card'
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
        <div className="bg-[rgba(22,163,74,0.1)] border border-[rgba(22,163,74,0.3)] rounded-lg px-4 py-[10px] mb-4 text-[#16a34a] text-[13px]">
          {msg}
        </div>
      )}

      {/* ── 반려 모달 ── */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
          <div className="bg-card rounded-xl p-7 w-[360px] shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
            <h3 className="m-0 mb-4 text-base font-bold">반려 사유</h3>
            <FormTextarea
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요." rows={3}
            />
            <ModalFooter>
              <Btn variant="ghost" onClick={() => { setRejectId(null); setRejectReason('') }}>취소</Btn>
              <Btn variant="danger" onClick={() => reject(rejectId)} disabled={processing === rejectId}>
                {processing === rejectId ? '처리 중...' : '반려'}
              </Btn>
            </ModalFooter>
          </div>
        </div>
      )}

      <div className="flex gap-5">
        {/* ── 목록 ── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-16 text-[#9CA3AF]">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-[#9CA3AF]">{search ? '검색 결과가 없습니다.' : `${STATUS_LABEL[filter]} 상태의 신청이 없습니다.`}</div>
          ) : (
            <AdminTable headers={['이름', '이메일', '직종', '서류', '가입일시', '상태', '']}>
              {filtered.map(r => {
                const doc = getDocStatus(r)
                return (
                <AdminTr key={r.id} onClick={() => setSelected(r)} highlighted={selected?.id === r.id}>
                  <AdminTd>
                    <div className="font-semibold text-[13px] text-[#111827]">{r.name}</div>
                    {r.phone && <div className="text-[11px] text-[#9CA3AF]">{r.phone}</div>}
                  </AdminTd>
                  <AdminTd>{r.email ?? <span className="text-[#9CA3AF]">-</span>}</AdminTd>
                  <AdminTd>{r.jobTitle}</AdminTd>
                  <AdminTd>
                    <div className="flex items-center gap-1 text-[12px]">
                      <span style={{ color: doc.done === doc.total ? '#16a34a' : '#F97316' }}>
                        {doc.done === doc.total ? '●' : '○'}
                      </span>
                      <span className="text-[#6B7280]">{doc.done}/{doc.total}</span>
                    </div>
                  </AdminTd>
                  <AdminTd className="text-[12px] text-[#9CA3AF]">{fmtDate(r.createdAt)}</AdminTd>
                  <AdminTd>
                    <StatusBadge status={r.accountStatus} label={STATUS_LABEL[r.accountStatus]} />
                  </AdminTd>
                  <AdminTd>
                    {r.accountStatus === 'PENDING' && (
                      <div className="flex gap-[6px]" onClick={e => e.stopPropagation()}>
                        <Btn variant="success" size="xs" onClick={() => approve(r.id)} disabled={processing === r.id}>승인</Btn>
                        <Btn variant="danger" size="xs" onClick={() => { setRejectId(r.id); setRejectReason('') }}>반려</Btn>
                      </div>
                    )}
                  </AdminTd>
                </AdminTr>
                )
              })}
            </AdminTable>
          )}
        </div>

        {/* ── 상세 패널 ── */}
        {selected && (
          <div className="w-[280px] shrink-0">
            <SectionCard className="sticky top-[80px]">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-[15px] font-bold text-[#111827] m-0">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="bg-transparent border-0 text-[#9CA3AF] text-[18px] cursor-pointer leading-none hover:text-[#6B7280]">×</button>
              </div>
              <div className="space-y-3 text-[13px]">
                <div><span className="text-[#9CA3AF]">이메일</span><div className="mt-[2px] text-[#374151]">{selected.email ?? '-'}</div></div>
                <div><span className="text-[#9CA3AF]">전화번호</span><div className="mt-[2px] text-[#374151]">{selected.phone ?? '-'}</div></div>
                <div><span className="text-[#9CA3AF]">직종</span><div className="mt-[2px] text-[#374151]">{selected.jobTitle}</div></div>
                <div><span className="text-[#9CA3AF]">가입일시</span><div className="mt-[2px] text-[#374151]">{new Date(selected.createdAt).toLocaleString('ko-KR')}</div></div>
                <div><span className="text-[#9CA3AF]">상태</span><div className="mt-[2px]"><StatusBadge status={selected.accountStatus} label={STATUS_LABEL[selected.accountStatus]} /></div></div>
                {selected.reviewedAt && (
                  <div><span className="text-[#9CA3AF]">검토일시</span><div className="mt-[2px] text-[#374151]">{new Date(selected.reviewedAt).toLocaleString('ko-KR')}</div></div>
                )}
                {selected.rejectReason && (
                  <div><span className="text-[#9CA3AF]">반려 사유</span><div className="mt-[2px] text-[#dc2626]">{selected.rejectReason}</div></div>
                )}
                {selected.devices.length > 0 && (
                  <div><span className="text-[#9CA3AF]">기기</span><div className="mt-[2px] text-[#374151]">{selected.devices[0].deviceName}</div></div>
                )}
                {selected.siteJoinRequests.length > 0 && (
                  <div><span className="text-[#9CA3AF]">현장 참여</span><div className="mt-[2px] text-[#374151]">{selected.siteJoinRequests.length}건</div></div>
                )}
                {/* 서류 제출 현황 */}
                <div>
                  <span className="text-[#9CA3AF]">서류 현황</span>
                  <div className="mt-2 space-y-[6px]">
                    {DOCUMENTS.map((doc) => {
                      const isDone = doc.key === 'privacyConsent' // 가입 시 동의 완료
                      const isLater = doc.key === 'laborContract' || doc.key === 'safetyTraining'
                      return (
                        <div key={doc.key} className="flex items-center gap-2 text-[12px]">
                          <span>{isDone ? '✅' : isLater ? '⏳' : '⬜'}</span>
                          <span className={isDone ? 'text-[#16a34a]' : isLater ? 'text-[#9CA3AF]' : 'text-[#374151]'}>{doc.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              {selected.accountStatus === 'PENDING' && (
                <div className="flex gap-2 mt-5">
                  <Btn variant="success" size="sm" className="flex-1" onClick={() => approve(selected.id)} disabled={processing === selected.id}>승인</Btn>
                  <Btn variant="danger" size="sm" className="flex-1" onClick={() => { setRejectId(selected.id); setRejectReason('') }}>반려</Btn>
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </PageShell>
  )
}
