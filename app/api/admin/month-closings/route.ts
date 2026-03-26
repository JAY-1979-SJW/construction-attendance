import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const monthKey = searchParams.get('monthKey')

    const closings = await prisma.monthClosing.findMany({
      where: monthKey ? { monthKey } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    return ok({ closings })
  } catch (err) {
    console.error('[month-closings/GET]', err)
    return internalError()
  }
}
