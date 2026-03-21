import { prisma } from '@/lib/db/prisma'
import { logPresenceAudit } from '@/lib/attendance/presence-audit'

interface ExpireResult {
  found: number
  expired: number
  failed: number
}

export async function runExpirePresence(dryRun = false): Promise<ExpireResult> {
  const now = new Date()

  // Find all PENDING checks that have expired
  const targets = await prisma.presenceCheck.findMany({
    where: {
      status:    'PENDING',
      expiresAt: { lt: now },
    },
    select: { id: true, workerId: true, status: true },
  })

  const result: ExpireResult = { found: targets.length, expired: 0, failed: 0 }

  if (dryRun) {
    console.info('[expire-presence] dryRun — would expire', targets.length, 'checks')
    return result
  }

  for (const pc of targets) {
    try {
      await prisma.presenceCheck.update({
        where: { id: pc.id },
        data:  { status: 'NO_RESPONSE', closedAt: now },
      })
      await logPresenceAudit({
        presenceCheckId:   pc.id,
        action:            'AUTO_EXPIRED',
        actorType:         'SYSTEM',
        fromStatus:        'PENDING',
        toStatus:          'NO_RESPONSE',
        message:           '응답 시간 초과 — 자동 종료',
      })
      result.expired++
    } catch (err) {
      console.error('[expire-presence] failed to expire', { id: pc.id, err })
      result.failed++
    }
  }

  console.info('[expire-presence] done', result)
  return result
}
