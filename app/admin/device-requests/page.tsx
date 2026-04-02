'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminRole } from '@/lib/hooks/useAdminRole'
import { StatusBadge, MobileCardList, MobileCard, MobileCardField, MobileCardFields, MobileCardActions } from '@/components/admin/ui'

interface DeviceRequest {
  id: string
  workerName: string
  workerPhone: string
  company: string
  oldDeviceToken: string | null
  newDeviceName: string
  reason: string
  status: string
  requestedAt: string
  processedAt: string | null
}

const STATUS_LABEL: Record<string, string> = { PENDING: '대기중', APPROVED: '승인', REJECTED: '반려' }
const STATUS_COLOR: Record<string, string> = { PENDING: '#e65100', APPROVED: '#2e7d32', REJECTED: '#888' }

export default function DeviceRequestsPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'
  const [items, setItems] = useState<DeviceRequest[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = (s = statusFilter) => {
    setLoading(true)
    fetch(`/api/admin/device-requests?status=${s}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setProcessing(requestId)
    setMsg('')
    const res = await fetch('/api/admin/device-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action }),
    })
    const data = await res.json()
    setMsg(data.message)
    if (data.success) load()
    setProcessing(null)
  }

  const formatPhone = (p: string) => p.length === 11 ? `${p.slice(0,3)}-${p.slice(3,7)}-${p.slice(7)}` : p
  const formatDt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  const getRequestType = (item: DeviceRequest) => item.oldDeviceToken === null ? '신규 등록' : '기기 변경'
  const getTypeColor = (item: DeviceRequest) => item.oldDeviceToken === null ? '#1565c0' : '#6a1b9a'

  return (
    <div className="p-8">
        <h1 className="text-[22px] font-bold m-0 mb-5">기기 등록/변경 요청 ({total}건)</h1>

        {msg && (
          <div className="bg-green-light border border-[#a5d6a7] rounded-lg px-4 py-3 text-sm text-[#2e7d32] mb-4">
            {msg}
          </div>
        )}

        {/* 상태 탭 */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          {[['PENDING', '대기중'], ['APPROVED', '승인'], ['REJECTED', '반려']].map(([s, label]) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); load(s) }}
              className={`px-5 py-2 border rounded-md cursor-pointer text-sm transition-colors ${statusFilter === s ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-[rgba(91,164,217,0.3)] bg-card text-muted-brand'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <p>로딩 중...</p> : items.length === 0 ? (
          <div className="text-center py-12 text-muted2-brand text-[13px]">요청이 없습니다.</div>
        ) : (
          <MobileCardList
            items={items}
            keyExtractor={(item) => item.id}
            emptyMessage="요청이 없습니다."
            renderCard={(item) => (
              <MobileCard
                title={item.workerName}
                subtitle={formatPhone(item.workerPhone)}
                badge={<span style={{ fontSize: '11px', fontWeight: 700, color: getTypeColor(item), background: item.oldDeviceToken === null ? '#e3f2fd' : '#f3e5f5', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' as const }}>{getRequestType(item)}</span>}
              >
                <MobileCardFields>
                  <MobileCardField label="기기명" value={item.newDeviceName} />
                  {item.reason && <MobileCardField label="사유" value={item.reason} />}
                  <MobileCardField label="요청일" value={formatDt(item.requestedAt)} />
                </MobileCardFields>
                {item.status === 'PENDING' && canMutate ? (
                  <MobileCardActions>
                    <button onClick={() => handleAction(item.id, 'APPROVE')} disabled={processing === item.id}
                      className="px-3 py-1.5 bg-[#2e7d32] text-white border-none rounded-md cursor-pointer text-xs font-semibold disabled:opacity-50">승인</button>
                    <button onClick={() => handleAction(item.id, 'REJECT')} disabled={processing === item.id}
                      className="px-3 py-1.5 bg-[#e53935] text-white border-none rounded-md cursor-pointer text-xs font-semibold disabled:opacity-50">반려</button>
                  </MobileCardActions>
                ) : (
                  <div className="mt-2 text-right">
                    <span style={{ color: STATUS_COLOR[item.status], fontWeight: 600, fontSize: '12px' }}>{STATUS_LABEL[item.status]}</span>
                  </div>
                )}
              </MobileCard>
            )}
            renderTable={() => (
              <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-[rgba(91,164,217,0.2)]">
                      {['유형', '근로자', '연락처', '새 기기명', '사유', '요청일', '상태', '처리'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs text-muted-brand">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-[rgba(91,164,217,0.1)]">
                        <td className="px-3 py-3">
                          <span style={{ fontSize: '11px', fontWeight: 700, color: getTypeColor(item), background: item.oldDeviceToken === null ? '#e3f2fd' : '#f3e5f5', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                            {getRequestType(item)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm">{item.workerName}</td>
                        <td className="px-3 py-3 text-sm text-muted-brand">{formatPhone(item.workerPhone)}</td>
                        <td className="px-3 py-3 text-sm">{item.newDeviceName}</td>
                        <td className="px-3 py-3 text-xs text-muted-brand">{item.reason}</td>
                        <td className="px-3 py-3 text-sm text-muted-brand">{formatDt(item.requestedAt)}</td>
                        <td className="px-3 py-3">
                          <span style={{ color: STATUS_COLOR[item.status], fontWeight: 600, fontSize: '12px' }}>{STATUS_LABEL[item.status]}</span>
                        </td>
                        <td className="px-3 py-3">
                          {item.status === 'PENDING' && canMutate && (
                            <div className="flex gap-1.5">
                              <button onClick={() => handleAction(item.id, 'APPROVE')} disabled={processing === item.id}
                                className="px-3 py-1 bg-[#2e7d32] text-white border-none rounded cursor-pointer text-xs disabled:opacity-50">승인</button>
                              <button onClick={() => handleAction(item.id, 'REJECT')} disabled={processing === item.id}
                                className="px-3 py-1 bg-[#e53935] text-white border-none rounded cursor-pointer text-xs disabled:opacity-50">반려</button>
                            </div>
                          )}
                          {item.processedAt && <span className="text-[11px] text-[#999]">{formatDt(item.processedAt)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          />
        )}
    </div>
  )
}
