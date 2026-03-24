import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, created, badRequest, unauthorized } from '@/lib/utils/response'
import { generateRequestNo } from '@/lib/materials/request-service'

const CreateSchema = z.object({
  title:               z.string().min(1, '제목을 입력하세요.'),
  siteId:              z.string().optional(),
  notes:               z.string().optional(),
  deliveryRequestedAt: z.string().datetime().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { searchParams } = req.nextUrl
  const status   = searchParams.get('status') ?? ''
  const siteId   = searchParams.get('siteId') ?? ''
  const q        = searchParams.get('q') ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20', 10))

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (siteId) where.siteId = siteId
  if (q.trim()) {
    where.OR = [
      { title:     { contains: q, mode: 'insensitive' } },
      { requestNo: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [total, requests] = await Promise.all([
    prisma.materialRequest.count({ where }),
    prisma.materialRequest.findMany({
      where,
      select: {
        id:           true,
        requestNo:    true,
        title:        true,
        status:       true,
        requestedBy:  true,
        createdAt:    true,
        deliveryRequestedAt: true,
        site:         { select: { id: true, name: true } },
        _count:       { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
  ])

  return ok({ requests, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { title, siteId, notes, deliveryRequestedAt } = parsed.data
  const requestNo = await generateRequestNo()
  const id = randomUUID()

  const request = await prisma.$transaction(async (tx) => {
    const req = await tx.materialRequest.create({
      data: {
        id,
        requestNo,
        title,
        siteId:             siteId ?? null,
        requestedBy:        session.sub,
        notes:              notes ?? null,
        deliveryRequestedAt: deliveryRequestedAt ? new Date(deliveryRequestedAt) : null,
        status:             'DRAFT',
      },
    })
    await tx.materialRequestStatusHistory.create({
      data: {
        id:        randomUUID(),
        requestId: id,
        fromStatus: null,
        toStatus:   'DRAFT',
        actorId:    session.sub,
        actorType:  'ADMIN',
      },
    })
    return req
  })

  return created({ id: request.id, requestNo: request.requestNo })
}
