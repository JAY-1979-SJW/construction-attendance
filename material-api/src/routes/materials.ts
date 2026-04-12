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

interface SuggestQuery {
  q?: string
  limit?: string
  category?: string
}

interface ByCodeQuery {
  code?: string
  source?: string
}

interface LookupBody {
  codes: string[]
  source?: string
}

interface LookupTextBody {
  text?: string
  source?: string
}

function csvCell(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// 공통: 코드 목록으로 자재 일괄 조회
async function lookupByCodes(cleaned: string[], source: string) {
  const rows = await prisma.material.findMany({
    where: { code: { in: cleaned }, source },
    select: {
      id: true, code: true, name: true, spec: true, unit: true,
      category: true, basePrice: true, source: true, baseDate: true, updatedAt: true,
    },
  })

  const byCode = new Map<string, typeof rows[number]>()
  for (const r of rows) {
    if (!byCode.has(r.code)) byCode.set(r.code, r)
  }

  const items = cleaned
    .filter((c) => byCode.has(c))
    .map((c) => {
      const r = byCode.get(c)!
      return {
        id:         r.id,
        code:       r.code,
        name:       r.name,
        spec:       r.spec,
        unit:       r.unit,
        category:   r.category,
        base_price: r.basePrice,
        source:     r.source,
        base_date:  r.baseDate,
        updated_at: r.updatedAt,
      }
    })

  const foundCodes   = new Set(items.map((i) => i.code))
  const missingCodes = cleaned.filter((c) => !foundCodes.has(c))

  return { items, missingCodes }
}

// 공통: cleaned 코드 배열 추출 (trim / 빈값 제거 / 중복 제거)
function cleanCodes(raw: string[]): string[] {
  return [...new Set(
    raw
      .map((c) => (typeof c === 'string' ? c.trim() : ''))
      .filter((c) => c.length > 0)
  )]
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

  // GET /api/materials/suggest — 자동완성 (q, limit, category)
  app.get<{ Querystring: SuggestQuery }>('/materials/suggest', async (req) => {
    const q        = req.query.q?.trim() ?? ''
    const limit    = Math.min(20, Math.max(1, parseInt(req.query.limit ?? '10') || 10))
    const category = req.query.category?.trim()

    if (!q) return { success: true, data: [] }

    const where: Record<string, unknown> = {
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    }
    if (category) where.category = category

    // 내부 버퍼: 최대 200건 가져와 메모리 정렬
    const rows = await prisma.material.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 200,
      select: { id: true, code: true, name: true, spec: true, unit: true, category: true, source: true },
    })

    const ql = q.toLowerCase()
    const priority = (r: typeof rows[number]) => {
      if (r.code.toLowerCase().startsWith(ql)) return 0
      if (r.name.toLowerCase().startsWith(ql))  return 1
      return 2
    }
    rows.sort((a, b) => {
      const dp = priority(a) - priority(b)
      return dp !== 0 ? dp : a.name.localeCompare(b.name, 'ko')
    })

    return { success: true, data: rows.slice(0, limit) }
  })

  // GET /api/materials/by-code — code 기준 단건 조회 (code, source)
  app.get<{ Querystring: ByCodeQuery }>('/materials/by-code', async (req, reply) => {
    const code   = req.query.code?.trim()
    const source = req.query.source?.trim() ?? 'nara'

    if (!code) {
      return reply.status(400).send({ success: false, message: 'code는 필수입니다.' })
    }

    const item = await prisma.material.findFirst({
      where: { code, source },
    })
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

  // POST /api/materials/lookup — 코드 목록 일괄 조회 (최대 100)
  app.post<{ Body: LookupBody }>('/materials/lookup', async (req, reply) => {
    const { codes, source = 'nara' } = req.body ?? {}

    if (!Array.isArray(codes)) {
      return reply.status(400).send({ success: false, message: 'codes는 배열이어야 합니다.' })
    }

    const cleaned = cleanCodes(codes as string[])

    if (cleaned.length === 0) {
      return reply.status(400).send({ success: false, message: 'codes에 유효한 값이 없습니다.' })
    }
    if (cleaned.length > 100) {
      return reply.status(400).send({ success: false, message: 'codes는 최대 100개까지 허용됩니다.' })
    }

    const { items, missingCodes } = await lookupByCodes(cleaned, source)

    return {
      success: true,
      data: {
        requestedCount: cleaned.length,
        foundCount:     items.length,
        items,
        missingCodes,
      },
    }
  })

  // POST /api/materials/lookup/text — textarea 붙여넣기 입력으로 일괄 조회
  app.post<{ Body: LookupTextBody }>('/materials/lookup/text', async (req, reply) => {
    const { text, source = 'nara' } = req.body ?? {}

    if (!text || typeof text !== 'string' || !text.trim()) {
      return reply.status(400).send({ success: false, message: 'text는 필수입니다.' })
    }

    // 줄바꿈 / 쉼표 / 탭 / 공백 모두 구분자로 허용
    const tokens = text.split(/[\n\r,\t ]+/)
    const cleaned = cleanCodes(tokens)

    if (cleaned.length === 0) {
      return reply.status(400).send({ success: false, message: 'text에 유효한 코드가 없습니다.' })
    }
    if (cleaned.length > 100) {
      return reply.status(400).send({ success: false, message: 'codes는 최대 100개까지 허용됩니다.' })
    }

    const { items, missingCodes } = await lookupByCodes(cleaned, source)

    return {
      success: true,
      data: {
        parsedCount:    tokens.filter((t) => t.trim()).length,
        requestedCount: cleaned.length,
        foundCount:     items.length,
        items,
        missingCodes,
      },
    }
  })

  // POST /api/materials/lookup/export.csv — 코드 목록 일괄 조회 결과 CSV 다운로드
  app.post<{ Body: LookupBody }>('/materials/lookup/export.csv', async (req, reply) => {
    const { codes, source = 'nara' } = req.body ?? {}

    if (!Array.isArray(codes)) {
      return reply.status(400).send({ success: false, message: 'codes는 배열이어야 합니다.' })
    }

    const cleaned = cleanCodes(codes as string[])

    if (cleaned.length === 0) {
      return reply.status(400).send({ success: false, message: 'codes에 유효한 값이 없습니다.' })
    }
    if (cleaned.length > 100) {
      return reply.status(400).send({ success: false, message: 'codes는 최대 100개까지 허용됩니다.' })
    }

    const { items, missingCodes: missing } = await lookupByCodes(cleaned, source)
    const byCode = new Map(items.map((i) => [i.code, i]))

    const HEADER = 'input_code,found,id,code,name,spec,unit,category,base_price,source,base_date,updated_at'
    const csvRows = cleaned.map((inputCode) => {
      const r = byCode.get(inputCode)
      if (!r) {
        return [csvCell(inputCode), 'false', '', '', '', '', '', '', '', '', '', ''].join(',')
      }
      return [
        csvCell(inputCode),
        'true',
        r.id,
        csvCell(r.code),
        csvCell(r.name),
        csvCell(r.spec),
        csvCell(r.unit),
        csvCell(r.category),
        r.base_price !== null ? String(r.base_price) : '',
        r.source,
        r.base_date instanceof Date ? r.base_date.toISOString().split('T')[0] : String(r.base_date),
        r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      ].join(',')
    })

    void missing  // used only for CSV; suppress unused warning

    const csv = '\uFEFF' + HEADER + '\n' + csvRows.join('\n') + '\n'

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="materials_lookup_2026-03-24.csv"')
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
