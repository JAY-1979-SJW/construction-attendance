import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, getAccessibleSiteIds } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { generateToken } from '@/lib/utils/random'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  allowedRadius: z.number().int().min(10).max(5000).default(100),
  siteCode: z.string().optional(),
  openedAt: z.string().optional(),
  closedAt: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') ?? '200', 10)

    // SITE_ADMIN / COMPANY_ADMIN scope 필터
    const accessibleSiteIds = await getAccessibleSiteIds(session)

    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(accessibleSiteIds !== null ? { id: { in: accessibleSiteIds } } : {}),
    }
    const [total, sites] = await Promise.all([
      prisma.site.count({ where }),
      prisma.site.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          companyAssignments: {
            include: {
              company: { select: { id: true, companyName: true, companyType: true } },
            },
            orderBy: { startDate: 'desc' },
          },
        },
      }),
    ])

    return ok({ items: sites, total, page, pageSize })
  } catch (err) {
    console.error('[admin/sites GET]', err)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    // SITE_ADMIN은 현장 신규 생성 불가 (배정된 현장만 관리)
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { siteCode, openedAt, closedAt, notes, ...coreData } = parsed.data
    const qrToken = generateToken(32)
    const site = await prisma.site.create({
      data: {
        ...coreData,
        qrToken,
        siteCode: siteCode ?? null,
        openedAt: openedAt ? new Date(openedAt) : null,
        closedAt: closedAt ? new Date(closedAt) : null,
        notes: notes ?? null,
      },
    })

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'CREATE_SITE',
      targetType: 'Site',
      targetId: site.id,
      description: `현장 등록: ${site.name}`,
    })

    return created({ id: site.id }, '현장이 등록되었습니다.')
  } catch (err) {
    console.error('[admin/sites POST]', err)
    return internalError()
  }
}
