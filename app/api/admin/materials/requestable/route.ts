import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/session'
import { ok, unauthorized } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { searchParams } = req.nextUrl
  const q              = searchParams.get('q') ?? ''
  const disciplineCode = searchParams.get('disciplineCode') ?? ''
  const page           = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize       = Math.min(100, parseInt(searchParams.get('pageSize') ?? '30', 10))

  const where: Record<string, unknown> = {
    active:        true,
    isRequestable: true,
  }

  if (disciplineCode) where.disciplineCode = disciplineCode

  if (q.trim()) {
    where.OR = [
      { standardItemName: { contains: q, mode: 'insensitive' } },
      { itemCode:         { contains: q, mode: 'insensitive' } },
      { standardSpec:     { contains: q, mode: 'insensitive' } },
      { searchKeywords:   { contains: q, mode: 'insensitive' } },
    ]
  }

  const [total, items] = await Promise.all([
    prisma.materialMaster.count({ where }),
    prisma.materialMaster.findMany({
      where,
      select: {
        id:               true,
        itemCode:         true,
        standardItemName: true,
        standardSpec:     true,
        standardUnit:     true,
        disciplineCode:   true,
        subDisciplineCode: true,
        itemCategory:     true,
      },
      orderBy: [{ standardItemName: 'asc' }],
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
  ])

  return ok({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
