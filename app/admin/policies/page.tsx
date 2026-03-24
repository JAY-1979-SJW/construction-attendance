'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

interface PolicyDoc {
  id: string
  documentType: string
  title: string
  version: string
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
  isRequired: boolean
  createdAt: string
  _count: { consents: number }
}

const DOC_TYPE_LABEL: Record<string, string> = {
  TERMS_OF_SERVICE: '이용약관',
  PRIVACY_POLICY: '개인정보처리방침',
  LOCATION_POLICY: '위치정보 이용약관',
  MARKETING_NOTICE: '마케팅 수신 동의',
}

const EMPTY_FORM = {
  documentType: 'TERMS_OF_SERVICE',
  title: '',
  version: '',
  effectiveFrom: '',
  contentMd: '',
  isRequired: true,
}

export default function PoliciesPage() {
  const router = useRouter()
  const role = useAdminRole()
  const isSuperAdmin = role === 'SUPER_ADMIN'

  const [docs, setDocs] = useState<PolicyDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedContent, setExpandedContent] = useState<string>('')

  const load = () => {
    setLoading(true)
    fetch('/api/admin/policies')
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setDocs(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!form.title || !form.version || !form.effectiveFrom || !form.contentMd) {
      setMsg({ text: '모든 필드를 입력해 주세요.', ok: false })
      return
    }
    setSubmitting(true)
    setMsg(null)
    const res = await fetch('/api/admin/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, effectiveFrom: new Date(form.effectiveFrom).toISOString() }),
    })
    const data = await res.json()
    setMsg({ text: data.success ? '새 버전이 등록되었습니다.' : (data.message ?? '등록 실패'), ok: data.success })
    if (data.success) { setShowForm(false); setForm(EMPTY_FORM); load() }
    setSubmitting(false)
  }

  const toggleContent = async (doc: PolicyDoc) => {
    if (expandedId === doc.id) { setExpandedId(null); return }
    setExpandedId(doc.id)
    setExpandedContent('로딩 중...')
    fetch(`/api/admin/policies/${doc.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setExpandedContent(data.data.contentMd ?? '(내용 없음)')
        else setExpandedContent('조회 실패')
      })
      .catch(() => setExpandedContent('조회 실패'))
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  const grouped = Object.keys(DOC_TYPE_LABEL).map(type => ({
    type,
    label: DOC_TYPE_LABEL[type],
    docs: docs.filter(d => d.documentType === type),
  }))

  return (
    <div className="flex min-h-screen bg-brand">
      <nav className="w-[220px] bg-brand-deeper py-6 flex-shrink-0">
        <div className="text-white text-base font-bold px-5 pb-6">해한 출퇴근</div>
        {[
          ['/admin', '대시보드'], ['/admin/workers', '근로자 관리'], ['/admin/companies', '회사 관리'], ['/admin/sites', '현장 관리'],
          ['/admin/attendance', '출퇴근 조회'], ['/admin/exceptions', '예외 승인'], ['/admin/device-requests', '기기 승인'],
          ['/admin/devices', '기기 차단 관리'], ['/admin/policies', '약관 관리'],
        ].map(([href, label]) => <Link key={href} href={href} className="block text-white/80 px-5 py-[10px] text-[14px] no-underline">{label}</Link>)}
      </nav>

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-[22px] font-bold m-0">약관/정책 문서 관리</h1>
          {isSuperAdmin && (
            <button onClick={() => setShowForm(!showForm)} className="px-5 py-2 bg-[#1a1a2e] text-white border-none rounded-md cursor-pointer text-[14px]">
              {showForm ? '취소' : '+ 새 버전 등록'}
            </button>
          )}
        </div>

        {msg && (
          <div className={`border rounded-lg px-4 py-3 text-[14px] mb-4 ${msg.ok ? 'bg-[#e8f5e9] border-[#a5d6a7] text-[#2e7d32]' : 'bg-[#ffebee] border-[#ef9a9a] text-[#c62828]'}`}>
            {msg.text}
          </div>
        )}

        {/* 새 버전 등록 폼 */}
        {showForm && isSuperAdmin && (
          <div className="bg-card rounded-[10px] p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
            <h3 className="mt-0 mb-4 text-[16px]">새 정책 문서 버전 등록</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[12px] text-muted-brand mb-1 font-semibold">문서 유형</label>
                <select value={form.documentType} onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))} className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[14px] box-border bg-brand">
                  {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-muted-brand mb-1 font-semibold">버전 (예: 2.0)</label>
                <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[14px] box-border bg-brand" placeholder="2.0" />
              </div>
              <div>
                <label className="block text-[12px] text-muted-brand mb-1 font-semibold">제목</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[14px] box-border bg-brand" placeholder="개인정보처리방침 v2.0" />
              </div>
              <div>
                <label className="block text-[12px] text-muted-brand mb-1 font-semibold">시행일</label>
                <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} className="w-full px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[14px] box-border bg-brand" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] text-muted-brand mb-1 font-semibold">필수 동의 여부</label>
              <label className="flex items-center gap-2 text-[14px] cursor-pointer">
                <input type="checkbox" checked={form.isRequired} onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))} />
                필수 동의 항목
              </label>
            </div>
            <div className="mt-3">
              <label className="block text-[12px] text-muted-brand mb-1 font-semibold">내용 (Markdown)</label>
              <textarea
                value={form.contentMd}
                onChange={e => setForm(f => ({ ...f, contentMd: e.target.value }))}
                className="w-full h-[200px] px-3 py-2 border border-[rgba(91,164,217,0.3)] rounded-md text-[13px] box-border resize-y font-mono bg-brand"
                placeholder="# 약관 내용&#10;&#10;본 약관은..."
              />
            </div>
            <button onClick={handleSubmit} disabled={submitting} className="mt-3 px-5 py-2 bg-[#1a1a2e] text-white border-none rounded-md cursor-pointer text-[14px]">
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        )}

        {loading ? <p>로딩 중...</p> : (
          <div className="flex flex-col gap-6">
            {grouped.map(group => (
              <div key={group.type} className="bg-card rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                <h2 className="text-[16px] font-bold mt-0 mb-4 border-b-2 border-[#f0f0f0] pb-2">{group.label}</h2>
                {group.docs.length === 0 ? (
                  <p className="text-[#718096] text-[14px]">등록된 문서가 없습니다.</p>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['버전', '제목', '시행일', '종료일', '상태', '필수', '동의자수', ''].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[12px] text-muted-brand border-b-2 border-[rgba(91,164,217,0.2)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.docs.map(doc => (
                        <>
                          <tr key={doc.id} className={doc.isActive ? 'bg-[#f0fdf4]' : 'bg-white'}>
                            <td className="px-3 py-[10px] text-[14px] border-b border-[#f5f5f5]"><span className="font-bold font-mono">v{doc.version}</span></td>
                            <td className="px-3 py-[10px] text-[14px] border-b border-[#f5f5f5]">{doc.title}</td>
                            <td className="px-3 py-[10px] text-[14px] border-b border-[#f5f5f5]">{fmt(doc.effectiveFrom)}</td>
                            <td className="px-3 py-[10px] text-[14px] border-b border-[#f5f5f5]">{doc.effectiveTo ? fmt(doc.effectiveTo) : '-'}</td>
                            <td className="px-3 py-[10px] text-[14px] border-b border-[#f5f5f5]">
                              {doc.isActive ? (
                                <span className="text-[11px] bg-[#e8f5e9] text-[#2e7d32] px-2 py-[2px] rounded-[10px] font-bold">현행</span>
                              ) : (
                                <span className="text-[11px] bg-brand text-muted-brand px-2 py-[2px] rounded-[10px]">구버전</span>
                              )}
                            </td>
                            <td className="px-3 py-[10px] text-[14px] border-b border-[#f5f5f5]">{doc.isRequired ? '필수' : '선택'}</td>
                            <td className="px-3 py-[10px] text-[14px] border-b border-[#f5f5f5]">{doc._count.consents}명</td>
                            <td className="px-3 py-[10px] text-[14px] border-b border-[#f5f5f5]">
                              <button onClick={() => toggleContent(doc)} className="px-[10px] py-1 border border-[rgba(91,164,217,0.3)] rounded bg-card cursor-pointer text-[12px]">
                                {expandedId === doc.id ? '닫기' : '내용 보기'}
                              </button>
                            </td>
                          </tr>
                          {expandedId === doc.id && (
                            <tr key={`${doc.id}_content`}>
                              <td colSpan={8} className="px-4 py-4 bg-[#f9f9f9] border-b border-[#eee]">
                                <pre className="text-[12px] whitespace-pre-wrap text-[#444] m-0">{expandedContent}</pre>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
