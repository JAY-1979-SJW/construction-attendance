import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'

/**
 * GET /api/admin/worker-requests
 * 근로자 요청 목록 조회 (관리자용)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const url      = new URL(req.url)
    const status   = url.searchParams.get('status')
    const category = url.searchParams.get('category')
    const limit    = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const offset   = parseInt(url.searchParams.get('offset') ?? '0')

    const where: Record<string, unknown> = {}
    if (status)   where.status   = status
    if (category) where.category = category

    // COMPANY_ADMIN은 자기 회사 소속 근로자 요청만 조회
    if (session.role === 'COMPANY_ADMIN' && session.companyId) {
      where.companyId = session.companyId
    }

    const [requests, total] = await Promise.all([
      prisma.workerRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    offset,
        include: {
          worker: { select: { id: true, name: true, phone: true, jobTitle: true } },
        },
      }),
      prisma.workerRequest.count({ where }),
    ])

    return NextResponse.json({ requests, total })
  } catch (err) {
    console.error('[GET /api/admin/worker-requests]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
