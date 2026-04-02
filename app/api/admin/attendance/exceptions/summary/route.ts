/**
 * GET /api/admin/attendance/exceptions/summary
 * 출퇴근 이상 자동 탐지 요약 집계
 *
 * 탐지 대상:
 *  1. 출근만 있고 퇴근 없음 (MISSING_CHECKOUT, 당일 제외)
 *  2. 지오펜스 밖 출근 (checkInWithinRadius = false)
 *  3. 사진 누락 (CHECK_IN 사진 없음)
 *  4. 비정상 장시간 근무 (12시간 이상)
 *  5. 재실확인 미응답 (PresenceCheck NO_RESPONSE/MISSED)
 *
 * 쿼리: dateFrom, dateTo (기본 최근 7일)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { searchParams } = new URL(req.url)
    const today = toKSTDateString()

    // 기본 최근 7일
    const dateTo = searchParams.get('dateTo') ?? today
    const dateFromDefault = new Date(new Date(dateTo).getTime() - 6 * 86_400_000)
    const dateFrom = searchParams.get('dateFrom') ?? dateFromDefault.toISOString().slice(0, 10)

    const dateGte = kstDateStringToDate(dateFrom)
    const dateLte = kstDateStringToDate(dateTo)
    const todayDate = kstDateStringToDate(today)

    // 1. 퇴근 누락 (MISSING_CHECKOUT, 당일 제외)
    const missingCheckout = await prisma.attendanceLog.findMany({
      where: {
        status: 'MISSING_CHECKOUT',
        workDate: { gte: dateGte, lt: todayDate },
      },
      include: {
        worker: { select: { name: true, phone: true } },
        checkInSite: { select: { id: true, name: true } },
      },
      orderBy: { workDate: 'desc' },
      take: 50,
    })

    // 2. 지오펜스 밖 출근
    const outsideGeofence = await prisma.attendanceLog.findMany({
      where: {
        workDate: { gte: dateGte, lte: dateLte },
        checkInWithinRadius: false,
      },
      include: {
        worker: { select: { name: true, phone: true } },
        checkInSite: { select: { id: true, name: true } },
      },
      orderBy: { workDate: 'desc' },
      take: 50,
    })

    // 3. 사진 누락 — 해당 기간 출근 로그 중 CHECK_IN 사진이 없는 건
    const logsInRange = await prisma.attendanceLog.findMany({
      where: {
        workDate: { gte: dateGte, lte: dateLte },
        status: { in: ['WORKING', 'COMPLETED', 'ADJUSTED', 'ADMIN_MANUAL'] },
      },
      select: { id: true, workerId: true, siteId: true, workDate: true },
    })
    const logIdsInRange = logsInRange.map(l => l.id)
    const photosExist = logIdsInRange.length > 0
      ? await prisma.attendancePhotoEvidence.findMany({
          where: {
            attendanceLogId: { in: logIdsInRange },
            photoType: 'CHECK_IN',
          },
          select: { attendanceLogId: true },
        })
      : []
    const hasPhotoSet = new Set(photosExist.map(p => p.attendanceLogId))
    const missingPhotoLogIds = logIdsInRange.filter(id => !hasPhotoSet.has(id))
    const missingPhotoLogs = missingPhotoLogIds.length > 0
      ? await prisma.attendanceLog.findMany({
          where: { id: { in: missingPhotoLogIds.slice(0, 50) } },
          include: {
            worker: { select: { name: true, phone: true } },
            checkInSite: { select: { id: true, name: true } },
          },
          orderBy: { workDate: 'desc' },
        })
      : []

    // 4. 비정상 장시간 근무 (12시간 = 720분 이상)
    const longShiftLogs = await prisma.attendanceLog.findMany({
      where: {
        workDate: { gte: dateGte, lte: dateLte },
        checkInAt: { not: null },
        checkOutAt: { not: null },
        status: { in: ['COMPLETED', 'ADJUSTED'] },
      },
      include: {
        worker: { select: { name: true, phone: true } },
        checkInSite: { select: { id: true, name: true } },
      },
      orderBy: { workDate: 'desc' },
    })
    const longShift = longShiftLogs.filter(l => {
      if (!l.checkInAt || !l.checkOutAt) return false
      const diff = (l.checkOutAt.getTime() - l.checkInAt.getTime()) / 60000
      return diff >= 720
    }).slice(0, 50)

    // 5. 재실확인 미응답
    const presenceMissed = await prisma.presenceCheck.findMany({
      where: {
        checkDate: { gte: dateFrom, lte: dateTo },
        status: { in: ['NO_RESPONSE', 'MISSED'] },
      },
      include: {
        worker: { select: { name: true, phone: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    })

    // 요약 집계
    const summary = {
      missingCheckout: missingCheckout.length,
      outsideGeofence: outsideGeofence.length,
      missingPhoto: missingPhotoLogIds.length,
      longShift: longShift.length,
      presenceMissed: presenceMissed.length,
      total: missingCheckout.length + outsideGeofence.length + missingPhotoLogIds.length + longShift.length + presenceMissed.length,
      dateFrom,
      dateTo,
    }

    // 항목별 상세 (최대 10건씩)
    const fmt = (l: { id: string; workDate: Date; checkInAt: Date | null; checkOutAt: Date | null; worker: { name: string; phone: string | null }; checkInSite: { id: string; name: string } }) => ({
      id: l.id,
      workerName: l.worker.name,
      workerPhone: l.worker.phone ?? '',
      siteName: l.checkInSite.name,
      siteId: l.checkInSite.id,
      workDate: l.workDate.toISOString().slice(0, 10),
      checkInAt: l.checkInAt?.toISOString() ?? null,
      checkOutAt: l.checkOutAt?.toISOString() ?? null,
    })

    return NextResponse.json({
      success: true,
      summary,
      details: {
        missingCheckout: missingCheckout.slice(0, 10).map(fmt),
        outsideGeofence: outsideGeofence.slice(0, 10).map(fmt),
        missingPhoto: missingPhotoLogs.slice(0, 10).map(fmt),
        longShift: longShift.slice(0, 10).map(l => ({
          ...fmt(l),
          workedMinutes: l.checkInAt && l.checkOutAt
            ? Math.floor((l.checkOutAt.getTime() - l.checkInAt.getTime()) / 60000)
            : null,
        })),
        presenceMissed: presenceMissed.slice(0, 10).map(p => ({
          id: p.id,
          workerName: p.worker.name,
          workerPhone: p.worker.phone,
          siteName: p.site.name,
          siteId: p.site.id,
          checkDate: p.checkDate,
          scheduledAt: p.scheduledAt.toISOString(),
          status: p.status,
        })),
      },
    })
  } catch (err) {
    console.error('[GET /attendance/exceptions/summary]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
