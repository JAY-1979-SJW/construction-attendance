import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../db/prisma'

interface ListQuery {
  q?: string
  category?: string
  source?: string
  page?: string
  pageSize?: string
}

interface CodeParam {
  code: string
}

export async function materialsRoutes(app: FastifyInstance) {
  // GET /api/materials — 자재 목록 검색
  app.get<{ Querystring: ListQuery }>('/materials', async (req) => {
    const { q, category, source, page = '1', pageSize = '20' } = req.query
    const take = Math.min(100, parseInt(pageSize))
    const skip = (Math.max(1, parseInt(page)) - 1) * take

    const where: Record<string, unknown> = {}
    if (q) where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { spec: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
    ]
    if (category) where.category = category
    if (source)   where.source   = source

    const [total, items] = await Promise.all([
      prisma.material.count({ where }),
      prisma.material.findMany({
        where,
        skip,
        take,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
    ])

    return {
      success: true,
      data: { items, total, page: parseInt(page), pageSize: take },
    }
  })

  // GET /api/materials/categories — 분류 목록
  app.get('/materials/categories', async () => {
    const rows = await prisma.material.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { category: 'asc' },
    })
    return {
      success: true,
      data: rows.map(r => ({ category: r.category, count: r._count.id })),
    }
  })

  // GET /api/materials/sync-status — 갱신 상태
  app.get('/materials/sync-status', async () => {
    const [totalMaterials, recentSyncs] = await Promise.all([
      prisma.material.count(),
      prisma.materialSyncLog.findMany({
        orderBy: { syncedAt: 'desc' },
        take: 5,
      }),
    ])
    return { success: true, data: { totalMaterials, recentSyncs } }
  })

  // GET /api/materials/:code — 자재 상세 (코드 기준, 출처별 전체)
  app.get<{ Params: CodeParam }>('/materials/:code', async (req, reply) => {
    const { code } = req.params
    const items = await prisma.material.findMany({
      where: { code },
      orderBy: { source: 'asc' },
    })
    if (!items.length) {
      return reply.status(404).send({
        success: false,
        message: '해당 코드의 자재를 찾을 수 없습니다.',
      })
    }
    return { success: true, data: items }
  })
}
