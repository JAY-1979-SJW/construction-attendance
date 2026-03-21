/**
 * GET /api/admin/labor/allocations
 *
 * 기간별 근로자 현장 투입현황 집계
 * Query: dateFrom, dateTo, siteId?, workerId?, onlyIncluded?
 */
import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { aggregateLaborAllocations, summarizeLaborAllocations } from '@/lib/labor/aggregate'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const dateFrom     = searchParams.get('dateFrom')
    const dateTo       = searchParams.get('dateTo')
    const siteId       = searchParams.get('siteId') ?? undefined
    const workerId     = searchParams.get('workerId') ?? undefined
    const onlyIncluded = searchParams.get('onlyIncluded') === 'true'

    if (!dateFrom || !dateTo) return badRequest('dateFrom, dateTo 파라미터가 필요합니다.')

    const rows   = await aggregateLaborAllocations({ dateFrom, dateTo, siteId, workerId, onlyIncluded })
    const summary = summarizeLaborAllocations(rows)

    const includedCount    = rows.filter((r) => r.includeInLabor).length
    const needsReviewCount = rows.filter((r) => r.needsReview).length
    const autoCount        = rows.filter((r) => r.isAutoCheckout && r.includeInLabor).length

    return ok({
      rows,
      summary,
      meta: {
        totalRows: rows.length,
        includedCount,
        needsReviewCount,
        autoCount,
        dateFrom,
        dateTo,
      },
    })
  } catch (err) {
    console.error('[admin/labor/allocations]', err)
    return internalError()
  }
}
