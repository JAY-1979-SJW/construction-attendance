'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  PageShell, SectionCard,
  FilterInput, FilterSelect,
  StatusBadge,
  AdminTable, AdminTr, AdminTd, EmptyRow,
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
  createdAt: string
  worker: { id: string; name: string; phone: string | null }
  site: { id: string; name: string } | null
}

function SafetyDocsContent() {
  const searchParams = useSearchParams()
  const [docs, setDocs] = useState<SafetyDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

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
        <div className="flex flex-wrap gap-2 mb-4">
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
        </div>

        <AdminTable headers={columns}>
          {loading ? (
            <EmptyRow colSpan={columns.length} message="불러오는 중..." />
          ) : docs.length === 0 ? (
            <EmptyRow colSpan={columns.length} message="안전서류가 없습니다" />
          ) : (
            docs.map(doc => (
              <AdminTr key={doc.id}>
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
