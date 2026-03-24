'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  generateBrowserFingerprint,
  getStoredDeviceToken,
  setDeviceToken,
  detectDeviceName,
} from '@/lib/utils/device-token'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? '해한 현장 출퇴근'
const STORED_PHONE_KEY = 'ca_stored_phone'

type Phase = 'input' | 'pending' | 'rejected'

export default function LoginPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('input')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 앱 재진입 시 저장된 번호로 자동 상태 확인
  useEffect(() => {
    const storedPhone = localStorage.getItem(STORED_PHONE_KEY)
    if (storedPhone) {
      setPhone(storedPhone)
      autoCheck(storedPhone)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getOrCreateDeviceToken = async (): Promise<{ token: string; name: string }> => {
    let token = getStoredDeviceToken()
    if (!token) {
      const fp = await generateBrowserFingerprint()
      token = `dt_${fp.slice(0, 32)}`
      setDeviceToken(token)
    }
    return { token, name: detectDeviceName() }
  }

  const callLoginApi = async (cleanedPhone: string): Promise<void> => {
    const { token, name } = await getOrCreateDeviceToken()

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanedPhone, deviceToken: token, deviceName: name }),
    })
    const data = await res.json()

    if (data.status === 'DEVICE_APPROVED') {
      router.push('/attendance')
      return
    }

    if (data.status === 'DEVICE_PENDING') {
      localStorage.setItem(STORED_PHONE_KEY, cleanedPhone)
      setPhase('pending')
      setError('')
      return
    }

    if (data.status === 'DEVICE_REJECTED') {
      localStorage.removeItem(STORED_PHONE_KEY)
      setPhase('rejected')
      return
    }

    // NOT_REGISTERED, INACTIVE, 기타 오류
    localStorage.removeItem(STORED_PHONE_KEY)
    setError(data.message ?? '오류가 발생했습니다.')
    setPhase('input')
  }

  const autoCheck = async (storedPhone: string) => {
    try {
      await callLoginApi(storedPhone)
    } catch {
      // 자동 확인 실패 시 입력 화면 유지
    }
  }

  const handleLogin = async () => {
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (!/^010\d{8}$/.test(cleaned)) {
      setError('010으로 시작하는 11자리 숫자를 입력하세요.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await callLoginApi(cleaned)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshStatus = async () => {
    const cleaned = phone.replace(/[^0-9]/g, '')
    setLoading(true)
    try {
      await callLoginApi(cleaned)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatPhone = (value: string) => {
    const num = value.replace(/[^0-9]/g, '').slice(0, 11)
    if (num.length < 4) return num
    if (num.length < 8) return `${num.slice(0, 3)}-${num.slice(3)}`
    return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7)}`
  }

  // ── 승인 대기 화면 ──────────────────────────────────────────
  if (phase === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-5 bg-[linear-gradient(135deg,#0F1724_0%,#1B2838_60%,#141E2A_100%)]">
        <div className="bg-[#243144] rounded-2xl px-8 py-10 w-full max-w-[400px] shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-[rgba(91,164,217,0.15)] border-t-[3px] border-t-[#F47920]">
          <div className="text-5xl text-center mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">승인 대기 중</h1>
          <p className="text-sm text-[#A0AEC0] text-center leading-[1.7] mb-3">
            기기 등록 요청이 접수되었습니다.
            <br />
            관리자 승인 후 출퇴근이 가능합니다.
          </p>
          <p className="text-lg font-bold text-white text-center mb-6 tracking-[1px]">{formatPhone(phone)}</p>
          <button
            onClick={handleRefreshStatus}
            disabled={loading}
            className="block w-full py-4 text-lg font-bold bg-[#F47920] text-white border-none rounded-[10px] cursor-pointer mt-2 disabled:opacity-60"
          >
            {loading ? '확인 중...' : '승인 여부 확인'}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(STORED_PHONE_KEY)
              setPhase('input')
              setPhone('')
              setError('')
            }}
            className="block w-full py-3 text-sm bg-transparent text-[#A0AEC0] border border-[rgba(91,164,217,0.2)] rounded-[10px] cursor-pointer mt-[10px]"
          >
            다른 번호로 시도
          </button>
        </div>
      </div>
    )
  }

  // ── 반려 화면 ────────────────────────────────────────────────
  if (phase === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-5 bg-[linear-gradient(135deg,#0F1724_0%,#1B2838_60%,#141E2A_100%)]">
        <div className="bg-[#243144] rounded-2xl px-8 py-10 w-full max-w-[400px] shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-[rgba(91,164,217,0.15)] border-t-[3px] border-t-[#F47920]">
          <div className="text-5xl text-center mb-4">✗</div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">기기 등록 반려</h1>
          <p className="text-sm text-[#A0AEC0] text-center leading-[1.7] mb-3">
            기기 등록 요청이 반려되었습니다.
            <br />
            관리자에게 문의하세요.
          </p>
          <button
            onClick={() => {
              setPhase('input')
              setPhone('')
              setError('')
            }}
            className="block w-full py-4 text-lg font-bold bg-[#F47920] text-white border-none rounded-[10px] cursor-pointer mt-6"
          >
            확인
          </button>
        </div>
      </div>
    )
  }

  // ── 번호 입력 화면 (기본) ────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-[linear-gradient(135deg,#0F1724_0%,#1B2838_60%,#141E2A_100%)]">
      <div className="bg-[#243144] rounded-2xl px-8 py-10 w-full max-w-[400px] shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-[rgba(91,164,217,0.15)] border-t-[3px] border-t-[#F47920]">
        <div className="text-center mb-1">
          <Image src="/logo/logo_main.png" alt="해한Ai Engineering" width={240} height={180} className="w-[200px] h-auto mx-auto block rounded-2xl" priority />
          <div className="text-xs text-[#5a6a7e] mt-2">현장 출퇴근 관리 시스템</div>
        </div>
        <div className="h-px bg-[rgba(255,255,255,0.08)] my-5" />
        <h1 className="text-lg font-bold text-white text-center mb-1">로그인</h1>
        <p className="text-sm text-[#A0AEC0] text-center mb-8">휴대폰 번호를 입력하세요</p>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-[#A0AEC0] mb-2">휴대폰 번호</label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={formatPhone(phone)}
            onChange={(e) => {
              setPhone(e.target.value.replace(/[^0-9]/g, ''))
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-[14px] text-lg border border-[rgba(91,164,217,0.25)] rounded-[10px] outline-none box-border tracking-[2px] bg-[rgba(255,255,255,0.06)] text-white"
            maxLength={13}
          />
        </div>

        {error && <p className="text-[#f56565] text-[13px] mb-4">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="block w-full py-4 text-lg font-bold bg-[#F47920] text-white border-none rounded-[10px] cursor-pointer mt-2 disabled:opacity-60"
        >
          {loading ? '확인 중...' : '로그인'}
        </button>
      </div>
    </div>
  )
}
