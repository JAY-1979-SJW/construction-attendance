/**
 * POST /api/admin/daily-reports/batch-confirm
 * 작업일보 일괄 확정 / 반려
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const schema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  action: z.enum(['CONFIRM', 'REJECT']),
  reason: z.string().optional(),
  adminMemo: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { ids, action, reason, adminMemo } = parsed.data

    if (action === 'REJECT' && !reason?.trim()) {
      return badRequest('반려 시 사유를 입력하세요.')
    }

    let confirmed = 0
    let rejected = 0
    let skipped = 0

    for (const id of ids) {
      const report = await prisma.workerDailyReport.findUnique({
        where: { id },
        select: { id: true, status: true, workerId: true },
      })
      if (!report) { skipped++; continue }

      if (action === 'CONFIRM') {
        if (report.status !== 'WRITTEN') { skipped++; continue }
        await prisma.workerDailyReport.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            confirmedById: session.sub,
            confirmedAt: new Date(),
            adminMemo: adminMemo ?? undefined,
          },
        })
        confirmed++
      } else {
        // 반려: WRITTEN 상태 유지 + adminMemo에 반려 사유 기록
        if (report.status !== 'WRITTEN') { skipped++; continue }
        await prisma.workerDailyReport.update({
          where: { id },
          data: {
            adminMemo: `[반려] ${reason}`,
          },
        })
        rejected++
      }
    }

    await writeAuditLog({
      adminId: session.sub,
      actionType: action === 'CONFIRM' ? 'DAILY_REPORT_BATCH_CONFIRM' : 'DAILY_REPORT_BATCH_REJECT',
      targetType: 'WorkerDailyReport',
      targetId: ids.join(','),
      description: `작업일보 일괄 ${action === 'CONFIRM' ? '확정' : '반려'}: ${confirmed + rejected}건 처리, ${skipped}건 스킵`,
    })

    return ok({
      confirmed,
      rejected,
      skipped,
      total: ids.length,
    }, `${action === 'CONFIRM' ? '확정' : '반려'} ${confirmed + rejected}건 처리되었습니다.`)
  } catch (err) {
    console.error('[daily-reports/batch-confirm]', err)
    return internalError()
  }
}
