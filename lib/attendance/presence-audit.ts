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

/**
 * PresenceCheck audit log 기록.
 *
 * ⚠️ 호출 책임: presenceCheckId는 반드시 DB에 존재하는 값이어야 한다.
 * 미검증 params.id를 직접 넘기면 FK violation(P2003) 발생.
 *
 * 올바른 사용:
 *   const pc = await prisma.presenceCheck.findUnique(...)
 *   if (pc) await logPresenceAudit({ presenceCheckId: pc.id, ... })
 *
 * 권한 차단 분기처럼 row 존재 여부가 불확실한 경우:
 *   → logPresenceAuditSafe() 사용
 */
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
        metadataJson:      params.metadata as never ?? undefined,
      },
    })
  } catch (err) {
    // audit log failure must NOT block the main flow
    console.error('[presence-audit] log failed', { params, err })
  }
}

/**
 * presenceCheckId 존재 여부를 내부에서 확인한 뒤 audit log 기록.
 * row가 없으면 silently skip — FK violation 방지.
 *
 * 권한 차단 분기 등 선조회 없이 params.id만 있는 상황에서 사용.
 * 주 리소스를 이미 fetch한 경우에는 logPresenceAudit({ presenceCheckId: pc.id }) 직접 사용이 더 효율적.
 */
export async function logPresenceAuditSafe(
  presenceCheckId: string,
  params: Omit<AuditParams, 'presenceCheckId'>,
): Promise<void> {
  try {
    const exists = await prisma.presenceCheck.findUnique({
      where:  { id: presenceCheckId },
      select: { id: true },
    })
    if (!exists) return
    await logPresenceAudit({ presenceCheckId: exists.id, ...params })
  } catch (err) {
    console.error('[presence-audit] safe log failed', { presenceCheckId, err })
  }
}
