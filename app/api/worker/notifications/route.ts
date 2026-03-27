/**
 * GET  /api/worker/notifications — 근로자 본인 알림 목록
 * POST /api/worker/notifications — 알림 읽음 처리 { ids: string[] }
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const notifications = await prisma.workerNotification.findMany({
      where: {
        workerId: session.sub,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await prisma.workerNotification.count({
      where: { workerId: session.sub, isRead: false },
    })

    return ok({ items: notifications, unreadCount })
  } catch (err) {
    console.error('[worker/notifications GET]', err)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const ids = body.ids as string[]
    if (!Array.isArray(ids) || ids.length === 0) return badRequest('ids 필수')

    await prisma.workerNotification.updateMany({
      where: { id: { in: ids }, workerId: session.sub },
      data: { isRead: true, readAt: new Date() },
    })

    return ok({ updated: ids.length })
  } catch (err) {
    console.error('[worker/notifications POST]', err)
    return internalError()
  }
}
