/**
 * GET /api/admin/dashboard/ops-status
 * 운영 현황 요약: 서류 미완성, 안전서류 미완료, TBM 미작성 현장
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'
import { toKSTDateString } from '@/lib/utils/date'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const today = toKSTDateString()

    // 1. 활성 현장 수
    const activeSites = await prisma.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true, openedAt: true, closedAt: true },
    })

    // 현장 중 필수정보 미완성 (openedAt/closedAt 없음)
    const sitesIncomplete = activeSites.filter(s => !s.openedAt || !s.closedAt)

    // 2. 활성 근로자 수
    const activeWorkerCount = await prisma.worker.count({
      where: { isActive: true, accountStatus: 'APPROVED' },
    })

    // 3. 현장 미배정 근로자
    const assignedWorkerIds = await prisma.workerSiteAssignment.findMany({
      where: { isActive: true },
      select: { workerId: true },
      distinct: ['workerId'],
    })
    const assignedArr = assignedWorkerIds.map(a => a.workerId)
    const assignedSet = new Set(assignedArr)
    const unassignedCount = await prisma.worker.count({
      where: {
        isActive: true,
        accountStatus: 'APPROVED',
        id: { notIn: assignedArr },
      },
    })

    // 4. 안전서류 미완료 근로자 (DRAFT 또는 안전서류 0건인 배정 근로자)
    const safetyDocCounts = await prisma.safetyDocument.groupBy({
      by: ['workerId'],
      where: { status: { in: ['SIGNED', 'APPROVED'] } },
      _count: true,
    })
    const safetyCompleteSet = new Set(safetyDocCounts.map(d => d.workerId))
    const safetyIncompleteCount = assignedArr.filter(id => !safetyCompleteSet.has(id)).length

    // 5. TBM 오늘 미작성 현장
    const todayTbms = await prisma.siteTbmRecord.findMany({
      where: { workDate: new Date(today + 'T00:00:00Z') },
      select: { siteId: true },
    })
    const tbmSiteSet = new Set(todayTbms.map(t => t.siteId))
    const tbmMissingSites = activeSites.filter(s => !tbmSiteSet.has(s.id))

    // 6. 온보딩 체크리스트 미완료 근로자
    const onboardingPending = await prisma.onboardingChecklist.groupBy({
      by: ['workerId'],
      where: { status: { in: ['PENDING', 'WARNING'] } },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          activeSites: activeSites.length,
          activeWorkers: activeWorkerCount,
          unassignedWorkers: unassignedCount,
          sitesIncomplete: sitesIncomplete.length,
          safetyIncomplete: safetyIncompleteCount,
          tbmMissing: tbmMissingSites.length,
          onboardingPending: onboardingPending.length,
        },
        details: {
          sitesIncomplete: sitesIncomplete.slice(0, 10).map(s => ({
            id: s.id,
            name: s.name,
            hasOpenedAt: !!s.openedAt,
            hasClosedAt: !!s.closedAt,
          })),
          tbmMissingSites: tbmMissingSites.slice(0, 10).map(s => ({
            id: s.id,
            name: s.name,
          })),
        },
        date: today,
      },
    })
  } catch (err) {
    console.error('[GET /dashboard/ops-status]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
