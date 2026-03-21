/**
 * 일별 근무 집계 서비스
 * attendance_logs + presence_checks → attendance_days
 */
import { prisma } from '@/lib/db/prisma'
import { toKSTDateString } from '@/lib/utils/date'

export interface AggregateDaysOptions {
  workDate?: string   // 'YYYY-MM-DD' — 미지정 시 오늘
  siteId?: string
  workerId?: string
}

export interface AggregateDaysResult {
  processed: number
  created: number
  updated: number
  errors: number
}

export async function aggregateAttendanceDays(
  opts: AggregateDaysOptions = {},
): Promise<AggregateDaysResult> {
  const workDate = opts.workDate ?? toKSTDateString()
  const result: AggregateDaysResult = { processed: 0, created: 0, updated: 0, errors: 0 }

  // workDate 는 'YYYY-MM-DD' 문자열 → Date 변환
  const dateAsDate = new Date(`${workDate}T00:00:00+09:00`)

  // 해당 날짜의 attendance_logs 조회
  const logs = await prisma.attendanceLog.findMany({
    where: {
      workDate: dateAsDate,
      ...(opts.siteId   ? { siteId: opts.siteId }     : {}),
      ...(opts.workerId ? { workerId: opts.workerId }  : {}),
    },
    include: {
      events:        { orderBy: { occurredAt: 'asc' } },
      presenceChecks: { where: { checkDate: workDate } },
    },
  })

  for (const log of logs) {
    try {
      result.processed++

      // 첫 출근 / 마지막 퇴근
      const checkInEvent  = log.events.find((e) => e.eventType === 'CHECK_IN')
      const checkOutEvent = [...log.events].reverse().find(
        (e) => e.eventType === 'CHECK_OUT' || e.eventType === 'AUTO_CHECK_OUT'
      )
      const firstCheckInAt  = checkInEvent?.occurredAt  ?? log.checkInAt ?? null
      const lastCheckOutAt  = checkOutEvent?.occurredAt ?? log.checkOutAt ?? null

      // 근무 분 계산
      let workedMinutesRaw: number | null = null
      if (firstCheckInAt && lastCheckOutAt) {
        workedMinutesRaw = Math.round(
          (new Date(lastCheckOutAt).getTime() - new Date(firstCheckInAt).getTime()) / 60000
        )
      }

      // 현장 이동 여부
      const moveSiteIds = log.events
        .filter((e) => e.eventType === 'MOVE' && e.siteId)
        .map((e) => e.siteId)
      const hasMoveBetweenSites = new Set([log.siteId, ...moveSiteIds]).size > 1

      // 체류확인 결과 판정
      const pc = log.presenceChecks
      let presenceStatus: 'NORMAL' | 'REVIEW_REQUIRED' | 'OUT_OF_GEOFENCE' | 'NO_RESPONSE' | 'MISSING_CHECKOUT' | 'INVALID' = 'NORMAL'
      let presenceReviewResult: string | null = null

      if (log.status === 'MISSING_CHECKOUT') {
        presenceStatus = 'MISSING_CHECKOUT'
      } else if (pc.some((c) => c.status === 'REVIEW_REQUIRED')) {
        presenceStatus = 'REVIEW_REQUIRED'
        presenceReviewResult = 'PRESENCE_CHECK_REVIEW'
      } else if (pc.some((c) => c.status === 'OUT_OF_GEOFENCE')) {
        presenceStatus = 'OUT_OF_GEOFENCE'
        presenceReviewResult = 'PRESENCE_CHECK_OUT_OF_FENCE'
      } else if (pc.some((c) => c.status === 'NO_RESPONSE' || c.status === 'MISSED')) {
        presenceStatus = 'NO_RESPONSE'
      }

      const sourceSummary = {
        logStatus:      log.status,
        eventCount:     log.events.length,
        presenceChecks: pc.map((c) => ({ id: c.id, status: c.status, timeBucket: c.timeBucket })),
      }

      // upsert
      const existing = await prisma.attendanceDay.findUnique({
        where: { workerId_siteId_workDate: { workerId: log.workerId, siteId: log.siteId, workDate } },
      })

      if (existing?.manualAdjustedYn) {
        // 수동 보정된 건은 자동 집계로 덮어쓰지 않음
        continue
      }

      if (existing) {
        await prisma.attendanceDay.update({
          where: { id: existing.id },
          data: {
            firstCheckInAt,
            lastCheckOutAt,
            workedMinutesRaw,
            presenceStatus: presenceStatus as never,
            presenceReviewResult,
            attendanceSourceSummary: sourceSummary,
            hasMoveBetweenSites,
          },
        })
        result.updated++
      } else {
        await prisma.attendanceDay.create({
          data: {
            workerId: log.workerId,
            siteId:   log.siteId,
            workDate,
            firstCheckInAt,
            lastCheckOutAt,
            workedMinutesRaw,
            presenceStatus: presenceStatus as never,
            presenceReviewResult,
            attendanceSourceSummary: sourceSummary,
            hasMoveBetweenSites,
          },
        })
        result.created++
      }
    } catch (err) {
      console.error('[attendance-days] error processing log', { logId: log.id, err })
      result.errors++
    }
  }

  console.info('[attendance-days] aggregated', { workDate, ...result })
  return result
}
