/**
 * 민감정보 단방향 해시 — HMAC-SHA256
 *
 * 환경변수:
 *   SENSITIVE_DATA_HMAC_KEY  — 64자리 hex (32바이트)
 *
 * 목적:
 *   원문을 복호화하지 않고 검색/중복체크에 사용
 *   (주민등록번호/휴대폰번호 중복 등록 방지)
 */

import { createHmac } from 'crypto'

function getHmacKey(): string {
  const key = process.env.SENSITIVE_DATA_HMAC_KEY
  if (!key || key.length < 32) {
    throw new Error('[crypto] SENSITIVE_DATA_HMAC_KEY is missing or too short')
  }
  return key
}

/**
 * 평문 → HMAC-SHA256 hex
 */
export function hmacHash(value: string): string {
  return createHmac('sha256', getHmacKey()).update(value, 'utf8').digest('hex')
}

/**
 * 값이 있을 때만 해시, null/undefined는 null 반환
 */
export function hmacHashOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  return hmacHash(value)
}
