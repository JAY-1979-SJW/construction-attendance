/**
 * POST /api/admin/site-locations/generate — 템플릿 기반 위치 자동생성
 *
 * Body: { siteId, buildings: ["A동","B동"], undergroundStart: -2, abovegroundEnd: 30, specials: ["옥탑","PIT","기계실"] }
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

const generateSchema = z.object({
  siteId:           z.string().min(1),
  buildings:        z.array(z.string().min(1)).min(1),
  undergroundStart: z.number().int().min(-20).max(0).default(0),
  abovegroundEnd:   z.number().int().min(1).max(200).default(1),
  specials:         z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const body = await req.json()
    const parsed = generateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { siteId, buildings, undergroundStart, abovegroundEnd, specials } = parsed.data
    if (!await canAccessSite(session, siteId)) return siteAccessDenied()

    const records: {
      siteId: string
      buildingName: string
      floorOrder: number
      floorLabel: string
      sortOrder: number
    }[] = []

    let sort = 0

    for (const bldg of buildings) {
      // 지하층 (큰 숫자부터)
      for (let f = undergroundStart; f < 0; f++) {
        records.push({
          siteId,
          buildingName: bldg,
          floorOrder: f,
          floorLabel: `지하${Math.abs(f)}층`,
          sortOrder: sort++,
        })
      }

      // 지상층
      for (let f = 1; f <= abovegroundEnd; f++) {
        records.push({
          siteId,
          buildingName: bldg,
          floorOrder: f,
          floorLabel: `${f}층`,
          sortOrder: sort++,
        })
      }

      // 특수구역
      if (specials) {
        for (const sp of specials) {
          records.push({
            siteId,
            buildingName: bldg,
            floorOrder: abovegroundEnd + 1,
            floorLabel: sp,
            sortOrder: sort++,
          })
        }
      }
    }

    const result = await prisma.siteLocationMaster.createMany({
      data: records,
      skipDuplicates: true,
    })

    return ok({ created: result.count, total: records.length }, `${result.count}개 위치가 생성되었습니다.`)
  } catch (err) {
    console.error('[admin/site-locations/generate POST]', err)
    return internalError()
  }
}
