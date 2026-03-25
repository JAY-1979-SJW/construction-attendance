/**
 * GET /api/wage/my-payslip?monthKey=YYYY-MM
 *
 * 근로자 본인의 월별 공수 + 노임 명세 조회
 * worker_token 쿠키 기반 인증 — 본인 데이터만 반환
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session || session.type !== 'worker') return unauthorized()
    const workerId = session.sub

    const { searchParams } = new URL(request.url)
    const monthKey = searchParams.get('monthKey')
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('monthKey(YYYY-MM) 파라미터가 필요합니다.')
    }

    // 본인 근무확정 데이터 (일자별)
    const confirmations = await prisma.monthlyWorkConfirmation.findMany({
      where: {
        workerId,
        monthKey,
      },
      include: {
        site: { select: { id: true, name: true } },
      },
      orderBy: [{ workDate: 'asc' }],
    })

    // 일자별 명세
    const days = confirmations.map((c) => ({
      workDate: c.workDate,
      siteName: c.site.name,
      workType: c.confirmedWorkType,       // FULL_DAY | HALF_DAY | INVALID
      workUnits: Number(c.confirmedWorkUnits),
      workMinutes: c.confirmedWorkMinutes,
      baseAmount: c.confirmedBaseAmount,
      allowanceAmount: c.confirmedAllowanceAmount,
      totalAmount: c.confirmedTotalAmount,
      status: c.confirmationStatus,        // DRAFT | CONFIRMED
    }))

    // 월 집계
    const totalUnits  = days.reduce((s, d) => s + d.workUnits, 0)
    const totalAmount = days.reduce((s, d) => s + d.totalAmount, 0)
    const totalDays   = days.filter((d) => d.workType !== 'INVALID').length
    const confirmedDays = days.filter((d) => d.status === 'CONFIRMED' && d.workType !== 'INVALID').length

    // 근로자 기본 정보
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { name: true, jobTitle: true },
    })

    return ok({
      workerName: worker?.name ?? '',
      jobTitle:   worker?.jobTitle ?? '',
      monthKey,
      days,
      summary: {
        totalDays,
        confirmedDays,
        totalUnits: Math.round(totalUnits * 100) / 100,
        totalAmount,
      },
    })
  } catch (err) {
    console.error('[wage/my-payslip]', err)
    return internalError()
  }
}
