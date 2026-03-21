import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const monthKey = searchParams.get('monthKey')

  const closings = await prisma.monthClosing.findMany({
    where: monthKey ? { monthKey } : undefined,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ closings })
}
