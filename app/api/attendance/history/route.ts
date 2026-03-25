/**
 * GET /api/attendance/history?days=7
 *
 * 근로자 본인의 최근 출퇴근 기록
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
    const daysParam = searchParams.get('days') ?? '7'
    const days = parseInt(daysParam, 10)
    if (isNaN(days) || days < 1 || days > 90) {
      return badRequest('days는 1~90 사이 숫자여야 합니다.')
    }

    // KST 기준 days일 전부터 오늘까지
    const todayKst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
    const fromDate = new Date(Date.now() + 9 * 3600000 - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10)

    const logs = await prisma.attendanceLog.findMany({
      where: {
        workerId,
        workDate: {
          gte: new Date(fromDate),
          lte: new Date(todayKst),
        },
      },
      include: {
        checkInSite: { select: { id: true, name: true } },
      },
      orderBy: { workDate: 'desc' },
    })

    const items = logs.map((log) => ({
      workDate: log.workDate.toISOString().slice(0, 10),
      siteName: log.checkInSite.name,
      checkInAt: log.checkInAt ? log.checkInAt.toISOString() : null,
      checkOutAt: log.checkOutAt ? log.checkOutAt.toISOString() : null,
      status: log.status,
      exceptionReason: log.exceptionReason ?? null,
    }))

    return ok({ items })
  } catch (err) {
    console.error('[attendance/history]', err)
    return internalError()
  }
}
