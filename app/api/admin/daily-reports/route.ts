/**
 * GET /api/admin/daily-reports — 관리자 작업일보 목록 (필터/페이징)
 *
 * Query params:
 *   date       — YYYY-MM-DD (기본: 오늘)
 *   siteId     — 현장 필터
 *   status     — WRITTEN | CONFIRMED | MISSING (미작성)
 *   employmentType — DIRECT | DAILY | OUTSOURCE_LEAD | OUTSOURCE_CREW
 *   jobTitle   — 직종 필터
 *   search     — 근로자명 검색
 *   page       — 페이지 (1부터)
 *   pageSize   — 페이지 크기 (기본 30)
 */
import { NextRequest } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES, buildSiteScopeWhere } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const scope = await buildSiteScopeWhere(session)
    if (scope === false) return ok({ items: [], total: 0, missing: [] })

    const { searchParams } = req.nextUrl
    const dateStr        = searchParams.get('date') || toKSTDateString()
    const siteId         = searchParams.get('siteId')
    const status         = searchParams.get('status')
    const employmentType = searchParams.get('employmentType')
    const jobTitle       = searchParams.get('jobTitle')
    const search         = searchParams.get('search')?.trim()
    const page           = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize       = Math.min(100, parseInt(searchParams.get('pageSize') ?? '30'))

    const reportDate = kstDateStringToDate(dateStr)

    // ── 사이트 범위 제한 ────────────────────────────────────
    const siteWhere: Record<string, any> = siteId
      ? { siteId }
      : (scope as any) !== true
        ? { siteId: (scope as any).siteId }
        : {}

    // ── 미작성 조회 모드 ────────────────────────────────────
    if (status === 'MISSING') {
      const missing = await getMissingReports(reportDate, siteWhere, search)
      return ok({ items: [], total: 0, missing })
    }

    // ── 작업일보 목록 ───────────────────────────────────────
    const where: any = {
      reportDate,
      ...siteWhere,
      ...(status ? { status } : {}),
      ...(employmentType ? { employmentType } : {}),
      ...(jobTitle ? { jobTitle: { contains: jobTitle, mode: 'insensitive' } } : {}),
      ...(search ? {
        worker: { name: { contains: search, mode: 'insensitive' } },
      } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.workerDailyReport.findMany({
        where,
        include: {
          worker: { select: { id: true, name: true, phone: true, jobTitle: true, employmentType: true } },
          site: { select: { id: true, name: true } },
        },
        orderBy: [{ site: { name: 'asc' } }, { worker: { name: 'asc' } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.workerDailyReport.count({ where }),
    ])

    // ── 요약 통계 ───────────────────────────────────────────
    const summaryWhere: any = { reportDate, ...siteWhere }
    const [totalReports, confirmedCount, attendanceCount] = await Promise.all([
      prisma.workerDailyReport.count({ where: summaryWhere }),
      prisma.workerDailyReport.count({ where: { ...summaryWhere, status: 'CONFIRMED' } }),
      prisma.attendanceLog.count({ where: { workDate: reportDate, ...siteWhere } }),
    ])

    const summary = {
      totalAttendance: attendanceCount,
      totalReports,
      confirmedCount,
      writtenCount: totalReports - confirmedCount,
      missingCount: attendanceCount - totalReports,
    }

    return ok({ items, total, summary, page, pageSize })
  } catch (err) {
    console.error('[admin/daily-reports GET]', err)
    return internalError()
  }
}

/**
 * 출근했지만 작업일보 미작성인 근로자 목록
 */
async function getMissingReports(
  reportDate: Date,
  siteWhere: Record<string, any>,
  search?: string,
) {
  // 해당 날짜 출근 기록이 있는 근로자
  const attendanceLogs = await prisma.attendanceLog.findMany({
    where: {
      workDate: reportDate,
      ...siteWhere,
      ...(search ? {
        worker: { name: { contains: search, mode: 'insensitive' as const } },
      } : {}),
    },
    select: {
      id: true,
      workerId: true,
      siteId: true,
      checkInAt: true,
      status: true,
      worker: { select: { id: true, name: true, phone: true, jobTitle: true } },
      checkInSite: { select: { id: true, name: true } },
    },
  })

  // 해당 날짜 작업일보가 있는 근로자 ID
  const reportedWorkerIds = new Set(
    (await prisma.workerDailyReport.findMany({
      where: { reportDate, ...siteWhere },
      select: { workerId: true },
    })).map((r) => r.workerId)
  )

  // 미작성 = 출근 있고 작업일보 없음
  return attendanceLogs
    .filter((a) => !reportedWorkerIds.has(a.workerId))
    .map((a) => ({
      workerId: a.workerId,
      workerName: a.worker.name,
      workerPhone: a.worker.phone,
      jobTitle: a.worker.jobTitle,
      siteId: a.checkInSite.id,
      siteName: a.checkInSite.name,
      checkInAt: a.checkInAt,
      attendanceStatus: a.status,
    }))
}
