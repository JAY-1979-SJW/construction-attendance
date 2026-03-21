import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const workerId = searchParams.get('workerId')

  const items = await prisma.onboardingChecklist.findMany({
    where: {
      ...(status ? { status } : { status: 'PENDING' }),
      ...(workerId ? { workerId } : {}),
    },
    include: {
      worker: { select: { id: true, name: true, company: true } },
      site: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ items, total: items.length })
}
