'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { generateBrowserFingerprint, detectDeviceName } from '@/lib/utils/device-token'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

export default function DeviceChangePage() {
  const router = useRouter()
  const [deviceName, setDeviceName] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setDeviceName(detectDeviceName())
  }, [])

  const handleSubmit = async () => {
    if (!reason.trim() || reason.length < 5) {
      setError('변경 사유를 5자 이상 입력하세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const fingerprint = await generateBrowserFingerprint()
      const newDeviceToken = `dt_${fingerprint.slice(0, 32)}`

      const res = await fetch('/api/device/change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDeviceToken, newDeviceName: deviceName, reason }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.message)
        return
      }

      setSubmitted(true)
    } catch {
      setError('요청 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <>
        <WorkerTopBar />
        <div className="min-h-screen flex items-center justify-center p-5 bg-brand pt-[76px]">
        <div className="bg-card rounded-2xl px-8 py-10 w-full max-w-[400px] shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
          <div className="text-[48px] text-center mb-4">📨</div>
          <h1 className="text-[22px] font-bold text-white mb-3 text-center">요청 접수 완료</h1>
          <p className="text-center text-muted-brand text-sm leading-[1.6]">
            기기 변경 요청이 관리자에게 전달되었습니다.
            <br />
            승인 후 새 기기에서 출퇴근 가능합니다.
          </p>
          <button
            onClick={() => router.push('/attendance')}
            className="w-full py-4 text-[17px] font-bold bg-accent text-white border-none rounded-[10px] cursor-pointer mt-6"
          >
            확인
          </button>
        </div>
      </div>
      </>
    )
  }

  return (
    <>
      <WorkerTopBar />
      <div className="min-h-screen flex items-center justify-center p-5 bg-brand pt-[76px]">
      <div className="bg-card rounded-2xl px-8 py-10 w-full max-w-[400px] shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
        <button
          onClick={() => router.back()}
          className="bg-transparent border-none text-muted-brand text-sm cursor-pointer pb-4 block"
        >
          ← 뒤로
        </button>
        <h1 className="text-[22px] font-bold text-white mb-2 text-center">기기 변경 요청</h1>
        <p className="text-[13px] text-muted-brand text-center mb-7 leading-[1.5]">관리자 승인 후 새 기기로 출퇴근할 수 있습니다.</p>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-dim-brand mb-2">새 기기 이름</label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            className="w-full px-[14px] py-3 text-[15px] border border-[rgba(91,164,217,0.25)] rounded-lg outline-none box-border bg-[rgba(255,255,255,0.06)] text-white"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-dim-brand mb-2">변경 사유</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="기기 분실, 기기 교체 등 변경 사유를 입력하세요."
            className="w-full px-[14px] py-3 text-[15px] border border-[rgba(91,164,217,0.25)] rounded-lg outline-none box-border bg-[rgba(255,255,255,0.06)] text-white h-[100px] resize-y"
          />
        </div>

        {error && <p className="text-[#e53935] text-[13px] mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 text-[17px] font-bold bg-accent text-white border-none rounded-[10px] cursor-pointer"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '요청 중...' : '변경 요청하기'}
        </button>
      </div>
    </div>
    </>
  )
}
