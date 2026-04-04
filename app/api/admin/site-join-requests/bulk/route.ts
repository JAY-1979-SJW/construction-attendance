import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, badRequest, forbidden, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { ensurePackageExists } from '@/lib/onboarding-docs/ensure-package'

/**
 * POST /api/admin/site-join-requests/bulk
 * Body:
 *   { action: 'approve', ids: string[] }
 *   { action: 'reject',  ids: string[], rejectReason: string }
 * Response: { succeeded: number, failed: number, failedItems: { id, reason }[] }
 *
 * PENDING 상태인 항목만 처리. 이미 처리된 항목은 failed로 반환.
 */

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    ids: z.array(z.string()).min(1, 'ids가 필요합니다').max(100, '최대 100건까지 처리 가능합니다'),
  }),
  z.object({
    action: z.literal('reject'),
    ids: z.array(z.string()).min(1, 'ids가 필요합니다').max(100, '최대 100건까지 처리 가능합니다'),
    rejectReason: z.string().min(1, '반려 사유를 입력하세요.').max(200),
  }),
])

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (!['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN'].includes(session.role ?? '')) return forbidden()

    const body = await req.json().catch(() => null)
    if (!body) return badRequest('요청 본문이 필요합니다')

    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { action, ids } = parsed.data

    // FK 선조회 원칙 — ids 전체 조회
    const joinReqs = await prisma.siteJoinRequest.findMany({
      where: { id: { in: ids } },
      include: {
        worker: { select: { name: true, phone: true } },
        site: { select: { name: true } },
      },
    })
    const reqMap = new Map(joinReqs.map((r) => [r.id, r]))

    const succeeded: string[] = []
    const failedItems: { id: string; reason: string }[] = []

    if (action === 'approve') {
      for (const id of ids) {
        const joinReq = reqMap.get(id)
        if (!joinReq) { failedItems.push({ id, reason: 'NOT_FOUND' }); continue }
        if (joinReq.status !== 'PENDING') { failedItems.push({ id, reason: 'NOT_PENDING' }); continue }

        const resolvedCompanyId = joinReq.companyId
        if (!resolvedCompanyId) { failedItems.push({ id, reason: 'NO_COMPANY' }); continue }

        // COMPANY_ADMIN 권한 제어
        if (session.role === 'COMPANY_ADMIN' && resolvedCompanyId !== session.companyId) {
          failedItems.push({ id, reason: 'PERMISSION_DENIED' }); continue
        }

        try {
          await prisma.$transaction(async (tx) => {
            await tx.siteJoinRequest.update({
              where: { id },
              data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: session.sub },
            })
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
                  isActive: true,
                },
              })
            }
          })

          try {
            await ensurePackageExists(joinReq.workerId, joinReq.siteId)
          } catch (pkgErr) {
            console.error('[site-join-bulk/approve] 문서 패키지 생성 실패 (배정은 유지)', pkgErr)
          }

          await writeAuditLog({
            actorUserId: session.sub,
            actorType: 'ADMIN',
            actorRole: session.role ?? undefined,
            companyId: resolvedCompanyId,
            actionType: 'SITE_JOIN_APPROVED',
            targetType: 'SiteJoinRequest',
            targetId: id,
            summary: `[대량] 현장 참여 승인 — ${joinReq.worker.name} → ${joinReq.site.name}`,
            metadataJson: { bulk: true, workerId: joinReq.workerId, siteId: joinReq.siteId, companyId: resolvedCompanyId },
          })

          succeeded.push(id)
        } catch (err) {
          console.error(`[site-join-bulk/approve] id=${id}`, err)
          failedItems.push({ id, reason: 'INTERNAL_ERROR' })
        }
      }
    } else {
      // action === 'reject'
      const { rejectReason } = parsed.data as { action: 'reject'; ids: string[]; rejectReason: string }

      for (const id of ids) {
        const joinReq = reqMap.get(id)
        if (!joinReq) { failedItems.push({ id, reason: 'NOT_FOUND' }); continue }
        if (joinReq.status !== 'PENDING') { failedItems.push({ id, reason: 'NOT_PENDING' }); continue }

        // COMPANY_ADMIN 권한 제어
        if (session.role === 'COMPANY_ADMIN' && joinReq.companyId !== session.companyId) {
          failedItems.push({ id, reason: 'PERMISSION_DENIED' }); continue
        }

        try {
          await prisma.siteJoinRequest.update({
            where: { id },
            data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: session.sub, rejectReason },
          })

          await writeAuditLog({
            actorUserId: session.sub,
            actorType: 'ADMIN',
            actorRole: session.role ?? undefined,
            actionType: 'SITE_JOIN_REJECTED',
            targetType: 'SiteJoinRequest',
            targetId: id,
            summary: `[대량] 현장 참여 반려 — ${joinReq.worker.name} → ${joinReq.site.name}: ${rejectReason}`,
            reason: rejectReason,
          })

          succeeded.push(id)
        } catch (err) {
          console.error(`[site-join-bulk/reject] id=${id}`, err)
          failedItems.push({ id, reason: 'INTERNAL_ERROR' })
        }
      }
    }

    return ok({ succeeded: succeeded.length, failed: failedItems.length, failedItems })
  } catch (err) {
    console.error('[admin/site-join-requests/bulk]', err)
    return internalError()
  }
}
