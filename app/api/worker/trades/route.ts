/**
 * GET /api/worker/trades — 근로자용 공종 계열 + 세부공종 + 작업사항 목록
 *
 * query: familyCode (선택) — 특정 계열만 필터
 */
import { NextRequest } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const familyCode = req.nextUrl.searchParams.get('familyCode')

    const families = await prisma.tradeFamilyMaster.findMany({
      where: {
        isActive: true,
        ...(familyCode ? { code: familyCode } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        label: true,
        trades: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, code: true, label: true },
        },
        tasks: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, code: true, label: true, tradeId: true },
        },
      },
    })

    return ok(families)
  } catch (err) {
    console.error('[worker/trades GET]', err)
    return internalError()
  }
}
