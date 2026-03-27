/**
 * GET /api/worker/locations?siteId=...  — 근로자용 현장 위치 목록 (활성만)
 */
import { NextRequest } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const siteId = req.nextUrl.searchParams.get('siteId')
    if (!siteId) return badRequest('siteId 필수')

    const items = await prisma.siteLocationMaster.findMany({
      where: { siteId, isActive: true },
      orderBy: [{ buildingName: 'asc' }, { floorOrder: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        buildingName: true,
        floorOrder: true,
        floorLabel: true,
        detailLabel: true,
      },
    })

    // 동 → 층 → 상세 구조화
    const buildings = Array.from(new Set(items.map((i) => i.buildingName))).sort()
    const floorsByBuilding: Record<string, string[]> = {}
    const detailsByBuildingFloor: Record<string, string[]> = {}

    for (const item of items) {
      const bKey = item.buildingName
      if (!floorsByBuilding[bKey]) floorsByBuilding[bKey] = []
      if (!floorsByBuilding[bKey].includes(item.floorLabel)) {
        floorsByBuilding[bKey].push(item.floorLabel)
      }
      if (item.detailLabel) {
        const fKey = `${bKey}__${item.floorLabel}`
        if (!detailsByBuildingFloor[fKey]) detailsByBuildingFloor[fKey] = []
        if (!detailsByBuildingFloor[fKey].includes(item.detailLabel)) {
          detailsByBuildingFloor[fKey].push(item.detailLabel)
        }
      }
    }

    return ok({ buildings, floorsByBuilding, detailsByBuildingFloor })
  } catch (err) {
    console.error('[worker/locations GET]', err)
    return internalError()
  }
}
