/**
 * GET /api/admin/audit-logs/anomalies
 * 이상행위 탐지 — 감사로그 기반 실시간 조회
 * SUPER_ADMIN 전용
 */
import { NextRequest } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { SUPER_ADMIN_ONLY_ROLES } from '@/lib/policies/security-policy'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY_ROLES)
    if (deny) return deny

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // 1. 로그인 실패 급증 (최근 1시간)
    const loginFailures = await prisma.auditLog.count({
      where: { actionType: 'ADMIN_LOGIN_FAILED', createdAt: { gte: oneHourAgo } },
    })

    // 2. Rate limit 초과 (최근 1시간)
    const rateLimits = await prisma.auditLog.count({
      where: { actionType: 'ADMIN_LOGIN_RATE_LIMITED', createdAt: { gte: oneHourAgo } },
    })

    // 3. 403 거부 행위 (최근 24시간)
    const accessDenied = await prisma.auditLog.count({
      where: {
        actionType: { in: ['ACCESS_DENIED', 'SITE_ACCESS_DENIED'] },
        createdAt: { gte: oneDayAgo },
      },
    })

    // 4. 민감정보 복호화 (최근 24시간)
    const sensitiveAccess = await prisma.auditLog.findMany({
      where: {
        actionType: { in: ['RRN_DECRYPT_VIEW', 'PHONE_DECRYPT_VIEW', 'ADDRESS_DECRYPT_VIEW', 'ACCOUNT_DECRYPT_VIEW', 'DOWNLOAD_ORIGINAL'] },
        createdAt: { gte: oneDayAgo },
      },
      select: { actorUserId: true, actorRole: true, actionType: true, summary: true, ipAddress: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // 5. 동일 계정 다중 IP (최근 24시간)
    const multiIpUsers = await prisma.$queryRaw`
      SELECT "actorUserId", COUNT(DISTINCT "ipAddress") as ip_count
      FROM "audit_logs"
      WHERE "actionType" = 'ADMIN_LOGIN'
        AND "createdAt" > ${oneDayAgo}
        AND "actorUserId" IS NOT NULL
        AND "ipAddress" IS NOT NULL
      GROUP BY "actorUserId"
      HAVING COUNT(DISTINCT "ipAddress") > 3
    ` as Array<{ actorUserId: string; ip_count: bigint }>

    // 6. 대량 수정 작업자 (최근 1시간, 50건 초과)
    const bulkActors = await prisma.$queryRaw`
      SELECT "actorUserId", COUNT(*) as action_count
      FROM "audit_logs"
      WHERE "createdAt" > ${oneHourAgo}
        AND "actorUserId" IS NOT NULL
        AND "actionType" NOT LIKE '%_GET%'
        AND "actionType" NOT IN ('ADMIN_LOGIN', 'ADMIN_LOGIN_FAILED')
      GROUP BY "actorUserId"
      HAVING COUNT(*) > 50
    ` as Array<{ actorUserId: string; action_count: bigint }>

    const anomalies = []

    if (loginFailures > 5) {
      anomalies.push({ type: 'LOGIN_BRUTE_FORCE', severity: 'HIGH', count: loginFailures, period: '1h' })
    }
    if (rateLimits > 0) {
      anomalies.push({ type: 'RATE_LIMIT_EXCEEDED', severity: 'HIGH', count: rateLimits, period: '1h' })
    }
    if (accessDenied > 10) {
      anomalies.push({ type: 'ACCESS_DENIED_SPIKE', severity: 'MEDIUM', count: accessDenied, period: '24h' })
    }
    if (multiIpUsers.length > 0) {
      anomalies.push({
        type: 'MULTI_IP_LOGIN', severity: 'MEDIUM',
        users: multiIpUsers.map(u => ({ userId: u.actorUserId, ipCount: Number(u.ip_count) })),
        period: '24h',
      })
    }
    if (bulkActors.length > 0) {
      anomalies.push({
        type: 'BULK_MODIFICATION', severity: 'MEDIUM',
        users: bulkActors.map(u => ({ userId: u.actorUserId, actionCount: Number(u.action_count) })),
        period: '1h',
      })
    }

    return ok({
      anomalies,
      sensitiveAccess,
      summary: {
        loginFailures1h: loginFailures,
        rateLimits1h: rateLimits,
        accessDenied24h: accessDenied,
        sensitiveAccess24h: sensitiveAccess.length,
        multiIpUsers: multiIpUsers.length,
        bulkActors: bulkActors.length,
      },
    })
  } catch (err) {
    console.error('[admin/audit-logs/anomalies]', err)
    return internalError()
  }
}
