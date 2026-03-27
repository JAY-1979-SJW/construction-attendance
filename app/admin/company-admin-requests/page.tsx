'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal, Toast } from '@/components/admin/ui'

interface CompanyAdminRequest {
  id: string
  applicantName: string
  phone: string
  email: string | null
  companyName: string
  businessNumber: string
  representativeName: string | null
  contactPhone: string | null
  jobTitle: string | null
  status: string
  requestedAt: string
  reviewedAt: string | null
  rejectReason: string | null
  createdAdminUserId: string | null
}

const STATUS_LABEL: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }
const STATUS_COLOR: Record<string, string> = { PENDING: '#ff9800', APPROVED: '#2e7d32', REJECTED: '#c62828' }

export default function CompanyAdminRequestsPage() {
  const [filter, setFilter] = useState('PENDING')
  const [data, setData] = useState<CompanyAdminRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<CompanyAdminRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [tempPass, setTempPass] = useState('')
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null)
  const [processing, setProcessing] = useState(false)
  const [msg, setMsg] = useState('')
  const [approveResult, setApproveResult] = useState<{ temporaryPassword: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/admin/company-admin-requests?status=${filter}`)
    const d = await res.json()
    setData(d.data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function submitApprove() {
    if (!selected) return
    setProcessing(true)
    const res = await fetch(`/api/admin/company-admin-requests/${selected.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temporaryPassword: tempPass || undefined }),
    })
    const d = await res.json()
    setProcessing(false)
    if (d.success) {
      setApproveResult({ temporaryPassword: d.data?.temporaryPassword })
      setMode(null)
      load()
    } else {
      setMsg(d.message ?? '오류가 발생했습니다.')
    }
  }

  async function submitReject() {
    if (!selected || !rejectReason.trim()) { setMsg('반려 사유를 입력하세요.'); return }
    setProcessing(true)
    const res = await fetch(`/api/admin/company-admin-requests/${selected.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectReason }),
    })
    const d = await res.json()
    setProcessing(false)
    setMsg(d.message ?? '')
    setMode(null)
    setSelected(null)
    setRejectReason('')
    load()
  }

  const closeModal = () => { setMode(null); setSelected(null); setRejectReason(''); setTempPass('') }

  return (
    <div className="px-6 py-8 max-w-[1100px] mx-auto font-['Malgun_Gothic',sans-serif]">
      <h1 className="text-[22px] font-bold mb-6 text-white">업체 관리자 신청 관리</h1>

      <div className="flex gap-2 mb-5">
        {['PENDING', 'APPROVED', 'REJECTED'].map(st => (
          <button
            key={st}
            className={`px-[18px] py-2 rounded-[20px] border text-sm cursor-pointer transition-colors ${
              filter === st
                ? 'bg-[#F47920] text-white border-[#1976d2] font-bold'
                : 'bg-card border-white/[0.12] text-muted-brand'
            }`}
            onClick={() => setFilter(st)}
          >
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>

      {msg && (
        <div className="bg-[#e8f5e9] border border-[#a5d6a7] rounded-lg px-4 py-3 mb-4 text-[#2e7d32] text-sm">
          {msg}
        </div>
      )}

      {/* 승인 결과 — 임시 비밀번호 표시 */}
      {approveResult && (
        <div className="bg-[rgba(91,164,217,0.1)] border border-[#90caf9] rounded-lg p-4 mb-4 text-sm">
          <strong>승인 완료!</strong> 아래 임시 비밀번호를 신청자에게 전달하세요.<br />
          <code className="block font-mono text-[18px] font-bold my-2 text-[#4A93C8] tracking-[0.1em]">{approveResult.temporaryPassword}</code>
          <button
            className="px-3 py-1 bg-[#eee] border-none rounded-md text-[13px] cursor-pointer mt-2"
            onClick={() => setApproveResult(null)}
          >닫기</button>
        </div>
      )}

      {/* 모달 */}
      <Modal open={!!(mode && selected)} onClose={closeModal} title={mode === 'approve' ? '업체 관리자 승인' : '신청 반려'}>
        {selected && (
          <>
            <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 text-sm mb-4 p-[14px] bg-brand rounded-lg">
              <span className="text-muted-brand font-semibold">업체명</span><span>{selected.companyName}</span>
              <span className="text-muted-brand font-semibold">사업자번호</span><span>{selected.businessNumber}</span>
              <span className="text-muted-brand font-semibold">담당자</span><span>{selected.applicantName}</span>
              <span className="text-muted-brand font-semibold">연락처</span><span>{selected.phone}</span>
            </div>
            {mode === 'approve' && (
              <>
                <label className="block text-[13px] font-semibold mb-[6px] text-[#CBD5E0]">임시 비밀번호 (비워두면 자동 생성)</label>
                <input
                  className="w-full px-[10px] py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-sm box-border"
                  value={tempPass}
                  onChange={e => setTempPass(e.target.value)}
                  placeholder="8자 이상"
                  minLength={8}
                />
              </>
            )}
            {mode === 'reject' && (
              <>
                <label className="block text-[13px] font-semibold mb-[6px] text-[#CBD5E0]">반려 사유 *</label>
                <textarea
                  className="w-full px-[10px] py-[10px] border border-[rgba(91,164,217,0.3)] rounded-lg text-sm box-border resize-y"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="반려 사유를 입력하세요."
                  rows={3}
                />
              </>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button
                className="px-4 py-2 bg-[#eee] border-none rounded-lg text-sm cursor-pointer"
                onClick={closeModal}
              >취소</button>
              {mode === 'approve'
                ? <button
                    className="px-4 py-2 bg-[#2e7d32] text-white border-none rounded-lg text-sm cursor-pointer font-bold disabled:opacity-50"
                    onClick={submitApprove}
                    disabled={processing}
                  >{processing ? '처리 중...' : '승인'}</button>
                : <button
                    className="px-4 py-2 bg-[#c62828] text-white border-none rounded-lg text-sm cursor-pointer font-bold disabled:opacity-50"
                    onClick={submitReject}
                    disabled={processing}
                  >{processing ? '처리 중...' : '반려'}</button>
              }
            </div>
          </>
        )}
      </Modal>

      {loading ? (
        <div className="text-center py-[60px] text-muted-brand text-[15px]">로딩 중...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-[60px] text-muted-brand text-[15px]">{STATUS_LABEL[filter]} 상태의 신청이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {['업체명', '사업자번호', '담당자', '연락처', '상태', '신청일', ''].map(h => (
                  <th
                    key={h}
                    className="bg-[#1E3350] px-[14px] py-3 text-left font-bold text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]"
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} className="border-b border-[#f0f0f0]">
                  <td className="px-[14px] py-3 align-middle">{r.companyName}</td>
                  <td className="px-[14px] py-3 align-middle">{r.businessNumber}</td>
                  <td className="px-[14px] py-3 align-middle">
                    {r.applicantName}
                    <div className="text-[11px] text-muted-brand mt-[2px]">{r.jobTitle}</div>
                  </td>
                  <td className="px-[14px] py-3 align-middle">{r.phone}</td>
                  <td className="px-[14px] py-3 align-middle">
                    <span
                      className="inline-block text-white text-[11px] font-bold px-2 py-[3px] rounded-xl"
                      style={{ background: STATUS_COLOR[r.status] }}
                    >{STATUS_LABEL[r.status]}</span>
                    {r.rejectReason && <div className="text-[11px] text-[#c62828] mt-1 max-w-[160px]">{r.rejectReason}</div>}
                  </td>
                  <td className="px-[14px] py-3 align-middle">{new Date(r.requestedAt).toLocaleDateString()}</td>
                  <td className="px-[14px] py-3 align-middle">
                    {r.status === 'PENDING' && (
                      <div className="flex gap-[6px]">
                        <button
                          className="px-3 py-[6px] bg-[#2e7d32] text-white border-none rounded-md text-xs cursor-pointer font-semibold"
                          onClick={() => { setSelected(r); setMode('approve') }}
                        >승인</button>
                        <button
                          className="px-3 py-[6px] bg-[#c62828] text-white border-none rounded-md text-xs cursor-pointer font-semibold"
                          onClick={() => { setSelected(r); setMode('reject') }}
                        >반려</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
