/**
 * GET /api/cron/check-rate-sources
 * 보험요율 공식 고시 소스 접근 가능성 확인 (주기적 실행)
 *
 * 주기:
 *   - 1~7월: 주 1회 (월요일)
 *   - 8~12월: 평일 1회
 *
 * Authorization: Bearer {CRON_SECRET}
 *
 * 동작:
 *   1. DB의 InsuranceRateSource 목록 조회
 *   2. shouldCheckNow() 판단 — 주기가 안 됐으면 스킵
 *   3. 대상 소스 URL HEAD 요청으로 접근성 확인
 *   4. lastCheckedAt, lastChangeDetectedAt 업데이트
 *   5. 결과 반환 (관리자가 보고 수동으로 요율 검토 후 등록)
 *
 * 참고: 자동 반영 금지. 관리자가 검토 후 수동으로 신규 버전 등록.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { shouldCheckNow, checkRateSourceAccessibility } from '@/lib/insurance/rate-monitor'
import type { InsuranceRateType } from '@prisma/client'

export async function GET(req: NextRequest) {
  // cron 인증
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results: {
    rateType:    InsuranceRateType
    status:      'checked' | 'skipped' | 'error'
    httpStatus?: number
    error?:      string
    message:     string
  }[] = []

  try {
    const sources = await prisma.insuranceRateSource.findMany({
      where: { isActive: true },
    })

    for (const source of sources) {
      // 주기 판단
      if (!shouldCheckNow(source.lastCheckedAt, now)) {
        results.push({
          rateType: source.rateType,
          status:   'skipped',
          message:  '확인 주기 미도달 — 스킵',
        })
        continue
      }

      try {
        const detection = await checkRateSourceAccessibility(source.rateType, source.sourceUrl)

        // lastCheckedAt 업데이트
        await prisma.insuranceRateSource.update({
          where: { id: source.id },
          data: {
            lastCheckedAt:        now,
            lastChangeDetectedAt: detection.detected ? now : source.lastChangeDetectedAt,
          },
        })

        results.push({
          rateType:   source.rateType,
          status:     'checked',
          httpStatus: detection.httpStatus,
          message:    detection.reviewMessage ?? '확인 완료',
        })
      } catch (err: any) {
        results.push({
          rateType: source.rateType,
          status:   'error',
          error:    err?.message,
          message:  `처리 중 오류: ${err?.message}`,
        })
      }
    }

    const checked = results.filter(r => r.status === 'checked').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors  = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success:     true,
      checkedAt:   now.toISOString(),
      totalSources: sources.length,
      checked,
      skipped,
      errors,
      results,
      note: '자동 반영 없음 — 관리자가 고시 소스를 직접 확인 후 신규 버전을 등록하세요.',
    })
  } catch (err) {
    console.error('[cron/check-rate-sources]', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
