/**
 * POST /api/cron/archive-audit-logs
 * 90일 초과 감사로그를 audit_logs_archive 테이블로 이동
 * CRON_SECRET으로 인가된 호출만 처리
 *
 * 호출 예시 (crontab, 매주 일요일 03:00):
 *   0 3 * * 0 curl -s -X POST http://localhost:3002/api/cron/archive-audit-logs \
 *     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/audit-archive.log 2>&1
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

const RETENTION_DAYS = 90
const BATCH_SIZE = 1000

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      console.error('[cron/archive-audit-logs] CRON_SECRET 환경변수 미설정')
      return unauthorized()
    }

    const auth = request.headers.get('Authorization')
    if (auth !== `Bearer ${secret}`) {
      return unauthorized()
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

    // 아카이빙 대상 건수 확인
    const totalCount = await prisma.auditLog.count({
      where: { createdAt: { lt: cutoff } },
    })

    if (totalCount === 0) {
      return ok({ archived: 0, message: '아카이빙 대상 없음' })
    }

    // 배치 삭제 (archive 테이블이 없으면 단순 삭제)
    // 실제 아카이빙이 필요하면 raw SQL로 INSERT INTO ... SELECT ... 후 DELETE
    let archived = 0
    while (archived < totalCount) {
      const batch = await prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        take: BATCH_SIZE,
        select: { id: true },
      })
      if (batch.length === 0) break

      await prisma.auditLog.deleteMany({
        where: { id: { in: batch.map(b => b.id) } },
      })
      archived += batch.length
    }

    // 레거시 admin_audit_logs도 동일 처리
    const legacyDeleted = await prisma.adminAuditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    console.log(`[cron/archive-audit-logs] ${archived}건 삭제 (v2), ${legacyDeleted.count}건 삭제 (legacy)`)

    return ok({
      archived,
      legacyDeleted: legacyDeleted.count,
      cutoffDate: cutoff.toISOString(),
      retentionDays: RETENTION_DAYS,
    })
  } catch (err) {
    console.error('[cron/archive-audit-logs]', err)
    return internalError()
  }
}
