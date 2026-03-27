'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

interface SafetyDoc {
  id: string
  documentType: string
  status: string
  documentDate: string | null
  signedAt: string | null
  signedBy: string | null
  site: { id: string; name: string } | null
  createdAt: string
}

interface Contract {
  id: string
  contractKind: string
  contractTemplateType: string
  contractStatus: string
  startDate: string
  endDate: string | null
  signedAt: string | null
  site: { id: string; name: string } | null
  createdAt: string
}

interface Consent {
  id: string
  consentType: string
  agreed: boolean
  agreedAt: string | null
  policyDocument: { id: string; title: string; version: number } | null
}

const DOC_TYPE_LABELS: Record<string, string> = {
  SAFETY_EDUCATION_NEW_HIRE: '신규채용 안전교육',
  SAFETY_EDUCATION_TASK_CHANGE: '작업변경 교육',
  PPE_PROVISION: '보호구 지급',
  SAFETY_PLEDGE: '안전수칙 서약',
  WORK_CONDITIONS_RECEIPT: '근로조건 수령확인',
  PRIVACY_CONSENT: '개인정보 동의',
  BASIC_SAFETY_EDU_CONFIRM: '기초안전교육 확인',
  SITE_SAFETY_RULES_CONFIRM: '현장 안전수칙 확인',
  HEALTH_DECLARATION: '건강 이상 없음 각서',
  HEALTH_CERTIFICATE: '건강 증명서',
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  DRAFT: { text: '작성 필요', color: 'bg-gray-100 text-gray-700' },
  ISSUED: { text: '확인 요청', color: 'bg-blue-100 text-blue-700' },
  SIGNED: { text: '검토중', color: 'bg-blue-100 text-blue-700' },
  REVIEW_REQUESTED: { text: '검토중', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { text: '승인', color: 'bg-green-100 text-green-700' },
  REJECTED: { text: '보완 필요', color: 'bg-red-100 text-red-700' },
  ACTIVE: { text: '진행중', color: 'bg-blue-100 text-blue-700' },
  ENDED: { text: '종료', color: 'bg-gray-100 text-gray-700' },
}

const CONSENT_LABELS: Record<string, string> = {
  TERMS_OF_SERVICE: '서비스 이용약관',
  PRIVACY_POLICY: '개인정보 수집·이용',
  LOCATION_POLICY: '위치정보 이용',
  MARKETING_NOTICE: '마케팅 수신',
}

type Tab = 'safety' | 'contract' | 'consent'

export default function MyDocumentsPage() {
  const [tab, setTab] = useState<Tab>('safety')
  const [safetyDocs, setSafetyDocs] = useState<SafetyDoc[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/worker/documents')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setSafetyDocs(res.data.safetyDocuments ?? [])
          setContracts(res.data.contracts ?? [])
          setConsents(res.data.consents ?? [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'safety', label: '안전서류', count: safetyDocs.length },
    { key: 'contract', label: '계약서', count: contracts.length },
    { key: 'consent', label: '동의서', count: consents.length },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <WorkerTopBar />

      <main className="flex-1 pb-20 pt-14">
        {/* 반려 서류 경고 배너 */}
        {!loading && safetyDocs.some(d => d.status === 'REJECTED') && (
          <div className="px-4 pt-4 pb-0">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <div className="text-[13px] font-bold text-red-700 mb-1">보완 필요 서류가 있습니다</div>
              {safetyDocs.filter(d => d.status === 'REJECTED').map(d => (
                <Link key={d.id} href={`/my/documents/${d.id}`}
                  className="flex items-center justify-between py-1 no-underline">
                  <span className="text-[13px] text-red-600">{DOC_TYPE_LABELS[d.documentType] ?? d.documentType}</span>
                  <span className="text-[11px] text-red-400">재제출 &rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 서류 현황 요약 */}
        {!loading && (
          <div className="px-4 pt-4 pb-2">
            <div
              className="rounded-xl px-[18px] py-4 border"
              style={{
                background: safetyDocs.length + contracts.length > 0
                  ? 'rgba(46,125,50,0.12)' : 'rgba(244,121,32,0.1)',
                borderColor: safetyDocs.length + contracts.length > 0
                  ? 'rgba(46,125,50,0.4)' : 'rgba(244,121,32,0.4)',
              }}
            >
              <div className="flex items-center gap-[10px]">
                <span className="text-2xl">{safetyDocs.length + contracts.length > 0 ? '📋' : '📄'}</span>
                <div>
                  <div className="text-[15px] font-bold text-[#0F172A]">
                    안전서류 {safetyDocs.length}건 · 계약서 {contracts.length}건 · 동의서 {consents.length}건
                  </div>
                  <div className="text-[13px] text-gray-500 mt-0.5">
                    {(() => {
                      const approved = safetyDocs.filter(d => d.status === 'APPROVED').length
                      const rejected = safetyDocs.filter(d => d.status === 'REJECTED').length
                      const reviewing = safetyDocs.filter(d => d.status === 'REVIEW_REQUESTED' || d.status === 'SIGNED').length
                      const parts: string[] = []
                      if (approved > 0) parts.push(`승인 ${approved}건`)
                      if (reviewing > 0) parts.push(`검토중 ${reviewing}건`)
                      if (rejected > 0) parts.push(`반려 ${rejected}건`)
                      return parts.length > 0 ? parts.join(' · ') : '아직 발급된 서류가 없습니다'
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 탭 */}
        <div className="flex border-b bg-white sticky top-14 z-10">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {t.label} {t.count > 0 && <span className="ml-1 text-xs">({t.count})</span>}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-10 text-gray-400">불러오는 중...</div>
          ) : tab === 'safety' ? (
            safetyDocs.length === 0 ? (
              <EmptyState text="안전서류가 없습니다" />
            ) : (
              safetyDocs.map(doc => (
                <Link key={doc.id} href={`/my/documents/${doc.id}`} className="block no-underline">
                  <div className="bg-white rounded-xl p-4 shadow-sm active:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-[#0F172A]">
                        {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                      </span>
                      <StatusBadge status={doc.status} />
                    </div>
                    {doc.site && (
                      <p className="text-xs text-gray-500">{doc.site.name}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {doc.documentDate ?? doc.createdAt.slice(0, 10)}
                      {doc.signedAt && ` · 서명: ${doc.signedAt.slice(0, 10)}`}
                    </p>
                  </div>
                </Link>
              ))
            )
          ) : tab === 'contract' ? (
            contracts.length === 0 ? (
              <EmptyState text="근로계약서가 없습니다" />
            ) : (
              contracts.map(c => (
                <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      {c.contractKind === 'EMPLOYMENT' ? '근로계약' : '용역계약'}
                    </span>
                    <StatusBadge status={c.contractStatus} />
                  </div>
                  {c.site && <p className="text-xs text-gray-500">{c.site.name}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {c.startDate} ~ {c.endDate ?? '미정'}
                    {c.signedAt && ` · 서명: ${c.signedAt.slice(0, 10)}`}
                  </p>
                </div>
              ))
            )
          ) : (
            consents.length === 0 ? (
              <EmptyState text="동의 이력이 없습니다" />
            ) : (
              consents.map(c => (
                <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      {CONSENT_LABELS[c.consentType] ?? c.consentType}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.agreed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.agreed ? '동의' : '미동의'}
                    </span>
                  </div>
                  {c.policyDocument && (
                    <p className="text-xs text-gray-500">v{c.policyDocument.version}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {c.agreedAt ? c.agreedAt.slice(0, 10) : ''}
                  </p>
                </div>
              ))
            )
          )}
        </div>
      </main>

      <WorkerBottomNav />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-gray-400 text-sm">{text}</div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { text: status, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.text}</span>
  )
}
