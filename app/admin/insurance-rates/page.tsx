'use client'

import { useEffect, useState, useCallback } from 'react'
import { Modal } from '@/components/admin/ui'

// ─── 타입 ─────────────────────────────────────────────────

type InsuranceRateType =
  | 'NATIONAL_PENSION' | 'HEALTH_INSURANCE' | 'LONG_TERM_CARE'
  | 'EMPLOYMENT_INSURANCE' | 'EMPLOYMENT_STABILITY'
  | 'INDUSTRIAL_ACCIDENT' | 'RETIREMENT_MUTUAL'

type RateStatus = 'DRAFT' | 'REVIEW_PENDING' | 'REVIEWED' | 'APPROVED_FOR_USE' | 'DEPRECATED'

interface InsuranceRateVersion {
  id: string
  rateType: InsuranceRateType
  effectiveYear: number
  effectiveMonth: number | null
  totalRatePct: string | null
  employeeRatePct: string | null
  employerRatePct: string | null
  rateNote: string | null
  industryCode: string | null
  officialSourceName: string | null
  officialSourceUrl: string | null
  officialAnnouncementDate: string | null
  referenceDocumentNo: string | null
  status: RateStatus
  reviewNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
}

// ─── 상수 ─────────────────────────────────────────────────

const RATE_TYPE_LABEL: Record<InsuranceRateType, string> = {
  NATIONAL_PENSION:     '국민연금',
  HEALTH_INSURANCE:     '건강보험',
  LONG_TERM_CARE:       '장기요양보험',
  EMPLOYMENT_INSURANCE: '고용보험(실업급여)',
  EMPLOYMENT_STABILITY: '고용안정·직능개발',
  INDUSTRIAL_ACCIDENT:  '산재보험',
  RETIREMENT_MUTUAL:    '건설업 퇴직공제',
}

const STATUS_LABEL: Record<RateStatus, string> = {
  DRAFT:            '초안',
  REVIEW_PENDING:   '검토 요청됨',
  REVIEWED:         '검토 완료',
  APPROVED_FOR_USE: '사용 승인',
  DEPRECATED:       '구버전',
}

const STATUS_COLOR: Record<RateStatus, string> = {
  DRAFT:            'bg-gray-100 text-gray-700',
  REVIEW_PENDING:   'bg-yellow-100 text-yellow-800',
  REVIEWED:         'bg-blue-100 text-blue-800',
  APPROVED_FOR_USE: 'bg-green-100 text-green-800',
  DEPRECATED:       'bg-red-100 text-red-600',
}

// ─── 컴포넌트 ────────────────────────────────────────────

