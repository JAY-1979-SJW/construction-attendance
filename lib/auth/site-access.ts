/**
 * 현장(Site) 단위 접근 권한 공통 함수
 *
 * 사용 패턴:
 *   const session = await getAdminSession()
 *   if (!session) return unauthorized()
 *   if (!await canAccessSite(session, siteId)) return siteAccessDenied()
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import type { JwtPayload } from '@/types/auth'

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 세션이 해당 현장에 접근 가능한지 확인한다.
 *
 * - SUPER_ADMIN / ADMIN / VIEWER : 모든 현장 허용
 * - COMPANY_ADMIN                : 자기 회사 소속 현장만 허용
 * - SITE_ADMIN                   : SiteAdminAssignment에 등록된 현장만 허용
 * - EXTERNAL_SITE_ADMIN          : UserSiteAccessGroup → SiteAccessGroupSite로 등록된 현장만 허용
 * - 그 외                        : 거부
 */
export async function canAccessSite(
  session: JwtPayload,
  siteId: string
): Promise<boolean> {
  const role = session.role ?? ''

  // 플랫폼 관리자 (SUPER_ADMIN / HQ_ADMIN / ADMIN / VIEWER) — 전체 허용
  if (['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER'].includes(role)) return true

  // COMPANY_ADMIN — 자기 회사 소속 현장만
  if (role === 'COMPANY_ADMIN' && session.companyId) {
    const count = await prisma.siteCompanyAssignment.count({
      where: { siteId, companyId: session.companyId },
    })
    return count > 0
  }

  // SITE_ADMIN — 할당된 현장만
  if (role === 'SITE_ADMIN') {
    const count = await prisma.siteAdminAssignment.count({
      where: { userId: session.sub, siteId, isActive: true },
    })
    return count > 0
  }

  // EXTERNAL_SITE_ADMIN — 회사 인증 완료 확인 후 접근 그룹에 포함된 현장만
  if (role === 'EXTERNAL_SITE_ADMIN') {
    // companyId 없으면 즉시 차단 (fail-closed)
    if (!session.companyId) return false

    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { externalVerificationStatus: true },
    })
    if (!company || company.externalVerificationStatus !== 'VERIFIED') {
      return false
    }

    const count = await prisma.siteAccessGroupSite.count({
      where: {
        siteId,
        accessGroup: {
          isActive: true,
          users: {
            some: { userId: session.sub, isActive: true },
          },
        },
      },
    })
    return count > 0
  }

  return false
}

/**
 * 세션이 접근 가능한 현장 ID 목록을 반환한다.
 * null 반환 = 제한 없음 (WHERE 절에 id 필터 불필요)
 */
export async function getAccessibleSiteIds(
  session: JwtPayload
): Promise<string[] | null> {
  const role = session.role ?? ''

  if (['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER'].includes(role)) return null

  if (role === 'COMPANY_ADMIN' && session.companyId) {
    const rows = await prisma.siteCompanyAssignment.findMany({
      where: { companyId: session.companyId },
      select: { siteId: true },
    })
    const ids = rows.map((r) => r.siteId)
    return ids.filter((v, i) => ids.indexOf(v) === i)
  }

  if (role === 'SITE_ADMIN') {
    const rows = await prisma.siteAdminAssignment.findMany({
      where: { userId: session.sub, isActive: true },
      select: { siteId: true },
    })
    return rows.map((r) => r.siteId)
  }

  if (role === 'EXTERNAL_SITE_ADMIN') {
    const rows = await prisma.siteAccessGroupSite.findMany({
      where: {
        accessGroup: {
          isActive: true,
          users: {
            some: { userId: session.sub, isActive: true },
          },
        },
      },
      select: { siteId: true },
    })
    const ids = rows.map((r) => r.siteId)
    return ids.filter((v, i) => ids.indexOf(v) === i)
  }

  return []
}

/**
 * 세션이 접근 가능한 회사 ID 목록을 반환한다.
 * null = 제한 없음
 *
 * ⚠ EXTERNAL_SITE_ADMIN은 회사 데이터에 접근 불가 → 빈 배열 반환
 */
