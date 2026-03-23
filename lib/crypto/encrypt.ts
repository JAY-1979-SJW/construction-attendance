/**
 * 민감정보 암호화/복호화 — AES-256-GCM
 *
 * 환경변수:
 *   SENSITIVE_DATA_KEY  — 64자리 hex (32바이트, `openssl rand -hex 32`로 생성)
 *
 * 저장 형식: base64(iv:12바이트) + ":" + base64(authTag:16바이트) + ":" + base64(ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES  = 12   // GCM 권장 96-bit
const TAG_BYTES = 16

function getKey(): Buffer {
  const hex = process.env.SENSITIVE_DATA_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('[crypto] SENSITIVE_DATA_KEY is missing or not 64 hex chars (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * 평문 → 암호화 문자열
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * 암호화 문자열 → 평문
 */
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('[crypto] Invalid ciphertext format')

  const iv         = Buffer.from(parts[0], 'base64')
  const tag        = Buffer.from(parts[1], 'base64')
  const encrypted  = Buffer.from(parts[2], 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(encrypted) + decipher.final('utf8')
}

/**
 * 값이 있을 때만 암호화, null/undefined는 null 반환
 */
export function encryptOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  return encrypt(value)
}

/**
 * 값이 있을 때만 복호화, null/undefined는 null 반환
 */
export function decryptOrNull(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null
  return decrypt(ciphertext)
}
