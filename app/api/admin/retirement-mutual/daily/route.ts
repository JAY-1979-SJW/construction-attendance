import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const monthKey = searchParams.get('monthKey')
  const siteId = searchParams.get('siteId')
  const workerId = searchParams.get('workerId')

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  const records = await prisma.retirementMutualDailyRecord.findMany({
    where: {
      monthKey,
      ...(siteId ? { siteId } : {}),
      ...(workerId ? { workerId } : {}),
    },
    include: {
      worker: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
    orderBy: [{ workDate: 'asc' }, { workerId: 'asc' }],
  })

  return NextResponse.json({ records })
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, manualOverrideYn, manualOverrideReason, eligibleYn, excludedReason } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (manualOverrideYn && !manualOverrideReason) {
    return NextResponse.json({ error: '수동 보정 사유를 입력하세요.' }, { status: 400 })
  }

  const updated = await prisma.retirementMutualDailyRecord.update({
    where: { id },
    data: { manualOverrideYn, manualOverrideReason, eligibleYn, excludedReason },
  })

  return NextResponse.json({ record: updated })
}
