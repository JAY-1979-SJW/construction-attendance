import { NextRequest } from 'next/server'
import { runNotifyExpiringDocs } from '@/lib/jobs/notifyExpiringDocs'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

/**
 * POST /api/cron/notify-expiring-docs
 *
 * 만료 30일 이내 서류에 대해 근로자 알림 생성.
 * crontab 예시 (매일 오전 9시):
 *   0 9 * * * curl -s -X POST http://localhost:3000/api/cron/notify-expiring-docs
 *     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/notify-expiring-docs.log 2>&1
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('Authorization')

  if (!secret) {
    console.error('[cron/notify-expiring-docs] CRON_SECRET 환경변수 미설정')
    return unauthorized('크론 인증이 설정되지 않았습니다.')
  }
  if (auth !== `Bearer ${secret}`) return unauthorized()

  const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true'

  try {
    const result = await runNotifyExpiringDocs(dryRun)
    return ok({ ...result, dryRun })
  } catch (err) {
    console.error('[cron/notify-expiring-docs] fatal error', err)
    return internalError()
  }
}
