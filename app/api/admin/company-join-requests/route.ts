import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, forbidden } from '@/lib/utils/response'

/**
 * GET /api/admin/company-join-requests?status=PENDING
 * 업체 합류 신청 목록. SUPER_ADMIN 전용.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (session.role !== 'SUPER_ADMIN') return forbidden('슈퍼관리자 전용입니다.')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? undefined
    const companyId = searchParams.get('companyId') ?? undefined

    const items = await prisma.companyJoinRequest.findMany({
      where: {
        ...(status    ? { status: status as never } : {}),
        ...(companyId ? { companyId }               : {}),
      },
      orderBy: { requestedAt: 'desc' },
      include: {
        company: { select: { id: true, companyName: true, businessNumber: true } },
      },
    })

    return ok({
      items: items.map((r) => ({
        id:              r.id,
        companyId:       r.companyId,
        companyName:     r.company.companyName,
        businessNumber:  r.company.businessNumber,
        applicantName:   r.applicantName,
        phone:           r.phone,
        email:           r.email,
        jobTitle:        r.jobTitle,
        message:         r.message,
        status:          r.status,
        requestedAt:     r.requestedAt.toISOString(),
        reviewedAt:      r.reviewedAt?.toISOString() ?? null,
        rejectReason:    r.rejectReason,
      })),
      total: items.length,
    })
  } catch (err) {
    console.error('[admin/company-join-requests GET]', err)
    return ok({ items: [], total: 0 })
  }
}
