/**
 * GET /api/attendance/monthly?month=YYYY-MM
 * 근로자 본인의 월별 출퇴근 기록 (캘린더용)
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session || session.type !== 'worker') return unauthorized()

    const month = req.nextUrl.searchParams.get('month')
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return badRequest('month(YYYY-MM) 파라미터가 필요합니다.')
    }

    const [year, mon] = month.split('-').map(Number)
    const from = new Date(Date.UTC(year, mon - 1, 1))
    const to = new Date(Date.UTC(year, mon, 0)) // 월 마지막일

    const logs = await prisma.attendanceLog.findMany({
      where: {
        workerId: session.sub,
        workDate: { gte: from, lte: to },
      },
      include: {
        checkInSite: { select: { id: true, name: true } },
      },
      orderBy: { workDate: 'asc' },
    })

    // 일일보고 존재 여부
    const reports = await prisma.workerDailyReport.findMany({
      where: {
        workerId: session.sub,
        reportDate: { gte: from, lte: to },
      },
      select: { reportDate: true, status: true, todayManDays: true },
    })

    const reportMap = new Map(
      reports.map(r => [r.reportDate.toISOString().slice(0, 10), r])
    )

    const days = logs.map(log => {
      const dateStr = log.workDate.toISOString().slice(0, 10)
      const report = reportMap.get(dateStr)
      return {
        date: dateStr,
        siteName: log.checkInSite.name,
        checkInAt: log.checkInAt?.toISOString() ?? null,
        checkOutAt: log.checkOutAt?.toISOString() ?? null,
        status: log.status,
        hasReport: !!report,
        reportStatus: report?.status ?? null,
        manDays: report ? Number(report.todayManDays) : null,
      }
    })

    const summary = {
      totalDays: days.length,
      workedDays: days.filter(d => d.status === 'COMPLETED' || d.status === 'WORKING').length,
      totalManDays: days.reduce((s, d) => s + (d.manDays ?? 0), 0),
      reportedDays: days.filter(d => d.hasReport).length,
    }

    return ok({ month, days, summary })
  } catch (err) {
    console.error('[attendance/monthly]', err)
    return internalError()
  }
}
