'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  generateBrowserFingerprint,
  getStoredDeviceToken,
  setDeviceToken,
  detectDeviceName,
} from '@/lib/utils/device-token'
import { generateToken } from '@/lib/utils/random'
import WorkerTopBar from '@/components/worker/WorkerTopBar'

export default function DeviceRegisterPage() {
  const router = useRouter()
  const [deviceName, setDeviceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDeviceName(detectDeviceName())
  }, [])

  const handleRegister = async () => {
    setLoading(true)
    setError('')

    try {
      // 브라우저 fingerprint 기반 device token 생성
      const fingerprint = await generateBrowserFingerprint()
      const deviceToken = `dt_${fingerprint.slice(0, 32)}`

      const res = await fetch('/api/device/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceToken, deviceName }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.message)
        return
      }

      setDeviceToken(deviceToken)
      router.push('/attendance')
    } catch {
      setError('기기 등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <WorkerTopBar />
      <div className="min-h-screen flex items-center justify-center p-5 bg-brand pt-[76px]">
      <div className="bg-card rounded-2xl px-8 py-10 w-full max-w-[400px] shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">기기 등록</h1>
        <p className="text-sm text-muted-brand text-center mb-8 leading-[1.6]">
          이 기기를 본인 기기로 등록합니다.
          <br />
          이후 이 기기에서만 출퇴근이 가능합니다.
        </p>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-[#CBD5E0] mb-2">기기 이름</label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            className="w-full px-4 py-[14px] text-base border border-[rgba(91,164,217,0.25)] rounded-[10px] outline-none box-border bg-[rgba(255,255,255,0.06)] text-white"
            placeholder="내 휴대폰"
          />
        </div>

        {error && <p className="text-[#e53935] text-[13px] mb-4">{error}</p>}

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full py-4 text-lg font-bold bg-[#2e7d32] text-white border-none rounded-[10px] cursor-pointer mb-5"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '등록 중...' : '이 기기로 등록하기'}
        </button>

        <div className="text-xs text-muted-brand bg-[rgba(244,121,32,0.08)] rounded-lg p-3 leading-[1.6]">
          <strong>주의:</strong> 기기 분실 또는 변경 시 현장 관리자에게 기기 변경 요청을 해야 합니다.
        </div>
      </div>
    </div>
    </>
  )
}
