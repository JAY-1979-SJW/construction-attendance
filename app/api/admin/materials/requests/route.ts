import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, buildSiteScopeWhere } from '@/lib/auth/guards'
import { ok, created, badRequest, unauthorized } from '@/lib/utils/response'
import { generateRequestNo } from '@/lib/materials/request-service'

const CreateSchema = z.object({
  siteId:              z.string().optional(),
  notes:               z.string().optional(),
  deliveryRequestedAt: z.string().datetime().optional(),
  // 인라인 품목 (현장형 단일 등록)
  itemName:    z.string().min(1, '품목명을 입력하세요.'),
  spec:        z.string().optional(),
  requestedQty: z.number().positive('수량은 0보다 커야 합니다.'),
  unit:        z.string().optional(),
  useLocation: z.string().optional(),
  isUrgent:    z.boolean().default(false),
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

  // ── scope 강제: TEAM_LEADER/FOREMAN는 본인 신청만, 나머지는 site scope ──────
  const role = session.role ?? ''
  if (['TEAM_LEADER', 'FOREMAN'].includes(role)) {
    where.requestedBy = session.sub
  } else if (!['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER'].includes(role)) {
    const scope = await buildSiteScopeWhere(session)
    if (scope === false) return ok({ requests: [], total: 0, page: 1, pageSize, totalPages: 0 })
    if ((scope as Record<string, unknown>).siteId) where.siteId = (scope as Record<string, unknown>).siteId
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (status) where.status = status
  if (siteId && !['TEAM_LEADER', 'FOREMAN'].includes(role)) where.siteId = siteId
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
        id:               true,
        requestNo:        true,
        title:            true,
        status:           true,
        requestedBy:      true,
        requestedByName:  true,
        createdAt:        true,
        deliveryRequestedAt: true,
        site:             { select: { id: true, name: true } },
        items: {
          select: { itemName: true, spec: true, requestedQty: true, unit: true, isUrgent: true },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { items: true } },
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

  const { siteId, notes, deliveryRequestedAt, itemName, spec, requestedQty, unit, useLocation, isUrgent } = parsed.data
  const requestNo = await generateRequestNo()
  const requestId = randomUUID()

  // 제목은 품목명으로 자동 생성
  const title = `${itemName}${spec ? ` (${spec})` : ''} 자재 신청`

  const request = await prisma.$transaction(async (tx) => {
    const newReq = await tx.materialRequest.create({
      data: {
        id:                 requestId,
        requestNo,
        title,
        siteId:             siteId ?? null,
        requestedBy:        session.sub,
        requestedByName:    (session as { name?: string }).name ?? null,
        notes:              notes ?? null,
        deliveryRequestedAt: deliveryRequestedAt ? new Date(deliveryRequestedAt) : null,
        status:             'SUBMITTED', // 등록 즉시 요청 상태
        submittedAt:        new Date(),
      },
    })

    // 인라인 품목 생성
    await tx.materialRequestItem.create({
      data: {
        id:          randomUUID(),
        requestId,
        itemCode:    itemName.slice(0, 50),
        itemName,
        spec:        spec ?? null,
        unit:        unit ?? null,
        requestedQty: requestedQty,
        isUrgent,
        useLocation: useLocation ?? null,
      },
    })

    await tx.materialRequestStatusHistory.create({
      data: {
        id:         randomUUID(),
        requestId,
        fromStatus: null,
        toStatus:   'SUBMITTED',
        actorId:    session.sub,
        actorType:  'ADMIN',
      },
    })

    return newReq
  })

  return created({ id: request.id, requestNo: request.requestNo })
}
