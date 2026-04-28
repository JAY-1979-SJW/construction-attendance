/**
 * GET /api/admin/attendance/calendar?month=YYYY-MM&siteId=xxx
 * 관리자 월별 출퇴근 캘린더 집계
 */
import { NextRequest } from 'next/server'
import { getAdminSession, buildSiteScopeWhere } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const sp = req.nextUrl.searchParams
    const month = sp.get('month')
    const siteId = sp.get('siteId')
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return badRequest('month(YYYY-MM) 필요')

    const scope = await buildSiteScopeWhere(session)
    if (scope === false) return ok({ days: [], summary: {} })

    const [year, mon] = month.split('-').map(Number)
    const from = new Date(Date.UTC(year, mon - 1, 1))
    const to = new Date(Date.UTC(year, mon, 0))

    const siteWhere = siteId ? { siteId } : scope

    // 일자별 출퇴근 집계
    const logs = await prisma.attendanceLog.groupBy({
      by: ['workDate', 'status'],
      where: { workDate: { gte: from, lte: to }, ...siteWhere },
      _count: true,
    })

    // 일자별 작업일보 집계
    const reports = await prisma.workerDailyReport.groupBy({
      by: ['reportDate', 'status'],
      where: { reportDate: { gte: from, lte: to }, ...siteWhere },
      _count: true,
    })

    // 일자별 공수 집계
    const confirmations = await prisma.monthlyWorkConfirmation.groupBy({
      by: ['workDate'],
      where: { monthKey: month, confirmationStatus: 'CONFIRMED', ...siteWhere },
      _sum: { confirmedWorkUnits: true },
      _count: true,
    })

    // 날짜별 맵 구성
    const dayMap = new Map<string, {
      date: string
      totalWorkers: number
      completed: number
      working: number
      exception: number
      reportWritten: number
      reportConfirmed: number
      confirmedUnits: number
      confirmedCount: number
    }>()

    const lastDate = to.getDate()
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      dayMap.set(dateStr, {
        date: dateStr,
        totalWorkers: 0, completed: 0, working: 0, exception: 0,
        reportWritten: 0, reportConfirmed: 0,
        confirmedUnits: 0, confirmedCount: 0,
      })
    }

    for (const log of logs) {
      const dateStr = log.workDate.toISOString().slice(0, 10)
      const day = dayMap.get(dateStr)
      if (!day) continue
      day.totalWorkers += log._count
      if (log.status === 'COMPLETED') day.completed += log._count
      else if (log.status === 'WORKING') day.working += log._count
      else if (log.status === 'EXCEPTION') day.exception += log._count
    }

    for (const r of reports) {
      const dateStr = r.reportDate.toISOString().slice(0, 10)
      const day = dayMap.get(dateStr)
      if (!day) continue
      if (r.status === 'CONFIRMED') day.reportConfirmed += r._count
      else day.reportWritten += r._count
    }

    for (const c of confirmations) {
      const dateStr = typeof c.workDate === 'string' ? c.workDate : ''
      const day = dayMap.get(dateStr)
      if (!day) continue
      day.confirmedUnits += Number(c._sum?.confirmedWorkUnits ?? 0)
      day.confirmedCount += c._count
    }

    const days = Array.from(dayMap.values())

    // 월 합계
    const summary = {
      totalAttendance: days.reduce((s, d) => s + d.totalWorkers, 0),
      totalCompleted: days.reduce((s, d) => s + d.completed, 0),
      totalReports: days.reduce((s, d) => s + d.reportWritten + d.reportConfirmed, 0),
      totalConfirmedUnits: Math.round(days.reduce((s, d) => s + d.confirmedUnits, 0) * 100) / 100,
      workingDays: days.filter(d => d.totalWorkers > 0).length,
    }

    return ok({ month, days, summary })
  } catch (err) {
    console.error('[admin/attendance/calendar]', err)
    return internalError()
  }
}
