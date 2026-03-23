/**
 * GET /api/admin/attendance/exceptions
 * 출퇴근 예외/누락 처리 센터 — EXCEPTION + MISSING_CHECKOUT 통합 조회
 *
 * 권한: ADMIN 이상
 * 쿼리 파라미터:
 *  - type: 'EXCEPTION' | 'MISSING_CHECKOUT' | 'ALL' (기본: ALL)
 *  - page: 페이지 번호 (기본: 1)
 *  - pageSize: 페이지 크기 (기본: 30)
 *  - siteId: 현장 필터
 *  - dateFrom / dateTo: 날짜 필터 (YYYY-MM-DD)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'
import { kstDateStringToDate, toKSTDateString } from '@/lib/utils/date'
import { AttendanceStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { searchParams } = new URL(req.url)
    const type     = searchParams.get('type') ?? 'ALL'
    const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1',  10))
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '30', 10))
    const siteId   = searchParams.get('siteId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo   = searchParams.get('dateTo')

    const today = kstDateStringToDate(toKSTDateString())

    // 상태 필터
    let statusFilter: AttendanceStatus[]
    if (type === 'EXCEPTION')        statusFilter = ['EXCEPTION']
    else if (type === 'MISSING_CHECKOUT') statusFilter = ['MISSING_CHECKOUT']
    else                             statusFilter = ['EXCEPTION', 'MISSING_CHECKOUT']

    // 날짜 필터
    const workDateFilter: { gte?: Date; lte?: Date; lt?: Date } = {}
    if (dateFrom) workDateFilter.gte = kstDateStringToDate(dateFrom)
    if (dateTo)   workDateFilter.lte = kstDateStringToDate(dateTo)
    // MISSING_CHECKOUT: 당일 제외 (당일은 아직 근무 중일 수 있음)
    else if (type === 'MISSING_CHECKOUT' || type === 'ALL') {
      workDateFilter.lt = today
    }

    const where = {
      status: { in: statusFilter },
      ...(Object.keys(workDateFilter).length > 0 ? { workDate: workDateFilter } : {}),
      ...(siteId ? { siteId } : {}),
    }

    const [total, items] = await Promise.all([
      prisma.attendanceLog.count({ where }),
      prisma.attendanceLog.findMany({
        where,
        include: {
          worker:      { select: { id: true, name: true, phone: true } },
          checkInSite: { select: { id: true, name: true } },
        },
        orderBy: [{ workDate: 'asc' }, { checkInAt: 'asc' }],
        skip:  (page - 1) * pageSize,
        take:  pageSize,
      }),
    ])

    return NextResponse.json({
      success: true,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      items: items.map(l => ({
        id:              l.id,
        workerId:        l.workerId,
        workerName:      l.worker.name,
        workerPhone:     l.worker.phone,
        company:         l.companyNameSnapshot ?? '',
        siteId:          l.siteId,
        siteName:        l.checkInSite.name,
        workDate:        l.workDate.toISOString().slice(0, 10),
        checkInAt:       l.checkInAt?.toISOString()  ?? null,
        checkOutAt:      l.checkOutAt?.toISOString() ?? null,
        status:          l.status,
        exceptionReason: l.exceptionReason ?? null,
        adminNote:       l.adminNote       ?? null,
        daysBehind:      Math.floor((today.getTime() - l.workDate.getTime()) / 86_400_000),
      })),
    })
  } catch (err) {
    console.error('[GET /attendance/exceptions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
