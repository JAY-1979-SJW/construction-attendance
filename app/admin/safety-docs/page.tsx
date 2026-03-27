'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  PageShell,
  FilterBar, FilterInput, FilterSelect, FilterSpacer,
  StatusBadge, Btn,
  AdminTable, AdminTr, AdminTd, EmptyRow,
  FormInput, FormSelect, FormGrid, ModalFooter,
  DetailPanel, Modal, Toast, MetaRow,
} from '@/components/admin/ui'

/* ━━━ 기준 수치 (UI_SPEC) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 이 페이지를 admin 웹 화면의 기준으로 삼는다.
 * 아래 수치는 공용 컴포넌트(components/admin/ui)에 의해 강제됨.
 *
 *   topbar 높이          : 4px(라인) + 52px(바) = 56px  [AdminLayoutWrapper]
 *   page title 높이      : pt-16 pb-12 + 18px text ≈ 47px [AdminLayoutWrapper]
 *   sidebar 폭           : 220px                         [AdminLayoutWrapper]
 *   card 패딩            : p-5 (20px)                    [SectionCard]
 *   card border-radius   : 12px                          [SectionCard]
 *   filter 입력 높이      : h-9 (36px)                   [FilterBar]
 *   form 입력 높이        : h-10 (40px)                  [FormField]
 *   button md 높이       : ≈34px (py-7px + text-13px)    [Btn]
 *   table header         : py-10px, text-11px, bg-F3F4F6 [AdminTable]
 *   table row            : py-10px, text-13px            [AdminTable]
 *   status badge         : text-11px, px-2, py-0.5       [StatusBadge]
 *   detail panel 폭      : 420px, 우측 슬라이드           [DetailPanel]
 *   생성 모달 폭          : max-w-[480px], center overlay
 *   content preview 최대  : max-h-[400px]
 *   section 간격          : mb-5 (20px) = SectionDivider
 *   toast/alert           : text-12px, rounded-8px, p-2.5
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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

/* ─── 생성 모달 (공용 Modal 사용) ──────────────────────────── */
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
      setTimeout(() => { onCreated(); onClose() }, 600)
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="안전서류 생성">
      {error && <Toast message={error} variant="error" />}
      {toast && <Toast message={toast} />}

      <FormSelect
        label="근로자" required
        value={workerId} onChange={e => setWorkerId(e.target.value)}
        options={workers.map(w => ({ value: w.id, label: w.name }))}
        placeholder="선택하세요"
      />
      <FormSelect
        label="서류 유형" required
        value={docType} onChange={e => setDocType(e.target.value)}
        options={Object.entries(DOC_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
        placeholder="선택하세요"
      />
      <FormGrid>
        <FormSelect
          label="현장"
          value={siteId} onChange={e => setSiteId(e.target.value)}
          options={sites.map(s => ({ value: s.id, label: s.name }))}
          placeholder="(선택)"
        />
        <FormInput
          label="발급일" required type="date"
          value={documentDate} onChange={e => setDocumentDate(e.target.value)}
        />
      </FormGrid>
      <FormInput
        label="담당자(교육자)" placeholder="예: 현장소장"
        value={educatorName} onChange={e => setEducatorName(e.target.value)}
      />
      {needsEducationFields && (
        <>
          <FormGrid>
            <FormInput
              label="교육일" type="date"
              value={educationDate} onChange={e => setEducationDate(e.target.value)}
            />
            <FormInput
              label="교육시간(h)" type="number" min="0.5" step="0.5" placeholder="1"
              value={educationHours} onChange={e => setEducationHours(e.target.value)}
            />
          </FormGrid>
          <FormInput
            label="교육장소" placeholder="예: 현장 회의실"
            value={educationPlace} onChange={e => setEducationPlace(e.target.value)}
          />
        </>
      )}
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose} disabled={saving}>취소</Btn>
        <Btn variant="orange" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '생성'}
        </Btn>
      </ModalFooter>
    </Modal>
  )
}

