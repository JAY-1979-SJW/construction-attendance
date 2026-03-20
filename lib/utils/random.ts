import { randomBytes, createHash } from 'crypto'

/**
 * N자리 숫자 OTP 생성
 */
export function generateOtp(length = 6): string {
  const max = Math.pow(10, length)
  const num = parseInt(randomBytes(4).toString('hex'), 16) % max
  return num.toString().padStart(length, '0')
}

/**
 * URL-safe 랜덤 토큰 생성 (QR 토큰, device 토큰 등)
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/**
 * 짧은 식별자 (8자, hex)
 */
export function shortId(): string {
  return randomBytes(4).toString('hex')
}

/**
 * device fingerprint → 결정론적 토큰
 * (브라우저에서 수집한 fingerprint 해시)
 */
export function hashFingerprint(fingerprint: string): string {
  return createHash('sha256').update(fingerprint).digest('base64url')
}
