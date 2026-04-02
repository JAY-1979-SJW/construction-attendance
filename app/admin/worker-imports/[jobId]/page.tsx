'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

interface Candidate {
  id: string
  name: string
  phone: string | null
  birthDate: string | null
  jobTitle: string
  isActive: boolean
}

interface ImportRow {
  id: string
  rowNumber: number
  name: string
  phone: string
  jobTitle: string
  employmentType: string | null
  birthDate: string | null
  dedupeStatus: string // OK, REVIEW, BLOCK, PENDING
  dedupeReason: string | null
  matchedWorkerId: string | null
  matchedWorkerName: string | null
  candidatesJson: Candidate[] | null
  aiDecision: string | null
  aiConfidence: number | null
  userDecision: string | null
  validationStatus: string
  validationMessage: string | null
  importedWorkerId: string | null
}

interface ImportJob {
  id: string
  originalFilename: string
  status: string
  totalRows: number
  okRows: number
  reviewRows: number
  blockRows: number
  failedRows: number
  importedRows: number
  createdAt: string
  rows: ImportRow[]
}

const DEDUPE_LABEL: Record<string, string> = {
  OK: 'OK', REVIEW: '검토필요', BLOCK: '차단', PENDING: '대기',
}
const DEDUPE_COLOR: Record<string, string> = {
  OK: '#2e7d32', REVIEW: '#e65100', BLOCK: '#b71c1c', PENDING: '#757575',
}
const DEDUPE_BG: Record<string, string> = {
  OK: '#e8f5e9', REVIEW: '#fff3e0', BLOCK: '#ffebee', PENDING: '#f5f5f5',
}

type FilterTab = 'ALL' | 'REVIEW' | 'BLOCK' | 'OK' | 'FAILED' | 'IMPORTED'

