/**
 * GET /api/admin/trade-masters — 공종 계열 + 세부 공종 + 작업사항 전체 조회
 *
 * 계열 → 공종 → 작업사항 트리 구조로 반환
 */
import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const families = await prisma.tradeFamilyMaster.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        trades: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        tasks: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return ok(families)
  } catch (err) {
    console.error('[admin/trade-masters GET]', err)
    return internalError()
  }
}
