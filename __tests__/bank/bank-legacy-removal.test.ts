/**
 * 단위 / 회귀 테스트: 레거시 계좌 참조 완전 제거 검증
 *
 * 검증 항목:
 *   1. security-policy: 두 legacy fallback 모두 false
 *   2. security-policy: decryptAllowedRoles = SUPER_ADMIN 만
 *   3. security-policy: maskedViewAllowedRoles = MUTATE_ALLOWED_ROLES
 *   4. 감사로그 의무 목록에 ACCOUNT_DECRYPT_VIEW 포함
 *   5. 마스킹 정책: 계좌번호 마지막 4자리만 표시
 *   6. bankName / bankAccount legacy 정책 종료 확인
 */
import { describe, it, expect } from 'vitest'
import {
  BANK_ACCOUNT_POLICY,
  AUDIT_REQUIRED_ACTIONS,
  MASKING_POLICY,
  SUPER_ADMIN_ONLY_ROLES,
  MUTATE_ALLOWED_ROLES,
} from '@/lib/policies/security-policy'

// ─── 정책 설정 검증 ───────────────────────────────────────────

describe('security-policy — 레거시 계좌 정책 종료 확인', () => {

  it('allowLegacyBankAccountFallback 가 false 여야 한다 (레거시 계좌번호 fallback 금지)', () => {
    expect(BANK_ACCOUNT_POLICY.allowLegacyBankAccountFallback).toBe(false)
  })

  it('allowLegacyBankNameDisplay 가 false 여야 한다 (레거시 bankName 표시 종료)', () => {
    expect(BANK_ACCOUNT_POLICY.allowLegacyBankNameDisplay).toBe(false)
  })

  it('decryptAllowedRoles 가 SUPER_ADMIN 만 포함해야 한다', () => {
    expect(BANK_ACCOUNT_POLICY.decryptAllowedRoles).toEqual(SUPER_ADMIN_ONLY_ROLES)
    expect(BANK_ACCOUNT_POLICY.decryptAllowedRoles).not.toContain('ADMIN')
    expect(BANK_ACCOUNT_POLICY.decryptAllowedRoles).not.toContain('COMPANY_ADMIN')
    expect(BANK_ACCOUNT_POLICY.decryptAllowedRoles).not.toContain('VIEWER')
  })

  it('maskedViewAllowedRoles 가 MUTATE_ALLOWED_ROLES 와 동일해야 한다', () => {
    expect(BANK_ACCOUNT_POLICY.maskedViewAllowedRoles).toEqual(MUTATE_ALLOWED_ROLES)
  })

})

describe('security-policy — 감사로그 의무', () => {

  it('ACCOUNT_DECRYPT_VIEW 가 감사로그 의무 목록에 포함된다', () => {
    expect(AUDIT_REQUIRED_ACTIONS).toContain('ACCOUNT_DECRYPT_VIEW')
  })

  it('SENSITIVE_PROFILE_UPDATED 가 감사로그 의무 목록에 포함된다', () => {
    expect(AUDIT_REQUIRED_ACTIONS).toContain('SENSITIVE_PROFILE_UPDATED')
  })

})

describe('security-policy — 마스킹 정책', () => {

  it('계좌번호 마스킹: 마지막 4자리만 표시', () => {
    expect(MASKING_POLICY.accountLastVisible).toBe(4)
  })

  it('전화번호 마스킹: 중간 2자리 마스킹', () => {
    expect(MASKING_POLICY.phoneMiddleMaskLen).toBe(2)
  })

})

// ─── 마스킹 함수 검증 ─────────────────────────────────────────

describe('mask.ts — 계좌번호 마스킹 함수', () => {

  it('maskAccountNumber: 14자리 계좌번호에서 마지막 4자리만 보인다', async () => {
    const { maskAccountNumber } = await import('@/lib/crypto/mask')
    const result = maskAccountNumber('12345678901234')
    expect(result).toMatch(/\*{4,}1234$/)
    expect(result).not.toContain('123456789012')
  })

  it('maskAccountNumber: 10자리 계좌번호에서 마지막 4자리만 보인다', async () => {
    const { maskAccountNumber } = await import('@/lib/crypto/mask')
    const result = maskAccountNumber('1234567890')
    expect(result).toMatch(/\*{4,}7890$/)
  })

  it('maskAccountNumber: 빈문자열 또는 null-like 입력 처리', async () => {
    const { maskAccountNumber } = await import('@/lib/crypto/mask')
    expect(() => maskAccountNumber('')).not.toThrow()
  })

})

// ─── 회귀 테스트: 레거시 필드 코드 참조 없음 확인 ─────────────────

describe('회귀 테스트 — legacy bankName / bankAccount 코드 참조 종료', () => {

  it('BANK_ACCOUNT_POLICY 에 legacy fallback 허용 속성이 false 로 고정된다', () => {
    // 두 legacy fallback 모두 false — 새 코드가 실수로 true 로 되돌리는 것을 방지
    expect(BANK_ACCOUNT_POLICY.allowLegacyBankAccountFallback).toBe(false)
    expect(BANK_ACCOUNT_POLICY.allowLegacyBankNameDisplay).toBe(false)
  })

  it('COMPANY_ADMIN 은 decryptAllowedRoles 에 없다', () => {
    const roles = BANK_ACCOUNT_POLICY.decryptAllowedRoles as readonly string[]
    expect(roles).not.toContain('COMPANY_ADMIN')
  })

  it('VIEWER 는 maskedViewAllowedRoles 에 없다', () => {
    const roles = BANK_ACCOUNT_POLICY.maskedViewAllowedRoles as readonly string[]
    expect(roles).not.toContain('VIEWER')
  })

})

// ─── 시나리오 C: 권한별 노출 범위 정책 ───────────────────────────

describe('시나리오 C — 권한별 계좌정보 노출 정책', () => {

  function canDecrypt(role: string): boolean {
    return (BANK_ACCOUNT_POLICY.decryptAllowedRoles as readonly string[]).includes(role)
  }

  function canViewMasked(role: string): boolean {
    return (BANK_ACCOUNT_POLICY.maskedViewAllowedRoles as readonly string[]).includes(role)
  }

  it('SUPER_ADMIN: 원문 복호화 가능', () => {
    expect(canDecrypt('SUPER_ADMIN')).toBe(true)
  })

  it('ADMIN: 원문 복호화 불가', () => {
    expect(canDecrypt('ADMIN')).toBe(false)
  })

  it('ADMIN: 마스킹 조회 가능', () => {
    expect(canViewMasked('ADMIN')).toBe(true)
  })

  it('COMPANY_ADMIN: 원문 복호화 불가', () => {
    expect(canDecrypt('COMPANY_ADMIN')).toBe(false)
  })

  it('COMPANY_ADMIN: 마스킹 조회 불가 (MUTATE_ALLOWED_ROLES 에 없음)', () => {
    expect(canViewMasked('COMPANY_ADMIN')).toBe(false)
  })

  it('VIEWER: 원문 복호화 불가', () => {
    expect(canDecrypt('VIEWER')).toBe(false)
  })

  it('VIEWER: 마스킹 조회 불가', () => {
    expect(canViewMasked('VIEWER')).toBe(false)
  })

})
