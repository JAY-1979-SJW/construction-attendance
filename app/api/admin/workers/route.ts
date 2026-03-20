import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().regex(/^010\d{8}$/),
  company: z.string().min(1),
  jobTitle: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10)

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { company: { contains: search } },
          ],
        }
      : {}

    const [total, workers] = await Promise.all([
      prisma.worker.count({ where }),
      prisma.worker.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { devices: { where: { isActive: true } } } } },
      }),
    ])

    return ok({
      items: workers.map((w) => ({
        id: w.id,
        name: w.name,
        phone: w.phone,
        company: w.company,
        jobTitle: w.jobTitle,
        isActive: w.isActive,
        deviceCount: w._count.devices,
        createdAt: w.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('[admin/workers GET]', err)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { name, phone, company, jobTitle } = parsed.data

    const existing = await prisma.worker.findUnique({ where: { phone } })
    if (existing) return badRequest('이미 등록된 휴대폰 번호입니다.')

    const worker = await prisma.worker.create({ data: { name, phone, company, jobTitle } })

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'REGISTER_WORKER',
      targetType: 'Worker',
      targetId: worker.id,
      description: `근로자 등록: ${name} (${phone})`,
    })

    return created({ id: worker.id }, '근로자가 등록되었습니다.')
  } catch (err) {
    console.error('[admin/workers POST]', err)
    return internalError()
  }
}
