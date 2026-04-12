'use client'

import { useState, useEffect } from 'react'
import {
  PageShell,
  StatusBadge, Btn,
  AdminTable, AdminTr, AdminTd, EmptyRow,
  FormInput, FormSelect, ModalFooter,
  Modal, Toast,
  FilterBar, FilterSpacer,
} from '@/components/admin/ui'

interface ConsentDoc {
  id:         string
  docType:    string
  scope:      string
  companyId:  string | null
  siteId:     string | null
  title:      string
  contentMd:  string
  version:    number
  isActive:   boolean
  isRequired: boolean
  sortOrder:  number
  createdAt:  string
  company:    { companyName: string } | null
  site:       { name: string } | null
  _count:     { workerConsents: number }
}

const DOC_TYPE_OPTIONS = [
  { value: 'PRIVACY_CONSENT',  label: '개인정보 수집·이용 동의서' },
  { value: 'SAFETY_PLEDGE',    label: '안전교육 서약서' },
  { value: 'SITE_NOTICE',      label: '현장 유의사항' },
  { value: 'TBM_CONFIRMATION', label: 'TBM 확인서' },
  { value: 'GENERAL',          label: '기타 공통 문서' },
]

const SCOPE_OPTIONS = [
  { value: 'GLOBAL',  label: '전체 공통 (모든 근로자)' },
  { value: 'COMPANY', label: '업체별' },
  { value: 'SITE',    label: '현장별' },
]

const DOC_TYPE_LABEL: Record<string, string> = {
  PRIVACY_CONSENT:  '개인정보',
  SAFETY_PLEDGE:    '안전서약',
  SITE_NOTICE:      '현장공지',
  TBM_CONFIRMATION: 'TBM',
  LABOR_CONTRACT:   '근로계약',
  GENERAL:          '공통',
}

const SCOPE_LABEL: Record<string, string> = {
  GLOBAL:  '전체',
  COMPANY: '업체',
  SITE:    '현장',
}

const TABLE_HEADERS = ['유형', '범위', '제목', 'v', '필수', '동의수', '정렬', '작업']

