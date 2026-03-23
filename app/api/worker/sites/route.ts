import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'

/**
 * GET /api/worker/sites
 * 로그인한 근로자가 볼 수 있는 활성 현장 목록 + 내 참여 신청 상태.
 * APPROVED 계정만 접근 가능.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    // 계정 상태 확인
    const worker = await prisma.worker.findUnique({
      where: { id: session.sub },
      select: { accountStatus: true },
    })
    if (!worker || worker.accountStatus !== 'APPROVED') {
      return NextResponse.json({
        success: false,
        message: '승인된 계정만 현장 목록을 조회할 수 있습니다.',
      }, { status: 403 })
    }

    // 현재 내 참여 신청 목록 (workerId 기준)
    const myJoinRequests = await prisma.siteJoinRequest.findMany({
      where: { workerId: session.sub },
      select: { siteId: true, status: true, requestedAt: true, rejectReason: true },
    })
    const joinMap = new Map(myJoinRequests.map(j => [j.siteId, j]))

    // 현재 배정된 현장 ID 목록 (승인 완료된 것)
    const assignedSiteIds = new Set(
      (await prisma.workerSiteAssignment.findMany({
        where: { workerId: session.sub, isActive: true },
        select: { siteId: true },
      })).map(a => a.siteId)
    )

    // 활성 현장 전체 목록
    const sites = await prisma.site.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        openedAt: true,
        closedAt: true,
        allowedRadius: true,
      },
    })

    const now = new Date()
    const result = sites.map(site => {
      const join = joinMap.get(site.id)
      const isAssigned = assignedSiteIds.has(site.id)

      let siteStatus: 'UPCOMING' | 'ACTIVE' | 'CLOSED' = 'ACTIVE'
      if (site.openedAt && site.openedAt > now) siteStatus = 'UPCOMING'
      else if (site.closedAt && site.closedAt < now) siteStatus = 'CLOSED'

      return {
        siteId: site.id,
        siteName: site.name,
        address: site.address,
        openedAt: site.openedAt,
        closedAt: site.closedAt,
        allowedRadiusMeters: site.allowedRadius,
        siteStatus,
        // 내 참여 상태
        joinStatus: isAssigned ? 'ASSIGNED' : (join?.status ?? null),
        joinRequestedAt: join?.requestedAt ?? null,
        joinRejectReason: join?.rejectReason ?? null,
        canJoin: !isAssigned && (!join || join.status === 'REJECTED'),
        canCheckIn: isAssigned && siteStatus === 'ACTIVE',
      }
    })

    return NextResponse.json({ success: true, sites: result })
  } catch (err) {
    console.error('[worker/sites]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
