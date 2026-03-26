/**
 * GET /api/worker/daily-reports/suggestions
 *
 * 최근 작업 / 자주 쓰는 작업 / 전일 작업 데이터 (공종/작업사항/위치 포함)
 */
import { NextRequest } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const { searchParams } = req.nextUrl
    const siteId = searchParams.get('siteId')
    const todayStr = searchParams.get('date') || toKSTDateString()
    const today = kstDateStringToDate(todayStr)

    const selectFields = {
      todayWork: true,
      workDetail: true,
      tradeFamilyCode: true, tradeFamilyLabel: true,
      tradeCode: true, tradeLabel: true,
      taskCode: true, taskLabel: true,
      buildingName: true, floorLabel: true, locationDetail: true,
      locationDisplayName: true,
      site: { select: { id: true, name: true } },
    } as const

    // 1. 전일 작업일보
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayReport = await prisma.workerDailyReport.findFirst({
      where: {
        workerId: session.sub,
        reportDate: yesterday,
        ...(siteId ? { siteId } : {}),
      },
      select: {
        ...selectFields,
        tomorrowWork: true,
      },
    })

    // 2. 최근 7일 작업 (중복 제거 — taskCode 기준)
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recentReports = await prisma.workerDailyReport.findMany({
      where: {
        workerId: session.sub,
        reportDate: { gte: sevenDaysAgo, lt: today },
        ...(siteId ? { siteId } : {}),
      },
      select: selectFields,
      orderBy: { reportDate: 'desc' },
      take: 20,
    })

    const seen = new Set<string>()
    const recent = recentReports
      .filter((r) => {
        const key = r.taskCode || r.todayWork?.trim() || ''
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((r) => ({
        text: r.taskLabel || r.todayWork?.trim() || '',
        tradeFamilyCode: r.tradeFamilyCode,
        tradeFamilyLabel: r.tradeFamilyLabel,
        tradeCode: r.tradeCode,
        tradeLabel: r.tradeLabel,
        taskCode: r.taskCode,
        taskLabel: r.taskLabel,
        workDetail: r.workDetail,
        buildingName: r.buildingName,
        floorLabel: r.floorLabel,
        locationDetail: r.locationDetail,
        locationDisplayName: r.locationDisplayName,
      }))

    // 3. 자주 쓰는 작업 (빈도순)
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
    const frequentRaw = await prisma.workerDailyReport.groupBy({
      by: ['taskCode', 'taskLabel', 'tradeFamilyCode', 'tradeFamilyLabel', 'tradeCode', 'tradeLabel'],
      where: {
        workerId: session.sub,
        reportDate: { gte: sixtyDaysAgo },
        taskCode: { not: null },
        ...(siteId ? { siteId } : {}),
      },
      _count: { taskCode: true },
      orderBy: { _count: { taskCode: 'desc' } },
      take: 10,
    })

    const frequent = frequentRaw.map((r) => ({
      text: r.taskLabel || '',
      tradeFamilyCode: r.tradeFamilyCode,
      tradeFamilyLabel: r.tradeFamilyLabel,
      tradeCode: r.tradeCode,
      tradeLabel: r.tradeLabel,
      taskCode: r.taskCode,
      taskLabel: r.taskLabel,
      count: r._count.taskCode,
    }))

    return ok({ yesterdayReport, recent, frequent })
  } catch (err) {
    console.error('[worker/daily-reports/suggestions GET]', err)
    return internalError()
  }
}
