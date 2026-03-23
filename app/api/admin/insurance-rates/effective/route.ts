/**
 * GET /api/admin/insurance-rates/effective
 * 기준일 기반 유효 보험요율 조회
 *
 * Query params:
 *   date        — ISO 날짜 (기본: 오늘)
 *   rateType    — 특정 보험 종류만 조회 (생략 시 전체)
 *   industryCode — 산재보험 업종 코드 (선택)
 *   mode        — "single" | "all" (기본: "all")
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { getEffectiveRate } from '@/lib/insurance/calculate'
import { unauthorized, badRequest, internalError } from '@/lib/utils/response'
import type { InsuranceRateType } from '@prisma/client'

const ALL_RATE_TYPES: InsuranceRateType[] = [
  'NATIONAL_PENSION',
  'HEALTH_INSURANCE',
  'LONG_TERM_CARE',
  'EMPLOYMENT_INSURANCE',
  'EMPLOYMENT_STABILITY',
  'INDUSTRIAL_ACCIDENT',
  'RETIREMENT_MUTUAL',
]

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const dateParam    = searchParams.get('date')
    const rateTypeParam = searchParams.get('rateType') as InsuranceRateType | null
    const industryCode = searchParams.get('industryCode') ?? undefined

    // 기준일 파싱
    let referenceDate: Date
    if (dateParam) {
      referenceDate = new Date(dateParam)
      if (isNaN(referenceDate.getTime())) {
        return badRequest('date 파라미터가 올바른 날짜 형식이 아닙니다. (ISO 8601)')
      }
    } else {
      referenceDate = new Date()
    }

    if (rateTypeParam) {
      // 단일 보험 종류 조회
      if (!ALL_RATE_TYPES.includes(rateTypeParam)) {
        return badRequest(`rateType이 올바르지 않습니다. 허용값: ${ALL_RATE_TYPES.join(', ')}`)
      }
      const rate = await getEffectiveRate(rateTypeParam, referenceDate, industryCode)
      return NextResponse.json({
        success:       true,
        referenceDate: referenceDate.toISOString().slice(0, 10),
        rateType:      rateTypeParam,
        rate:          rate ?? null,
        available:     rate !== null,
      })
    }

    // 전체 보험 종류 일괄 조회
    const rates = await Promise.all(
      ALL_RATE_TYPES.map(async (type) => {
        const rate = await getEffectiveRate(
          type,
          referenceDate,
          type === 'INDUSTRIAL_ACCIDENT' ? industryCode : undefined,
        )
        return { rateType: type, rate: rate ?? null, available: rate !== null }
      }),
    )

    const unavailable = rates.filter(r => !r.available).map(r => r.rateType)

    return NextResponse.json({
      success:       true,
      referenceDate: referenceDate.toISOString().slice(0, 10),
      rates,
      unavailable,
      allAvailable:  unavailable.length === 0,
    })
  } catch (err) {
    console.error('[insurance-rates/effective GET]', err)
    return internalError()
  }
}
