import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from './jwt'
import { forbidden, unauthorized } from '@/lib/utils/response'
import { isUserRevoked } from './user-revocation'
import type { JwtPayload } from '@/types/auth'
import {
  MUTATE_ALLOWED_ROLES,
  SUPER_ADMIN_ONLY_ROLES,
  PLATFORM_ADMIN_ROLES,
  COMPANY_ADMIN_ROLE,
  SITE_MUTATE_ROLES,
  hasFeaturePermission,
  type AdminFeature,
} from '@/lib/policies/security-policy'

// ─── 현장 접근 권한 공통 함수 재내보내기 ──────────────────────────────────────
export {
  canAccessSite,
  canAccessCompany,
  getAccessibleSiteIds,
  getAccessibleCompanyIds,
  buildSiteScopeWhere,
  buildWorkerScopeWhere,
  siteAccessDenied,
  siteAccessDeniedWithLog,
  companyAccessDenied,
  companyAccessDeniedWithLog,
} from './site-access'

// 변경 작업 허용 역할 (VIEWER 제외) — security-policy 참조
export const MUTATE_ROLES: readonly string[] = MUTATE_ALLOWED_ROLES

// 현장성 데이터 쓰기 허용 역할 (SITE_ADMIN 포함) — security-policy 참조
export const SITE_MUTATE_ROLES_EXPORT: readonly string[] = SITE_MUTATE_ROLES

// SUPER_ADMIN 전용 작업 — security-policy 참조
export const SUPER_ADMIN_ONLY: readonly string[] = SUPER_ADMIN_ONLY_ROLES

// 플랫폼 관리자 역할 (업체 관리자 제외) — security-policy 참조
export const PLATFORM_ROLES: readonly string[] = PLATFORM_ADMIN_ROLES

// 업체 관리자 역할 — security-policy 참조
export const COMPANY_ADMIN_ROLES = [COMPANY_ADMIN_ROLE] as const

/**
 * 세션의 역할이 허용 목록에 없으면 403 NextResponse 반환, 있으면 null 반환.
 * 반환값이 null이 아니면 즉시 return 처리해야 합니다.
 */
export function requireRole(
  session: JwtPayload,
  allowed: readonly string[]
): NextResponse<unknown> | null {
  if (!allowed.includes(session.role ?? '')) {
    return forbidden(`이 작업은 ${allowed.join(', ')} 권한이 필요합니다.`)
  }
  return null
}

export async function getWorkerSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('worker_token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  // 비밀번호/상태 변경 후 발급된 토큰만 유효
  if (isUserRevoked(payload.sub, payload.iat)) return null
  return payload
}

export async function getAdminSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.type !== 'admin') return null
  // 비밀번호/권한 변경, 비활성화 후 발급된 토큰만 유효
  if (isUserRevoked(payload.sub, payload.iat)) return null
  return payload
}

export async function requireWorker(): Promise<JwtPayload> {
  const session = await getWorkerSession()
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}

export async function requireAdmin(): Promise<JwtPayload> {
  const session = await getAdminSession()
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}

/** COMPANY_ADMIN 전용 — companyId 없으면 거부 */
export async function requireCompanyAdmin(): Promise<JwtPayload & { companyId: string }> {
  const session = await getAdminSession()
  if (!session) throw new Error('UNAUTHORIZED')
  if (session.role !== 'COMPANY_ADMIN' || !session.companyId) throw new Error('FORBIDDEN')
  return session as JwtPayload & { companyId: string }
}

/** 플랫폼 관리자 전용 — COMPANY_ADMIN 접근 거부 */
export function requirePlatformRole(session: JwtPayload): NextResponse<unknown> | null {
  if (session.role === 'COMPANY_ADMIN') {
    return forbidden('플랫폼 관리자 전용 기능입니다.')
  }
  return null
}

/**
 * 세션의 역할이 특정 기능 권한을 보유하는지 확인한다.
 * 권한 없으면 403 NextResponse 반환, 있으면 null 반환.
 *
 * 사용 예:
 *   const deny = requireFeature(session, 'ATTENDANCE_APPROVE')
 *   if (deny) return deny
 */
export function requireFeature(
  session: JwtPayload,
  feature: AdminFeature
): NextResponse<unknown> | null {
  if (!hasFeaturePermission(session.role, feature)) {
    return forbidden(`이 작업은 ${feature} 권한이 필요합니다. 현재 역할: ${session.role ?? '없음'}`)
  }
  return null
}

// feature permission 유틸 재내보내기
export { hasFeaturePermission, type AdminFeature }

/** unauthorized response helper (기존 코드 호환) */
export { unauthorized }
