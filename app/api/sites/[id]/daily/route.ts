/**
 * GET /api/sites/[id]/daily  — 근로자용 당일 현장 정보 (읽기 전용)
 *
 * 반환 데이터:
 *   - notices:        오늘 유효한 공지 (ALL_WORKERS 대상만)
 *   - schedules:      오늘 일정 (ALL_WORKERS 대상만)
 *   - dailySummary:   작업일보 요약 집계 (명수만, 이름 없음)
 *
 * 절대 포함 금지:
 *   - memoInternal (관리자 메모)
 *   - 출근자 실명 목록
 *   - TBM 미참석자 명단
 *   - 안전확인 누락자 명단
 *   - 작업일보 본문 상세 (summaryText 등 텍스트 필드)
 */
import { NextRequest } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, notFound, internalError } from '@/lib/utils/response'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 근로자 인증 필수
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const { id: siteId } = await params

    // 현장 존재 확인
    const site = await prisma.site.findUnique({
      where:  { id: siteId, isActive: true },
      select: { id: true, name: true },
    })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const { searchParams } = req.nextUrl
    const dateParam = searchParams.get('date')
    const dateStr   = dateParam ?? new Date().toISOString().slice(0, 10)
    const date      = new Date(dateStr)

    // ── 1. 오늘 공지 (ALL_WORKERS 노출 대상만) ─────────────────────────
    const notices = await prisma.siteNotice.findMany({
      where: {
        siteId,
        isActive:       true,
        visibilityScope: { in: ['ALL_WORKERS', 'SPECIFIC_TEAM_ONLY'] },
        startDate:      { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      select: {
        id:               true,
        title:            true,
        content:          true,
        noticeType:       true,
        isTodayHighlight: true,
        startDate:        true,
        endDate:          true,
        targetTeamLabel:  true,
      },
      orderBy: [
        { isTodayHighlight: 'desc' },
        { noticeType:       'asc'  }, // EMERGENCY_NOTICE, SAFETY_NOTICE 우선
        { startDate:        'desc' },
      ],
    })

    // ── 2. 오늘 일정 (ALL_WORKERS 노출 대상만) ─────────────────────────
    const schedules = await prisma.siteDailySchedule.findMany({
      where: {
        siteId,
        scheduleDate:    date,
        visibilityScope: { in: ['ALL_WORKERS', 'SPECIFIC_TEAM_ONLY'] },
        status:          { not: 'CANCELED' },
      },
      select: {
        id:             true,
        scheduleType:   true,
        title:          true,
        description:    true,
        plannedStartAt: true,
        plannedEndAt:   true,
        location:       true,
        status:         true,
        targetTeamLabel: true,
      },
      orderBy: [{ plannedStartAt: 'asc' }, { scheduleType: 'asc' }],
    })

    // ── 3. 작업일보 요약 (명수만, 텍스트 본문/메모 제외) ───────────────
    const summary = await prisma.siteWorkLogSummary.findUnique({
      where:  { siteId_workDate: { siteId, workDate: date } },
      select: {
        totalPresentCount:           true,
        directWorkerCount:           true,
        subcontractWorkerCount:      true,
        teamCount:                   true,
        tbmConducted:                true,
        tbmAttendedCount:            true,
        tbmAbsentCount:              true,
        inspectionPlannedCount:      true,
        inspectionDoneCount:         true,
        materialDeliveryPlannedCount: true,
        materialDeliveryDoneCount:   true,
        // safetyIssueCount, issueCount, photoCount 는 필요 시 포함 가능
      },
    })

    return ok({
      siteId,
      siteName: site.name,
      date:     dateStr,
      notices,
      schedules,
      dailySummary: summary ?? null,
    })
  } catch (err) {
    console.error('[sites/[id]/daily GET]', err)
    return internalError()
  }
}
