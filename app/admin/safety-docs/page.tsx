'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  PageShell, SectionCard,
  FilterInput, FilterSelect,
  StatusBadge, Btn,
  AdminTable, AdminTr, AdminTd, EmptyRow,
  FormInput, FormSelect, FormGrid, ModalFooter,
} from '@/components/admin/ui'

const DOC_TYPE_LABEL: Record<string, string> = {
  SAFETY_EDUCATION_NEW_HIRE:    '신규채용 안전교육',
  SAFETY_EDUCATION_TASK_CHANGE: '작업변경 교육',
  PPE_PROVISION:                '보호구 지급',
  SAFETY_PLEDGE:                '안전수칙 서약',
  WORK_CONDITIONS_RECEIPT:      '근로조건 수령확인',
  PRIVACY_CONSENT:              '개인정보 동의',
  BASIC_SAFETY_EDU_CONFIRM:     '기초안전교육 확인',
  SITE_SAFETY_RULES_CONFIRM:    '현장안전수칙 확인',
  HEALTH_DECLARATION:           '건강 각서',
  HEALTH_CERTIFICATE:           '건강 증명서',
}

interface SafetyDoc {
  id: string
  documentType: string
  status: string
  documentDate: string | null
  educationDate: string | null
  signedAt: string | null
  createdAt: string
  worker: { id: string; name: string; phone: string | null }
  site: { id: string; name: string } | null
}

interface PickerItem { id: string; name: string }

