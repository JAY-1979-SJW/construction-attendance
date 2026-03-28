/**
 * GET  /api/worker/daily-reports         — 오늘 작업일보 조회 (또는 특정 날짜)
 * POST /api/worker/daily-reports         — 작업일보 저장 (upsert)
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, forbidden, internalError } from '@/lib/utils/response'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads'

const saveSchema = z.object({
  siteId:           z.string().min(1),
  attendanceLogId:  z.string().optional(),
  reportDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employmentType:   z.enum(['DIRECT', 'DAILY', 'OUTSOURCE_LEAD', 'OUTSOURCE_CREW']).optional(),
  jobTitle:         z.string().optional(),
  // 공종/작업사항
  tradeFamilyCode:  z.string().nullable().optional(),
  tradeFamilyLabel: z.string().nullable().optional(),
  tradeCode:        z.string().nullable().optional(),
  tradeLabel:       z.string().nullable().optional(),
  taskCode:         z.string().nullable().optional(),
  taskLabel:        z.string().nullable().optional(),
  workDetail:       z.string().nullable().optional(),
  // 위치
  buildingName:     z.string().nullable().optional(),
  floorLabel:       z.string().nullable().optional(),
  locationDetail:   z.string().nullable().optional(),
  // 작업 3구조
  yesterdayWork:    z.string().nullable().optional(),
  todayWork:        z.string().nullable().optional(),
  tomorrowWork:     z.string().nullable().optional(),
  // 작업시간
  workStartTime:   z.string().nullable().optional(),
  workEndTime:     z.string().nullable().optional(),
  // 기타
  notes:            z.string().nullable().optional(),
  materialUsedYn:   z.boolean().optional(),
  materialNote:     z.string().nullable().optional(),
  todayManDays:     z.number().min(0).max(3).optional(),
  photos:           z.array(z.string()).optional(),
  copiedFromPreviousYn: z.boolean().optional(),
  copiedToTomorrowYn:   z.boolean().optional(),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const { searchParams } = req.nextUrl
    const date = searchParams.get('date') || toKSTDateString()
    const reportDate = kstDateStringToDate(date)

    const report = await prisma.workerDailyReport.findFirst({
      where: { workerId: session.sub, reportDate },
      include: { site: { select: { id: true, name: true } } },
    })

    const attendance = await prisma.attendanceLog.findFirst({
      where: { workerId: session.sub, workDate: reportDate },
      include: { checkInSite: { select: { id: true, name: true } } },
    })

    return ok({ report, attendance })
  } catch (err) {
    console.error('[worker/daily-reports GET]', err)
    return internalError()
  }
}

// ─── POST (upsert) ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await req.json()
    const parsed = saveSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data
    const reportDate = kstDateStringToDate(d.reportDate || toKSTDateString())

    // 출근 확인
    const attendance = await prisma.attendanceLog.findFirst({
      where: { workerId: session.sub, workDate: reportDate },
    })
    if (!attendance) {
      return forbidden('출근 기록이 없는 날짜에는 작업일보를 작성할 수 없습니다.')
    }

    const worker = await prisma.worker.findUnique({
      where: { id: session.sub },
      select: { jobTitle: true },
    })

    // 위치 조합 표시명
    const locationParts = [d.buildingName, d.floorLabel, d.locationDetail].filter(Boolean)
    const locationDisplayName = locationParts.length > 0 ? locationParts.join(' ') : null

    // 반복 작업 연속일수 (공종+작업사항+위치 기준)
    const consecutiveDays = await calcConsecutiveDays(
      session.sub, d.siteId, reportDate,
      d.tradeFamilyCode ?? null, d.tradeCode ?? null, d.taskCode ?? null,
      d.buildingName ?? null, d.floorLabel ?? null,
    )

    // 공수 계산
    const { monthlyManDays, totalManDays } = await calcManDays(
      session.sub, reportDate, d.todayManDays ?? 1.0
    )

    // 사진 삭제 대비: 기존 photos 조회
    let oldPhotos: string[] = []
    if (d.photos !== undefined) {
      const existing = await prisma.workerDailyReport.findUnique({
        where: {
          workerId_siteId_reportDate: {
            workerId: session.sub, siteId: d.siteId, reportDate,
          },
        },
        select: { photos: true },
      })
      oldPhotos = existing?.photos ?? []
    }

    const shared = {
      tradeFamilyCode:  d.tradeFamilyCode ?? null,
      tradeFamilyLabel: d.tradeFamilyLabel ?? null,
      tradeCode:        d.tradeCode ?? null,
      tradeLabel:       d.tradeLabel ?? null,
      taskCode:         d.taskCode ?? null,
      taskLabel:        d.taskLabel ?? null,
      workDetail:       d.workDetail ?? null,
      buildingName:     d.buildingName ?? null,
      floorLabel:       d.floorLabel ?? null,
      locationDetail:   d.locationDetail ?? null,
      locationDisplayName,
      yesterdayWork:    d.yesterdayWork ?? null,
      todayWork:        d.todayWork ?? null,
      tomorrowWork:     d.tomorrowWork ?? null,
      workStartTime:   d.workStartTime ?? null,
      workEndTime:     d.workEndTime ?? null,
      consecutiveDays,
      todayManDays:    d.todayManDays ?? 1.0,
      monthlyManDays,
      totalManDays,
      notes:           d.notes ?? null,
      materialUsedYn:  d.materialUsedYn ?? false,
      materialNote:    d.materialNote ?? null,
      ...(d.photos !== undefined ? { photos: d.photos } : {}),
      copiedFromPreviousYn: d.copiedFromPreviousYn ?? false,
      copiedToTomorrowYn:   d.copiedToTomorrowYn ?? false,
    }

    const report = await prisma.workerDailyReport.upsert({
      where: {
        workerId_siteId_reportDate: {
          workerId: session.sub,
          siteId: d.siteId,
          reportDate,
        },
      },
      create: {
        workerId:       session.sub,
        siteId:         d.siteId,
        attendanceLogId: d.attendanceLogId ?? attendance.id,
        reportDate,
        employmentType: (d.employmentType as any) ?? 'DIRECT',
        jobTitle:       d.jobTitle ?? worker?.jobTitle ?? '미설정',
        ...shared,
      },
      update: shared,
      include: { site: { select: { id: true, name: true } } },
    })

    // 삭제된 사진 파일 정리 (비동기, 실패해도 저장 결과에 영향 없음)
    if (d.photos !== undefined && oldPhotos.length > 0) {
      const newSet = new Set(d.photos)
      const removed = oldPhotos.filter(p => !newSet.has(p))
      for (const photoPath of removed) {
        // 다른 일보에서 참조 중인지 확인
        const refCount = await prisma.workerDailyReport.count({
          where: { photos: { has: photoPath } },
        })
        if (refCount === 0) {
          // 경로 안전 검증
          if (!photoPath.includes('..') && photoPath.startsWith('daily-report-photos/')) {
            unlink(join(UPLOAD_DIR, photoPath)).catch((err) => {
              if (err.code !== 'ENOENT') console.error('[photo-cleanup]', photoPath, err)
            })
          }
        }
      }
    }

    return ok(report, '작업일보가 저장되었습니다.')
  } catch (err) {
    console.error('[worker/daily-reports POST]', err)
    return internalError()
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function calcConsecutiveDays(
  workerId: string, siteId: string, reportDate: Date,
  familyCode: string | null, tradeCode: string | null, taskCode: string | null,
  buildingName: string | null, floorLabel: string | null,
): Promise<number> {
  if (!taskCode && !tradeCode) return 1

  const thirtyDaysAgo = new Date(reportDate.getTime() - 30 * 24 * 60 * 60 * 1000)
  const prevReports = await prisma.workerDailyReport.findMany({
    where: {
      workerId, siteId,
      reportDate: { gte: thirtyDaysAgo, lt: reportDate },
    },
    select: {
      reportDate: true, tradeFamilyCode: true, tradeCode: true,
      taskCode: true, buildingName: true, floorLabel: true,
    },
    orderBy: { reportDate: 'desc' },
    take: 30,
  })

  let days = 1
  let prevDay = new Date(reportDate.getTime() - 24 * 60 * 60 * 1000)

  for (const r of prevReports) {
    const rDate = r.reportDate.toISOString().slice(0, 10)
    const pDate = prevDay.toISOString().slice(0, 10)
    if (rDate !== pDate) break

    const same = (
      r.tradeFamilyCode === familyCode &&
      r.tradeCode === tradeCode &&
      r.taskCode === taskCode &&
      r.buildingName === buildingName &&
      r.floorLabel === floorLabel
    )
    if (!same) break

    days++
    prevDay = new Date(prevDay.getTime() - 24 * 60 * 60 * 1000)
  }

  return days
}

async function calcManDays(
  workerId: string, reportDate: Date, todayManDays: number,
): Promise<{ monthlyManDays: number; totalManDays: number }> {
  const dateStr = reportDate.toISOString().slice(0, 10)
  const monthStart = kstDateStringToDate(dateStr.slice(0, 7) + '-01')

  const [monthAgg, totalAgg] = await Promise.all([
    prisma.workerDailyReport.aggregate({
      where: { workerId, reportDate: { gte: monthStart, lt: reportDate } },
      _sum: { todayManDays: true },
    }),
    prisma.workerDailyReport.aggregate({
      where: { workerId, reportDate: { lt: reportDate } },
      _sum: { todayManDays: true },
    }),
  ])

  return {
    monthlyManDays: Number(monthAgg._sum.todayManDays ?? 0) + todayManDays,
    totalManDays: Number(totalAgg._sum.todayManDays ?? 0) + todayManDays,
  }
}
