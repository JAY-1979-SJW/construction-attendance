/**
 * POST /api/cron/send-presence-push
 *
 * scheduledAt <= now 이고 아직 푸시를 보내지 않은 PENDING 체류확인 건을 찾아
 * 해당 근로자의 FCM 토큰으로 푸시 알림을 발송한다.
 *
 * crontab 예시 (매 5분):
 *   [star]/5 [star] [star] [star] [star] curl -s -X POST http://localhost:3000/api/cron/send-presence-push
 *     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/send-presence-push.log 2>&1
 *
 * 처리 보장:
 *   - 푸시 실패 시 pushFailedAt 기록, PENDING 상태는 유지
 *   - 중복 발송 방지: pushSentAt IS NULL 조건
 *   - dryRun=true 시 DB 변경 없이 대상 목록만 반환
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { sendFcmPush } from '@/lib/push/fcm'
import { logPresenceAudit } from '@/lib/attendance/presence-audit'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = request.headers.get('Authorization')

  if (!secret) {
    console.error('[cron/send-presence-push] CRON_SECRET 환경변수 미설정')
    return unauthorized('크론 인증이 설정되지 않았습니다.')
  }
  if (auth !== `Bearer ${secret}`) return unauthorized()

  const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true'

  try {
    const now = new Date()

    // 발송 대상: scheduledAt <= now, 만료 안 됨, PENDING, 푸시 미발송
    const checks = await prisma.presenceCheck.findMany({
      where: {
        status:      'PENDING',
        scheduledAt: { lte: now },
        expiresAt:   { gt: now },
        pushSentAt:  null,
        pushFailedAt: null,  // 실패 기록 있으면 재시도 안 함 (수동 재처리)
      },
      include: {
        worker: {
          select: { id: true, name: true, devices: { where: { isActive: true, fcmToken: { not: null } }, select: { fcmToken: true }, take: 1 } },
        },
        site: { select: { name: true } },
      },
      take: 200,  // 1회 최대 200건
    })

    if (dryRun) {
      return ok({ dryRun: true, targetCount: checks.length, targets: checks.map((c) => ({ id: c.id, workerId: c.workerId, timeBucket: c.timeBucket })) })
    }

    let sent = 0; let failed = 0; let skipped = 0

    for (const check of checks) {
      const fcmToken = check.worker.devices[0]?.fcmToken
      if (!fcmToken) {
        skipped++
        console.info('[presence-push] FCM 토큰 없음 — 스킵', { presenceCheckId: check.id, workerId: check.workerId })
        continue
      }

      const bucket  = check.timeBucket === 'AM' ? '오전' : '오후'
      const result  = await sendFcmPush({
        to: fcmToken,
        notification: {
          title: `체류 확인 요청 — ${check.site.name}`,
          body:  `${bucket} 체류 확인이 도착했습니다. ${check.worker.name}님, 지금 확인해 주세요.`,
        },
        data: {
          type:            'PRESENCE_CHECK',
          presenceCheckId: check.id,
          screen:          'presence-respond',
        },
      })

      if (result.success) {
        await prisma.presenceCheck.update({
          where: { id: check.id },
          data: { pushSentAt: new Date() },
        })
        await logPresenceAudit({
          presenceCheckId: check.id,
          action:    'PUSH_SENT',
          actorType: 'SYSTEM',
          message:   `FCM 푸시 발송 성공 (${bucket})`,
          metadata:  { messageId: result.messageId, fcmTokenSuffix: fcmToken.slice(-8) },
        })
        sent++
      } else {
        await prisma.presenceCheck.update({
          where: { id: check.id },
          data: { pushFailedAt: new Date() },
        })
        await logPresenceAudit({
          presenceCheckId: check.id,
          action:    'PUSH_FAILED',
          actorType: 'SYSTEM',
          message:   `FCM 푸시 발송 실패: ${result.error}`,
          metadata:  { error: result.error, fcmTokenSuffix: fcmToken.slice(-8) },
        })
        failed++
      }
    }

    console.info('[cron/send-presence-push] 완료', { total: checks.length, sent, failed, skipped })
    return ok({ sent, failed, skipped, total: checks.length })
  } catch (err) {
    console.error('[cron/send-presence-push] fatal error', err)
    return internalError()
  }
}
