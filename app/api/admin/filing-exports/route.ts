import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, created, internalError } from '@/lib/utils/response'
import { createFilingExport, ExportType } from '@/lib/labor/filing-export'

const VALID_TYPES: ExportType[] = [
  'DAILY_WAGE_NTS', 'BUSINESS_INCOME_NTS', 'EI_DAILY_REPORT',
  'NP_BASE', 'HI_BASE', 'RETIREMENT_MUTUAL_BASE', 'LABOR_COST_SUMMARY',
]

// GET /api/admin/filing-exports?monthKey=
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const monthKey = searchParams.get('monthKey') ?? undefined

    const items = await prisma.filingExport.findMany({
      where: { ...(monthKey ? { monthKey } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return ok({ items, total: items.length })
  } catch (err) {
    console.error('[filing-exports GET]', err)
    return internalError()
  }
}

// POST /api/admin/filing-exports
// { monthKey, exportType, siteId? }
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const { monthKey, exportType, siteId } = body

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return badRequest('INVALID_MONTH_KEY')
    if (!VALID_TYPES.includes(exportType))              return badRequest('INVALID_EXPORT_TYPE')

    const result = await createFilingExport({
      monthKey,
      exportType: exportType as ExportType,
      createdBy:  session.sub,
      siteId,
    })

    return created(result)
  } catch (err) {
    console.error('[filing-exports POST]', err)
    return internalError()
  }
}
