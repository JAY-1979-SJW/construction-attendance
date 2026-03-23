import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

/**
 * GET /api/admin/devices
 * 전체 기기 목록 — isBlocked 포함, 차단 기기 탐지용
 * query: workerId?, isBlocked?('true'|'false'), page?
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const workerId  = searchParams.get('workerId') ?? undefined
    const isBlockedParam = searchParams.get('isBlocked')
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = 30

    const where = {
      ...(workerId  ? { workerId } : {}),
      ...(isBlockedParam === 'true'  ? { isBlocked: true }  : {}),
      ...(isBlockedParam === 'false' ? { isBlocked: false } : {}),
      isActive: true,
    }

    const [total, devices] = await Promise.all([
      prisma.workerDevice.count({ where }),
      prisma.workerDevice.findMany({
        where,
        include: {
          worker: { select: { id: true, name: true, phone: true, accountStatus: true } },
        },
        orderBy: [{ isBlocked: 'desc' }, { lastLoginAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return ok({
      items: devices.map(d => ({
        id: d.id,
        workerId: d.workerId,
        workerName: d.worker.name,
        workerPhone: d.worker.phone,
        workerStatus: d.worker.accountStatus,
        deviceToken: d.deviceToken.slice(0, 12) + '***',
        deviceName: d.deviceName,
        isPrimary: d.isPrimary,
        isBlocked: d.isBlocked,
        blockReason: d.blockReason,
        blockedAt: d.blockedAt,
        lastLoginAt: d.lastLoginAt,
        platform: d.platform,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('[admin/devices GET]', err)
    return internalError()
  }
}
