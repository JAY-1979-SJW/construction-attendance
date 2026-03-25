import { NextRequest } from 'next/server'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'

// GET /api/labor/insurance/history?month=YYYY-MM
// 현재 InsuranceSubmissionHistory 모델이 없으므로 빈 배열 반환 (추후 모델 추가 시 교체)
export async function GET(_req: NextRequest) {
  try {
    try {
      await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      return msg === 'UNAUTHORIZED' ? unauthorized() : forbidden()
    }

    // TODO: InsuranceSubmissionHistory 모델 추가 후 실제 조회로 교체
    return ok([])
  } catch (err) {
    console.error('[labor/insurance/history GET]', err)
    return internalError()
  }
}
