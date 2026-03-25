'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DeviceRequest {
  id: string
  workerName: string
  deviceName: string
  status: string
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = { PENDING: '?ÄÍ∏∞Ï§ë', APPROVED: '?πÏù∏', REJECTED: 'Î∞òÎ†§' }
const STATUS_COLOR: Record<string, string> = { PENDING: '#e65100', APPROVED: '#2e7d32', REJECTED: '#888' }
const STATUS_BG: Record<string, string> = { PENDING: '#fff3e0', APPROVED: '#e8f5e9', REJECTED: '#f5f5f5' }

export default function CompanyDevicesPage() {
  const router = useRouter()
  const [items, setItems] = useState<DeviceRequest[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = (s = statusFilter) => {
    setLoading(true)
    const q = s !== 'ALL' ? `?status=${s}` : ''
    fetch(`/api/company/devices${q}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) { router.push('/company/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id)
    setMsg('')
    try {
      const res = await fetch(`/api/company/devices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      setMsg(data.success ? (action === 'approve' ? '?πÏù∏?òÏóà?µÎãà??' : 'Î∞òÎ†§?òÏóà?µÎãà??') : (data.message ?? '?§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.'))
      if (data.success) load()
    } catch {
      setMsg('?§Ìä∏?åÌÅ¨ ?§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.')
    } finally {
      setProcessing(null)
    }
  }

  const handleFilterChange = (s: string) => {
    setStatusFilter(s)
    load(s)
  }

  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold m-0 mb-4 text-white">Í∏∞Í∏∞ ?πÏù∏ ({total}Í±?</h1>

      {msg && (
        <p
          className="px-[14px] py-[10px] rounded-md mb-4 text-[14px]"
          style={{
            background: msg.includes('?§Î•ò') ? '#ffebee' : '#e8f5e9',
            color: msg.includes('?§Î•ò') ? '#b71c1c' : '#2e7d32',
          }}
        >
          {msg}
        </p>
      )}

      <div className="flex gap-2 mb-4">
        {[['PENDING', '?ÄÍ∏∞Ï§ë'], ['APPROVED', '?πÏù∏'], ['REJECTED', 'Î∞òÎ†§'], ['ALL', '?ÑÏ≤¥']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => handleFilterChange(val)}
            className="px-[14px] py-[7px] border-none rounded-md cursor-pointer text-[13px] font-semibold"
            style={{
              background: statusFilter === val ? '#F97316' : '#eee',
              color: statusFilter === val ? 'white' : '#555',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-brand text-[15px]">Î∂àÎü¨?§Îäî Ï§?..</p>
      ) : (
        <div className="bg-card rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.07)] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Í∑ºÎ°ú?êÎ™Ö', 'Í∏∞Í∏∞Î™?, '?îÏ≤≠?ºÏãú', '?ÅÌÉú', 'Ï≤òÎ¶¨'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold text-muted-brand border-b border-[#eee] bg-[#fafafa] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-[#aaa] text-[14px]">Í∏∞Í∏∞ ?îÏ≤≠???ÜÏäµ?àÎã§.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="border-b border-[#f0f0f0]">
                  <td className="px-4 py-3 text-[14px] text-[#CBD5E0] whitespace-nowrap">{item.workerName}</td>
                  <td className="px-4 py-3 text-[14px] text-[#CBD5E0] whitespace-nowrap">{item.deviceName}</td>
                  <td className="px-4 py-3 text-[14px] text-[#CBD5E0] whitespace-nowrap">{formatDt(item.createdAt)}</td>
                  <td className="px-4 py-3 text-[14px] text-[#CBD5E0] whitespace-nowrap">
                    <span
                      className="px-2 py-[3px] rounded text-[12px] font-semibold"
                      style={{
                        background: STATUS_BG[item.status] ?? '#f5f5f5',
                        color: STATUS_COLOR[item.status] ?? '#555',
                      }}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-[#CBD5E0] whitespace-nowrap">
                    {item.status === 'PENDING' && (
                      <div className="flex gap-[6px]">
                        <button
                          onClick={() => handleAction(item.id, 'approve')}
                          disabled={processing === item.id}
                          className="px-3 py-[5px] bg-[#2e7d32] text-white border-none rounded-[5px] cursor-pointer text-[13px] font-semibold"
                          style={{ opacity: processing === item.id ? 0.6 : 1 }}
                        >
                          ?πÏù∏
                        </button>
                        <button
                          onClick={() => handleAction(item.id, 'reject')}
                          disabled={processing === item.id}
                          className="px-3 py-[5px] bg-[#b71c1c] text-white border-none rounded-[5px] cursor-pointer text-[13px] font-semibold"
                          style={{ opacity: processing === item.id ? 0.6 : 1 }}
                        >
                          Î∞òÎ†§
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
