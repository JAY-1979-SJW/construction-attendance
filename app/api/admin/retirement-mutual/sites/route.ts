import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const sites = await prisma.retirementMutualSite.findMany({
      include: { site: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return ok({ items: sites })
  } catch (err) {
    console.error('[retirement-mutual/sites GET]', err)
    return internalError()
  }
}
