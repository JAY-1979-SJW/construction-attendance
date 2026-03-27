import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'

/**
 * GET /api/admin/registrations
 * 회원가입 신청 목록 (accountStatus 기준 필터).
 * 쿼리: status=PENDING|APPROVED|REJECTED|SUSPENDED (기본 PENDING)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'PENDING'
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)
    const skip = (page - 1) * limit

    const [workers, total] = await Promise.all([
      prisma.worker.findMany({
        where: {
          accountStatus: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED',
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          jobTitle: true,
          username: true,
          email: true,
          accountStatus: true,
          rejectReason: true,
          reviewedAt: true,
          reviewedBy: true,
          createdAt: true,
          birthDate: true,
          organizationType: true,
          companyAssignments: {
            select: {
              companyId: true,
              employmentType: true,
              company: { select: { companyName: true } },
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          devices: {
            where: { isActive: true },
            select: { deviceName: true, approvedAt: true },
            take: 1,
          },
          siteJoinRequests: {
            select: { siteId: true, status: true },
          },
          consents: {
            select: { consentType: true, agreed: true, agreedAt: true },
          },
          safetyDocuments: {
            select: { documentType: true, status: true, createdAt: true },
          },
          workerDocuments: {
            select: { documentType: true, status: true, createdAt: true },
          },
          contracts: {
            select: { id: true, contractStatus: true, createdAt: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              safetyDocuments: true,
              contracts: true,
              consents: true,
              workerDocuments: true,
            },
          },
        },
      }),
      prisma.worker.count({
        where: { accountStatus: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: workers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[admin/registrations]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
