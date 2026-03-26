/**
 * GET  /api/admin/site-locations?siteId=...  — 현장별 위치 마스터 목록
 * POST /api/admin/site-locations             — 위치 추가
 * PATCH /api/admin/site-locations            — 위치 수정 (id 필수)
 * DELETE /api/admin/site-locations?id=...    — 위치 삭제
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'

const createSchema = z.object({
  siteId:       z.string().min(1),
  buildingName: z.string().min(1),
  floorOrder:   z.number().int(),
  floorLabel:   z.string().min(1),
  detailLabel:  z.string().nullable().optional(),
  sortOrder:    z.number().int().optional(),
})

const patchSchema = z.object({
  id:           z.string().min(1),
  buildingName: z.string().min(1).optional(),
  floorOrder:   z.number().int().optional(),
  floorLabel:   z.string().min(1).optional(),
  detailLabel:  z.string().nullable().optional(),
  isActive:     z.boolean().optional(),
  sortOrder:    z.number().int().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const siteId = req.nextUrl.searchParams.get('siteId')
    if (!siteId) return badRequest('siteId 필수')
    if (!await canAccessSite(session, siteId)) return siteAccessDenied()

    const items = await prisma.siteLocationMaster.findMany({
      where: { siteId },
      orderBy: [{ buildingName: 'asc' }, { floorOrder: 'asc' }, { sortOrder: 'asc' }],
    })

    // 동 목록, 층 목록을 구조화
    const buildings = Array.from(new Set(items.map((i) => i.buildingName))).sort()
    const byBuilding: Record<string, typeof items> = {}
    for (const item of items) {
      if (!byBuilding[item.buildingName]) byBuilding[item.buildingName] = []
      byBuilding[item.buildingName].push(item)
    }

    return ok({ items, buildings, byBuilding })
  } catch (err) {
    console.error('[admin/site-locations GET]', err)
    return internalError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data
    if (!await canAccessSite(session, d.siteId)) return siteAccessDenied()

    const item = await prisma.siteLocationMaster.create({
      data: {
        siteId: d.siteId,
        buildingName: d.buildingName,
        floorOrder: d.floorOrder,
        floorLabel: d.floorLabel,
        detailLabel: d.detailLabel ?? null,
        sortOrder: d.sortOrder ?? 0,
      },
    })

    return ok(item, '위치가 추가되었습니다.')
  } catch (err) {
    console.error('[admin/site-locations POST]', err)
    return internalError()
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data
    const existing = await prisma.siteLocationMaster.findUnique({ where: { id: d.id } })
    if (!existing) return notFound()

    const updated = await prisma.siteLocationMaster.update({
      where: { id: d.id },
      data: {
        ...(d.buildingName !== undefined ? { buildingName: d.buildingName } : {}),
        ...(d.floorOrder !== undefined ? { floorOrder: d.floorOrder } : {}),
        ...(d.floorLabel !== undefined ? { floorLabel: d.floorLabel } : {}),
        ...(d.detailLabel !== undefined ? { detailLabel: d.detailLabel } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      },
    })

    return ok(updated)
  } catch (err) {
    console.error('[admin/site-locations PATCH]', err)
    return internalError()
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return badRequest('id 필수')

    await prisma.siteLocationMaster.delete({ where: { id } })
    return ok({ id }, '삭제되었습니다.')
  } catch (err) {
    console.error('[admin/site-locations DELETE]', err)
    return internalError()
  }
}