/* ─── 생성 모달 ────────────────────────────────────────────── */
function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [workers, setWorkers] = useState<PickerItem[]>([])
  const [sites, setSites] = useState<PickerItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // 폼
  const [workerId, setWorkerId] = useState('')
  const [docType, setDocType] = useState('')
  const [siteId, setSiteId] = useState('')
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10))
  const [educatorName, setEducatorName] = useState('')
  const [educationDate, setEducationDate] = useState('')
  const [educationHours, setEducationHours] = useState('')
  const [educationPlace, setEducationPlace] = useState('')

  useEffect(() => {
    fetch('/api/admin/workers?pageSize=500').then(r => r.json()).then(d => {
      const items = d.data?.items ?? d.data ?? []
      setWorkers(items.map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })))
    })
    fetch('/api/admin/sites?pageSize=100').then(r => r.json()).then(d => {
      const items = d.data?.items ?? d.data ?? []
      setSites(items.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))
    })
  }, [])

  const needsEducationFields = [
    'SAFETY_EDUCATION_NEW_HIRE',
    'SAFETY_EDUCATION_TASK_CHANGE',
    'BASIC_SAFETY_EDU_CONFIRM',
    'SITE_SAFETY_RULES_CONFIRM',
  ].includes(docType)

  const handleSave = async () => {
    setError('')
    if (!workerId) { setError('근로자를 선택하세요'); return }
    if (!docType) { setError('서류 유형을 선택하세요'); return }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        documentType: docType,
        documentDate,
        siteId: siteId || undefined,
        educatorName: educatorName || undefined,
      }
      if (needsEducationFields) {
        body.educationDate = educationDate || documentDate
        body.educationHours = educationHours ? Number(educationHours) : undefined
        body.educationPlace = educationPlace || undefined
      }

      const res = await fetch(`/api/admin/workers/${workerId}/safety-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || '생성 실패')
        setSaving(false)
        return
      }
      setToast('문서가 생성되었습니다')
      setTimeout(() => {
        onCreated()
        onClose()
      }, 600)
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-[12px] shadow-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-[#F3F4F6]">
          <h2 className="text-[16px] font-bold text-[#0F172A] m-0">안전서류 생성</h2>
        </div>
        <div className="px-5 py-4">
          {error && (
            <div className="mb-3 p-2.5 bg-[#FEE2E2] text-[#B91C1C] text-[12px] rounded-[8px]">{error}</div>
          )}
          {toast && (
            <div className="mb-3 p-2.5 bg-[#D1FAE5] text-[#065F46] text-[12px] rounded-[8px]">{toast}</div>
          )}

          <FormSelect
            label="근로자"
            required
            value={workerId}
            onChange={e => setWorkerId(e.target.value)}
            options={workers.map(w => ({ value: w.id, label: w.name }))}
            placeholder="선택하세요"
          />

          <FormSelect
            label="서류 유형"
            required
            value={docType}
            onChange={e => setDocType(e.target.value)}
            options={Object.entries(DOC_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            placeholder="선택하세요"
          />

          <FormGrid>
            <FormSelect
              label="현장"
              value={siteId}
              onChange={e => setSiteId(e.target.value)}
              options={sites.map(s => ({ value: s.id, label: s.name }))}
              placeholder="(선택)"
            />
            <FormInput
              label="발급일"
              required
              type="date"
              value={documentDate}
              onChange={e => setDocumentDate(e.target.value)}
            />
          </FormGrid>

          <FormInput
            label="담당자(교육자)"
            placeholder="예: 현장소장"
            value={educatorName}
            onChange={e => setEducatorName(e.target.value)}
          />

          {needsEducationFields && (
            <FormGrid>
              <FormInput
                label="교육일"
                type="date"
                value={educationDate}
                onChange={e => setEducationDate(e.target.value)}
              />
              <FormInput
                label="교육시간(h)"
                type="number"
                min="0.5"
                step="0.5"
                placeholder="1"
                value={educationHours}
                onChange={e => setEducationHours(e.target.value)}
              />
            </FormGrid>
          )}
          {needsEducationFields && (
            <FormInput
              label="교육장소"
              placeholder="예: 현장 회의실"
              value={educationPlace}
              onChange={e => setEducationPlace(e.target.value)}
            />
          )}

          <ModalFooter>
            <Btn variant="secondary" onClick={onClose} disabled={saving}>취소</Btn>
            <Btn variant="orange" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '생성'}
            </Btn>
          </ModalFooter>
        </div>
      </div>
    </div>
  )
}

/* ─── 상세 패널 ────────────────────────────────────────────── */
function DetailPanel({
  doc,
  onClose,
  onRefresh,
}: {
  doc: SafetyDoc
  onClose: () => void
  onRefresh: () => void
}) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [signing, setSigning] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch(`/api/admin/safety-documents/${doc.id}`).then(r => r.json()).then(d => {
      setDetail(d.data ?? null)
    })
  }, [doc.id])

  const handleSign = async () => {
    if (!confirm('서명 처리하시겠습니까? 서명 후 수정할 수 없습니다.')) return
    setSigning(true)
    const res = await fetch(`/api/admin/safety-documents/${doc.id}/sign`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      setToast('서명 처리되었습니다')
      setTimeout(() => {
        onRefresh()
        onClose()
      }, 600)
    }
    setSigning(false)
  }

  const handleDownload = () => {
    window.open(`/api/admin/safety-documents/${doc.id}/download`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-[12px] shadow-xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-[#F3F4F6] flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#0F172A] m-0">
            {DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
          </h2>
          <StatusBadge status={doc.status} />
        </div>
        <div className="px-5 py-4">
          {toast && (
            <div className="mb-3 p-2.5 bg-[#D1FAE5] text-[#065F46] text-[12px] rounded-[8px]">{toast}</div>
          )}

          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[13px] mb-4">
            <div className="text-[#9CA3AF]">근로자</div>
            <div className="text-[#111827] font-medium">{doc.worker.name}</div>
            <div className="text-[#9CA3AF]">현장</div>
            <div className="text-[#111827]">{doc.site?.name ?? '-'}</div>
            <div className="text-[#9CA3AF]">작성일</div>
            <div className="text-[#111827]">{doc.documentDate ?? '-'}</div>
            <div className="text-[#9CA3AF]">교육일</div>
            <div className="text-[#111827]">{doc.educationDate ?? '-'}</div>
            {doc.signedAt && (
              <>
                <div className="text-[#9CA3AF]">서명일시</div>
                <div className="text-[#111827]">{new Date(doc.signedAt).toLocaleString('ko-KR')}</div>
              </>
            )}
          </div>

          {detail && (detail as Record<string, unknown>).contentText && (
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] p-4 mb-4 max-h-[300px] overflow-y-auto">
              <pre className="text-[12px] text-[#374151] whitespace-pre-wrap m-0 font-[inherit]">
                {String((detail as Record<string, unknown>).contentText)}
              </pre>
            </div>
          )}

          <ModalFooter>
            <Btn variant="secondary" onClick={handleDownload}>다운로드</Btn>
            {doc.status !== 'SIGNED' && (
              <Btn variant="orange" onClick={handleSign} disabled={signing}>
                {signing ? '처리 중...' : '서명 처리'}
              </Btn>
            )}
            <Btn variant="ghost" onClick={onClose}>닫기</Btn>
          </ModalFooter>
        </div>
      </div>
    </div>
  )
}

/* ─── 메인 목록 ────────────────────────────────────────────── */
function SafetyDocsContent() {
  const searchParams = useSearchParams()
  const [docs, setDocs] = useState<SafetyDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<SafetyDoc | null>(null)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)       params.set('search', search)
    if (filterType)   params.set('docType', filterType)
    if (filterStatus) params.set('status', filterStatus)

    const res = await fetch(`/api/admin/safety-documents?${params}`)
    const json = await res.json()
    setDocs(json.data ?? [])
    setLoading(false)
  }, [search, filterType, filterStatus])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const columns = ['근로자', '현장', '서류 유형', '상태', '작성일', '교육일']

  return (
    <PageShell>
      <SectionCard>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <FilterInput
            placeholder="근로자 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FilterSelect
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">전체 유형</option>
            {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">전체 상태</option>
            <option value="DRAFT">초안</option>
            <option value="ISSUED">발행</option>
            <option value="SIGNED">서명완료</option>
          </FilterSelect>
          <div className="flex-1" />
          <Btn variant="orange" onClick={() => setShowCreate(true)}>+ 서류 생성</Btn>
        </div>

        <AdminTable headers={columns}>
          {loading ? (
            <EmptyRow colSpan={columns.length} message="불러오는 중..." />
          ) : docs.length === 0 ? (
            <EmptyRow colSpan={columns.length} message="안전서류가 없습니다" />
          ) : (
            docs.map(doc => (
              <AdminTr key={doc.id} onClick={() => setSelectedDoc(doc)}>
                <AdminTd>{doc.worker.name}</AdminTd>
                <AdminTd>{doc.site?.name ?? '-'}</AdminTd>
                <AdminTd>{DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}</AdminTd>
                <AdminTd>
                  <StatusBadge status={doc.status} />
                </AdminTd>
                <AdminTd>{doc.documentDate ?? '-'}</AdminTd>
                <AdminTd>{doc.educationDate ?? '-'}</AdminTd>
              </AdminTr>
            ))
          )}
        </AdminTable>
      </SectionCard>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchDocs}
        />
      )}

      {selectedDoc && (
        <DetailPanel
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onRefresh={fetchDocs}
        />
      )}
    </PageShell>
  )
}

export default function SafetyDocsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#9CA3AF]">로딩 중...</div>}>
      <SafetyDocsContent />
    </Suspense>
  )
}
