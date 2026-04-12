import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '../db/prisma'

interface ListQuery {
  q?: string
  category?: string
  source?: string
  page?: string
  pageSize?: string
}

interface IdParam {
  id: string
}

interface ExportQuery {
  q?: string
  category?: string
}

function csvCell(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export async function materialsRoutes(app: FastifyInstance) {
  // GET /api/materials — 자재 목록 검색
  app.get<{ Querystring: ListQuery }>('/materials', async (req) => {
    const { q, category, source, page = '1', pageSize = '50' } = req.query
    const pageNum = Math.max(1, parseInt(page))
    const take    = Math.min(200, Math.max(1, parseInt(pageSize)))
    const skip    = (pageNum - 1) * take
    const search  = q?.trim()

    const where: Record<string, unknown> = {}
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ]
    if (category) where.category = category.trim()
    if (source)   where.source   = source

    const [total, items] = await Promise.all([
      prisma.material.count({ where }),
      prisma.material.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
    ])

    return {
      success: true,
      data: {
        items,
        total,
        page:       pageNum,
        pageSize:   take,
        totalPages: Math.ceil(total / take),
        notice:        'nara 데이터는 2026-03-24 기준 카탈로그 이관본이며 base_price=null (실수집 보류 중)',
        price_available: false,
      },
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
    const naraStatus = {
      source:          'nara',
      status:          'deferred',
      reason:          '나라장터 PriceInfoService 서버 장애로 실수집 보류',
      dataType:        'migration_from_nara_resources',
      baseDate:        '2026-03-24',
      priceIncluded:   false,
      lastLiveSync:    null,
    }
    return { success: true, data: { totalMaterials, sourceStatus: [naraStatus], recentSyncs } }
  })

  // GET /api/materials/summary — 요약 통계
  app.get('/materials/summary', async () => {
    const [
      totalMaterials,
      categoryRows,
      sourceCounts,
      priceAvailableCount,
      latestBaseDateRow,
      categoryTop10,
    ] = await Promise.all([
      prisma.material.count(),
      prisma.material.groupBy({ by: ['category'], _count: { id: true } }),
      prisma.material.groupBy({ by: ['source'],   _count: { id: true }, orderBy: { source: 'asc' } }),
      prisma.material.count({ where: { basePrice: { not: null } } }),
      prisma.material.findFirst({ orderBy: { baseDate: 'desc' }, select: { baseDate: true } }),
      prisma.material.groupBy({
        by: ['category'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ])

    return {
      success: true,
      data: {
        totalMaterials,
        totalCategories:    categoryRows.length,
        sourceCounts:       sourceCounts.map(r => ({ source: r.source, count: r._count.id })),
        priceAvailableCount,
        priceMissingCount:  totalMaterials - priceAvailableCount,
        latestBaseDate:     latestBaseDateRow?.baseDate ?? null,
        categoryTop10:      categoryTop10.map(r => ({ category: r.category, count: r._count.id })),
        notice:             'nara 데이터는 2026-03-24 기준 카탈로그 이관본이며 base_price=null (실수집 보류 중)',
        price_available:    false,
      },
    }
  })

  // GET /api/materials/export.csv — CSV 다운로드 (q, category 필터 지원)
  app.get<{ Querystring: ExportQuery }>('/materials/export.csv', async (req, reply) => {
    const search   = req.query.q?.trim()
    const category = req.query.category?.trim()

    const where: Record<string, unknown> = {}
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ]
    if (category) where.category = category

    const items = await prisma.material.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, code: true, name: true, spec: true, unit: true,
        category: true, subCategory: true, basePrice: true,
        source: true, baseDate: true, updatedAt: true,
      },
    })

    const HEADER = 'id,code,name,spec,unit,category,base_price,source,base_date,updated_at'
    const rows = items.map(r => [
      r.id,
      csvCell(r.code),
      csvCell(r.name),
      csvCell(r.spec),
      csvCell(r.unit),
      csvCell(r.category),
      r.basePrice !== null ? r.basePrice.toString() : '',
      r.source,
      r.baseDate.toISOString().split('T')[0],
      r.updatedAt.toISOString(),
    ].join(','))

    const csv = '\uFEFF' + HEADER + '\n' + rows.join('\n') + '\n'  // BOM 포함(Excel 한글 호환)
    const filename = 'materials_snapshot_2026-03-24.csv'

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
    return reply.send(csv)
  })

  // GET /api/materials/:id — 자재 단건 상세조회 (DB id 기준)
  app.get<{ Params: IdParam }>('/materials/:id', async (req, reply) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return reply.status(400).send({ success: false, message: 'id는 정수여야 합니다.' })
    }
    const item = await prisma.material.findUnique({ where: { id } })
    if (!item) {
      return reply.status(404).send({ success: false, message: '자재를 찾을 수 없습니다.' })
    }
    return {
      success: true,
      data: {
        ...item,
        price_available: item.basePrice !== null,
        notice: 'nara 데이터는 2026-03-24 기준 카탈로그 이관본 (실수집 보류 중)',
      },
    }
  })
}