export default function InsuranceRatesPage() {
  const [versions, setVersions]         = useState<InsuranceRateVersion[]>([])
  const [loading, setLoading]           = useState(true)
  const [filterYear, setFilterYear]     = useState<string>(String(new Date().getFullYear()))
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType]     = useState<string>('')
  const [showForm, setShowForm]         = useState(false)
  const [selected, setSelected]         = useState<InsuranceRateVersion | null>(null)
  const [actionNote, setActionNote]     = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [msg, setMsg]                   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 신규 폼
  const [newForm, setNewForm] = useState({
    rateType: 'NATIONAL_PENSION' as InsuranceRateType,
    effectiveYear: new Date().getFullYear() + 1,
    totalRatePct: '',
    employeeRatePct: '',
    employerRatePct: '',
    rateNote: '',
    officialSourceName: '',
    officialSourceUrl: '',
    officialAnnouncementDate: '',
    referenceDocumentNo: '',
  })

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterYear)   params.set('year', filterYear)
      if (filterStatus) params.set('status', filterStatus)
      if (filterType)   params.set('rateType', filterType)
      const res  = await fetch(`/api/admin/insurance-rates?${params}`)
      const json = await res.json()
      if (json.success) setVersions(json.data)
    } finally {
      setLoading(false)
    }
  }, [filterYear, filterStatus, filterType])

  useEffect(() => { fetchVersions() }, [fetchVersions])

  async function handleCreate() {
    setSubmitting(true)
    try {
      const body: Record<string, any> = { ...newForm }
      if (body.totalRatePct)    body.totalRatePct    = parseFloat(body.totalRatePct)
      if (body.employeeRatePct) body.employeeRatePct = parseFloat(body.employeeRatePct)
      if (body.employerRatePct) body.employerRatePct = parseFloat(body.employerRatePct)
      if (!body.totalRatePct)    delete body.totalRatePct
      if (!body.employeeRatePct) delete body.employeeRatePct
      if (!body.employerRatePct) delete body.employerRatePct
      if (!body.rateNote)        delete body.rateNote
      if (!body.officialSourceName)       delete body.officialSourceName
      if (!body.officialSourceUrl)        delete body.officialSourceUrl
      if (!body.officialAnnouncementDate) delete body.officialAnnouncementDate
      if (!body.referenceDocumentNo)      delete body.referenceDocumentNo

      const res  = await fetch('/api/admin/insurance-rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        setMsg({ type: 'ok', text: '요율 버전이 생성되었습니다.' })
        setShowForm(false)
        fetchVersions()
      } else {
        setMsg({ type: 'err', text: json.error ?? '생성 실패' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAction(id: string, action: string) {
    setSubmitting(true)
    try {
      const res  = await fetch(`/api/admin/insurance-rates/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote: actionNote || undefined }),
      })
      const json = await res.json()
      if (json.success) {
        setMsg({ type: 'ok', text: '상태가 변경되었습니다.' })
        setSelected(null)
        setActionNote('')
        fetchVersions()
      } else {
        setMsg({ type: 'err', text: json.error ?? '처리 실패' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('DRAFT 버전을 삭제합니다. 계속하시겠습니까?')) return
    const res  = await fetch(`/api/admin/insurance-rates/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      setMsg({ type: 'ok', text: '삭제되었습니다.' })
      fetchVersions()
    } else {
      setMsg({ type: 'err', text: json.error ?? '삭제 실패' })
    }
  }

  const fmt = (v: string | null) => v ? `${v}%` : '—'
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ko-KR') : '—'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 서브 네비게이션 */}
      <div className="flex gap-2 text-sm border-b pb-3">
        <a href="/admin/insurance-rates" className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium">요율 버전 관리</a>
        <a href="/admin/insurance-rates/sources" className="px-3 py-1.5 bg-white border rounded text-gray-600 hover:bg-gray-50">고시 소스 관리</a>
        <a href="/admin/insurance-rates/calculate" className="px-3 py-1.5 bg-white border rounded text-gray-600 hover:bg-gray-50">보험료 계산기</a>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">보험요율 버전 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            공식 고시 기반으로 요율을 등록·검토·승인합니다. 하드코딩 금지.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          + 신규 버전 등록
        </button>
      </div>

      {/* 알림 */}
      {msg && (
        <div className={`p-3 rounded text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-2 underline">닫기</button>
        </div>
      )}

      {/* 신규 등록 폼 */}
      {showForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <h3 className="font-semibold text-sm">신규 요율 버전 등록 (DRAFT 생성)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">보험 종류</label>
              <select
                value={newForm.rateType}
                onChange={e => setNewForm(f => ({ ...f, rateType: e.target.value as InsuranceRateType }))}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              >
                {Object.entries(RATE_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">적용 연도</label>
              <input
                type="number" value={newForm.effectiveYear}
                onChange={e => setNewForm(f => ({ ...f, effectiveYear: parseInt(e.target.value) }))}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">합산 요율(%)</label>
              <input
                type="number" step="0.0001" placeholder="예: 9.5"
                value={newForm.totalRatePct}
                onChange={e => setNewForm(f => ({ ...f, totalRatePct: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">근로자 부담(%)</label>
              <input
                type="number" step="0.0001" placeholder="예: 4.75"
                value={newForm.employeeRatePct}
                onChange={e => setNewForm(f => ({ ...f, employeeRatePct: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">사업주 부담(%)</label>
              <input
                type="number" step="0.0001" placeholder="예: 4.75"
                value={newForm.employerRatePct}
                onChange={e => setNewForm(f => ({ ...f, employerRatePct: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">고시 기관</label>
              <input
                type="text" placeholder="예: 보건복지부"
                value={newForm.officialSourceName}
                onChange={e => setNewForm(f => ({ ...f, officialSourceName: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">고시 발표일</label>
              <input
                type="date"
                value={newForm.officialAnnouncementDate}
                onChange={e => setNewForm(f => ({ ...f, officialAnnouncementDate: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">고시 번호</label>
              <input
                type="text" placeholder="예: 보건복지부 고시 2025-228호"
                value={newForm.referenceDocumentNo}
                onChange={e => setNewForm(f => ({ ...f, referenceDocumentNo: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">비고/메모</label>
            <textarea
              rows={2} placeholder="업종별 차등 설명 등"
              value={newForm.rateNote}
              onChange={e => setNewForm(f => ({ ...f, rateNote: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm mt-1"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1 text-sm border rounded">취소</button>
            <button
              onClick={handleCreate} disabled={submitting}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
            >
              저장 (DRAFT 생성)
            </button>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          {[2024, 2025, 2026, 2027].map(y => (
            <option key={y} value={String(y)}>{y}년</option>
          ))}
          <option value="">전체 연도</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">전체 보험 종류</option>
          {Object.entries(RATE_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : versions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">해당하는 요율 버전이 없습니다.</div>
      ) : (
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">보험 종류</th>
                <th className="px-4 py-3 text-left">적용 연도</th>
                <th className="px-4 py-3 text-right">합산(%)</th>
                <th className="px-4 py-3 text-right">근로자(%)</th>
                <th className="px-4 py-3 text-right">사업주(%)</th>
                <th className="px-4 py-3 text-left">고시 기관</th>
                <th className="px-4 py-3 text-left">고시일</th>
                <th className="px-4 py-3 text-left">상태</th>
                <th className="px-4 py-3 text-left">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {versions.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{RATE_TYPE_LABEL[v.rateType]}</td>
                  <td className="px-4 py-3">{v.effectiveYear}{v.effectiveMonth ? `년 ${v.effectiveMonth}월` : '년'}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(v.totalRatePct)}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">{fmt(v.employeeRatePct)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-700">{fmt(v.employerRatePct)}</td>
                  <td className="px-4 py-3 text-gray-600">{v.officialSourceName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(v.officialAnnouncementDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[v.status]}`}>
                      {STATUS_LABEL[v.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(v)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      상세/전환
                    </button>
                    {v.status === 'DRAFT' && (
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="ml-2 text-xs text-red-500 hover:underline"
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 상세/상태 전환 모달 */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setActionNote('') }} title={selected ? `${RATE_TYPE_LABEL[selected.rateType]} — ${selected.effectiveYear}년` : ''}>
        {selected && (
          <div className="space-y-4">
            <div className="text-sm space-y-2 bg-gray-50 rounded p-3">
              <div className="flex justify-between"><span className="text-gray-500">합산 요율</span><strong>{fmt(selected.totalRatePct)}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">근로자 부담</span><strong className="text-blue-700">{fmt(selected.employeeRatePct)}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">사업주 부담</span><strong className="text-orange-700">{fmt(selected.employerRatePct)}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">고시 기관</span><span>{selected.officialSourceName ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">고시 번호</span><span>{selected.referenceDocumentNo ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">고시일</span><span>{fmtDate(selected.officialAnnouncementDate)}</span></div>
              {selected.rateNote && (
                <div className="border-t pt-2 text-gray-600">{selected.rateNote}</div>
              )}
              {selected.reviewNote && (
                <div className="border-t pt-2 text-gray-600">검토 메모: {selected.reviewNote}</div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-500">현재 상태</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
            </div>

            {/* 상태 전환 버튼 */}
            <div className="space-y-2">
              {selected.status === 'REVIEW_PENDING' && (
                <div>
                  <label className="text-xs font-medium">검토 메모</label>
                  <input
                    type="text" value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    placeholder="검토 의견 (선택)"
                    className="w-full border rounded px-2 py-1 text-sm mt-1"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {selected.status === 'DRAFT' && (
                  <button
                    onClick={() => handleAction(selected.id, 'REQUEST_REVIEW')}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded disabled:opacity-50"
                  >
                    검토 요청
                  </button>
                )}
                {selected.status === 'REVIEW_PENDING' && (
                  <button
                    onClick={() => handleAction(selected.id, 'MARK_REVIEWED')}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                  >
                    검토 완료 처리
                  </button>
                )}
                {['DRAFT', 'REVIEWED'].includes(selected.status) && (
                  <button
                    onClick={() => handleAction(selected.id, 'APPROVE')}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded disabled:opacity-50"
                  >
                    사용 승인 (SUPER_ADMIN)
                  </button>
                )}
                {selected.status === 'APPROVED_FOR_USE' && (
                  <button
                    onClick={() => handleAction(selected.id, 'DEPRECATE')}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded disabled:opacity-50"
                  >
                    구버전 처리
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
