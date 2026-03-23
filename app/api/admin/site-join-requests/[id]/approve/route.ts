import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { badRequest, unauthorized, forbidden } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const schema = z.object({
  tradeType: z.string().max(50).optional(),
  companyId: z.string().optional(),
})

/**
 * POST /api/admin/site-join-requests/[id]/approve
 * 현장 참여 신청 승인 → WorkerSiteAssignment 생성.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (!['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN'].includes(session.role ?? '')) return forbidden()

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)
    const { tradeType, companyId: bodyCompanyId } = parsed.data

    const joinReq = await prisma.siteJoinRequest.findUnique({
      where: { id },
      include: {
        worker: { select: { name: true, phone: true } },
        site: { select: { name: true } },
      },
    })
    if (!joinReq) {
      return NextResponse.json({ success: false, message: '신청 내역을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (joinReq.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: `현재 상태(${joinReq.status})에서는 승인할 수 없습니다.` }, { status: 400 })
    }

    // COMPANY_ADMIN은 자기 companyId 범위만 승인 가능
    if (session.role === 'COMPANY_ADMIN') {
      const targetCompany = joinReq.companyId ?? bodyCompanyId
      if (targetCompany !== session.companyId) return forbidden('자기 업체 소속 신청만 처리할 수 있습니다.')
    }

    const resolvedCompanyId = joinReq.companyId ?? bodyCompanyId
    if (!resolvedCompanyId) {
      return NextResponse.json({ success: false, message: '소속 업체 정보가 필요합니다.' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // SiteJoinRequest 승인 처리
      await tx.siteJoinRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: session.sub,
        },
      })

      // WorkerSiteAssignment 생성 (중복 방지)
      const existing = await tx.workerSiteAssignment.findFirst({
        where: { workerId: joinReq.workerId, siteId: joinReq.siteId, isActive: true },
      })
      if (!existing) {
        await tx.workerSiteAssignment.create({
          data: {
            workerId: joinReq.workerId,
            siteId: joinReq.siteId,
            companyId: resolvedCompanyId,
            assignedFrom: new Date(),
            tradeType: tradeType ?? null,
            isActive: true,
          },
        })
      }
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role ?? undefined,
      companyId: resolvedCompanyId,
      actionType: 'SITE_JOIN_APPROVED',
      targetType: 'SiteJoinRequest',
      targetId: id,
      summary: `현장 참여 승인 — ${joinReq.worker.name} → ${joinReq.site.name}`,
      metadataJson: { workerId: joinReq.workerId, siteId: joinReq.siteId, companyId: resolvedCompanyId },
    })

    return NextResponse.json({ success: true, message: '현장 참여가 승인되었습니다.' })
  } catch (err) {
    console.error('[admin/site-join-requests/approve]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
