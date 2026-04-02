'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminRole } from '@/lib/hooks/useAdminRole'

interface DeviceItem {
  id: string
  workerId: string
  workerName: string
  workerPhone: string
  workerStatus: string
  deviceToken: string
  deviceName: string
  isPrimary: boolean
  isBlocked: boolean
  blockReason: string | null
  blockedAt: string | null
  lastLoginAt: string | null
  platform: string | null
}

export default function DevicesPage() {
  const router = useRouter()
  const role = useAdminRole()
  const canMutate = role !== null && role !== 'VIEWER'

  const [items, setItems] = useState<DeviceItem[]>([])
  const [total, setTotal] = useState(0)
  const [filterBlocked, setFilterBlocked] = useState<'all' | 'blocked' | 'normal'>('all')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [blockReasonInput, setBlockReasonInput] = useState<Record<string, string>>({})

  const load = useCallback((filter: typeof filterBlocked = filterBlocked) => {
    setLoading(true)
    const q = filter === 'blocked' ? '?isBlocked=true' : filter === 'normal' ? '?isBlocked=false' : ''
    fetch(`/api/admin/devices${q}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { router.push('/admin/login'); return }
        setItems(data.data.items)
        setTotal(data.data.total)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filterBlocked, router])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlock = async (deviceId: string) => {
    const reason = blockReasonInput[deviceId] ?? ''
    setProcessing(deviceId)
    setMsg(null)
    const res = await fetch(`/api/admin/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'BLOCK', blockReason: reason }),
    })
    const data = await res.json()
    setMsg({ text: data.success ? '기기가 차단되었습니다.' : (data.message ?? '처리 실패'), ok: data.success })
    if (data.success) load()
    setProcessing(null)
  }

  const handleUnblock = async (deviceId: string) => {
    setProcessing(deviceId)
    setMsg(null)
    const res = await fetch(`/api/admin/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UNBLOCK' }),
    })
    const data = await res.json()
    setMsg({ text: data.success ? '차단이 해제되었습니다.' : (data.message ?? '처리 실패'), ok: data.success })
    if (data.success) load()
    setProcessing(null)
  }

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '-'
  const fmtPhone = (p: string) => p.length === 11 ? `${p.slice(0,3)}-${p.slice(3,7)}-${p.slice(7)}` : p

  return (
    <div className="p-8">
        <h1 className="text-[22px] font-bold m-0 mb-5">기기 차단 관리 ({total}건)</h1>

        {msg && (
          <div className={`border rounded-lg px-4 py-3 text-sm mb-4 ${msg.ok ? 'bg-green-light border-[#a5d6a7] text-[#2e7d32]' : 'bg-red-light border-[#ef9a9a] text-[#c62828]'}`}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {([['all', '전체'], ['blocked', '차단됨'], ['normal', '정상']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setFilterBlocked(v); load(v) }}
              className={`px-5 py-2 border rounded-md cursor-pointer text-sm transition-colors ${filterBlocked === v ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-[rgba(91,164,217,0.3)] bg-card text-muted-brand'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <p>로딩 중...</p> : (
          <div className="bg-card rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[rgba(91,164,217,0.2)]">
                  {['근로자', '연락처', '기기명', '기기토큰', '플랫폼', '마지막 로그인', '상태', '차단 사유', '처리'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs text-muted-brand">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-6 text-[#999]">기기가 없습니다.</td></tr>
                ) : items.map(item => (
                  <tr key={item.id} className="border-b border-[rgba(91,164,217,0.1)]"
                    style={{ background: item.isBlocked ? '#fff8f8' : 'transparent' }}>
                    <td className="px-3 py-3 text-sm text-dim-brand">
                      <div className="font-semibold">{item.workerName}</div>
                      {item.isPrimary && (
                        <span className="text-[11px] bg-[rgba(244,121,32,0.12)] text-accent px-1.5 py-0.5 rounded-lg mt-0.5 inline-block">주기기</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-dim-brand">{fmtPhone(item.workerPhone)}</td>
                    <td className="px-3 py-3 text-sm text-dim-brand">{item.deviceName}</td>
                    <td className="px-3 py-3 text-[11px] text-muted-brand font-mono">{item.deviceToken}</td>
                    <td className="px-3 py-3 text-sm text-dim-brand">{item.platform ?? '-'}</td>
                    <td className="px-3 py-3 text-sm text-dim-brand">{fmt(item.lastLoginAt)}</td>
                    <td className="px-3 py-3 text-sm text-dim-brand">
                      {item.isBlocked ? (
                        <span className="text-[11px] bg-red-light text-[#c62828] px-2 py-0.5 rounded-[10px] font-bold">차단됨</span>
                      ) : (
                        <span className="text-[11px] bg-green-light text-[#2e7d32] px-2 py-0.5 rounded-[10px] font-bold">정상</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-dim-brand">
                      {item.isBlocked ? (
                        <span className="text-xs text-[#c62828]">{item.blockReason ?? '-'}</span>
                      ) : (
                        canMutate && (
                          <input
                            type="text"
                            placeholder="차단 사유 (선택)"
                            value={blockReasonInput[item.id] ?? ''}
                            onChange={e => setBlockReasonInput(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="px-2 py-1 border border-[rgba(91,164,217,0.3)] rounded text-xs w-[120px] bg-transparent text-white"
                          />
                        )
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-dim-brand">
                      {canMutate && (
                        item.isBlocked ? (
                          <button
                            onClick={() => handleUnblock(item.id)}
                            disabled={processing === item.id}
                            className="px-3 py-1 bg-[#37474f] text-white border-none rounded cursor-pointer text-xs disabled:opacity-50"
                          >
                            차단 해제
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlock(item.id)}
                            disabled={processing === item.id}
                            className="px-3 py-1 bg-[#c62828] text-white border-none rounded cursor-pointer text-xs disabled:opacity-50"
                          >
                            차단
                          </button>
                        )
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
