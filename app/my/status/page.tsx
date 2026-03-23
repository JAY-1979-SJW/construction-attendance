'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import WorkerDisclaimerBanner from '@/components/worker/WorkerDisclaimerBanner'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'

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

  if (loading) return <div style={s.center}>로딩 중...</div>
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
    <div style={{ ...s.page, paddingBottom: '88px' }}>
      <WorkerDisclaimerBanner />
      <div style={s.container}>
        <h1 style={s.title}>내 상태</h1>

        {/* ── 출퇴근 가능 여부 요약 (최상단) ── */}
        <div style={{
          ...s.eligibilityBox,
          background: attendanceEligibility.canCheckIn ? '#e8f5e9' : '#fff8e1',
          borderColor: attendanceEligibility.canCheckIn ? '#a5d6a7' : '#ffe082',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: attendanceEligibility.blockReasons.length > 0 ? '10px' : 0 }}>
            <span style={{ fontSize: '24px' }}>{attendanceEligibility.canCheckIn ? '✅' : '⚠️'}</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: attendanceEligibility.canCheckIn ? '#2e7d32' : '#e65100' }}>
                {attendanceEligibility.canCheckIn ? '출퇴근 가능' : '출퇴근 불가'}
              </div>
              <div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>{attendanceEligibility.summary}</div>
            </div>
          </div>
          {attendanceEligibility.blockReasons.map((r, i) => (
            <div key={i} style={s.blockReasonRow}>
              <div style={{ fontWeight: 600, color: '#c62828', fontSize: '13px' }}>❌ {r.message}</div>
              <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>→ {r.actionRequired}</div>
            </div>
          ))}
        </div>

        {/* 계정 상태 */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>계정 상태</h2>
          <div style={s.statusRow}>
            <span style={{ ...s.badge, background: ACCOUNT_STATUS_COLOR[accountStatus.status] }}>
              {ACCOUNT_STATUS_LABEL[accountStatus.status] ?? accountStatus.status}
            </span>
            <span style={s.statusMsg}>{accountStatus.message}</span>
          </div>
          {accountStatus.rejectReason && (
            <div style={s.rejectBox}>반려 사유: {accountStatus.rejectReason}</div>
          )}
          <div style={s.infoGrid}>
            <span style={s.infoLabel}>이름</span><span>{worker.name}</span>
            <span style={s.infoLabel}>전화번호</span><span>{worker.phone}</span>
            <span style={s.infoLabel}>직종</span><span>{worker.jobTitle}</span>
            <span style={s.infoLabel}>가입일</span><span>{new Date(worker.createdAt).toLocaleDateString('ko-KR')}</span>
          </div>
        </div>

        {/* 기기 상태 */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>기기 승인 상태</h2>
          <div style={s.statusRow}>
            <span style={{ ...s.badge, background: DEVICE_STATUS_COLOR[deviceStatus.status] ?? '#999' }}>
              {DEVICE_STATUS_LABEL[deviceStatus.status] ?? deviceStatus.status}
            </span>
            {deviceStatus.deviceName && <span style={s.statusMsg}>{deviceStatus.deviceName}</span>}
          </div>
          {deviceStatus.status === 'PENDING' && (
            <p style={s.hint}>관리자가 기기를 승인해야 출퇴근이 가능합니다.</p>
          )}
          {deviceStatus.status === 'REJECTED' && (
            <p style={{ ...s.hint, color: '#c62828' }}>기기 등록이 반려되었습니다. 관리자에게 문의하세요.</p>
          )}
          {deviceStatus.status === 'NO_DEVICE' && (
            <p style={s.hint}>앱에서 로그인하면 기기 등록 요청이 자동으로 접수됩니다.</p>
          )}
        </div>

        {/* 현장 참여 현황 */}
        {(joinRequests.length > 0 || assignedSites.length > 0) && (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>현장 참여 현황</h2>

            {assignedSites.map(a => (
              <div key={a.siteId} style={s.siteCard}>
                <div style={s.siteName}>{a.siteName}</div>
                <div style={s.siteAddr}>{a.address}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ ...s.badge, background: a.isActive ? '#2e7d32' : '#999' }}>
                    {a.isActive ? '출퇴근 가능 현장' : '비활성 현장'}
                  </span>
                  <span style={s.siteInfo}>{a.companyName}</span>
                </div>
              </div>
            ))}

            {joinRequests.map(j => (
              <div key={j.requestId} style={s.siteCard}>
                <div style={s.siteName}>{j.siteName}</div>
                <div style={s.siteAddr}>{j.address}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ ...s.badge, background: JOIN_STATUS_COLOR[j.status] }}>
                    {JOIN_STATUS_LABEL[j.status] ?? j.status}
                  </span>
                  <span style={s.siteInfo}>{new Date(j.requestedAt).toLocaleDateString('ko-KR')} 신청</span>
                </div>
                {j.status === 'PENDING' && (
                  <p style={s.hint}>관리자 승인 후 이 현장에서 출퇴근할 수 있습니다.</p>
                )}
                {j.rejectReason && (
                  <div style={s.rejectBox}>
                    <strong>반려 사유:</strong> {j.rejectReason}
                  </div>
                )}
                {j.status === 'REJECTED' && (
                  <button style={s.reapplyBtn} onClick={() => requestJoin(j.siteId)} disabled={joiningId === j.siteId}>
                    재신청
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 현장 참여 신청 — 계정 승인된 경우만 */}
        {accountStatus.status === 'APPROVED' && (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>현장 참여 신청</h2>
            {joinMsg && <div style={s.joinMsg}>{joinMsg}</div>}
            {sites.filter(site => site.canJoin).length === 0 ? (
              <p style={s.hint}>참여 신청 가능한 현장이 없습니다.<br />이미 신청한 현장이 있거나 등록된 현장이 없습니다.</p>
            ) : (
              sites.filter(site => site.canJoin).map(site => (
                <div key={site.siteId} style={s.siteCard}>
                  <div style={s.siteName}>{site.siteName}</div>
                  <div style={s.siteAddr}>{site.address}</div>
                  <button
                    style={{ ...s.joinBtn, opacity: joiningId === site.siteId ? 0.6 : 1 }}
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

        {/* 노무/보험 상태 */}
        {complianceStatus && (
          <div style={s.section}>
            <h2 style={s.sectionTitle}>노무·보험 처리 현황</h2>
            <p style={{ fontSize: '12px', color: '#718096', margin: '0 0 12px' }}>
              출퇴근 가능 여부와 별도입니다. 출퇴근이 가능해도 보험 미처리 상태일 수 있습니다.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                ['국민연금', complianceStatus.nationalPensionStatus],
                ['건강보험', complianceStatus.healthInsuranceStatus],
                ['고용보험', complianceStatus.employmentInsuranceStatus],
                ['산재보험', complianceStatus.industrialAccidentStatus],
                ['퇴직공제', complianceStatus.retirementMutualStatus],
              ].map(([label, status]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9f9f9', borderRadius: '8px', fontSize: '14px' }}>
                  <span style={{ color: '#555' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: INSURANCE_STATUS_COLOR[status] ?? '#888' }}>
                    {INSURANCE_STATUS_LABEL[status] ?? status}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9f9f9', borderRadius: '8px', fontSize: '14px' }}>
                <span style={{ color: '#555' }}>계좌 등록</span>
                <span style={{ fontWeight: 600, color: complianceStatus.bankInfoCollected ? '#2e7d32' : '#9e9e9e' }}>
                  {complianceStatus.bankInfoCollected ? '완료' : '미등록'}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
      <WorkerBottomNav />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:            { minHeight: '100vh', background: '#1E3350', padding: '24px 16px' },
  center:          { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: '16px', color: '#666' },
  container:       { maxWidth: '520px', margin: '0 auto' },
  title:           { fontSize: '24px', fontWeight: 700, margin: '0 0 16px', color: '#1a1a2e' },
  eligibilityBox:  { borderRadius: '12px', padding: '16px 18px', marginBottom: '16px', border: '1px solid' },
  blockReasonRow:  { background: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '8px 12px', marginTop: '8px' },
  section:         { background: '#243144', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' },
  sectionTitle:    { fontSize: '12px', fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px' },
  statusRow:       { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' },
  badge:           { display: 'inline-block', color: 'white', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px' },
  statusMsg:       { fontSize: '14px', color: '#444' },
  rejectBox:       { background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: '#c62828', marginTop: '8px' },
  infoGrid:        { display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px 12px', fontSize: '14px', marginTop: '12px' },
  infoLabel:       { color: '#A0AEC0', fontWeight: 600 },
  hint:            { fontSize: '13px', color: '#A0AEC0', margin: '8px 0 0' },
  siteCard:        { border: '1px solid #eee', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' },
  siteName:        { fontSize: '15px', fontWeight: 700, color: '#1a1a2e' },
  siteAddr:        { fontSize: '13px', color: '#A0AEC0', marginTop: '4px' },
  siteInfo:        { fontSize: '13px', color: '#666' },
  joinBtn:         { marginTop: '10px', padding: '8px 20px', background: '#F47920', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  reapplyBtn:      { marginTop: '10px', padding: '6px 16px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  joinMsg:         { background: '#e8f5e9', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#2e7d32', marginBottom: '12px' },
  backLink:        { color: '#5BA4D9', fontSize: '14px', textDecoration: 'none' },
}
