/**
 * GET  /api/worker/work-orders — 내 작업지시 목록
 * POST /api/worker/work-orders — 작업지시 수신 확인
 */
import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await getWorkerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 내 배정 현장
  const assignments = await prisma.workerSiteAssignment.findMany({
    where: { workerId: session.sub, isActive: true },
    select: { siteId: true, tradeType: true },
  })
  if (!assignments.length) {
    return NextResponse.json({ success: true, data: [] })
  }

  const siteIds = assignments.map(a => a.siteId)
  const tradeTypes = assignments.map(a => a.tradeType).filter(Boolean)

  // 나에게 해당되는 작업지시 조회
  const orders = await prisma.workOrder.findMany({
    where: {
      siteId: { in: siteIds },
      status: 'ISSUED',
      OR: [
        { targetScope: 'ALL_SITE' },
        { targetScope: 'SPECIFIC_WORKER', targetWorkerId: session.sub },
        ...(tradeTypes.length > 0
          ? [{ targetScope: 'SPECIFIC_TRADE' as const, targetTradeType: { in: tradeTypes as string[] } }]
          : []),
      ],
    },
    include: {
      site: { select: { name: true } },
      acknowledgements: {
        where: { workerId: session.sub },
        select: { readAt: true, confirmedAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({
    success: true,
    data: orders.map(o => ({
      id: o.id,
      siteId: o.siteId,
      siteName: o.site.name,
      orderDate: o.orderDate,
      title: o.title,
      content: o.content,
      priority: o.priority,
      targetScope: o.targetScope,
      createdAt: o.createdAt,
      myAck: o.acknowledgements[0] ?? null,
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = await getWorkerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { workOrderId } = body
  if (!workOrderId) return NextResponse.json({ error: '작업지시 ID가 필요합니다.' }, { status: 400 })

  await prisma.workOrderAck.upsert({
    where: { workOrderId_workerId: { workOrderId, workerId: session.sub } },
    create: { workOrderId, workerId: session.sub, confirmedAt: new Date() },
    update: { confirmedAt: new Date() },
  })

  return NextResponse.json({ success: true, message: '작업지시를 확인했습니다.' })
}
