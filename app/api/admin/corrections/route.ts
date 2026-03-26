import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const domainType = searchParams.get('domainType')
    const actedBy = searchParams.get('actedBy')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50')

    const where = {
      ...(domainType ? { domainType: domainType as never } : {}),
      ...(actedBy ? { actedBy } : {}),
      ...(from || to ? {
        actedAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.correctionLog.findMany({
        where,
        orderBy: { actedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.correctionLog.count({ where }),
    ])

    return ok({ items, total, page, pageSize })
  } catch (err) {
    console.error('[corrections GET]', err)
    return internalError()
  }
}