export default function WorkerImportReviewPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const router = useRouter()
  const [job, setJob] = useState<ImportJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('ALL')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ importedCount: number; errors: string[] } | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/admin/worker-imports/${jobId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setJob(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(load, [jobId, router]) // eslint-disable-line

  const handleDecision = async (rowId: string, decision: 'USE_EXISTING' | 'REGISTER_NEW' | 'CANCEL') => {
    setSaving(true)
    const res = await fetch(`/api/admin/worker-imports/${jobId}/rows/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userDecision: decision }),
    })
    setSaving(false)
    if (res.ok) {
      load()
    } else {
      const data = await res.json()
      alert(data.error ?? '저장 실패')
    }
  }

  const handleImport = async () => {
    if (!job) return
    const registerNewCount = job.rows.filter(r =>
      r.validationStatus === 'APPROVED' && r.userDecision === 'REGISTER_NEW' && !r.importedWorkerId
    ).length
    if (registerNewCount === 0) { alert('신규 등록 대상이 없습니다.'); return }
    if (!confirm(`${registerNewCount}명을 신규 등록하시겠습니까?`)) return

    setImporting(true)
    setImportResult(null)
    const res = await fetch(`/api/admin/worker-imports/${jobId}/import`, { method: 'POST' })
    const data = await res.json()
    setImporting(false)
    if (data.success) {
      setImportResult(data.data)
      load()
    } else {
      alert(data.error ?? '등록 실패')
    }
  }

  if (loading) return <div className="px-16 py-16 text-center text-muted-brand">로딩 중...</div>
  if (!job) return <div className="px-16 py-16 text-center text-muted-brand">작업을 찾을 수 없습니다.</div>

  const getFilteredRows = (): ImportRow[] => {
    switch (filter) {
      case 'REVIEW': return job.rows.filter(r => r.dedupeStatus === 'REVIEW' && r.validationStatus === 'NEEDS_REVIEW')
      case 'BLOCK': return job.rows.filter(r => r.dedupeStatus === 'BLOCK' && r.validationStatus === 'NEEDS_REVIEW')
      case 'OK': return job.rows.filter(r => r.dedupeStatus === 'OK')
      case 'FAILED': return job.rows.filter(r => r.validationStatus === 'FAILED')
      case 'IMPORTED': return job.rows.filter(r => r.validationStatus === 'IMPORTED' || r.validationStatus === 'APPROVED')
      default: return job.rows
    }
  }
  const filteredRows = getFilteredRows()

  const registerNewCount = job.rows.filter(r =>
    r.validationStatus === 'APPROVED' && r.userDecision === 'REGISTER_NEW' && !r.importedWorkerId
  ).length

  const needsReviewCount = job.rows.filter(r => r.validationStatus === 'NEEDS_REVIEW').length

  return (
    <div className="p-8 min-w-0">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <Link href="/admin/worker-imports" className="text-[13px] text-muted-brand no-underline">← 목록으로</Link>
          <h1 className="text-xl font-bold my-1">{job.originalFilename}</h1>
          <div className="text-xs text-[#999]">
            업로드: {new Date(job.createdAt).toLocaleString('ko-KR')} · 전체 {job.totalRows}행
          </div>
        </div>

        <div className="flex gap-2.5 items-center flex-wrap">
          {registerNewCount > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-5 py-2 bg-brand-accent text-white border-0 rounded-lg cursor-pointer text-[13px] font-semibold"
              style={{ opacity: importing ? 0.5 : 1 }}
            >
              {importing ? '등록 중...' : `신규 등록 실행 (${registerNewCount}건)`}
            </button>
          )}
        </div>
      </div>

      {/* 통계 바 */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { label: '자동등록(OK)', count: job.okRows, color: '#2e7d32', bg: '#e8f5e9' },
          { label: '검토필요', count: job.reviewRows, color: '#e65100', bg: '#fff3e0' },
          { label: '차단', count: job.blockRows, color: '#b71c1c', bg: '#ffebee' },
          { label: '실패', count: job.failedRows, color: '#757575', bg: '#f5f5f5' },
          { label: '등록됨', count: job.importedRows, color: '#4a148c', bg: '#f3e5f5' },
        ].map(s => (
          <div key={s.label} className="rounded-[10px] px-5 py-3.5 text-center min-w-[80px]" style={{ background: s.bg }}>
            <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.count}</div>
            <div className="text-[11px]" style={{ color: s.color }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 등록 결과 */}
      {importResult && (
        <div className="bg-green-light border border-[#a5d6a7] rounded-[10px] px-4 py-3.5 mb-4">
          <div className="font-bold text-[#2e7d32] mb-1">{importResult.importedCount}명 등록 완료</div>
          {importResult.errors.length > 0 && (
            <div className="text-xs text-[#b71c1c] mt-1.5">
              오류 {importResult.errors.length}건:<br />
              {importResult.errors.map((e, i) => <span key={i}>{e}<br /></span>)}
            </div>
          )}
        </div>
      )}

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([
          { key: 'ALL' as FilterTab, label: '전체', count: job.rows.length },
          { key: 'REVIEW' as FilterTab, label: '검토필요', count: job.rows.filter(r => r.dedupeStatus === 'REVIEW' && r.validationStatus === 'NEEDS_REVIEW').length },
          { key: 'BLOCK' as FilterTab, label: '차단', count: job.rows.filter(r => r.dedupeStatus === 'BLOCK' && r.validationStatus === 'NEEDS_REVIEW').length },
          { key: 'OK' as FilterTab, label: 'OK(자동등록)', count: job.rows.filter(r => r.dedupeStatus === 'OK').length },
          { key: 'FAILED' as FilterTab, label: '실패', count: job.rows.filter(r => r.validationStatus === 'FAILED').length },
          { key: 'IMPORTED' as FilterTab, label: '처리완료', count: job.rows.filter(r => r.validationStatus === 'IMPORTED' || r.validationStatus === 'APPROVED').length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="px-3.5 py-1.5 rounded-full border-0 cursor-pointer text-xs font-semibold"
            style={{
              background: filter === tab.key ? (DEDUPE_BG[tab.key] ?? '#e3f2fd') : '#f0f0f0',
              color: filter === tab.key ? (DEDUPE_COLOR[tab.key] ?? '#1976d2') : '#666',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* 목록 */}
      <MobileCardList
        items={filteredRows}
        keyExtractor={(row) => row.id}
        emptyMessage="해당 항목이 없습니다."
        renderCard={(row) => (
          <MobileCard
            title={`${row.rowNumber}행 · ${row.name}`}
            subtitle={`${row.phone} · ${row.jobTitle}`}
            badge={
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-[10px]"
                style={{ color: DEDUPE_COLOR[row.dedupeStatus] ?? '#757575', background: DEDUPE_BG[row.dedupeStatus] ?? '#f5f5f5' }}>
                {DEDUPE_LABEL[row.dedupeStatus] ?? row.dedupeStatus}
              </span>
            }
          >
            <MobileCardFields>
              {row.birthDate && <MobileCardField label="생년월일" value={row.birthDate} />}
              {(row.dedupeReason || row.validationMessage) && (
                <MobileCardField label="사유" value={row.dedupeReason ?? row.validationMessage ?? ''} />
              )}
              {row.matchedWorkerName && <MobileCardField label="기존 후보" value={row.matchedWorkerName} />}
              {row.importedWorkerId && <MobileCardField label="처리" value="등록됨" />}
              {!row.importedWorkerId && row.userDecision === 'USE_EXISTING' && <MobileCardField label="처리" value="기존 사용" />}
              {!row.importedWorkerId && row.userDecision === 'CANCEL' && <MobileCardField label="처리" value="취소됨" />}
            </MobileCardFields>
            {!row.importedWorkerId && !row.userDecision && row.validationStatus === 'NEEDS_REVIEW' && (
              <MobileCardActions>
                {row.matchedWorkerId && (
                  <button onClick={() => handleDecision(row.id, 'USE_EXISTING')} disabled={saving}
                    className="px-2 py-1 bg-[#e3f2fd] text-[#1565c0] border-0 rounded text-[11px] cursor-pointer font-semibold">
                    기존 사용
                  </button>
                )}
                <button onClick={() => handleDecision(row.id, 'REGISTER_NEW')} disabled={saving}
                  className="px-2 py-1 bg-[#e8f5e9] text-[#2e7d32] border-0 rounded text-[11px] cursor-pointer font-semibold">
                  신규 등록
                </button>
                <button onClick={() => handleDecision(row.id, 'CANCEL')} disabled={saving}
                  className="px-2 py-1 bg-[#f5f5f5] text-[#757575] border-0 rounded text-[11px] cursor-pointer font-semibold">
                  취소
                </button>
              </MobileCardActions>
            )}
          </MobileCard>
        )}
        renderTable={() => (
          <div className="bg-card rounded-[12px] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['행', '이름', '연락처', '직종', '생년월일', '판정', '사유', '기존 후보', '처리'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[11px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)] bg-surface whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-[#999]">해당 항목이 없습니다.</td></tr>
                ) : filteredRows.map(row => (
                  <tr key={row.id} className="border-b border-[rgba(91,164,217,0.05)]">
                    <td className="px-3 py-2.5 text-[11px] text-muted-brand text-center">{row.rowNumber}</td>
                    <td className="px-3 py-2.5 text-[13px] font-semibold">{row.name}</td>
                    <td className="px-3 py-2.5 text-[13px]">{row.phone}</td>
                    <td className="px-3 py-2.5 text-[12px]">{row.jobTitle}</td>
                    <td className="px-3 py-2.5 text-[11px] text-muted-brand">{row.birthDate ?? '-'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-[10px]"
                        style={{ color: DEDUPE_COLOR[row.dedupeStatus] ?? '#757575', background: DEDUPE_BG[row.dedupeStatus] ?? '#f5f5f5' }}>
                        {DEDUPE_LABEL[row.dedupeStatus] ?? row.dedupeStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[#999] max-w-[200px]">{row.dedupeReason ?? row.validationMessage ?? ''}</td>
                    <td className="px-3 py-2.5 text-[11px]">
                      {row.candidatesJson && Array.isArray(row.candidatesJson) && row.candidatesJson.length > 0 ? (
                        <div className="space-y-1">
                          {(row.candidatesJson as Candidate[]).map((c, ci) => (
                            <div key={ci} className="bg-[rgba(91,164,217,0.08)] rounded px-2 py-1">
                              <span className="font-semibold">{c.name}</span>
                              <span className="text-[#999] ml-1">{c.phone ?? ''}</span>
                              {c.birthDate && <span className="text-[#999] ml-1">({c.birthDate})</span>}
                              <span className="text-[#999] ml-1">{c.jobTitle}</span>
                            </div>
                          ))}
                        </div>
                      ) : row.matchedWorkerName ? (
                        <span className="text-[#999]">{row.matchedWorkerName}</span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.importedWorkerId ? (
                        <span className="text-[11px] text-[#4a148c]">등록됨</span>
                      ) : row.userDecision === 'USE_EXISTING' ? (
                        <span className="text-[11px] text-[#1565c0]">기존 사용</span>
                      ) : row.userDecision === 'CANCEL' ? (
                        <span className="text-[11px] text-[#757575]">취소됨</span>
                      ) : row.validationStatus === 'NEEDS_REVIEW' ? (
                        <div className="flex gap-1 flex-wrap">
                          {row.matchedWorkerId && (
                            <button onClick={() => handleDecision(row.id, 'USE_EXISTING')} disabled={saving}
                              className="px-2 py-1 bg-[#e3f2fd] text-[#1565c0] border-0 rounded text-[11px] cursor-pointer font-semibold">
                              기존 사용
                            </button>
                          )}
                          <button onClick={() => handleDecision(row.id, 'REGISTER_NEW')} disabled={saving}
                            className="px-2 py-1 bg-[#e8f5e9] text-[#2e7d32] border-0 rounded text-[11px] cursor-pointer font-semibold">
                            신규 등록
                          </button>
                          <button onClick={() => handleDecision(row.id, 'CANCEL')} disabled={saving}
                            className="px-2 py-1 bg-[#f5f5f5] text-[#757575] border-0 rounded text-[11px] cursor-pointer font-semibold">
                            취소
                          </button>
                        </div>
                      ) : row.validationStatus === 'FAILED' ? (
                        <span className="text-[11px] text-[#b71c1c]">실패</span>
                      ) : row.validationStatus === 'IMPORTED' ? (
                        <span className="text-[11px] text-[#4a148c]">자동등록</span>
                      ) : (
                        <span className="text-[11px] text-[#999]">{row.validationStatus}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />
    </div>
  )
}
