/**
 * 근무확정 월별 자동 처리 배치
 *
 * 실행 순서:
 *   1. 락 체크 (중복 실행 방지 / 멱등성)
 *   2. 월 마감 여부 확인
 *   3. 일별 집계 + DRAFT 생성 (generate)
 *   4. 자동 확정 (auto-confirm: NORMAL + FULL_DAY만)
 *   5. 검토 대기 건수 집계
 *   6. 완료 기록 + 텔레그램 요약 전송
 *
 * finalize는 실행하지 않음 — 반드시 수동 승인 필요
 */

import { prisma } from '@/lib/db/prisma'
import { generateDraftConfirmations, autoConfirmQualified } from '@/lib/labor/work-confirmations'
import { aggregateAttendanceDays } from '@/lib/labor/attendance-days'
import { isMonthLocked } from '@/lib/labor/month-closing'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const JOB_ACTION = 'WORK_CONFIRMATION_MONTHLY_JOB'
// 실행 중 상태로 간주하는 최대 시간 (분) — 이 시간 초과 시 stale 락으로 처리
const LOCK_TIMEOUT_MIN = 60

export interface WorkConfirmMonthlyResult {
  monthKey: string
  generated: number
  autoConfirmed: number
  pendingReview: number
  errors: number
  skipped: boolean
  skipReason?: string
  ranAt: string
}

