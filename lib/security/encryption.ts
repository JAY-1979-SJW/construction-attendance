/**
 * 암호화 + 마스킹 공통 유틸리티
 *
 * ■ 마스킹 정책 (전체 시스템 공통)
 *   - 주민등록번호: 앞 8자리 표시, 뒤 6자리 마스킹  예) 900101-1******
 *   - 외국인등록번호: 동일 규칙
 *   - 발급번호/면허번호: 뒤 4자리 마스킹  예) ABCD1234****
 *   - 주소: 시/구 단위까지만 표시, 이하 *** 처리  예) 서울시 강남구 ***
 *
 * ■ 원본 저장 정책
 *   - 민감 정보(주민번호, 주소, 면허번호)는 AES-256-GCM으로 암호화 저장
 *   - 환경변수: IDENTITY_ENCRYPTION_KEY (최소 32자)
 *
 * ■ 열람 권한 정책
 *   - 기본 조회: 마스킹값(idNumberMasked, addressMasked, licenseNumberMasked)만 노출
 *   - 원본 조회: ADMIN, SUPER_ADMIN 역할만 복호화 허용 + 감사로그 필수
 *   - 원본 다운로드: SUPER_ADMIN만 허용 + 감사로그 필수
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.IDENTITY_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? 'fallback-dev-key-32chars-minimum!!'
  return scryptSync(secret, 'identity-salt-v1', 32)
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.slice(0, 16)
  const tag = buf.slice(16, 32)
  const encrypted = buf.slice(32)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}

export function maskIdNumber(id: string): string {
  if (!id) return ''
  if (/^\d{6}-\d{7}$/.test(id)) return id.slice(0, 8) + '******'
  if (/^\d{6}-[0-9A-Z]\d{6}$/.test(id)) return id.slice(0, 8) + '******'
  if (id.length >= 8) return id.slice(0, -4) + '****'
  return id.slice(0, 2) + '****'
}

export function maskAddress(address: string): string {
  if (!address) return ''
  const parts = address.split(' ')
  if (parts.length <= 2) return address
  return parts.slice(0, 2).join(' ') + ' ***'
}
