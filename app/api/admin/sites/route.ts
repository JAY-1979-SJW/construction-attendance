import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { generateQrToken } from '@/lib/qr/qr-token'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  allowedRadius: z.number().int().min(10).max(5000).default(100),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const sites = await prisma.site.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    return ok(sites)
  } catch (err) {
    console.error('[admin/sites GET]', err)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const qrToken = generateQrToken()
    const site = await prisma.site.create({
      data: { ...parsed.data, qrToken },
    })

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'CREATE_SITE',
      targetType: 'Site',
      targetId: site.id,
      description: `현장 등록: ${site.name}`,
    })

    return created({ id: site.id, qrToken }, '현장이 등록되었습니다.')
  } catch (err) {
    console.error('[admin/sites POST]', err)
    return internalError()
  }
}
