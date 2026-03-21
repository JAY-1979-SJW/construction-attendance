/**
 * presence-scheduler.ts
 * 출근 성공 직후 호출 → AM/PM PresenceCheck 예약 레코드 2건 자동 생성
 */

import { prisma } from '@/lib/db/prisma'
import {
  toSeoulDateKey,
  validateWindow,
  randomMinuteBetween,
  buildSeoulScheduledAt,
} from '@/lib/attendance/presence-time'

export async function schedulePresenceChecksForAttendance(
  attendanceLogId: string,
): Promise<void> {
  // ── Step 1. AttendanceLog 조회 ──────────────────────────────
  const log = await prisma.attendanceLog.findUnique({
    where: { id: attendanceLogId },
    select: { id: true, workerId: true, siteId: true, status: true, checkInAt: true },
  })

  if (!log) {
    console.warn('[presence] skipped: attendance not found', { attendanceLogId })
    return
  }
  if (log.status !== 'WORKING') {
    console.warn('[presence] skipped: attendance not working', {
      attendanceLogId,
      status: log.status,
    })
    return
  }
  if (!log.checkInAt) {
    console.warn('[presence] skipped: checkInAt missing', { attendanceLogId })
    return
  }

  // ── Step 2. 관리자 설정 조회 ────────────────────────────────
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })

  // ── Step 2b. 중복 생성 방지 — 이미 열린 PENDING 있으면 스킵 ──
  const now = new Date()
  const existingPending = await prisma.presenceCheck.findFirst({
    where: {
      workerId:  log.workerId,
      status:    'PENDING',
      expiresAt: { gt: now },
    },
  })
  if (existingPending) {
    console.info('[presence] skipped: already has open PENDING', {
      attendanceLogId,
      existingId: existingPending.id,
    })
    return
  }

  if (!settings?.presenceCheckEnabled) {
    console.info('[presence] skipped: feature disabled', { attendanceLogId })
    return
  }

  // ── Step 3. 시간 범위 검증 ──────────────────────────────────
  const amWindow = validateWindow(settings.presenceCheckAmStart, settings.presenceCheckAmEnd)
  const pmWindow = validateWindow(settings.presenceCheckPmStart, settings.presenceCheckPmEnd)

  if (!amWindow.ok || !pmWindow.ok) {
    console.error('[presence] skipped: invalid window', {
      attendanceLogId,
      am: amWindow,
      pm: pmWindow,
    })
    return
  }

  // ── Step 4. 근무일 계산 (KST) ──────────────────────────────
  const checkDate = toSeoulDateKey(log.checkInAt)

  // ── Step 5. 랜덤 시각 생성 ─────────────────────────────────
  const amMinute      = randomMinuteBetween(amWindow.startMinutes!, amWindow.endMinutes!)
  const pmMinute      = randomMinuteBetween(pmWindow.startMinutes!, pmWindow.endMinutes!)
  const amScheduledAt = buildSeoulScheduledAt(checkDate, amMinute)
  const pmScheduledAt = buildSeoulScheduledAt(checkDate, pmMinute)
  const expiresAt     = (scheduledAt: Date) =>
    new Date(scheduledAt.getTime() + settings.presenceCheckResponseLimitMinutes * 60 * 1000)

  // ── Step 6. upsert (중복 방지) ─────────────────────────────
  await prisma.$transaction([
    prisma.presenceCheck.upsert({
      where: {
        attendanceLogId_checkDate_timeBucket: {
          attendanceLogId: log.id,
          checkDate,
          timeBucket: 'AM',
        },
      },
      update: {},
      create: {
        workerId:            log.workerId,
        attendanceLogId:     log.id,
        siteId:              log.siteId,
        checkDate,
        timeBucket:          'AM',
        scheduledAt:         amScheduledAt,
        expiresAt:           expiresAt(amScheduledAt),
        appliedRadiusMeters: settings.presenceCheckRadiusMeters,
      },
    }),
    prisma.presenceCheck.upsert({
      where: {
        attendanceLogId_checkDate_timeBucket: {
          attendanceLogId: log.id,
          checkDate,
          timeBucket: 'PM',
        },
      },
      update: {},
      create: {
        workerId:            log.workerId,
        attendanceLogId:     log.id,
        siteId:              log.siteId,
        checkDate,
        timeBucket:          'PM',
        scheduledAt:         pmScheduledAt,
        expiresAt:           expiresAt(pmScheduledAt),
        appliedRadiusMeters: settings.presenceCheckRadiusMeters,
      },
    }),
  ])

  // ── Step 7. 성공 로그 ──────────────────────────────────────
  console.info('[presence] scheduled', {
    attendanceLogId: log.id,
    workerId:        log.workerId,
    siteId:          log.siteId,
    checkDate,
    amScheduledAt:   amScheduledAt.toISOString(),
    pmScheduledAt:   pmScheduledAt.toISOString(),
  })
}
