'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import WorkerDisclaimerBanner from '@/components/worker/WorkerDisclaimerBanner'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

interface BlockReason {
  code: string
  message: string
  actionRequired: string
}

interface ComplianceStatus {
  basicIdentityChecked: boolean
  rrnCollected: boolean
  bankInfoCollected: boolean
  nationalPensionStatus: string
  healthInsuranceStatus: string
  employmentInsuranceStatus: string
  industrialAccidentStatus: string
  retirementMutualStatus: string
}

interface MyStatus {
  worker: { id: string; name: string; phone: string; jobTitle: string; createdAt: string }
  accountStatus: { status: string; message: string; rejectReason: string | null; reviewedAt: string | null }
  deviceStatus: { status: string; deviceName: string | null; approvedAt?: string | null; requestedAt?: string | null }
  joinRequests: {
    requestId: string; siteId: string; siteName: string; address: string
    status: string; requestedAt: string; reviewedAt: string | null; rejectReason: string | null
  }[]
  assignedSites: {
    siteId: string; siteName: string; address: string; isActive: boolean; companyName: string
    assignedFrom: string; assignedTo: string | null
  }[]
  attendanceEligibility: {
    canCheckIn: boolean
    blockReasons: BlockReason[]
    summary: string
  }
  complianceStatus: ComplianceStatus | null
}

const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  PENDING: '승인 대기 중', APPROVED: '승인 완료', REJECTED: '반려됨', SUSPENDED: '계정 정지',
}
const ACCOUNT_STATUS_COLOR: Record<string, string> = {
  PENDING: '#ff9800', APPROVED: '#2e7d32', REJECTED: '#c62828', SUSPENDED: '#666',
}
const JOIN_STATUS_LABEL: Record<string, string> = {
  PENDING: '승인 대기 중', APPROVED: '승인 완료', REJECTED: '반려됨',
}
const JOIN_STATUS_COLOR: Record<string, string> = {
  PENDING: '#ff9800', APPROVED: '#2e7d32', REJECTED: '#c62828',
}
const DEVICE_STATUS_LABEL: Record<string, string> = {
  PENDING: '승인 대기 중', APPROVED: '승인 완료', REJECTED: '반려됨', NO_DEVICE: '기기 미등록',
}
const DEVICE_STATUS_COLOR: Record<string, string> = {
  PENDING: '#ff9800', APPROVED: '#2e7d32', REJECTED: '#c62828', NO_DEVICE: '#999',
}

