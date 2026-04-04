import { NextRequest } from 'next/server'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { runWorkConfirmMonthly, getPreviousMonthKey } from '@/lib/jobs/workConfirmMonthly'

/**
 * POST /api/cron/work-confirm-monthly?monthKey=YYYY-MM&dryRun=true
 *
 * 월별 근무확정 자동처리 스케줄:
 *   - 매월 1일 실행 → 전월 처리
 *   - generate → auto-confirm (NORMAL + FULL_DAY) → 검토대기 집계
 *   - finalize는 실행하지 않음 (수동 승인 필요)
 *   - 같은 monthKey 재실행 시 멱등성 유지 (락 체크)
 *
 * 인증: x-cron-secret 헤더 또는 Authorization: Bearer $CRON_SECRET
 *
 * 크론 예시 (매월 1일 오전 1시 KST = 16:00 UTC 전날):
 *   0 16 L * * curl -s -X POST https://your-domain/api/cron/work-confirm-monthly \
 *     -H "x-cron-secret: $CRON_SECRET" >> /var/log/work-confirm-monthly.log 2>&1
 */
export async function POST(req: NextRequest) {
  // ── 인증 ──
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/work-confirm-monthly] CRON_SECRET 환경변수 미설정')
    return unauthorized('크론 인증이 설정되지 않았습니다.')
  }

  const cronHeader = req.headers.get('x-cron-secret')
  const authHeader = req.headers.get('Authorization')
  if (cronHeader !== secret && authHeader !== `Bearer ${secret}`) {
    return unauthorized()
  }

  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dryRun') === 'true'

  // monthKey 미지정 시 이전 달 자동 사용
  const monthKeyParam = searchParams.get('monthKey') ?? getPreviousMonthKey()

  if (!/^\d{4}-\d{2}$/.test(monthKeyParam)) {
    return badRequest('INVALID_MONTH_KEY')
  }

  if (dryRun) {
    return ok({
      dryRun: true,
      monthKey: monthKeyParam,
      message: '시뮬레이션 — DB 변경 없음',
    })
  }

  try {
    const result = await runWorkConfirmMonthly(monthKeyParam)
    console.log('[cron/work-confirm-monthly]', JSON.stringify(result))
    return ok(result)
  } catch (err) {
    console.error('[cron/work-confirm-monthly] fatal error:', err)
    return internalError()
  }
}
