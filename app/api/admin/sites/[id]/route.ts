import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  internalError,
} from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  allowedRadius: z.number().int().min(10).max(5000).optional(),
  isActive: z.boolean().optional(),
})

// ─── PATCH /api/admin/sites/[id] — 현장 정보 수정 / 활성화 전환 ──────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    if (session.role === 'VIEWER') return forbidden('수정 권한이 없습니다.')

    const { id } = await params

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    if (Object.keys(parsed.data).length === 0) {
      return badRequest('수정할 항목이 없습니다.')
    }

    const site = await prisma.site.findUnique({ where: { id } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const updated = await prisma.site.update({
      where: { id },
      data: parsed.data,
    })

    const changedKeys = Object.keys(parsed.data).join(', ')
    await writeAuditLog({
      adminId: session.sub,
      actionType: 'UPDATE_SITE',
      targetType: 'Site',
      targetId: id,
      description: `현장 수정: ${updated.name} | 변경항목: ${changedKeys}`,
    })

    return ok(
      {
        id: updated.id,
        name: updated.name,
        address: updated.address,
        latitude: updated.latitude,
        longitude: updated.longitude,
        allowedRadius: updated.allowedRadius,
        isActive: updated.isActive,
        qrToken: updated.qrToken,
        updatedAt: updated.updatedAt,
      },
      '현장 정보가 수정되었습니다.'
    )
  } catch (err) {
    console.error('[admin/sites/[id] PATCH]', err)
    return internalError()
  }
}
