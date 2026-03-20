/**
 * 브라우저 측 device token 관련 유틸
 * - localStorage에 저장된 device_token을 읽거나 신규 생성
 * - 서버에서 발급한 토큰을 저장
 */

const DEVICE_TOKEN_KEY = 'ca_device_token'
const DEVICE_NAME_KEY = 'ca_device_name'

export function getStoredDeviceToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(DEVICE_TOKEN_KEY)
}

export function setDeviceToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEVICE_TOKEN_KEY, token)
}

export function getStoredDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device'
  return localStorage.getItem(DEVICE_NAME_KEY) || detectDeviceName()
}

export function detectDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) {
    const match = ua.match(/Android[^;]+;\s*([^)]+)/)
    return match ? match[1].trim() : 'Android Device'
  }
  return 'Web Browser'
}

/**
 * 브라우저에서 수집 가능한 간단한 fingerprint 문자열 생성
 * (완벽한 식별보다 충분한 entropy 확보 목적)
 */
export async function generateBrowserFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency,
  ].join('|')

  const encoder = new TextEncoder()
  const data = encoder.encode(components)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
