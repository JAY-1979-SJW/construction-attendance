/**
 * GET  /api/admin/work-orders — 작업지시문 목록
 * POST /api/admin/work-orders — 작업지시문 발행
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const siteId = searchParams.get('siteId') || undefined
    const status = searchParams.get('status') || undefined
    const date = searchParams.get('date') || undefined

    const where: Record<string, unknown> = {}
    if (siteId) where.siteId = siteId
    if (status) where.status = status
    if (date) where.orderDate = kstDateStringToDate(date)

    const orders = await prisma.workOrder.findMany({
      where: where as any,
      include: {
        site: { select: { name: true } },
        acknowledgements: { select: { workerId: true, readAt: true, confirmedAt: true } },
        _count: { select: { acknowledgements: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return ok(orders)
  } catch (err) {
    console.error('[admin/work-orders GET]', err)
    return internalError()
  }
}

const createSchema = z.object({
  siteId: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  targetScope: z.enum(['ALL_SITE', 'SPECIFIC_TRADE', 'SPECIFIC_WORKER']).default('ALL_SITE'),
  targetWorkerId: z.string().optional(),
  targetTradeType: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const data = parsed.data
    const orderDate = kstDateStringToDate(toKSTDateString())

    const order = await prisma.workOrder.create({
      data: {
        siteId: data.siteId,
        orderDate,
        title: data.title,
        content: data.content,
        priority: data.priority,
        issuedById: session.sub,
        targetScope: data.targetScope,
        targetWorkerId: data.targetWorkerId ?? null,
        targetTradeType: data.targetTradeType ?? null,
        status: 'ISSUED',
      },
    })

    // 대상 근로자에게 알림 발송
    let targetWorkerIds: string[] = []
    if (data.targetScope === 'SPECIFIC_WORKER' && data.targetWorkerId) {
      targetWorkerIds = [data.targetWorkerId]
    } else {
      const assignments = await prisma.workerSiteAssignment.findMany({
        where: {
          siteId: data.siteId,
          isActive: true,
          ...(data.targetScope === 'SPECIFIC_TRADE' && data.targetTradeType
            ? { tradeType: data.targetTradeType }
            : {}),
        },
        select: { workerId: true },
      })
      targetWorkerIds = assignments.map(a => a.workerId)
    }

    // 알림 일괄 생성
    if (targetWorkerIds.length > 0) {
      const PRIORITY_LABEL: Record<string, string> = { LOW: '', NORMAL: '', HIGH: '[중요] ', URGENT: '[긴급] ' }
      await prisma.workerNotification.createMany({
        data: targetWorkerIds.map(wid => ({
          workerId: wid,
          type: 'WORK_ORDER',
          title: `${PRIORITY_LABEL[data.priority] || ''}작업지시: ${data.title}`,
          body: data.content.slice(0, 200),
          linkUrl: `/work-orders`,
          referenceId: order.id,
        })),
        skipDuplicates: true,
      })
    }

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'WORK_ORDER_ISSUED',
      targetType: 'WorkOrder',
      targetId: order.id,
      description: `작업지시 발행: ${data.title} (대상: ${targetWorkerIds.length}명)`,
    })

    return created({ id: order.id, targetCount: targetWorkerIds.length }, '작업지시가 발행되었습니다.')
  } catch (err) {
    console.error('[admin/work-orders POST]', err)
    return internalError()
  }
}
