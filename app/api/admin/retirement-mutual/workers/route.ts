import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const workers = await prisma.retirementMutualWorker.findMany({
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return ok({ items: workers })
  } catch (err) {
    console.error('[retirement-mutual/workers GET]', err)
    return internalError()
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { workerId, enabledYn, startDate, endDate, reason } = body

  if (!workerId || !startDate) return NextResponse.json({ error: 'workerId and startDate required' }, { status: 400 })

  const record = await prisma.retirementMutualWorker.create({
    data: { workerId, enabledYn: enabledYn ?? true, startDate, endDate, reason },
  })

  return NextResponse.json({ worker: record }, { status: 201 })
}
