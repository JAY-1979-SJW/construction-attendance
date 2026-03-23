/**
 * GET /api/admin/dashboard/today-tasks
 * 관리자 오늘 처리할 일 패널
 *
 * 6개 카테고리로 미처리 건수를 집계해 반환:
 *  1. 출퇴근 예외/누락 — EXCEPTION + MISSING_CHECKOUT (전일 이전)
 *  2. 기기 승인 대기 — DeviceChangeRequest PENDING
 *  3. 현장참여 신청 대기 — SiteJoinRequest PENDING
 *  4. 업체관리자 승인 대기 — CompanyAdminRequest PENDING
 *  5. 종료 검토 진행 중 — WorkerTerminationReview IN_PROGRESS
 *  6. 공수 미확인 항목 — AttendanceLog MISSING_CHECKOUT 당일 포함 전체
 */
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const todayStr = toKSTDateString()
    const today    = kstDateStringToDate(todayStr)

    const [
      exceptionCount,
      missingCheckoutCount,
      deviceRequestCount,
      siteJoinCount,
      companyAdminCount,
      terminationReviewCount,
    ] = await Promise.all([
      // 1-a. 출퇴근 예외 (EXCEPTION status) — 미처리 전체
      prisma.attendanceLog.count({ where: { status: 'EXCEPTION' } }),

      // 1-b. 퇴근 누락 — 전일 이전 (당일은 아직 근무 중일 수 있음)
      prisma.attendanceLog.count({
        where: { status: 'MISSING_CHECKOUT', workDate: { lt: today } },
      }),

      // 2. 기기 승인 대기
      prisma.deviceChangeRequest.count({ where: { status: 'PENDING' } }),

      // 3. 현장참여 신청 대기
      prisma.siteJoinRequest.count({ where: { status: 'PENDING' } }),

      // 4. 업체관리자 승인 대기
      prisma.companyAdminRequest.count({ where: { status: 'PENDING' } }),

      // 5. 종료 검토 진행 중
      prisma.workerTerminationReview.count({
        where: { status: { in: ['DRAFT', 'IN_PROGRESS'] } },
      }),
    ])

    // 카테고리별 태스크 구성
    const tasks: TaskItem[] = [
      {
        key:     'attendance_exception',
        label:   '출퇴근 예외 처리',
        count:   exceptionCount,
        href:    '/admin/exceptions',
        urgency: exceptionCount > 0 ? 'HIGH' : 'OK',
        description: '예외(GPS 실패 등) 출퇴근 건 — 관리자 승인 대기',
      },
      {
        key:     'missing_checkout',
        label:   '퇴근 누락 처리',
        count:   missingCheckoutCount,
        href:    '/admin/attendance?filter=MISSING_CHECKOUT',
        urgency: missingCheckoutCount > 5 ? 'HIGH' : missingCheckoutCount > 0 ? 'MED' : 'OK',
        description: '전일 이전 퇴근 미기록 건 — 시간 보정 필요',
      },
      {
        key:     'device_request',
        label:   '기기 승인',
        count:   deviceRequestCount,
        href:    '/admin/device-requests',
        urgency: deviceRequestCount > 0 ? 'MED' : 'OK',
        description: '근로자 기기 변경/등록 승인 대기',
      },
      {
        key:     'site_join',
        label:   '현장참여 신청',
        count:   siteJoinCount,
        href:    '/admin/site-join-requests',
        urgency: siteJoinCount > 0 ? 'MED' : 'OK',
        description: '근로자 현장 배치 신청 승인 대기',
      },
      {
        key:     'company_admin',
        label:   '업체관리자 승인',
        count:   companyAdminCount,
        href:    '/admin/company-admin-requests',
        urgency: companyAdminCount > 0 ? 'MED' : 'OK',
        description: '업체 관리자 계정 승인 대기',
      },
      {
        key:     'termination_review',
        label:   '종료 검토 진행 중',
        count:   terminationReviewCount,
        href:    '/admin/workers?filter=termination_in_progress',
        urgency: terminationReviewCount > 0 ? 'HIGH' : 'OK',
        description: '종료 처리 플로우가 중단된 근로자',
      },
    ]

    const totalPending = tasks.reduce((s, t) => s + t.count, 0)
    const highCount    = tasks.filter(t => t.urgency === 'HIGH').length

    return NextResponse.json({
      success:      true,
      generatedAt:  new Date().toISOString(),
      todayStr,
      summary: { totalPending, highCount },
      tasks,
    })
  } catch (err) {
    console.error('[GET /dashboard/today-tasks]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

interface TaskItem {
  key:         string
  label:       string
  count:       number
  href:        string
  urgency:     'OK' | 'MED' | 'HIGH'
  description: string
}
