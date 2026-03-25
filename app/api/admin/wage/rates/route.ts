/**
 * GET  /api/admin/wage/rates?monthKey=YYYY-MM
 *   근로자별 현재 단가 목록 (최근 유효 계약 기준)
 *
 * PATCH /api/admin/wage/rates
 *   Body: { contractId: string, dailyWage: number }
 *   해당 계약의 일당 수정
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError, notFound } from '@/lib/utils/response'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const monthKey = searchParams.get('monthKey')
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return badRequest('monthKey(YYYY-MM) 파라미터가 필요합니다.')
    }

    const monthStart = `${monthKey}-01`
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)

    // 해당 월에 근무확정 기록이 있는 근로자
    const workers = await prisma.worker.findMany({
      where: {
        isActive: true,
        workConfirmations: {
          some: { monthKey },
        },
      },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        contracts: {
          where: {
            isActive: true,
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
          },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: { id: true, dailyWage: true, startDate: true, endDate: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const items = workers.map((w) => {
      const contract = w.contracts[0] ?? null
      return {
        workerId: w.id,
        workerName: w.name,
        jobTitle: w.jobTitle,
        contractId: contract?.id ?? null,
        dailyWage: contract?.dailyWage ?? 0,
        contractStartDate: contract?.startDate ?? null,
        contractEndDate: contract?.endDate ?? null,
        hasContract: !!contract,
      }
    })

    return ok({ items })
  } catch (err) {
    console.error('[wage/rates GET]', err)
    return internalError()
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const { contractId, dailyWage } = body

    if (!contractId || typeof contractId !== 'string') {
      return badRequest('contractId가 필요합니다.')
    }
    if (typeof dailyWage !== 'number' || dailyWage < 0) {
      return badRequest('dailyWage는 0 이상의 숫자여야 합니다.')
    }

    const contract = await prisma.workerContract.findUnique({
      where: { id: contractId },
      select: { id: true, workerId: true, dailyWage: true },
    })
    if (!contract) return notFound('계약서를 찾을 수 없습니다.')

    await prisma.workerContract.update({
      where: { id: contractId },
      data: { dailyWage },
    })

    return ok({ contractId, dailyWage })
  } catch (err) {
    console.error('[wage/rates PATCH]', err)
    return internalError()
  }
}
