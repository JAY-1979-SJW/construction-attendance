/**
 * 미퇴근 자동 종료 배치
 *
 * 매일 04:00 KST 기준으로 전일 이전 WORKING 상태 출근 기록을 MISSING_CHECKOUT으로 전환.
 * 외부 크론(crontab) + 독립 실행 스크립트 방식으로 호출.
 *
 * 실행: npx tsx scripts/run-auto-checkout.ts
 * 크론: 0 4 * * * cd /path/to/app && npx dotenv -e .env -- npx tsx scripts/run-auto-checkout.ts >> logs/auto-checkout.log 2>&1
 */

import { prisma } from '@/lib/db/prisma'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export interface AutoCheckoutResult {
  runAt: string
  targetDate: string
  totalFound: number
  processed: number
  failed: number
  skipped: number
  errors: Array<{ id: string; reason: string }>
}

export async function runAutoCheckout(dryRun = false): Promise<AutoCheckoutResult> {
  const runAt = new Date().toISOString()
  const nowKSTStr = toKSTDateString()
  const todayKST = kstDateStringToDate(nowKSTStr)

  const targets = await prisma.attendanceLog.findMany({
    where: {
      status: 'WORKING',
      checkOutAt: null,
      workDate: { lt: todayKST },
    },
    select: {
      id: true,
      workerId: true,
      siteId: true,
      workDate: true,
      checkInAt: true,
    },
  })

  const result: AutoCheckoutResult = {
    runAt,
    targetDate: nowKSTStr,
    totalFound: targets.length,
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  if (targets.length === 0 || dryRun) {
    if (dryRun) result.processed = targets.length
    return result
  }

  for (const log of targets) {
    try {
      // 재처리 방지
      const current = await prisma.attendanceLog.findUnique({
        where: { id: log.id },
        select: { status: true, checkOutAt: true },
      })

      if (!current || current.status !== 'WORKING' || current.checkOutAt !== null) {
        result.skipped++
        continue
      }

      // 마지막 이동 이벤트 조회 → 퇴근 현장 결정
      // 이동형 근무: 마지막 MOVE 현장이 사실상의 마지막 근무 현장
      const lastMove = await prisma.attendanceEvent.findFirst({
        where: {
          attendanceLogId: log.id,
          eventType: 'MOVE',
        },
        orderBy: { occurredAt: 'desc' },
      })

      // 마지막 현장이 출근 현장과 다를 때만 checkOutSiteId 기록
      const checkOutSiteId =
        lastMove?.siteId && lastMove.siteId !== log.siteId ? lastMove.siteId : null

      await prisma.attendanceLog.update({
        where: { id: log.id },
        data: {
          status: 'MISSING_CHECKOUT',
          checkOutSiteId,
          adminNote: `[AUTO] 04:00 자동 퇴근 미기록 처리. 실행시각: ${runAt}`,
        },
      })

      result.processed++
    } catch (err) {
      result.failed++
      result.errors.push({
        id: log.id,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}
