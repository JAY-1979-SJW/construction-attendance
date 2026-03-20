import { NextRequest } from 'next/server'
import { exceptionRequestSchema } from '@/lib/validators/attendance'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { kstDateStringToDate } from '@/lib/utils/date'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = exceptionRequestSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { siteId, workDate, reason, type } = parsed.data

    const workDateObj = kstDateStringToDate(workDate)

    // 해당 날짜 기록 조회 (없으면 신규)
    let log = await prisma.attendanceLog.findUnique({
      where: { workerId_siteId_workDate: { workerId: session.sub, siteId, workDate: workDateObj } },
    })

    if (log) {
      await prisma.attendanceLog.update({
        where: { id: log.id },
        data: {
          status: 'EXCEPTION',
          exceptionReason: `[${type}] ${reason}`,
        },
      })
    } else {
      // QR 없이 예외 신청 시 임시 기록 생성
      const site = await prisma.site.findUnique({ where: { id: siteId } })
      if (!site) return badRequest('현장을 찾을 수 없습니다.')

      log = await prisma.attendanceLog.create({
        data: {
          workerId: session.sub,
          siteId,
          workDate: workDateObj,
          qrToken: 'EXCEPTION',
          status: 'EXCEPTION',
          exceptionReason: `[${type}] ${reason}`,
        },
      })
    }

    return ok({ attendanceId: log.id }, '예외 처리 요청이 접수되었습니다. 관리자 승인 후 처리됩니다.')
  } catch (err) {
    console.error('[attendance/exception-request]', err)
    return internalError()
  }
}
