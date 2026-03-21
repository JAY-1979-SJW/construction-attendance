/**
 * GET /api/admin/pilot/summary
 *
 * 파일럿 당일 운영 모니터링 지표 10개를 한 번에 반환.
 *
 * 지표:
 * 1.  totalWorkers       — 총 대상자 (활성 근로자 수)
 * 2.  approvedDevices    — 승인 완료 기기 수 (isActive=true)
 * 3.  pendingDevices     — 승인 대기 기기 요청 수
 * 4.  working            — 오늘 WORKING (출근 후 미퇴근)
 * 5.  completed          — 오늘 COMPLETED (정상 퇴근 완료)
 * 6.  adjusted           — 오늘 ADJUSTED (수동 보정 완료)
 * 7.  moveCount          — 오늘 이동(MOVE) 이벤트 건수
 * 8.  needsReview        — MISSING_CHECKOUT 미해소 건 (전체)
 * 9.  suspectedMissing   — 오늘 WORKING 중 장시간 미퇴근 의심 (checkInAt ≥ 4h 전)
 * 10. manualCorrections  — 오늘 수동 보정 ADJUSTED 건
 */

import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { kstDateStringToDate, toKSTDateString } from '@/lib/utils/date'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const nowKSTStr = toKSTDateString()
    const today = kstDateStringToDate(nowKSTStr)
    const todayStart = today
    const tomorrowStart = new Date(today)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)

    // 장시간 미퇴근 의심 기준: 4시간 이상 전에 출근한 WORKING 근로자
    const suspectedThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000)

    const [
      totalWorkers,
      approvedDevices,
      pendingDevices,
      working,
      completed,
      adjusted,
      moveCount,
      needsReview,
      suspectedMissing,
    ] = await Promise.all([
      // 1. 총 대상자
      prisma.worker.count({ where: { isActive: true } }),
      // 2. 승인 완료 기기
      prisma.workerDevice.count({ where: { isActive: true } }),
      // 3. 승인 대기
      prisma.deviceChangeRequest.count({ where: { status: 'PENDING' } }),
      // 4. WORKING
      prisma.attendanceLog.count({ where: { workDate: todayStart, status: 'WORKING' } }),
      // 5. COMPLETED
      prisma.attendanceLog.count({ where: { workDate: todayStart, status: 'COMPLETED' } }),
      // 6. ADJUSTED (오늘 전체 — manualCorrections와 동일)
      prisma.attendanceLog.count({ where: { workDate: todayStart, status: 'ADJUSTED' } }),
      // 7. 이동 건수 (오늘)
      prisma.attendanceEvent.count({
        where: {
          eventType: 'MOVE',
          occurredAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      // 8. needsReview — MISSING_CHECKOUT 미해소 전체
      prisma.attendanceLog.count({ where: { status: 'MISSING_CHECKOUT' } }),
      // 9. 퇴근 누락 의심 — 오늘 WORKING 중 4시간 이상 전 출근
      prisma.attendanceLog.count({
        where: {
          workDate: todayStart,
          status: 'WORKING',
          checkInAt: { lte: suspectedThreshold },
        },
      }),
    ])

    // 10. 수동 보정 = 오늘 ADJUSTED (= #6과 동일, 명시적으로 분리 표시)
    const manualCorrections = adjusted

    return ok({
      generatedAt: new Date().toISOString(),
      targetDate: nowKSTStr,
      metrics: {
        totalWorkers,
        approvedDevices,
        pendingDevices,
        working,
        completed,
        adjusted,
        moveCount,
        needsReview,
        suspectedMissing,
        manualCorrections,
      },
      labels: {
        totalWorkers: '총 대상자',
        approvedDevices: '승인 완료 기기',
        pendingDevices: '승인 대기',
        working: 'WORKING (출근 중)',
        completed: 'COMPLETED (퇴근 완료)',
        adjusted: 'ADJUSTED (수동 보정)',
        moveCount: '이동 건수',
        needsReview: 'needsReview (MISSING_CHECKOUT)',
        suspectedMissing: '퇴근 누락 의심 (4h+ WORKING)',
        manualCorrections: '수동 보정 건수',
      },
    })
  } catch (err) {
    console.error('[admin/pilot/summary]', err)
    return internalError()
  }
}
