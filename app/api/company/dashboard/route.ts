import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, internalError } from '@/lib/utils/response'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export async function GET() {
  try {
    let session
    try {
      session = await requireCompanyAdmin()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'UNAUTHORIZED') return unauthorized()
      if (msg === 'FORBIDDEN') return forbidden()
      throw e
    }

    const today = toKSTDateString()
    const todayDate = kstDateStringToDate(today)

    // 이 회사에 배정된 활성 근로자 ID 목록
    const assignments = await prisma.workerCompanyAssignment.findMany({
      where: { companyId: session.companyId, validTo: null },
      select: { workerId: true },
    })
    const companyWorkerIds = assignments.map((a) => a.workerId)

    const [totalWorkers, todayLogs, pendingDevices] = await Promise.all([
      // 활성 근로자 수
      prisma.worker.count({
        where: { id: { in: companyWorkerIds }, isActive: true },
      }),
      // 오늘 출근 로그 (ADJUSTED 제외)
      prisma.attendanceLog.findMany({
        where: {
          workerId: { in: companyWorkerIds },
          workDate: todayDate,
          status: { not: 'ADJUSTED' },
        },
        select: { status: true },
      }),
      // 기기 승인 대기 건수
      prisma.deviceChangeRequest.count({
        where: {
          workerId: { in: companyWorkerIds },
          status: 'PENDING',
        },
      }),
    ])

    const todayCheckedIn = todayLogs.length
    const todayCompleted = todayLogs.filter((l) => l.status === 'COMPLETED').length

    return ok({ totalWorkers, todayCheckedIn, todayCompleted, pendingDevices })
  } catch (err) {
    console.error('[company/dashboard GET]', err)
    return internalError()
  }
}
