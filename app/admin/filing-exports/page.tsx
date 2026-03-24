'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FilingExport {
  id: string
  monthKey: string
  exportType: string
  status: string
  rowCount: number
  version: number
  isLatest: boolean
  createdAt: string
}

const EXPORT_TYPES = [
  { value: 'DAILY_WAGE_NTS',         label: '일용근로소득 지급명세 (국세청)' },
  { value: 'BUSINESS_INCOME_NTS',    label: '사업소득 간이지급명세 (국세청)' },
  { value: 'EI_DAILY_REPORT',        label: '고용보험 근로내용확인신고' },
  { value: 'NP_BASE',                label: '국민연금 판정 기초자료' },
  { value: 'HI_BASE',                label: '건강보험 판정 기초자료' },
  { value: 'RETIREMENT_MUTUAL_BASE', label: '퇴직공제 기초자료' },
]

function getMonthKey() {
  const now = new Date(Date.now() + 9 * 3600000)
  return now.toISOString().slice(0, 7)
}

export default function FilingExportsPage() {
  const router = useRouter()
  const [monthKey, setMonthKey]       = useState(getMonthKey())
  const [items, setItems]             = useState<FilingExport[]>([])
  const [loading, setLoading]         = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [generating, setGenerating]   = useState(false)
  const [msg, setMsg]                 = useState('')
  const [preview, setPreview]         = useState<{ exportId: string; rows: Record<string, unknown>[]; rowCount: number } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/filing-exports?monthKey=${monthKey}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { router.push('/admin/login'); return }
        setItems(d.data.items)
        setLoading(false)
      })
  }, [monthKey, router])

  useEffect(() => { load() }, [load])

  const handleGenerate = async () => {
    if (!selectedType) { setMsg('내보내기 유형을 선택하세요'); return }
    setGenerating(true)
    setPreview(null)
    const r = await fetch('/api/admin/filing-exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey, exportType: selectedType }),
    }).then((r) => r.json())
    setGenerating(false)
    if (r.success) {
      setMsg(`생성 완료 — ${r.data.rowCount}건`)
      setPreview(r.data)
      load()
    } else {
      setMsg('생성 실패: ' + r.message)
    }
  }

  const handleDownload = (id: string) => {
    window.location.href = `/api/admin/filing-exports/${id}/download`
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  // Group items by exportType to determine which is the latest version per type+month
  const latestByTypeMonth = items.reduce<Record<string, string>>((acc, item) => {
    const key = `${item.monthKey}__${item.exportType}`
    if (!acc[key] || new Date(item.createdAt) > new Date(items.find((i) => i.id === acc[key])?.createdAt ?? '')) {
      acc[key] = item.id
    }
    return acc
  }, {})

  return (
    <div className="flex min-h-screen bg-brand">
      <nav className="w-[220px] bg-brand-deeper py-6 flex-shrink-0 flex flex-col">
        <div className="text-white text-base font-bold px-5 pb-6 border-b border-white/10">해한 출퇴근</div>
        <div className="text-white/40 text-[11px] px-5 pt-4 pb-2 uppercase tracking-widest">관리</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={[
            'block text-white/80 px-5 py-[10px] text-[13px] no-underline',
            item.href === '/admin/filing-exports' ? 'bg-white/10 text-white font-bold' : '',
          ].join(' ')}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => router.push('/admin/login'))} className="mx-5 mt-6 py-[10px] bg-white/10 border-0 rounded-md text-white/60 cursor-pointer text-[13px]">로그아웃</button>
      </nav>

      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-bold mb-2">신고자료 내보내기</h1>
        <p className="text-[13px] text-muted-brand mb-5">
          근무확정 → 보험판정 → 세금계산 완료 후 내보내기를 실행하세요
        </p>

        {/* 생성 영역 */}
        <div className="bg-card rounded-[12px] p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-[12px] text-muted-brand mb-1 font-semibold">귀속연월</label>
              <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-brand" />
            </div>
            <div>
              <label className="block text-[12px] text-muted-brand mb-1 font-semibold">자료 유형</label>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="px-[10px] py-2 border border-[rgba(91,164,217,0.2)] rounded-md text-[14px] bg-brand min-w-[240px]">
                <option value="">유형 선택</option>
                {EXPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <button onClick={handleGenerate} disabled={generating} className="px-4 py-2 bg-[#7b1fa2] text-white border-0 rounded-md cursor-pointer text-[14px] font-semibold">
              {generating ? '생성 중...' : '기초자료 생성'}
            </button>
          </div>
        </div>

        {msg && <div className="px-4 py-3 bg-[rgba(91,164,217,0.1)] rounded-lg mb-4 text-[14px] text-[#4A93C8]">{msg}</div>}

        {/* 미리보기 */}
        {preview && preview.rows.length > 0 && (
          <div className="bg-card rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-[#f0f0f0] flex justify-between items-center">
              <span className="font-bold text-[14px]">미리보기 (전체 {preview.rowCount}건 중 상위 5건)</span>
              <button onClick={() => handleDownload(preview.exportId)} className="px-4 py-2 bg-accent text-white border-0 rounded-md cursor-pointer text-[14px] font-semibold">CSV 다운로드</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>{Object.keys(preview.rows[0]).map((h) => <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="cursor-default">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{String(v ?? '-')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 이력 */}
        <div className="bg-card rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f0f0f0] font-bold text-[14px]">생성 이력</div>
          {loading ? <div className="py-8 text-center text-[#999]">로딩 중...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>{['귀속연월', '자료유형', '건수', '버전', '생성일시', ''].map((h) => <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[rgba(91,164,217,0.2)] whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-[#999]">이력 없음</td></tr>
                  ) : items.map((item) => {
                    const typeMonthKey = `${item.monthKey}__${item.exportType}`
                    const isLatest = latestByTypeMonth[typeMonthKey] === item.id
                    return (
                      <tr key={item.id} className="cursor-default">
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{item.monthKey}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                          {EXPORT_TYPES.find((t) => t.value === item.exportType)?.label ?? item.exportType}
                          {!isLatest && (
                            <span className="ml-[6px] text-[11px] bg-[#fff3e0] text-[#e65100] px-[6px] py-[1px] rounded font-semibold">
                              구버전
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">{item.rowCount}건</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top text-center">
                          <span className="text-[12px] font-semibold" style={{ color: isLatest ? '#2e7d32' : '#9e9e9e' }}>
                            v{item.version ?? 1}
                            {isLatest && <span className="ml-1 text-[10px] bg-[#e8f5e9] text-[#2e7d32] px-[5px] py-[1px] rounded-[3px]">최신</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">{fmtDate(item.createdAt)}</td>
                        <td className="px-4 py-3 text-[13px] text-[#CBD5E0] border-b border-[rgba(91,164,217,0.1)] align-top">
                          <button
                            onClick={() => handleDownload(item.id)}
                            className="px-3 py-1 text-[12px] text-white border-0 rounded-md cursor-pointer font-semibold"
                            style={{ background: isLatest ? '#1976d2' : '#9e9e9e' }}
                          >
                            다운로드
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/admin',                       label: '대시보드' },
  { href: '/admin/workers',               label: '근로자 관리' },
  { href: '/admin/companies', label: '회사 관리' },
  { href: '/admin/sites',                 label: '현장 관리' },
  { href: '/admin/attendance',            label: '출퇴근 조회' },
  { href: '/admin/presence-checks',       label: '체류확인 현황' },
  { href: '/admin/presence-report',       label: '체류확인 리포트' },
  { href: '/admin/work-confirmations',    label: '근무확정' },
  { href: '/admin/contracts',             label: '인력/계약 관리' },
  { href: '/admin/insurance-eligibility', label: '보험판정' },
  { href: '/admin/wage-calculations',     label: '세금/노임 계산' },
  { href: '/admin/filing-exports',        label: '신고자료 내보내기' },
  { href: '/admin/retirement-mutual',     label: '퇴직공제' },
  { href: '/admin/labor-cost-summaries',  label: '노무비 집계' },
  { href: '/admin/month-closings',        label: '월마감' },
  { href: '/admin/corrections',           label: '정정 이력' },
  { href: '/admin/exceptions',            label: '예외 승인' },
  { href: '/admin/device-requests',       label: '기기 변경' },
]