/* ─── 상세 패널 (공용 DetailPanel 사용, 420px 우측 슬라이드) ── */
function DocDetailPanel({
  doc,
  onClose,
  onRefresh,
}: {
  doc: SafetyDoc
  onClose: () => void
  onRefresh: () => void
}) {
  const [contentText, setContentText] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [toast, setToast] = useState('')
  const [docStatus, setDocStatus] = useState(doc.status)

  useEffect(() => {
    fetch(`/api/admin/safety-documents/${doc.id}`).then(r => r.json()).then(d => {
      setContentText(d.data?.contentText ?? null)
    })
  }, [doc.id])

  const handleSign = async () => {
    if (!confirm('서명 처리하시겠습니까? 서명 후 수정할 수 없습니다.')) return
    setSigning(true)
    const res = await fetch(`/api/admin/safety-documents/${doc.id}/sign`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      setDocStatus('SIGNED')
      setToast('서명 처리되었습니다')
      setTimeout(() => onRefresh(), 600)
    }
    setSigning(false)
  }

  const handleDownload = () => {
    window.open(`/api/admin/safety-documents/${doc.id}/download`, '_blank')
  }

  return (
    <DetailPanel
      open
      onClose={onClose}
      title={DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
      subtitle={doc.worker.name}
      actions={
        <>
          <Btn variant="secondary" size="sm" onClick={handleDownload}>다운로드</Btn>
          {docStatus !== 'SIGNED' && (
            <Btn variant="orange" size="sm" onClick={handleSign} disabled={signing}>
              {signing ? '처리 중...' : '서명 처리'}
            </Btn>
          )}
        </>
      }
    >
      {toast && <Toast message={toast} />}

      {/* 메타 정보 — grid 2열, label 고정폭 */}
      <div className="space-y-2 text-[13px] mb-5">
        <MetaRow label="상태"><StatusBadge status={docStatus} /></MetaRow>
        <MetaRow label="현장">{doc.site?.name ?? '-'}</MetaRow>
        <MetaRow label="작성일">{doc.documentDate ?? '-'}</MetaRow>
        <MetaRow label="교육일">{doc.educationDate ?? '-'}</MetaRow>
        {doc.signedAt && (
          <MetaRow label="서명일시">{new Date(doc.signedAt).toLocaleString('ko-KR')}</MetaRow>
        )}
      </div>

      {/* 문서 내용 — max-h-[400px] */}
      {contentText && (
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] p-4 max-h-[400px] overflow-y-auto">
          <pre className="text-[12px] text-[#374151] whitespace-pre-wrap m-0 font-[inherit] leading-relaxed break-words">
            {contentText}
          </pre>
        </div>
      )}
    </DetailPanel>
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
      {/* 필터 바 — 공용 FilterBar 사용 */}
      <FilterBar>
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
        <FilterSpacer />
        <Btn variant="orange" onClick={() => setShowCreate(true)}>+ 서류 생성</Btn>
      </FilterBar>

      {/* 테이블 — AdminTable 자체가 카드 스타일이므로 SectionCard 래핑 불필요 */}
      <AdminTable headers={columns}>
        {loading ? (
          <EmptyRow colSpan={columns.length} message="불러오는 중..." />
        ) : docs.length === 0 ? (
          <EmptyRow colSpan={columns.length} message="안전서류가 없습니다" />
        ) : (
          docs.map(doc => (
            <AdminTr key={doc.id} onClick={() => setSelectedDoc(doc)}>
              <AdminTd>{doc.worker.name}</AdminTd>
              <AdminTd className="max-w-[160px] truncate">{doc.site?.name ?? '-'}</AdminTd>
              <AdminTd className="max-w-[200px] truncate">{DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}</AdminTd>
              <AdminTd>
                <StatusBadge status={doc.status} />
              </AdminTd>
              <AdminTd>{doc.documentDate ?? '-'}</AdminTd>
              <AdminTd>{doc.educationDate ?? '-'}</AdminTd>
            </AdminTr>
          ))
        )}
      </AdminTable>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchDocs}
        />
      )}

      {selectedDoc && (
        <DocDetailPanel
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
