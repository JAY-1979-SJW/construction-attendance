import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { confirmWorkDay } from '@/lib/labor/work-confirmations'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { Decimal } from '@prisma/client/runtime/library'

// POST /api/admin/work-confirmations/bulk
// body: { ids: string[], action: 'confirm' | 'exclude' }
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const { ids, action } = body as { ids?: string[]; action?: string }

    if (!ids || !Array.isArray(ids) || ids.length === 0) return badRequest('IDS_REQUIRED')
    if (action !== 'confirm' && action !== 'exclude') return badRequest('INVALID_ACTION')

    const succeeded: string[] = []
    const failed: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const mc = await prisma.monthlyWorkConfirmation.findUnique({ where: { id } })
        if (!mc) { failed.push({ id, reason: 'NOT_FOUND' }); continue }
        if (mc.confirmationStatus !== 'DRAFT') { failed.push({ id, reason: 'NOT_DRAFT' }); continue }

        if (action === 'confirm') {
          await confirmWorkDay({ confirmationId: mc.id, confirmedBy: session.sub })
          await writeAuditLog({
            actorUserId: session.sub,
            actorType: 'ADMIN',
            actorRole: session.role,
            actionType: 'WORK_CONFIRMATION_UPDATE',
            targetType: 'MonthlyWorkConfirmation',
            targetId: mc.id,
            summary: `근무확정 bulk confirm: ${mc.id}`,
            metadataJson: { action: 'bulk_confirm', bulkCount: ids.length },
          })
        } else {
          await prisma.monthlyWorkConfirmation.update({
            where: { id: mc.id },
            data: {
              confirmationStatus:      'EXCLUDED',
              confirmedWorkType:       'INVALID' as never,
              confirmedWorkUnits:      new Decimal(0),
              confirmedBaseAmount:     0,
              confirmedAllowanceAmount: 0,
              confirmedTotalAmount:    0,
              confirmedBy:             session.sub,
              confirmedAt:             new Date(),
            },
          })
          await writeAuditLog({
            actorUserId: session.sub,
            actorType: 'ADMIN',
            actorRole: session.role,
            actionType: 'WORK_CONFIRMATION_UPDATE',
            targetType: 'MonthlyWorkConfirmation',
            targetId: mc.id,
            summary: `근무확정 bulk exclude: ${mc.id}`,
            metadataJson: { action: 'bulk_exclude', bulkCount: ids.length },
          })
        }
        succeeded.push(id)
      } catch (err) {
        console.error('[work-confirmations bulk]', { id, action, err })
        failed.push({ id, reason: err instanceof Error ? err.message : 'UNKNOWN' })
      }
    }

    return ok({ succeeded: succeeded.length, failed: failed.length, failedItems: failed })
  } catch (err) {
    console.error('[work-confirmations bulk]', err)
    return internalError()
  }
}
