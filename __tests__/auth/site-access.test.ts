/**
 * 단위 테스트: 현장 접근 권한 함수
 *
 * 검증 항목 (지시문 §15.1):
 *   1. canAccessSite — SUPER_ADMIN/ADMIN/VIEWER 전체 허용
 *   2. canAccessSite — COMPANY_ADMIN 자기 회사 현장만
 *   3. canAccessSite — SITE_ADMIN 배정 현장만
 *   4. canAccessSite — EXTERNAL_SITE_ADMIN 접근 그룹 포함 현장만
 *   5. canAccessSite — 비활성 assignment/group 차단
 *   6. canAccessSite — 접근 불가 site → false
 *   7. getAccessibleSiteIds — 역할별 반환값
 *   8. getAccessibleCompanyIds — EXTERNAL_SITE_ADMIN 빈 배열 반환
 *   9. canAccessCompany — EXTERNAL_SITE_ADMIN 항상 false
 *  10. buildSiteScopeWhere — 무제한 역할 → {}
 *  11. buildSiteScopeWhere — 제한 역할 + requestedSiteId → canAccessSite 확인
 *  12. buildSiteScopeWhere — 제한 역할 + no requestedSiteId → { siteId: { in: [...] } }
 *  13. buildSiteScopeWhere — 접근 불가 site → false
 *  14. buildSiteScopeWhere — accessible ids 빈 배열 → false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { JwtPayload } from '@/types/auth'

// ─── Prisma 모킹 (vi.mock은 자동 호이스팅됨) ──────────────────────────────────

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    siteCompanyAssignment: {
      count:    vi.fn(),
      findMany: vi.fn(),
    },
    siteAdminAssignment: {
      count:    vi.fn(),
      findMany: vi.fn(),
    },
    siteAccessGroupSite: {
      count:    vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/audit/write-audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// 모킹 이후 모듈 임포트
import { prisma } from '@/lib/db/prisma'
import {
  canAccessSite,
  getAccessibleSiteIds,
  getAccessibleCompanyIds,
  canAccessCompany,
  buildSiteScopeWhere,
} from '@/lib/auth/site-access'

// ─── 타입 단언 헬퍼 ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// ─── 세션 헬퍼 ───────────────────────────────────────────────────────────────

function makeSession(role: string, extras?: Partial<JwtPayload>): JwtPayload {
  return { sub: 'user-1', type: 'admin', role, iat: 0, exp: 9999999999, ...extras }
}

// ─── 1–6. canAccessSite ───────────────────────────────────────────────────────

describe('canAccessSite', () => {

  beforeEach(() => { vi.clearAllMocks() })

  it('SUPER_ADMIN: 모든 현장 허용 (DB 조회 없음)', async () => {
    expect(await canAccessSite(makeSession('SUPER_ADMIN'), 'site-x')).toBe(true)
    expect(db.siteCompanyAssignment.count).not.toHaveBeenCalled()
  })

  it('ADMIN: 모든 현장 허용', async () => {
    expect(await canAccessSite(makeSession('ADMIN'), 'site-x')).toBe(true)
  })

  it('VIEWER: 모든 현장 허용', async () => {
    expect(await canAccessSite(makeSession('VIEWER'), 'site-x')).toBe(true)
  })

  it('COMPANY_ADMIN: 자기 회사 소속 현장 → true', async () => {
    db.siteCompanyAssignment.count.mockResolvedValue(1)
    expect(await canAccessSite(makeSession('COMPANY_ADMIN', { companyId: 'co-1' }), 'site-a')).toBe(true)
    expect(db.siteCompanyAssignment.count).toHaveBeenCalledWith({
      where: { siteId: 'site-a', companyId: 'co-1' },
    })
  })

  it('COMPANY_ADMIN: 타 회사 현장 → false', async () => {
    db.siteCompanyAssignment.count.mockResolvedValue(0)
    expect(await canAccessSite(makeSession('COMPANY_ADMIN', { companyId: 'co-1' }), 'site-b')).toBe(false)
  })

  it('COMPANY_ADMIN: companyId 없으면 → false (DB 조회 없음)', async () => {
    expect(await canAccessSite(makeSession('COMPANY_ADMIN'), 'site-a')).toBe(false)
    expect(db.siteCompanyAssignment.count).not.toHaveBeenCalled()
  })

  it('SITE_ADMIN: 배정된 활성 현장 → true', async () => {
    db.siteAdminAssignment.count.mockResolvedValue(1)
    expect(await canAccessSite(makeSession('SITE_ADMIN'), 'site-assigned')).toBe(true)
    expect(db.siteAdminAssignment.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', siteId: 'site-assigned', isActive: true },
    })
  })

  it('SITE_ADMIN: 미배정 현장 → false', async () => {
    db.siteAdminAssignment.count.mockResolvedValue(0)
    expect(await canAccessSite(makeSession('SITE_ADMIN'), 'site-other')).toBe(false)
  })

  it('SITE_ADMIN: 비활성 배정은 isActive:true 필터로 제외 → false', async () => {
    db.siteAdminAssignment.count.mockResolvedValue(0)
    expect(await canAccessSite(makeSession('SITE_ADMIN'), 'site-inactive')).toBe(false)
  })

  it('EXTERNAL_SITE_ADMIN: 접근 그룹에 포함된 현장 → true', async () => {
    db.siteAccessGroupSite.count.mockResolvedValue(2)
    expect(await canAccessSite(makeSession('EXTERNAL_SITE_ADMIN'), 'site-g1')).toBe(true)
    expect(db.siteAccessGroupSite.count).toHaveBeenCalledWith({
      where: {
        siteId: 'site-g1',
        accessGroup: {
          isActive: true,
          users: { some: { userId: 'user-1', isActive: true } },
        },
      },
    })
  })

  it('EXTERNAL_SITE_ADMIN: 그룹에 없는 현장 → false', async () => {
    db.siteAccessGroupSite.count.mockResolvedValue(0)
    expect(await canAccessSite(makeSession('EXTERNAL_SITE_ADMIN'), 'site-no-group')).toBe(false)
  })

  it('EXTERNAL_SITE_ADMIN: 비활성 그룹 → false (isActive 조건으로 걸러짐)', async () => {
    db.siteAccessGroupSite.count.mockResolvedValue(0)
    expect(await canAccessSite(makeSession('EXTERNAL_SITE_ADMIN'), 'site-inactive-group')).toBe(false)
  })

  it('알 수 없는 역할 → false', async () => {
    expect(await canAccessSite(makeSession('UNKNOWN_ROLE'), 'site-x')).toBe(false)
  })
})

// ─── 7. getAccessibleSiteIds ──────────────────────────────────────────────────

describe('getAccessibleSiteIds', () => {

  beforeEach(() => { vi.clearAllMocks() })

  it('SUPER_ADMIN → null (무제한)', async () => {
    expect(await getAccessibleSiteIds(makeSession('SUPER_ADMIN'))).toBeNull()
  })

  it('ADMIN → null', async () => {
    expect(await getAccessibleSiteIds(makeSession('ADMIN'))).toBeNull()
  })

  it('VIEWER → null', async () => {
    expect(await getAccessibleSiteIds(makeSession('VIEWER'))).toBeNull()
  })

  it('COMPANY_ADMIN → 자기 회사 현장 ids (중복 제거)', async () => {
    db.siteCompanyAssignment.findMany.mockResolvedValue([
      { siteId: 'site-a' }, { siteId: 'site-b' }, { siteId: 'site-a' },
    ])
    expect(await getAccessibleSiteIds(makeSession('COMPANY_ADMIN', { companyId: 'co-1' }))).toEqual(['site-a', 'site-b'])
  })

  it('SITE_ADMIN → 배정된 현장 ids', async () => {
    db.siteAdminAssignment.findMany.mockResolvedValue([{ siteId: 'site-x' }, { siteId: 'site-y' }])
    expect(await getAccessibleSiteIds(makeSession('SITE_ADMIN'))).toEqual(['site-x', 'site-y'])
  })

  it('EXTERNAL_SITE_ADMIN → 접근 그룹 내 현장 ids (중복 제거)', async () => {
    db.siteAccessGroupSite.findMany.mockResolvedValue([
      { siteId: 'site-1' }, { siteId: 'site-2' }, { siteId: 'site-1' }, { siteId: 'site-3' },
    ])
    expect(await getAccessibleSiteIds(makeSession('EXTERNAL_SITE_ADMIN'))).toEqual(['site-1', 'site-2', 'site-3'])
  })

  it('EXTERNAL_SITE_ADMIN: 활성 그룹만 포함 (비활성 그룹은 쿼리 조건으로 제외)', async () => {
    db.siteAccessGroupSite.findMany.mockResolvedValue([])
    expect(await getAccessibleSiteIds(makeSession('EXTERNAL_SITE_ADMIN'))).toEqual([])
    expect(db.siteAccessGroupSite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accessGroup: expect.objectContaining({ isActive: true }),
        }),
      })
    )
  })

  it('알 수 없는 역할 → []', async () => {
    expect(await getAccessibleSiteIds(makeSession('UNKNOWN'))).toEqual([])
  })
})

// ─── 8. getAccessibleCompanyIds ───────────────────────────────────────────────

describe('getAccessibleCompanyIds', () => {

  beforeEach(() => { vi.clearAllMocks() })

  it('SUPER_ADMIN → null (무제한)', async () => {
    expect(await getAccessibleCompanyIds(makeSession('SUPER_ADMIN'))).toBeNull()
  })

  it('COMPANY_ADMIN → [자기 companyId]', async () => {
    expect(await getAccessibleCompanyIds(makeSession('COMPANY_ADMIN', { companyId: 'co-1' }))).toEqual(['co-1'])
  })

  it('SITE_ADMIN → 배정 현장의 회사 ids (중복 제거)', async () => {
    db.siteAdminAssignment.findMany.mockResolvedValue([
      { companyId: 'co-1' }, { companyId: 'co-2' }, { companyId: 'co-1' },
    ])
    expect(await getAccessibleCompanyIds(makeSession('SITE_ADMIN'))).toEqual(['co-1', 'co-2'])
  })

  it('EXTERNAL_SITE_ADMIN → [] (회사 데이터 완전 차단)', async () => {
    expect(await getAccessibleCompanyIds(makeSession('EXTERNAL_SITE_ADMIN'))).toEqual([])
  })
})

// ─── 9. canAccessCompany ──────────────────────────────────────────────────────

describe('canAccessCompany', () => {

  beforeEach(() => { vi.clearAllMocks() })

  it('SUPER_ADMIN → true', async () => {
    expect(await canAccessCompany(makeSession('SUPER_ADMIN'), 'co-any')).toBe(true)
  })

  it('COMPANY_ADMIN → 자기 회사만 true, 타 회사 false', async () => {
    expect(await canAccessCompany(makeSession('COMPANY_ADMIN', { companyId: 'co-1' }), 'co-1')).toBe(true)
    expect(await canAccessCompany(makeSession('COMPANY_ADMIN', { companyId: 'co-1' }), 'co-2')).toBe(false)
  })

  it('SITE_ADMIN → 배정된 company 허용, 미배정 false', async () => {
    db.siteAdminAssignment.count.mockResolvedValueOnce(1)
    expect(await canAccessCompany(makeSession('SITE_ADMIN'), 'co-1')).toBe(true)
    db.siteAdminAssignment.count.mockResolvedValueOnce(0)
    expect(await canAccessCompany(makeSession('SITE_ADMIN'), 'co-2')).toBe(false)
  })

  it('EXTERNAL_SITE_ADMIN → 항상 false, DB 조회 없음', async () => {
    expect(await canAccessCompany(makeSession('EXTERNAL_SITE_ADMIN'), 'co-any')).toBe(false)
    expect(db.siteCompanyAssignment.count).not.toHaveBeenCalled()
    expect(db.siteAdminAssignment.count).not.toHaveBeenCalled()
  })
})

// ─── 10–14. buildSiteScopeWhere ───────────────────────────────────────────────

describe('buildSiteScopeWhere', () => {

  beforeEach(() => { vi.clearAllMocks() })

  it('SUPER_ADMIN + no requestedSiteId → {}', async () => {
    expect(await buildSiteScopeWhere(makeSession('SUPER_ADMIN'))).toEqual({})
  })

  it('ADMIN + requestedSiteId → { siteId: requestedId }', async () => {
    expect(await buildSiteScopeWhere(makeSession('ADMIN'), 'site-req')).toEqual({ siteId: 'site-req' })
  })

  it('SITE_ADMIN + requestedSiteId 접근 가능 → { siteId }', async () => {
    db.siteAdminAssignment.count.mockResolvedValue(1)
    expect(await buildSiteScopeWhere(makeSession('SITE_ADMIN'), 'site-ok')).toEqual({ siteId: 'site-ok' })
  })

  it('SITE_ADMIN + requestedSiteId 접근 불가 → false', async () => {
    db.siteAdminAssignment.count.mockResolvedValue(0)
    expect(await buildSiteScopeWhere(makeSession('SITE_ADMIN'), 'site-denied')).toBe(false)
  })

  it('SITE_ADMIN + no requestedSiteId → { siteId: { in: [...] } }', async () => {
    db.siteAdminAssignment.findMany.mockResolvedValue([{ siteId: 'site-a' }, { siteId: 'site-b' }])
    expect(await buildSiteScopeWhere(makeSession('SITE_ADMIN'))).toEqual({ siteId: { in: ['site-a', 'site-b'] } })
  })

  it('EXTERNAL_SITE_ADMIN + no requestedSiteId, 그룹 있음 → { siteId: { in: [...] } }', async () => {
    db.siteAccessGroupSite.findMany.mockResolvedValue([{ siteId: 'site-1' }, { siteId: 'site-2' }])
    expect(await buildSiteScopeWhere(makeSession('EXTERNAL_SITE_ADMIN'))).toEqual({ siteId: { in: ['site-1', 'site-2'] } })
  })

  it('accessible ids 빈 배열 → false (접근 가능한 현장 없음)', async () => {
    db.siteAdminAssignment.findMany.mockResolvedValue([])
    expect(await buildSiteScopeWhere(makeSession('SITE_ADMIN'))).toBe(false)
  })

  it('COMPANY_ADMIN + no requestedSiteId → { siteId: { in: [...] } }', async () => {
    db.siteCompanyAssignment.findMany.mockResolvedValue([
      { siteId: 'site-a' }, { siteId: 'site-b' }, { siteId: 'site-c' },
    ])
    expect(await buildSiteScopeWhere(makeSession('COMPANY_ADMIN', { companyId: 'co-1' }))).toEqual({
      siteId: { in: ['site-a', 'site-b', 'site-c'] },
    })
  })
})