export default function MyStatusPage() {
  const router = useRouter()
  const [data, setData] = useState<MyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [sites, setSites] = useState<{ siteId: string; siteName: string; address: string; joinStatus: string | null; canJoin: boolean }[]>([])
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [joinMsg, setJoinMsg] = useState('')
  const [insuranceOpen, setInsuranceOpen] = useState(false)

  useEffect(() => {
    fetch('/api/worker/my-status')
      .then(r => r.json())
      .then(r => {
        if (!r.success) { router.push('/login'); return }
        setData(r.data)
        if (r.data.accountStatus.status === 'APPROVED') {
          fetch('/api/worker/sites')
            .then(s => s.json())
            .then(s => { if (s.success) setSites(s.sites) })
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  async function requestJoin(siteId: string) {
    setJoiningId(siteId)
    setJoinMsg('')
    const res = await fetch(`/api/worker/sites/${siteId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const d = await res.json()
    setJoinMsg(d.message ?? '')
    setJoiningId(null)
    if (d.success) {
      const [st, si] = await Promise.all([
        fetch('/api/worker/my-status').then(r => r.json()),
        fetch('/api/worker/sites').then(r => r.json()),
      ])
      if (st.success) setData(st.data)
      if (si.success) setSites(si.sites)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-base text-muted-brand">
      로딩 중...
    </div>
  )
  if (!data) return null

  const { worker, accountStatus, deviceStatus, joinRequests, assignedSites, attendanceEligibility, complianceStatus } = data

  const INSURANCE_STATUS_LABEL: Record<string, string> = {
    NOT_STARTED: '미시작', IN_PROGRESS: '진행중', READY: '준비완료',
    COMPLETED: '신고완료', EXEMPT: '해당없음',
  }
  const INSURANCE_STATUS_COLOR: Record<string, string> = {
    NOT_STARTED: '#9e9e9e', IN_PROGRESS: '#e65100', READY: '#1565c0',
    COMPLETED: '#2e7d32', EXEMPT: '#bdbdbd',
  }

  return (
    <>
      <WorkerTopBar />
      <div className="mobile-content bg-brand">
      <WorkerDisclaimerBanner />
      <div>
        <h1 className="text-2xl font-bold mb-4 text-title-brand">내 상태</h1>

        {/* ── 출퇴근 가능 여부 요약 (최상단) ── */}
        <div
          className="rounded-xl px-[18px] py-4 mb-4 border"
          style={{
            background: attendanceEligibility.canCheckIn ? 'rgba(46,125,50,0.12)' : 'rgba(244,121,32,0.1)',
            borderColor: attendanceEligibility.canCheckIn ? 'rgba(46,125,50,0.4)' : 'rgba(244,121,32,0.4)',
          }}
        >
          <div
            className="flex items-center gap-[10px]"
            style={{ marginBottom: attendanceEligibility.blockReasons.length > 0 ? '10px' : 0 }}
          >
            <span className="text-2xl">{attendanceEligibility.canCheckIn ? '✅' : '⚠️'}</span>
            <div>
              <div
                className="text-[15px] font-bold"
                style={{ color: attendanceEligibility.canCheckIn ? '#81c784' : '#FFB74D' }}
              >
                {attendanceEligibility.canCheckIn ? '출퇴근 가능' : '출퇴근 불가'}
              </div>
              <div className="text-[13px] text-muted-brand mt-0.5">{attendanceEligibility.summary}</div>
            </div>
          </div>
          {attendanceEligibility.blockReasons.map((r, i) => (
            <div key={i} className="bg-[rgba(91,164,217,0.08)] rounded-lg px-3 py-2 mt-2">
              <div className="font-semibold text-[#c62828] text-[13px]">❌ {r.message}</div>
              <div className="text-muted-brand text-xs mt-0.5">→ {r.actionRequired}</div>
            </div>
          ))}
        </div>

        {/* 계정 상태 */}
        <div className="bg-card rounded-xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <h2 className="text-xs font-bold text-muted-brand uppercase tracking-[0.05em] mb-[14px]">계정 상태</h2>
          <div className="flex items-center gap-[10px] mb-[10px] flex-wrap">
            <span
              className="inline-block text-white text-xs font-bold px-[10px] py-1 rounded-[20px]"
              style={{ background: ACCOUNT_STATUS_COLOR[accountStatus.status] }}
            >
              {ACCOUNT_STATUS_LABEL[accountStatus.status] ?? accountStatus.status}
            </span>
            <span className="text-sm text-muted-brand">{accountStatus.message}</span>
          </div>
          {accountStatus.rejectReason && (
            <div className="bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.2)] rounded-md px-3 py-[10px] text-[13px] text-status-rejected mt-2">
              반려 사유: {accountStatus.rejectReason}
            </div>
          )}
          <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 text-sm mt-3">
            <span className="text-muted-brand font-semibold">이름</span><span>{worker.name}</span>
            <span className="text-muted-brand font-semibold">전화번호</span><span>{worker.phone}</span>
            <span className="text-muted-brand font-semibold">직종</span><span>{worker.jobTitle}</span>
            <span className="text-muted-brand font-semibold">가입일</span><span>{new Date(worker.createdAt).toLocaleDateString('ko-KR')}</span>
          </div>
        </div>

        {/* 기기 상태 */}
        <div className="bg-card rounded-xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <h2 className="text-xs font-bold text-muted-brand uppercase tracking-[0.05em] mb-[14px]">기기 승인 상태</h2>
          <div className="flex items-center gap-[10px] mb-[10px] flex-wrap">
            <span
              className="inline-block text-white text-xs font-bold px-[10px] py-1 rounded-[20px]"
              style={{ background: DEVICE_STATUS_COLOR[deviceStatus.status] ?? '#999' }}
            >
              {DEVICE_STATUS_LABEL[deviceStatus.status] ?? deviceStatus.status}
            </span>
            {deviceStatus.deviceName && <span className="text-sm text-muted-brand">{deviceStatus.deviceName}</span>}
          </div>
          {deviceStatus.status === 'PENDING' && (
            <p className="text-[13px] text-muted-brand mt-2">관리자가 기기를 승인해야 출퇴근이 가능합니다.</p>
          )}
          {deviceStatus.status === 'REJECTED' && (
            <p className="text-[13px] text-[#c62828] mt-2">기기 등록이 반려되었습니다. 관리자에게 문의하세요.</p>
          )}
          {deviceStatus.status === 'NO_DEVICE' && (
            <p className="text-[13px] text-muted-brand mt-2">앱에서 로그인하면 기기 등록 요청이 자동으로 접수됩니다.</p>
          )}
        </div>

        {/* 현장 참여 현황 */}
        {(joinRequests.length > 0 || assignedSites.length > 0) && (
          <div className="bg-card rounded-xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <h2 className="text-xs font-bold text-muted-brand uppercase tracking-[0.05em] mb-[14px]">현장 참여 현황</h2>

            {assignedSites.map(a => (
              <div key={a.siteId} className="border border-brand rounded-[10px] px-4 py-[14px] mb-[10px] bg-card">
                <div className="text-[15px] font-bold text-title-brand">{a.siteName}</div>
                <div className="text-[13px] text-muted-brand mt-1">{a.address}</div>
                <div className="flex gap-2 mt-2 items-center flex-wrap">
                  <span
                    className="inline-block text-white text-xs font-bold px-[10px] py-1 rounded-[20px]"
                    style={{ background: a.isActive ? '#2e7d32' : '#999' }}
                  >
                    {a.isActive ? '출퇴근 가능 현장' : '비활성 현장'}
                  </span>
                  <span className="text-[13px] text-muted-brand">{a.companyName}</span>
                </div>
              </div>
            ))}

            {joinRequests.map(j => (
              <div key={j.requestId} className="border border-brand rounded-[10px] px-4 py-[14px] mb-[10px] bg-card">
                <div className="text-[15px] font-bold text-title-brand">{j.siteName}</div>
                <div className="text-[13px] text-muted-brand mt-1">{j.address}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span
                    className="inline-block text-white text-xs font-bold px-[10px] py-1 rounded-[20px]"
                    style={{ background: JOIN_STATUS_COLOR[j.status] }}
                  >
                    {JOIN_STATUS_LABEL[j.status] ?? j.status}
                  </span>
                  <span className="text-[13px] text-muted-brand">{new Date(j.requestedAt).toLocaleDateString('ko-KR')} 신청</span>
                </div>
                {j.status === 'PENDING' && (
                  <p className="text-[13px] text-muted-brand mt-2">관리자 승인 후 이 현장에서 출퇴근할 수 있습니다.</p>
                )}
                {j.rejectReason && (
                  <div className="bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.2)] rounded-md px-3 py-[10px] text-[13px] text-status-rejected mt-2">
                    <strong>반려 사유:</strong> {j.rejectReason}
                  </div>
                )}
                {j.status === 'REJECTED' && (
                  <button
                    className="mt-[10px] px-4 py-[6px] bg-[#ff9800] text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer"
                    onClick={() => requestJoin(j.siteId)}
                    disabled={joiningId === j.siteId}
                  >
                    재신청
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 현장 참여 신청 — 계정 승인된 경우만 */}
        {accountStatus.status === 'APPROVED' && (
          <div className="bg-card rounded-xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <h2 className="text-xs font-bold text-muted-brand uppercase tracking-[0.05em] mb-[14px]">현장 참여 신청</h2>
            {joinMsg && (
              <div className="bg-[rgba(46,125,50,0.15)] rounded-lg px-[14px] py-[10px] text-[13px] text-[#81c784] mb-3">
                {joinMsg}
              </div>
            )}
            {sites.filter(site => site.canJoin).length === 0 ? (
              <p className="text-[13px] text-muted-brand mt-2">참여 신청 가능한 현장이 없습니다.<br />이미 신청한 현장이 있거나 등록된 현장이 없습니다.</p>
            ) : (
              sites.filter(site => site.canJoin).map(site => (
                <div key={site.siteId} className="border border-brand rounded-[10px] px-4 py-[14px] mb-[10px] bg-card">
                  <div className="text-[15px] font-bold text-title-brand">{site.siteName}</div>
                  <div className="text-[13px] text-muted-brand mt-1">{site.address}</div>
                  <button
                    className="mt-[10px] px-5 py-2 bg-accent text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer"
                    style={{ opacity: joiningId === site.siteId ? 0.6 : 1 }}
                    disabled={joiningId === site.siteId}
                    onClick={() => requestJoin(site.siteId)}
                  >
                    {joiningId === site.siteId ? '신청 중...' : '참여 신청'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* 노무/보험 상태 (접이식) */}
        {complianceStatus && (
          <div className="bg-card rounded-xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <button
              onClick={() => setInsuranceOpen(o => !o)}
              className="w-full flex items-center justify-between bg-transparent border-none cursor-pointer p-0"
            >
              <h2 className="text-xs font-bold text-muted-brand uppercase tracking-[0.05em] m-0">노무·보험 처리 현황</h2>
              <span className="text-muted-brand text-[14px]">{insuranceOpen ? '▲' : '▼'}</span>
            </button>
            {!insuranceOpen && (
              <p className="text-xs text-[#718096] mt-2 mb-0">
                탭하여 보험 처리 현황 확인
              </p>
            )}
            {insuranceOpen && (<>
            <p className="text-xs text-[#718096] mt-3 mb-3">
              출퇴근 가능 여부와 별도입니다.
            </p>
            <div className="flex flex-col gap-[6px]">
              {[
                ['국민연금', complianceStatus.nationalPensionStatus],
                ['건강보험', complianceStatus.healthInsuranceStatus],
                ['고용보험', complianceStatus.employmentInsuranceStatus],
                ['산재보험', complianceStatus.industrialAccidentStatus],
                ['퇴직공제', complianceStatus.retirementMutualStatus],
              ].map(([label, status]) => (
                <div key={label} className="flex justify-between px-3 py-2 bg-[rgba(91,164,217,0.06)] rounded-lg text-sm">
                  <span className="text-muted-brand">{label}</span>
                  <span
                    className="font-semibold"
                    style={{ color: INSURANCE_STATUS_COLOR[status] ?? '#888' }}
                  >
                    {INSURANCE_STATUS_LABEL[status] ?? status}
                  </span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 bg-[rgba(91,164,217,0.06)] rounded-lg text-sm">
                <span className="text-muted-brand">계좌 등록</span>
                <span
                  className="font-semibold"
                  style={{ color: complianceStatus.bankInfoCollected ? '#2e7d32' : '#9e9e9e' }}
                >
                  {complianceStatus.bankInfoCollected ? '완료' : '미등록'}
                </span>
              </div>
            </div>
            </>)}
          </div>
        )}

      </div>
      <WorkerBottomNav />
    </div>
    </>
  )
}