export async function getAccessibleCompanyIds(
  session: JwtPayload
): Promise<string[] | null> {
  const role = session.role ?? ''

  if (['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER'].includes(role)) return null

  if (role === 'COMPANY_ADMIN' && session.companyId) {
    return [session.companyId]
  }

  if (role === 'SITE_ADMIN') {
    const rows = await prisma.siteAdminAssignment.findMany({
      where: { userId: session.sub, isActive: true },
      select: { companyId: true },
    })
    const cids = rows.map((r) => r.companyId)
    return cids.filter((v, i) => cids.indexOf(v) === i)
  }

  // EXTERNAL_SITE_ADMIN — 회사 데이터 차단 (현장 운영 데이터만 허용)
  if (role === 'EXTERNAL_SITE_ADMIN') {
    return []
  }

  return []
}

/**
 * 세션이 특정 회사에 접근 가능한지 확인한다.
 * EXTERNAL_SITE_ADMIN은 항상 false (회사 데이터 완전 차단)
 */
export async function canAccessCompany(
  session: JwtPayload,
  companyId: string
): Promise<boolean> {
  const role = session.role ?? ''

  if (['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER'].includes(role)) return true

  if (role === 'COMPANY_ADMIN') {
    return session.companyId === companyId
  }

  if (role === 'SITE_ADMIN') {
    const count = await prisma.siteAdminAssignment.count({
      where: { userId: session.sub, companyId, isActive: true },
    })
    return count > 0
  }

  // EXTERNAL_SITE_ADMIN: 회사 접근 차단
  return false
}

/**
 * 현장 접근 거부 응답 — 403
 */
export function siteAccessDenied(): NextResponse {
  return NextResponse.json(
    { success: false, message: '이 현장에 대한 접근 권한이 없습니다.' },
    { status: 403 }
  )
}

/**
 * 회사 접근 거부 응답 — 403
 */
export function companyAccessDenied(): NextResponse {
  return NextResponse.json(
    { success: false, message: '이 업체에 대한 접근 권한이 없습니다.' },
    { status: 403 }
  )
}

// ─── buildSiteScopeWhere ──────────────────────────────────────────────────────

/**
 * Prisma where 조건 빌더 — site 범위 주입
 *
 * 사용 패턴 (목록 API):
 *   const scope = await buildSiteScopeWhere(session)
 *   if (scope === false) return siteAccessDenied()
 *   const rows = await prisma.xxx.findMany({ where: { ...scope, ...otherFilters } })
 *
 * 사용 패턴 (단건 API):
 *   const scope = await buildSiteScopeWhere(session, siteId)
 *   if (scope === false) return siteAccessDenied()
 *
 * 반환값:
 *   - `false`               : 접근 불가 (403 처리 필요)
 *   - `{}`                  : 무제한 (SUPER_ADMIN 등)
 *   - `{ siteId: string }`  : 단건 접근 확인된 경우
 *   - `{ siteId: { in: string[] } }` : 목록 범위 제한
 */
export async function buildSiteScopeWhere(
  session: JwtPayload,
  requestedSiteId?: string
): Promise<{ siteId?: string | { in: string[] } } | false> {
  const role = session.role ?? ''

  // 플랫폼 관리자 (SUPER_ADMIN / HQ_ADMIN / ADMIN / VIEWER) — 무제한
  if (['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER'].includes(role)) {
    return requestedSiteId ? { siteId: requestedSiteId } : {}
  }

  if (requestedSiteId) {
    const ok = await canAccessSite(session, requestedSiteId)
    if (!ok) return false
    return { siteId: requestedSiteId }
  }

  // 목록형 — accessible site ids 기반 in 조건
  const ids = await getAccessibleSiteIds(session)
  if (ids === null) return {} // unrestricted (위에서 이미 처리되지만 방어 코드)
  if (ids.length === 0) return false
  return { siteId: { in: ids } }
}

/**
 * AttendanceLog 목록/단건 쿼리에 사용할 Prisma where 조건 빌더
 *
 * TEAM_LEADER / FOREMAN는 site 기준이 아닌 worker 기준으로 필터링한다.
 *
 * - SUPER_ADMIN/HQ_ADMIN/ADMIN/VIEWER → {} (무제한)
 * - TEAM_LEADER → { worker: { teamName: session.teamName } }
 * - FOREMAN     → { worker: { foremanName: session.name } }
 * - 그 외       → site scope 기반 (buildSiteScopeWhere와 동일)
 *
 * 반환값:
 *   - `false`  : 접근 불가
 *   - `object` : Prisma AttendanceLog where 조건
 */
