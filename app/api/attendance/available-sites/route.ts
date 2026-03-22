import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { getWorkerAvailableSites, calcDistance } from '@/lib/attendance/attendance-engine'

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const latStr = searchParams.get('lat')
    const lngStr = searchParams.get('lng')
    const userLat = latStr ? parseFloat(latStr) : null
    const userLng = lngStr ? parseFloat(lngStr) : null

    const sites = await getWorkerAvailableSites(session.sub)

    const result = sites.map(s => {
      let distanceMeters: number | null = null
      let withinRadius: boolean | null = null

      if (userLat !== null && userLng !== null) {
        const { distance, within } = calcDistance(
          userLat, userLng,
          s.site.latitude, s.site.longitude,
          s.site.allowedRadius
        )
        distanceMeters = Math.round(distance)
        withinRadius = within
      }

      return {
        siteId: s.siteId,
        siteName: s.site.name,
        companyId: s.companyId,
        companyName: s.companyName,
        tradeType: s.tradeType,
        isPrimary: s.isPrimary,
        allowedRadiusMeters: s.site.allowedRadius,
        distanceMeters,
        withinRadius,
      }
    })

    // 반경 내 현장 우선, 거리 오름차순 정렬
    result.sort((a, b) => {
      if (a.withinRadius && !b.withinRadius) return -1
      if (!a.withinRadius && b.withinRadius) return 1
      if (a.distanceMeters !== null && b.distanceMeters !== null) return a.distanceMeters - b.distanceMeters
      if (a.isPrimary && !b.isPrimary) return -1
      if (!a.isPrimary && b.isPrimary) return 1
      return 0
    })

    return NextResponse.json({ success: true, sites: result })
  } catch (err) {
    console.error('[attendance/available-sites]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
