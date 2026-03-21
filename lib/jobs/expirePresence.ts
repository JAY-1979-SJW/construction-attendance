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
      // 원자 업데이트: 근로자 응답과의 경합 방지
      // status='PENDING' AND respondedAt IS NULL 조건으로 이미 응답된 건은 건너뜀
      const atomicResult = await prisma.presenceCheck.updateMany({
        where: {
          id:          pc.id,
          status:      'PENDING',
          respondedAt: null,
        },
        data: { status: 'NO_RESPONSE', closedAt: now },
      })

      if (atomicResult.count === 0) {
        // 근로자가 먼저 응답한 경우 — 무시 (정상 케이스)
        console.info('[expire-presence] skip — worker already responded', { id: pc.id })
        continue
      }

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