/** 이전 달 monthKey 반환 (YYYY-MM, KST 기준) */
export function getPreviousMonthKey(): string {
  // KST = UTC+9
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-based (0 = January)
  if (month === 0) {
    return `${year - 1}-12`
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

async function sendTelegramNotification(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.warn('[workConfirmMonthly] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 미설정 — 알림 생략')
    return
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) {
      console.error('[workConfirmMonthly] Telegram 전송 실패:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[workConfirmMonthly] Telegram 전송 오류:', err)
  }
}

/**
 * 중복 실행 방지 락 체크
 * - completed: 이미 완료된 실행 → 멱등 스킵
 * - running (1시간 이내): 실행 중 → 스킵
 * - running (1시간 초과): stale 락 → 재실행 허용
 */
async function checkLock(monthKey: string): Promise<{ locked: boolean; reason?: string }> {
  const recent = await prisma.auditLog.findFirst({
    where: { actionType: JOB_ACTION, targetId: monthKey },
    orderBy: { createdAt: 'desc' },
  })

  if (!recent) return { locked: false }

  const meta = recent.metadataJson as Record<string, unknown> | null
  if (!meta) return { locked: false }

  if (meta.status === 'completed') {
    return { locked: true, reason: `이미 완료됨 (${recent.createdAt.toISOString()})` }
  }

  if (meta.status === 'running') {
    const runningAt = new Date(meta.runningAt as string)
    const diffMin = (Date.now() - runningAt.getTime()) / 60000
    if (diffMin < LOCK_TIMEOUT_MIN) {
      return { locked: true, reason: `실행 중 (${Math.round(diffMin)}분 전 시작)` }
    }
    // stale 락 — 재실행 허용
    console.warn(`[workConfirmMonthly] stale 락 감지 (${Math.round(diffMin)}분 경과) — 재실행 허용`)
  }

  return { locked: false }
}

export async function runWorkConfirmMonthly(monthKey: string): Promise<WorkConfirmMonthlyResult> {
  const ranAt = new Date().toISOString()

  // ── 1. 입력 검증 ──
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`유효하지 않은 monthKey: ${monthKey}`)
  }

  // ── 2. 락 체크 ──
  const lock = await checkLock(monthKey)
  if (lock.locked) {
    console.log(`[workConfirmMonthly] 스킵: ${lock.reason}`)
    return {
      monthKey,
      generated: 0,
      autoConfirmed: 0,
      pendingReview: 0,
      errors: 0,
      skipped: true,
      skipReason: lock.reason,
      ranAt,
    }
  }

  // ── 3. 월 마감 여부 확인 ──
  const locked = await isMonthLocked(monthKey)
  if (locked) {
    return {
      monthKey,
      generated: 0,
      autoConfirmed: 0,
      pendingReview: 0,
      errors: 0,
      skipped: true,
      skipReason: '월 마감 완료됨 — 재오픈 후 실행 필요',
      ranAt,
    }
  }

  // ── 4. 실행 시작 기록 ──
  await writeAuditLog({
    actorType: 'SYSTEM',
    actionType: JOB_ACTION,
    targetType: 'MonthlyWorkConfirmation',
    targetId: monthKey,
    summary: `근무확정 월별 자동처리 시작: ${monthKey}`,
    metadataJson: { monthKey, status: 'running', runningAt: ranAt },
  })

  let generated = 0
  let autoConfirmed = 0
  let pendingReview = 0
  let errors = 0

  try {
    // ── 5. 일별 집계 ──
    const [year, month] = monthKey.split('-').map(Number)
    const endDay = new Date(year, month, 0).getDate()

    for (let d = 1; d <= endDay; d++) {
      const workDate = `${monthKey}-${String(d).padStart(2, '0')}`
      try {
        await aggregateAttendanceDays({ workDate })
      } catch (err) {
        console.error(`[workConfirmMonthly] aggregateAttendanceDays 실패 (${workDate}):`, err)
        errors++
      }
    }

    // ── 6. DRAFT 생성 ──
    const genResult = await generateDraftConfirmations({ monthKey })
    generated = genResult.created
    errors += genResult.errors

    // ── 7. 자동 확정 (NORMAL + FULL_DAY만) ──
    const acResult = await autoConfirmQualified({ monthKey, confirmedBy: 'SYSTEM' })
    autoConfirmed = acResult.autoConfirmed
    errors += acResult.errors

    // ── 8. 검토 대기 건수 집계 (최종 DRAFT 수) ──
    pendingReview = await prisma.monthlyWorkConfirmation.count({
      where: { monthKey, confirmationStatus: 'DRAFT' },
    })
  } catch (err) {
    console.error('[workConfirmMonthly] 실행 중 치명적 오류:', err)
    errors++

    await writeAuditLog({
      actorType: 'SYSTEM',
      actionType: JOB_ACTION,
      targetType: 'MonthlyWorkConfirmation',
      targetId: monthKey,
      summary: `근무확정 월별 자동처리 실패: ${monthKey}`,
      metadataJson: {
        monthKey,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        generated,
        autoConfirmed,
        pendingReview,
        errors,
        ranAt,
      },
    })

    await sendTelegramNotification(
      `❌ <b>근무확정 자동처리 실패</b>\n월: <b>${monthKey}</b>\n오류: ${String(err).slice(0, 300)}`,
    )

    return { monthKey, generated, autoConfirmed, pendingReview, errors, skipped: false, ranAt }
  }

  // ── 9. 완료 기록 ──
  await writeAuditLog({
    actorType: 'SYSTEM',
    actionType: JOB_ACTION,
    targetType: 'MonthlyWorkConfirmation',
    targetId: monthKey,
    summary: `근무확정 월별 자동처리 완료: ${monthKey} — 생성 ${generated}건, 자동확정 ${autoConfirmed}건, 검토대기 ${pendingReview}건`,
    metadataJson: { monthKey, status: 'completed', generated, autoConfirmed, pendingReview, errors, ranAt },
  })

  // ── 10. 텔레그램 요약 전송 ──
  const statusIcon = errors > 0 ? '⚠️' : '✅'
  await sendTelegramNotification(
    `${statusIcon} <b>근무확정 월별 자동처리</b>\n` +
      `월: <b>${monthKey}</b>\n` +
      `━━━━━━━━━━━━━━\n` +
      `📝 생성(DRAFT): ${generated}건\n` +
      `✅ 자동확정: ${autoConfirmed}건\n` +
      `🔍 검토대기: ${pendingReview}건\n` +
      `❌ 오류: ${errors}건\n` +
      `━━━━━━━━━━━━━━\n` +
      `🕐 ${ranAt}`,
  )

  return { monthKey, generated, autoConfirmed, pendingReview, errors, skipped: false, ranAt }
}