export async function buildAttendanceScopeWhere(
  session: JwtPayload
): Promise<Record<string, unknown> | false> {
  const role = session.role ?? ''

  if (['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER'].includes(role)) return {}

  // 팀장 — 자기 팀 소속 근로자의 출근 기록만
  if (role === 'TEAM_LEADER' && session.teamName) {
    return { worker: { teamName: session.teamName } }
  }

  // 반장 — 자기 이름을 foremanName으로 가진 근로자의 출근 기록만
  if (role === 'FOREMAN' && session.name) {
    return { worker: { foremanName: session.name } }
  }

  // site 기반 역할 (COMPANY_ADMIN, SITE_ADMIN, EXTERNAL_SITE_ADMIN)
  const ids = await getAccessibleSiteIds(session)
  if (ids === null) return {}
  if (ids.length === 0) return false
  return { siteId: { in: ids } }
}

/**
 * Worker 목록/검색 쿼리에 사용할 Prisma where 조건 빌더
 *
 * Worker에는 직접 siteId 필드가 없으므로 relation 기준으로 scope를 적용한다.
 *
 * - SUPER_ADMIN/ADMIN/VIEWER → {}  (무제한)
 * - COMPANY_ADMIN            → companyAssignments.some.companyId 기준
 * - SITE_ADMIN / EXTERNAL_SITE_ADMIN → siteAssignments.some.siteId 기준
 *
 * 반환값:
 *   - `false`  : 접근 불가
 *   - `object` : Prisma Worker where 조건
 */
export async function buildWorkerScopeWhere(
  session: JwtPayload
): Promise<Record<string, unknown> | false> {
  const role = session.role ?? ''

  if (['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER'].includes(role)) return {}

  if (role === 'COMPANY_ADMIN' && session.companyId) {
    return {
      companyAssignments: {
        some: { companyId: session.companyId, validTo: null },
      },
    }
  }

  // 팀장 — 자기 teamName과 일치하는 근로자만
  if (role === 'TEAM_LEADER' && session.teamName) {
    return { teamName: session.teamName }
  }

  // 반장 — 자기 이름을 foremanName으로 가진 근로자만
  if (role === 'FOREMAN' && session.name) {
    return { foremanName: session.name }
  }

  const ids = await getAccessibleSiteIds(session)
  if (ids === null) return {}
  if (ids.length === 0) return false
  return {
    siteAssignments: {
      some: { siteId: { in: ids }, isActive: true },
    },
  }
}

// ─── 접근 거부 감사 로그 헬퍼 ────────────────────────────────────────────────

/**
 * 현장 접근 거부 시 감사로그를 남기고 403 응답을 반환한다.
 *
 * 사용 패턴:
 *   if (!await canAccessSite(session, siteId)) return siteAccessDeniedWithLog(session, siteId)
 */
export async function siteAccessDeniedWithLog(
  session: JwtPayload,
  siteId: string
): Promise<NextResponse> {
  writeAuditLog({
    actorUserId: session.sub,
    actorType:   'ADMIN',
    actorRole:   session.role,
    actionType:  'DENIED_SITE_ACCESS',
    targetType:  'Site',
    targetId:    siteId,
    summary:     `현장 접근 거부: siteId=${siteId} (role: ${session.role ?? 'unknown'})`,
    metadataJson: { role: session.role, siteId },
  }).catch(() => {})

  return NextResponse.json(
    { success: false, message: '이 현장에 대한 접근 권한이 없습니다.' },
    { status: 403 }
  )
}

/**
 * 회사 접근 거부 시 감사로그를 남기고 403 응답을 반환한다.
 */
export async function companyAccessDeniedWithLog(
  session: JwtPayload,
  companyId: string
): Promise<NextResponse> {
  writeAuditLog({
    actorUserId: session.sub,
    actorType:   'ADMIN',
    actorRole:   session.role,
    actionType:  'DENIED_COMPANY_ACCESS',
    targetType:  'Company',
    targetId:    companyId,
    summary:     `업체 접근 거부: companyId=${companyId} (role: ${session.role ?? 'unknown'})`,
    metadataJson: { role: session.role, companyId },
  }).catch(() => {})

  return NextResponse.json(
    { success: false, message: '이 업체에 대한 접근 권한이 없습니다.' },
    { status: 403 }
  )
}
