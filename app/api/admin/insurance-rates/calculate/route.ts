/**
 * POST /api/admin/insurance-rates/calculate
 * 보험요율 계산 API
 *
 * body:
 *   wage         — 월급여 or 일급여 (원, 필수)
 *   date         — 기준일 ISO (기본: 오늘)
 *   wageType     — "MONTHLY" | "DAILY" (기본: MONTHLY)
 *   industryCode — 산재보험 업종 코드 (선택)
 *
 * 반환:
 *   - 보험 종류별 근로자/사업주 부담금
 *   - 적용된 요율 버전 ID
 *   - 미등록 요율 항목 목록
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { calculateAllInsurances, calculateDailyWorkerInsurance } from '@/lib/insurance/calculate'
import { unauthorized, badRequest, internalError } from '@/lib/utils/response'

const schema = z.object({
  wage:         z.number().int().positive('임금은 양수여야 합니다.'),
  date:         z.string().optional(),
  wageType:     z.enum(['MONTHLY', 'DAILY']).default('MONTHLY'),
  industryCode: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { wage, date, wageType, industryCode } = parsed.data

    let referenceDate: Date
    if (date) {
      referenceDate = new Date(date)
      if (isNaN(referenceDate.getTime())) {
        return badRequest('date 파라미터가 올바른 날짜 형식이 아닙니다.')
      }
    } else {
      referenceDate = new Date()
    }

    if (wageType === 'DAILY') {
      // 건설업 일용근로자 계산
      const result = await calculateDailyWorkerInsurance(wage, referenceDate, industryCode)
      return NextResponse.json({
        success:      true,
        wageType:     'DAILY',
        dailyWage:    wage,
        referenceDate: referenceDate.toISOString().slice(0, 10),
        result,
      })
    }

    // 월급여 기준 4대보험 계산
    const result = await calculateAllInsurances(wage, referenceDate, industryCode)

    // 근로자 부담 합산
    const employeeTotalAmount = [
      result.nationalPension?.employeeAmount,
      result.healthInsurance?.employeeAmount,
      result.longTermCare?.employeeAmount,
      result.employmentInsurance?.employeeAmount,
    ].reduce((sum: number, v) => sum + (v ?? 0), 0)

    // 사업주 부담 합산
    const employerTotalAmount = [
      result.nationalPension?.employerAmount,
      result.healthInsurance?.employerAmount,
      result.longTermCare?.employerAmount,
      result.employmentInsurance?.employerAmount,
      result.employmentStability?.employerAmount,
      result.industrialAccident?.employerAmount,
    ].reduce((sum: number, v) => sum + (v ?? 0), 0)

    return NextResponse.json({
      success:      true,
      wageType:     'MONTHLY',
      monthlyWage:  wage,
      referenceDate: referenceDate.toISOString().slice(0, 10),
      summary: {
        employeeTotalAmount,
        employerTotalAmount,
        grandTotal: employeeTotalAmount + employerTotalAmount,
      },
      details: result,
      unavailable: result.unavailable,
      note: result.unavailable.length > 0
        ? `미등록 요율 항목 ${result.unavailable.length}개: 관리자가 해당 보험요율을 등록·승인해야 계산이 가능합니다.`
        : null,
    })
  } catch (err) {
    console.error('[insurance-rates/calculate POST]', err)
    return internalError()
  }
}
