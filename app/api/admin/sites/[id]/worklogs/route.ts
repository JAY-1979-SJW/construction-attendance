/**
 * GET  /api/admin/sites/[id]/worklogs          — 작업일보 목록 또는 날짜별 단건 조회
 * POST /api/admin/sites/[id]/worklogs          — 작업일보 생성/수정 (upsert)
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { SiteWorkLogStatus } from '@prisma/client'

const upsertSchema = z.object({
  workDate:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // 운영 요약
  summaryText:            z.string().nullable().optional(),
  majorWorkText:          z.string().nullable().optional(),
  issueText:              z.string().nullable().optional(),
  // TBM 요약
  tbmSummaryText:         z.string().nullable().optional(),
  // 안전 요약
  safetySummaryText:      z.string().nullable().optional(),
  safetyHazardText:       z.string().nullable().optional(),
  safetyActionText:       z.string().nullable().optional(),
  safetyIncidentOccurred: z.boolean().optional(),
  safetyCorrectionNeeded: z.boolean().optional(),
  safetyCorrectionDone:   z.boolean().optional(),
  // 검측·자재 (2차 확장용, 현재도 저장 가능)
  inspectionSummaryText:  z.string().nullable().optional(),
  materialSummaryText:    z.string().nullable().optional(),
  // 관리자 전용
  memoInternal:           z.string().nullable().optional(),
  status:                 z.nativeEnum(SiteWorkLogStatus).optional(),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params
    if (!await canAccessSite(session, id)) return siteAccessDenied()

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const { searchParams } = req.nextUrl
    const date   = searchParams.get('date')   // YYYY-MM-DD — 단건 조회
    const status = searchParams.get('status') as SiteWorkLogStatus | null
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '60'), 180)

    if (date) {
      // 특정 날짜 단건 — TBM 기록 + 출근 요약도 함께
      const workLog = await prisma.siteWorkLog.findUnique({
        where:   { siteId_workDate: { siteId: id, workDate: new Date(date) } },
        include: { summary: true },
      })
      if (!workLog) return notFound('해당 날짜의 작업일보가 없습니다.')

      // TBM 기록
      const tbmRecords = await prisma.siteTbmRecord.findMany({
        where:   { siteId: id, workDate: new Date(date) },
        orderBy: { conductedAt: 'asc' },
      })

      // 경고 집계
      const warnings = await buildWarnings(id, date, workLog.status)

      // ── 인원 누계 계산 ──────────────────────────────────────
      const targetDate = new Date(date)
      const yesterday = new Date(targetDate)
      yesterday.setDate(yesterday.getDate() - 1)
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)

      // 전일 인원
      const yesterdaySummary = await prisma.siteWorkLogSummary.findUnique({
        where: { siteId_workDate: { siteId: id, workDate: yesterday } },
        select: { totalPresentCount: true },
      })

      // 월 누계 (이번 달 1일~오늘까지 합계)
      const monthlyAgg = await prisma.siteWorkLogSummary.aggregate({
        where: { siteId: id, workDate: { gte: monthStart, lte: targetDate } },
        _sum: { totalPresentCount: true },
      })

      // 총 누계 (전체 기간)
      const totalAgg = await prisma.siteWorkLogSummary.aggregate({
        where: { siteId: id, workDate: { lte: targetDate } },
        _sum: { totalPresentCount: true },
      })

      const manpowerStats = {
        yesterday: yesterdaySummary?.totalPresentCount ?? 0,
        today: workLog.summary?.totalPresentCount ?? 0,
        monthlyCumulative: monthlyAgg._sum.totalPresentCount ?? 0,
        totalCumulative: totalAgg._sum.totalPresentCount ?? 0,
      }

      return ok({ workLog, tbmRecords, warnings, manpowerStats })
    }

    // 목록 조회 (memoInternal 제외)
    const workLogs = await prisma.siteWorkLog.findMany({
      where: {
        siteId: id,
        ...(status ? { status } : {}),
      },
      select: {
        id:          true,
        siteId:      true,
        workDate:    true,
        status:      true,
        writtenById: true,
        safetyIncidentOccurred: true,
        safetyCorrectionNeeded: true,
        safetyCorrectionDone:   true,
        summaryText:      true,
        majorWorkText:    true,
        createdAt:   true,
        updatedAt:   true,
        summary:     true,
      },
      orderBy: { workDate: 'desc' },
      take:    limit,
    })

    return ok({ workLogs })
  } catch (err) {
    console.error('[sites/[id]/worklogs GET]', err)
    return internalError()
  }
}

// ─── POST (upsert) ───────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const { id } = await params
    if (!await canAccessSite(session, id)) return siteAccessDenied()

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const d = parsed.data
    const workDate = new Date(d.workDate)

    const workLog = await prisma.siteWorkLog.upsert({
      where:  { siteId_workDate: { siteId: id, workDate } },
      create: {
        siteId:               id,
        workDate,
        writtenById:          session.sub,
        summaryText:          d.summaryText          ?? null,
        majorWorkText:        d.majorWorkText        ?? null,
        issueText:            d.issueText            ?? null,
        tbmSummaryText:       d.tbmSummaryText       ?? null,
        safetySummaryText:    d.safetySummaryText    ?? null,
        safetyHazardText:     d.safetyHazardText     ?? null,
        safetyActionText:     d.safetyActionText     ?? null,
        safetyIncidentOccurred: d.safetyIncidentOccurred ?? false,
        safetyCorrectionNeeded: d.safetyCorrectionNeeded ?? false,
        safetyCorrectionDone:   d.safetyCorrectionDone   ?? false,
        inspectionSummaryText: d.inspectionSummaryText ?? null,
        materialSummaryText:  d.materialSummaryText  ?? null,
        memoInternal:         d.memoInternal         ?? null,
        status:               d.status               ?? 'DRAFT',
      },
      update: buildUpdatePayload(d),
      include: { summary: true },
    })

    const tbmRecords = await prisma.siteTbmRecord.findMany({
      where: { siteId: id, workDate },
      orderBy: { conductedAt: 'asc' },
    })

    const warnings = await buildWarnings(id, d.workDate, workLog.status)

    return ok({ workLog, tbmRecords, warnings }, '작업일보가 저장되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/worklogs POST]', err)
    return internalError()
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type UpsertData = z.infer<typeof upsertSchema>

function buildUpdatePayload(d: Partial<UpsertData>) {
  const set = <T>(v: T | undefined) => v !== undefined ? v : undefined
  return Object.fromEntries(
    Object.entries({
      summaryText:            set(d.summaryText),
      majorWorkText:          set(d.majorWorkText),
      issueText:              set(d.issueText),
      tbmSummaryText:         set(d.tbmSummaryText),
      safetySummaryText:      set(d.safetySummaryText),
      safetyHazardText:       set(d.safetyHazardText),
      safetyActionText:       set(d.safetyActionText),
      safetyIncidentOccurred: set(d.safetyIncidentOccurred),
      safetyCorrectionNeeded: set(d.safetyCorrectionNeeded),
      safetyCorrectionDone:   set(d.safetyCorrectionDone),
      inspectionSummaryText:  set(d.inspectionSummaryText),
      materialSummaryText:    set(d.materialSummaryText),
      memoInternal:           set(d.memoInternal),
      status:                 set(d.status),
    }).filter(([, v]) => v !== undefined)
  )
}

async function buildWarnings(siteId: string, dateStr: string, wlStatus: string) {
  const date = new Date(dateStr)
  const warnings: string[] = []

  // 출근자 있는데 작업일보 미작성
  if (wlStatus === 'DRAFT') {
    const presentCount = await prisma.siteDailyWorkerStatus.count({
      where: { siteId, workDate: date, attendanceStatus: 'PRESENT' },
    })
    if (presentCount > 0) {
      warnings.push(`출근 인원 ${presentCount}명 — 작업일보 미제출 상태입니다.`)
    }
  }

  // TBM 미참석자
  const tbmAbsent = await prisma.siteDailyWorkerStatus.count({
    where: { siteId, workDate: date, tbmStatus: 'NOT_ATTENDED' },
  })
  if (tbmAbsent > 0) warnings.push(`TBM 미참석 인원 ${tbmAbsent}명`)

  // 안전확인 누락
  const safetyMissing = await prisma.siteDailyWorkerStatus.count({
    where: { siteId, workDate: date, safetyCheckStatus: 'NOT_COMPLETED' },
  })
  if (safetyMissing > 0) warnings.push(`안전확인 미완료 인원 ${safetyMissing}명`)

  // 체크아웃 누락 (출근했는데 퇴근 시각 없음)
  const checkoutMissing = await prisma.siteDailyWorkerStatus.count({
    where: {
      siteId, workDate: date,
      attendanceStatus: 'PRESENT',
      checkOutAt: null,
    },
  })
  if (checkoutMissing > 0) warnings.push(`체크아웃 누락 ${checkoutMissing}명`)

  return warnings
}
