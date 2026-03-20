import { NextRequest } from 'next/server'
import { runAutoCheckout } from '@/lib/jobs/autoCheckout'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

/**
 * POST /api/cron/auto-checkout
 *
 * Linux 서버 crontab에서 호출하는 자동퇴근 배치 엔드포인트.
 * CRON_SECRET 환경변수로 인가된 호출만 처리.
 *
 * 호출 예시 (crontab):
 *   0 19 * * * curl -s -X POST http://localhost:3002/api/cron/auto-checkout \
 *     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/auto-checkout.log 2>&1
 *
 * 서버 timezone이 UTC인 경우 KST 04:00 = UTC 19:00
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('Authorization')

  // 키 미설정 시 운영 환경에서 명확히 거부
  if (!secret) {
    console.error('[cron/auto-checkout] CRON_SECRET 환경변수가 설정되지 않았습니다.')
    return unauthorized('크론 인증이 설정되지 않았습니다.')
  }

  if (auth !== `Bearer ${secret}`) {
    return unauthorized()
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true'

  try {
    const startTime = Date.now()
    const result = await runAutoCheckout(dryRun)
    const elapsed = Date.now() - startTime

    console.log(
      `[cron/auto-checkout] 완료 | 대상=${result.totalFound} 처리=${result.processed} 스킵=${result.skipped} 실패=${result.failed} 소요=${elapsed}ms dryRun=${dryRun}`
    )

    if (result.errors.length > 0) {
      console.warn('[cron/auto-checkout] 실패 목록:', result.errors)
    }

    return ok({ ...result, elapsedMs: elapsed })
  } catch (err) {
    console.error('[cron/auto-checkout] 치명적 오류:', err)
    return internalError()
  }
}
