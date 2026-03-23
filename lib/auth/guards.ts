import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from './jwt'
import { forbidden, unauthorized } from '@/lib/utils/response'
import type { JwtPayload } from '@/types/auth'

// 변경 작업 허용 역할 (VIEWER 제외)
export const MUTATE_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const

// SUPER_ADMIN 전용 작업
export const SUPER_ADMIN_ONLY = ['SUPER_ADMIN'] as const

// 플랫폼 관리자 역할 (업체 관리자 제외)
export const PLATFORM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] as const

// 업체 관리자 역할
export const COMPANY_ADMIN_ROLES = ['COMPANY_ADMIN'] as const

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
  return verifyToken(token)
}

export async function getAdminSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.type !== 'admin') return null
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

/** unauthorized response helper (기존 코드 호환) */
export { unauthorized }
