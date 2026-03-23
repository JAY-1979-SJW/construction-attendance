import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'

/**
 * GET /api/admin/site-join-requests
 * 현장 참여 신청 목록.
 * 쿼리: status=PENDING|APPROVED|REJECTED, siteId, companyId
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'PENDING'
    const siteId = searchParams.get('siteId') ?? undefined
    const companyId = searchParams.get('companyId') ?? undefined
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)
    const skip = (page - 1) * limit

    // COMPANY_ADMIN은 자기 companyId 범위만
    const scopedCompanyId = session.role === 'COMPANY_ADMIN'
      ? (session.companyId ?? undefined)
      : (companyId ?? undefined)

    const where = {
      status: status as 'PENDING' | 'APPROVED' | 'REJECTED',
      ...(siteId && { siteId }),
      ...(scopedCompanyId && { companyId: scopedCompanyId }),
    }

    const [requests, total] = await Promise.all([
      prisma.siteJoinRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
        include: {
          worker: { select: { id: true, name: true, phone: true, jobTitle: true } },
          site: { select: { id: true, name: true, address: true } },
        },
      }),
      prisma.siteJoinRequest.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[admin/site-join-requests]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
