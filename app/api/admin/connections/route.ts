/**
 * GET /api/admin/connections
 * 최고관리자용 — 관리자/근로자 최근 접속 현황
 * query: tab=admin|worker, page?
 */
import { NextRequest } from 'next/server'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY, unauthorized } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, internalError } from '@/lib/utils/response'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const { searchParams } = new URL(req.url)
    const tab  = searchParams.get('tab') ?? 'admin'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

    if (tab === 'worker') {
      const [total, devices] = await Promise.all([
        prisma.workerDevice.count({ where: { isActive: true } }),
        prisma.workerDevice.findMany({
          where:   { isActive: true },
          include: { worker: { select: { id: true, name: true, phone: true, accountStatus: true } } },
          orderBy: { lastLoginAt: 'desc' },
          skip:    (page - 1) * PAGE_SIZE,
          take:    PAGE_SIZE,
        }),
      ])

      return ok({
        tab:   'worker',
        total,
        page,
        pageSize: PAGE_SIZE,
        items: devices.map(d => ({
          id:           d.id,
          workerId:     d.workerId,
          workerName:   d.worker.name,
          workerPhone:  d.worker.phone,
          workerStatus: d.worker.accountStatus,
          deviceName:   d.deviceName,
          platform:     d.platform,
          isPrimary:    d.isPrimary,
          isBlocked:    d.isBlocked,
          blockReason:  d.blockReason,
          lastLoginAt:  d.lastLoginAt?.toISOString() ?? null,
        })),
      })
    }

    // tab === 'admin'
    const [total, users] = await Promise.all([
      prisma.adminUser.count(),
      prisma.adminUser.findMany({
        include: { company: { select: { companyName: true } } },
        orderBy: { lastLoginAt: 'desc' },
        skip:    (page - 1) * PAGE_SIZE,
        take:    PAGE_SIZE,
      }),
    ])

    return ok({
      tab:   'admin',
      total,
      page,
      pageSize: PAGE_SIZE,
      items: users.map(u => ({
        id:          u.id,
        name:        u.name,
        email:       u.email,
        role:        u.role,
        companyName: u.company?.companyName ?? null,
        isActive:    u.isActive,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt:   u.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[connections GET]', err)
    return internalError()
  }
}
