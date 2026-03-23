/**
 * GET /api/admin/labor-count/review
 * 공수/정산 사전 검토 화면 — DRAFT 상태 MonthlyWorkConfirmation 목록
 *
 * 권한: ADMIN 이상
 * 쿼리 파라미터:
 *  - monthKey: 'YYYY-MM' (필수)
 *  - siteId: 현장 필터 (선택)
 *  - page / pageSize
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, badRequest } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { searchParams } = new URL(req.url)
    const monthKey = searchParams.get('monthKey')
    const siteId   = searchParams.get('siteId')
    const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1',  10))
    const pageSize = Math.min(200, parseInt(searchParams.get('pageSize') ?? '50', 10))

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('monthKey는 YYYY-MM 형식이어야 합니다.')
    }

    const where = {
      monthKey,
      confirmationStatus: 'DRAFT' as const,
      ...(siteId ? { siteId } : {}),
    }

    const [total, items] = await Promise.all([
      prisma.monthlyWorkConfirmation.count({ where }),
      prisma.monthlyWorkConfirmation.findMany({
        where,
        include: {
          worker: { select: { id: true, name: true, phone: true } },
          site:   { select: { id: true, name: true } },
          attendanceDay: {
            select: {
              workedMinutesRaw:      true,
              workedMinutesAuto:     true,
              workedMinutesOverride: true,
              workedMinutesRawFinal: true,
              manualAdjustedYn:      true,
              manualAdjustedReason:  true,
            },
          },
        },
        orderBy: [{ workDate: 'asc' }, { worker: { name: 'asc' } }],
        skip:  (page - 1) * pageSize,
        take:  pageSize,
      }),
    ])

    // 요약 집계 (해당 월 전체)
    const [totalDraft, totalConfirmed] = await Promise.all([
      prisma.monthlyWorkConfirmation.count({ where: { monthKey, confirmationStatus: 'DRAFT', ...(siteId ? { siteId } : {}) } }),
      prisma.monthlyWorkConfirmation.count({ where: { monthKey, confirmationStatus: 'CONFIRMED', ...(siteId ? { siteId } : {}) } }),
    ])

    return NextResponse.json({
      success: true,
      monthKey,
      summary: {
        totalDraft,
        totalConfirmed,
        totalItems: totalDraft + totalConfirmed,
      },
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      items: items.map(c => {
        const ad = c.attendanceDay
        const finalMinutes = ad?.workedMinutesRawFinal ?? ad?.workedMinutesAuto ?? 0
        return {
          id:                   c.id,
          workerId:             c.workerId,
          workerName:           c.worker.name,
          workerPhone:          c.worker.phone,
          siteId:               c.siteId,
          siteName:             c.site.name,
          workDate:             c.workDate,
          monthKey:             c.monthKey,
          confirmationStatus:   c.confirmationStatus,
          confirmedWorkType:    c.confirmedWorkType,
          confirmedWorkUnits:   Number(c.confirmedWorkUnits),
          confirmedWorkMinutes: c.confirmedWorkMinutes,
          confirmedBaseAmount:  c.confirmedBaseAmount,
          confirmedTotalAmount: c.confirmedTotalAmount,
          incomeTypeSnapshot:   c.incomeTypeSnapshot,
          // 출퇴근 원본 정보
          workedMinutesAuto:     ad?.workedMinutesAuto     ?? null,
          workedMinutesOverride: ad?.workedMinutesOverride ?? null,
          workedMinutesFinal:    finalMinutes,
          manualAdjustedYn:     ad?.manualAdjustedYn       ?? false,
          manualAdjustedReason: ad?.manualAdjustedReason   ?? null,
          // 이상 플래그
          hasOverride:     (ad?.workedMinutesOverride != null),
          isZeroMinutes:   finalMinutes === 0,
        }
      }),
    })
  } catch (err) {
    console.error('[GET /labor-count/review]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
