import { prisma } from '@/lib/db/prisma'

interface AuditParams {
  presenceCheckId: string
  action: string
  actorType: 'SYSTEM' | 'WORKER' | 'ADMIN'
  actorId?: string
  actorNameSnapshot?: string
  fromStatus?: string
  toStatus?: string
  message?: string
  metadata?: Record<string, unknown>
}

export async function logPresenceAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.presenceCheckAuditLog.create({
      data: {
        presenceCheckId:   params.presenceCheckId,
        action:            params.action,
        actorType:         params.actorType,
        actorId:           params.actorId ?? null,
        actorNameSnapshot: params.actorNameSnapshot ?? null,
        fromStatus:        params.fromStatus ?? null,
        toStatus:          params.toStatus ?? null,
        message:           params.message ?? null,
        metadataJson:      params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    })
  } catch (err) {
    // audit log failure must NOT block the main flow
    console.error('[presence-audit] log failed', { params, err })
  }
}
