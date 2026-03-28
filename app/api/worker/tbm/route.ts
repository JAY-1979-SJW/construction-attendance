/**
 * GET  /api/worker/tbm — 오늘 TBM 조회 (배정 현장 기준)
 * POST /api/worker/tbm — TBM 참여 확인 (서명)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export async function GET(req: NextRequest) {
  const session = await getWorkerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workDate = toKSTDateString()
  const dateAsDate = kstDateStringToDate(workDate)

  // 근로자의 활성 배정 현장
  const assignments = await prisma.workerSiteAssignment.findMany({
    where: { workerId: session.sub, isActive: true },
    select: { siteId: true, site: { select: { id: true, name: true } } },
  })

  if (!assignments.length) {
    return NextResponse.json({ success: true, data: { tbmRecords: [], myReport: null } })
  }

  const siteIds = assignments.map(a => a.siteId)

  // 오늘 TBM 조회
  const tbmRecords = await prisma.siteTbmRecord.findMany({
    where: { siteId: { in: siteIds }, workDate: dateAsDate },
    select: {
      id: true, siteId: true, title: true, content: true,
      conductedAt: true, attendeeCount: true, notes: true,
      site: { select: { name: true } },
    },
  })

  // 내 일일보고의 TBM 확인 상태
  const myReport = await prisma.workerDailyReport.findFirst({
    where: { workerId: session.sub, reportDate: dateAsDate },
    select: { tbmConfirmedYn: true, tbmConfirmedAt: true, siteId: true },
  })

  return NextResponse.json({
    success: true,
    data: {
      workDate,
      tbmRecords: tbmRecords.map(t => ({
        id: t.id,
        siteId: t.siteId,
        siteName: t.site.name,
        title: t.title,
        content: t.content,
        conductedAt: t.conductedAt,
        attendeeCount: t.attendeeCount,
        notes: t.notes,
      })),
      myConfirmation: myReport ? {
        confirmed: myReport.tbmConfirmedYn,
        confirmedAt: myReport.tbmConfirmedAt,
      } : null,
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getWorkerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { siteId } = body

  if (!siteId) return NextResponse.json({ error: '현장 ID가 필요합니다.' }, { status: 400 })

  const workDate = toKSTDateString()
  const dateAsDate = kstDateStringToDate(workDate)

  // 일일보고 upsert + TBM 확인 처리
  await prisma.workerDailyReport.upsert({
    where: {
      workerId_siteId_reportDate: {
        workerId: session.sub,
        siteId,
        reportDate: dateAsDate,
      },
    },
    create: {
      workerId: session.sub,
      siteId,
      reportDate: dateAsDate,
      tbmConfirmedYn: true,
      tbmConfirmedAt: new Date(),
    },
    update: {
      tbmConfirmedYn: true,
      tbmConfirmedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, message: 'TBM 참여가 확인되었습니다.' })
}
