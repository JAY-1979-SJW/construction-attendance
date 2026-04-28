import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, forbidden } from '@/lib/utils/response'
import { parsePage } from '@/lib/utils/pagination'

/**
 * GET /api/admin/company-admin-requests
 * 업체 관리자 신청 목록. SUPER_ADMIN 전용.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (session.role !== 'SUPER_ADMIN') return forbidden('슈퍼관리자 전용입니다.')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'PENDING'
    const page = parsePage(searchParams.get('page'))
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)
    const skip = (page - 1) * limit

    const [requests, total] = await Promise.all([
      prisma.companyAdminRequest.findMany({
        where: { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.companyAdminRequest.count({
        where: { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[admin/company-admin-requests]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
