import { NextRequest } from 'next/server'
import { runExpirePresence } from '@/lib/jobs/expirePresence'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

/**
 * POST /api/cron/expire-presence
 *
 * 만료된 PENDING 체류확인을 NO_RESPONSE로 자동 전환.
 * crontab 예시 (매 5분):
 *   */5 * * * * curl -s -X POST http://localhost:3002/api/cron/expire-presence \
 *     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/expire-presence.log 2>&1
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = request.headers.get('Authorization')

  if (!secret) {
    console.error('[cron/expire-presence] CRON_SECRET 환경변수 미설정')
    return unauthorized('크론 인증이 설정되지 않았습니다.')
  }
  if (auth !== `Bearer ${secret}`) return unauthorized()

  const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true'

  try {
    const result = await runExpirePresence(dryRun)
    return ok({ ...result, dryRun })
  } catch (err) {
    console.error('[cron/expire-presence] fatal error', err)
    return internalError()
  }
}
