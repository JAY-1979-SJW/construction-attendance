'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface LaborSummary {
  id: string
  monthKey: string
  siteName: string
  organizationType: string
  workerCount: number
  confirmedWorkUnits: number
  grossAmount: number
  withholdingTaxAmount: number
  retirementMutualTargetDays: number
  createdAt: string
}

interface ConfirmationSummary {
  monthKey: string
  confirmedCount: number
  totalWorkUnits: number
  totalAmount: number
}

interface DocumentsData {
  availableMonths: string[]
  laborSummaries: LaborSummary[]
  confirmationSummary: ConfirmationSummary[]
  totalWorkers: number
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '??
}

const ORG_LABEL: Record<string, string> = {
  DIRECT:        '직접',
  SUBCONTRACTOR: '?�도�?,
}

export default function CompanyDocumentsPage() {
  const router = useRouter()
  const [data, setData] = useState<DocumentsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('')

  const load = useCallback(async (mk?: string) => {
    setLoading(true)
    setMsg('')
    try {
      const qs = mk ? `?monthKey=${mk}` : ''
      const res = await fetch(`/api/company/documents${qs}`)
      if (res.status === 401) { router.push('/company/login'); return }
      if (res.status === 403) {
        setBlocked(true)
        const d = await res.json()
        setMsg(d.message ?? '??기능?� ?�료 ?�랜?�서 ?�용 가?�합?�다.')
        return
      }
      const json = await res.json()
      if (!json.success) { setMsg(json.message ?? '조회 ?�패'); return }
      setData(json.data)
      setBlocked(false)
    } catch {
      setMsg('?�트?�크 ?�류가 발생?�습?�다.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  function handleMonthFilter(mk: string) {
    setSelectedMonth(mk === selectedMonth ? '' : mk)
    load(mk === selectedMonth ? undefined : mk)
  }

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold m-0">?�임?�류 · 집계</h1>
          <p className="text-[13px] text-muted-brand mt-1 mb-0">?�별 ?�임�?집계 �?근무 ?�정 ?�약??조회?�니??</p>
        </div>
        <button onClick={() => load(selectedMonth || undefined)} disabled={loading} className="px-5 py-2 bg-[#F97316] text-white border-none rounded-md cursor-pointer text-[14px] font-semibold">
          {loading ? '조회�?..' : '?�로고침'}
        </button>
      </div>

      {msg && (
        <div
          className="px-[18px] py-[14px] rounded-lg mb-4 text-[14px]"
          style={{
            background: blocked ? '#fff3e0' : '#ffebee',
            color: blocked ? '#e65100' : '#c62828',
          }}
        >
          {msg}
          {blocked && <div className="mt-[6px] text-[13px]">관리자(?�퍼관리자)?�게 기능 ?�성?��? ?�청?�세??</div>}
        </div>
      )}

      {blocked ? (
        <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden px-12 py-12 text-center text-[#999]">
          <div className="text-[32px] mb-[10px]">?��</div>
          <div className="font-semibold">?�임?�류 기능??비활?�화?�어 ?�습?�다.</div>
        </div>
      ) : data && (
        <>
          {/* ?�용 가?????�터 */}
          {data.availableMonths.length > 0 && (
            <div className="mb-5">
              <div className="text-[13px] text-muted-brand mb-2 font-semibold">???�택</div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleMonthFilter('')}
                  className="px-[14px] py-[6px] border border-[rgba(91,164,217,0.3)] rounded-[16px] cursor-pointer text-[13px]"
                  style={{
                    background: selectedMonth === '' ? '#F97316' : '#F3F4F6',
                    color: selectedMonth === '' ? 'white' : '#6B7280',
                    borderColor: selectedMonth === '' ? '#F97316' : '#E5E7EB',
                  }}
                >
                  ?�체
                </button>
                {data.availableMonths.map(m => (
                  <button key={m} onClick={() => handleMonthFilter(m)}
                    className="px-[14px] py-[6px] border border-[rgba(91,164,217,0.3)] rounded-[16px] cursor-pointer text-[13px]"
                    style={{
                      background: selectedMonth === m ? '#F97316' : '#F3F4F6',
                      color: selectedMonth === m ? 'white' : '#6B7280',
                      borderColor: selectedMonth === m ? '#F97316' : '#E5E7EB',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 근무 ?�정 ?�약 */}
          <div className="mb-6">
            <h2 className="text-[16px] font-bold m-0 mb-[10px]">근무 ?�정 ?�약</h2>
            {data.confirmationSummary.length === 0 ? (
              <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden px-6 py-6 text-center text-[#aaa] text-[14px]">
                ?�정??근무 기록???�습?�다.
              </div>
            ) : (
              <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      {['??, '?�정 건수', '�?공수', '�?금액'].map(h => (
                        <th key={h} className="bg-brand px-3 py-[10px] text-left font-semibold text-muted-brand border-b border-[#e0e0e0] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.confirmationSummary.map((row, i) => (
                      <tr key={row.monthKey} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle font-semibold">{row.monthKey}</td>
                        <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{row.confirmedCount}�?/td>
                        <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{row.totalWorkUnits.toFixed(2)}??/td>
                        <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{fmt(row.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ?�임�?집계 */}
          <div>
            <h2 className="text-[16px] font-bold m-0 mb-[10px]">?�임�?집계??/h2>
            {data.laborSummaries.length === 0 ? (
              <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden px-6 py-6 text-center text-[#aaa] text-[14px]">
                ?�임�?집계 ?�이?��? ?�습?�다.
                <div className="text-[12px] mt-1">?�퍼관리자 메뉴 ???�무�?집계 ?�행 ??조회 가?�합?�다.</div>
              </div>
            ) : (
              <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr>
                        {['??, '?�장', '구분', '근로?�수', '공수', '지급총??, '?�천??, '?�직공제(??', '?�성??].map(h => (
                          <th key={h} className="bg-brand px-3 py-[10px] text-left font-semibold text-muted-brand border-b border-[#e0e0e0] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.laborSummaries.map((row, i) => (
                        <tr key={row.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle font-semibold">{row.monthKey}</td>
                          <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle">{row.siteName}</td>
                          <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle">
                            <span
                              className="text-[11px] px-2 py-[2px] rounded-lg"
                              style={{
                                background: row.organizationType === 'DIRECT' ? '#e3f2fd' : '#fce4ec',
                                color: row.organizationType === 'DIRECT' ? '#1565c0' : '#880e4f',
                              }}
                            >
                              {ORG_LABEL[row.organizationType] ?? row.organizationType}
                            </span>
                          </td>
                          <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{row.workerCount}�?/td>
                          <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{row.confirmedWorkUnits.toFixed(2)}</td>
                          <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{fmt(row.grossAmount)}</td>
                          <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right text-[#c62828]">{fmt(row.withholdingTaxAmount)}</td>
                          <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-right">{row.retirementMutualTargetDays}??/td>
                          <td className="px-3 py-[10px] border-b border-[rgba(91,164,217,0.1)] align-middle text-[12px] text-muted-brand">
                            {new Date(row.createdAt).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