export default function ConsentDocsPage() {
  const [docs,    setDocs]    = useState<ConsentDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState<{ msg: string; variant?: 'success' | 'error' } | null>(null)

  // 생성 모달
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    docType:    'PRIVACY_CONSENT',
    scope:      'GLOBAL',
    companyId:  '',
    siteId:     '',
    title:      '',
    contentMd:  '',
    isRequired: true,
    sortOrder:  0,
  })
  const [saving, setSaving] = useState(false)

  // 편집 모달
  const [editDoc,    setEditDoc]    = useState<ConsentDoc | null>(null)
  const [editForm,   setEditForm]   = useState({ title: '', contentMd: '', isRequired: true, isActive: true, sortOrder: 0 })
  const [editSaving, setEditSaving] = useState(false)

  const showToast = (msg: string, variant: 'success' | 'error' = 'success') => {
    setToast({ msg, variant })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/consent-docs')
      const d = await res.json()
      if (d.success) setDocs(d.data.docs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.contentMd.trim()) {
      showToast('제목과 내용을 입력하세요.', 'error'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/consent-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType:    form.docType,
          scope:      form.scope,
          companyId:  form.companyId || null,
          siteId:     form.siteId    || null,
          title:      form.title,
          contentMd:  form.contentMd,
          isRequired: form.isRequired,
          sortOrder:  form.sortOrder,
        }),
      })
      const d = await res.json()
      if (d.success) {
        showToast('문서를 등록했습니다.')
        setShowCreate(false)
        setForm({ docType: 'PRIVACY_CONSENT', scope: 'GLOBAL', companyId: '', siteId: '', title: '', contentMd: '', isRequired: true, sortOrder: 0 })
        load()
      } else {
        showToast(d.message ?? '등록 실패', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (doc: ConsentDoc) => {
    setEditDoc(doc)
    setEditForm({ title: doc.title, contentMd: doc.contentMd, isRequired: doc.isRequired, isActive: doc.isActive, sortOrder: doc.sortOrder })
  }

  const handleEdit = async () => {
    if (!editDoc) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/admin/consent-docs/${editDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const d = await res.json()
      if (d.success) {
        showToast('수정했습니다.')
        setEditDoc(null)
        load()
      } else {
        showToast(d.message ?? '수정 실패', 'error')
      }
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeactivate = async (doc: ConsentDoc) => {
    if (!confirm(`"${doc.title}" 문서를 비활성화합니까?`)) return
    const res = await fetch(`/api/admin/consent-docs/${doc.id}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) { showToast('비활성화됐습니다.'); load() }
    else showToast(d.message ?? '실패', 'error')
  }

  const handleReactivate = async (doc: ConsentDoc) => {
    const res = await fetch(`/api/admin/consent-docs/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    const d = await res.json()
    if (d.success) { showToast('재활성화됐습니다.'); load() }
    else showToast(d.message ?? '실패', 'error')
  }

  const activeDocs   = docs.filter(d => d.isActive)
  const inactiveDocs = docs.filter(d => !d.isActive)

  return (
    <PageShell>
      {toast && <Toast message={toast.msg} variant={toast.variant} />}

      {/* 헤더 */}
      <FilterBar>
        <div className="text-[18px] font-bold text-title-brand">앱 공통 문서 관리</div>
        <FilterSpacer />
        <Btn variant="orange" onClick={() => setShowCreate(true)}>+ 문서 등록</Btn>
      </FilterBar>

      {/* 활성 문서 */}
      <div className="mb-2 mt-5 text-[13px] font-semibold text-body-brand">
        활성 문서 ({activeDocs.length})
      </div>
      {loading ? (
        <AdminTable headers={TABLE_HEADERS}>
          <EmptyRow colSpan={8} message="불러오는 중..." />
        </AdminTable>
      ) : (
        <AdminTable headers={TABLE_HEADERS}>
          {activeDocs.length === 0 ? (
            <EmptyRow colSpan={8} message="등록된 문서가 없습니다." />
          ) : (
            activeDocs.map(doc => (
              <AdminTr key={doc.id}>
                <AdminTd>
                  <StatusBadge status={doc.docType} label={DOC_TYPE_LABEL[doc.docType] ?? doc.docType} />
                </AdminTd>
                <AdminTd>
                  <StatusBadge
                    status={doc.scope === 'GLOBAL' ? 'ACTIVE' : 'PENDING'}
                    label={
                      doc.scope === 'COMPANY' && doc.company ? `업체: ${doc.company.companyName}` :
                      doc.scope === 'SITE'    && doc.site    ? `현장: ${doc.site.name}` :
                      SCOPE_LABEL[doc.scope] ?? doc.scope
                    }
                  />
                </AdminTd>
                <AdminTd>{doc.title}</AdminTd>
                <AdminTd className="text-center">{doc.version}</AdminTd>
                <AdminTd className="text-center">
                  <StatusBadge
                    status={doc.isRequired ? 'ELIGIBLE' : 'EXEMPT'}
                    label={doc.isRequired ? '필수' : '선택'}
                  />
                </AdminTd>
                <AdminTd className="text-center">{doc._count.workerConsents}</AdminTd>
                <AdminTd className="text-center">{doc.sortOrder}</AdminTd>
                <AdminTd>
                  <div className="flex gap-1.5">
                    <Btn size="xs" variant="ghost" onClick={() => openEdit(doc)}>수정</Btn>
                    <Btn size="xs" variant="danger" onClick={() => handleDeactivate(doc)}>비활성</Btn>
                  </div>
                </AdminTd>
              </AdminTr>
            ))
          )}
        </AdminTable>
      )}

      {/* 비활성 문서 */}
      {inactiveDocs.length > 0 && (
        <>
          <div className="mb-2 mt-6 text-[13px] font-semibold text-body-brand">
            비활성 문서 ({inactiveDocs.length})
          </div>
          <AdminTable headers={['유형', '제목', 'v', '동의수', '작업']}>
            {inactiveDocs.map(doc => (
              <AdminTr key={doc.id}>
                <AdminTd>
                  <StatusBadge status="INACTIVE" label={DOC_TYPE_LABEL[doc.docType] ?? doc.docType} />
                </AdminTd>
                <AdminTd className="text-muted-brand">{doc.title}</AdminTd>
                <AdminTd className="text-center text-muted-brand">{doc.version}</AdminTd>
                <AdminTd className="text-center text-muted-brand">{doc._count.workerConsents}</AdminTd>
                <AdminTd>
                  <Btn size="xs" variant="ghost" onClick={() => handleReactivate(doc)}>재활성</Btn>
                </AdminTd>
              </AdminTr>
            ))}
          </AdminTable>
        </>
      )}

      {/* 생성 모달 */}
      <Modal open={showCreate} title="문서 등록" onClose={() => setShowCreate(false)}>
        <div className="space-y-3 p-5">
          <FormSelect
            label="문서 유형"
            value={form.docType}
            onChange={e => setForm(f => ({ ...f, docType: e.target.value }))}
            options={DOC_TYPE_OPTIONS}
          />
          <FormSelect
            label="적용 범위"
            value={form.scope}
            onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
            options={SCOPE_OPTIONS}
          />
          {form.scope === 'COMPANY' && (
            <FormInput
              label="업체 ID (cuid)"
              value={form.companyId}
              onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
              placeholder="cm..."
            />
          )}
          {form.scope === 'SITE' && (
            <FormInput
              label="현장 ID (cuid)"
              value={form.siteId}
              onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))}
              placeholder="cm..."
            />
          )}
          <FormInput
            label="제목"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="예: 개인정보 수집·이용 동의서 (v1)"
          />
          <div className="mb-4">
            <label className="block text-[12px] font-semibold text-body-brand mb-1.5">
              내용 (Markdown)
            </label>
            <textarea
              className="w-full border border-brand rounded-[8px] px-3 py-2 text-[13px] font-mono min-h-[180px] resize-y outline-none focus:border-accent"
              value={form.contentMd}
              onChange={e => setForm(f => ({ ...f, contentMd: e.target.value }))}
              placeholder={'## 조항 제목\n내용을 입력하세요...'}
            />
          </div>
          <div className="flex gap-5 items-center">
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))}
                className="w-4 h-4"
              />
              필수 동의
            </label>
            <FormInput
              label="정렬 순서"
              type="number"
              value={String(form.sortOrder)}
              onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
              className="w-28"
            />
          </div>
        </div>
        <ModalFooter>
          <Btn variant="ghost" onClick={() => setShowCreate(false)}>취소</Btn>
          <Btn variant="orange" onClick={handleCreate} disabled={saving}>
            {saving ? '저장 중...' : '등록'}
          </Btn>
        </ModalFooter>
      </Modal>

      {/* 수정 모달 */}
      <Modal open={!!editDoc} title="문서 수정" onClose={() => setEditDoc(null)}>
        <div className="space-y-3 p-5">
          {editDoc && (
            <div className="text-[12px] text-muted2-brand mb-1">
              유형: <strong>{DOC_TYPE_LABEL[editDoc.docType] ?? editDoc.docType}</strong> ·
              범위: <strong>{SCOPE_LABEL[editDoc.scope] ?? editDoc.scope}</strong>
            </div>
          )}
          <FormInput
            label="제목"
            value={editForm.title}
            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="mb-4">
            <label className="block text-[12px] font-semibold text-body-brand mb-1.5">
              내용 (Markdown)
            </label>
            <textarea
              className="w-full border border-brand rounded-[8px] px-3 py-2 text-[13px] font-mono min-h-[180px] resize-y outline-none focus:border-accent"
              value={editForm.contentMd}
              onChange={e => setEditForm(f => ({ ...f, contentMd: e.target.value }))}
            />
          </div>
          <div className="flex gap-5 items-center">
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isRequired}
                onChange={e => setEditForm(f => ({ ...f, isRequired: e.target.checked }))}
                className="w-4 h-4"
              />
              필수 동의
            </label>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4"
              />
              활성화
            </label>
            <FormInput
              label="정렬 순서"
              type="number"
              value={String(editForm.sortOrder)}
              onChange={e => setEditForm(f => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
              className="w-28"
            />
          </div>
        </div>
        <ModalFooter>
          <Btn variant="ghost" onClick={() => setEditDoc(null)}>취소</Btn>
          <Btn variant="orange" onClick={handleEdit} disabled={editSaving}>
            {editSaving ? '저장 중...' : '수정'}
          </Btn>
        </ModalFooter>
      </Modal>
    </PageShell>
  )
}
