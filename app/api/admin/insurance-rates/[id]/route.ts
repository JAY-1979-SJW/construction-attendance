/**
 * GET    /api/admin/insurance-rates/[id]  — 버전 상세
 * PATCH  /api/admin/insurance-rates/[id]  — 내용 수정 / 상태 전환
 * DELETE /api/admin/insurance-rates/[id]  — 삭제 (DRAFT만)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { unauthorized, badRequest, notFound, forbidden, internalError } from '@/lib/utils/response'

type Params = { params: { id: string } }

const patchSchema = z.object({
  // 내용 수정 (DRAFT 상태에서만)
  totalRatePct:             z.number().min(0).max(100).optional(),
  employeeRatePct:          z.number().min(0).max(100).optional(),
  employerRatePct:          z.number().min(0).max(100).optional(),
  rateNote:                 z.string().max(500).optional(),
  industryCode:             z.string().max(20).optional(),
  officialSourceName:       z.string().max(100).optional(),
  officialSourceUrl:        z.string().max(500).optional(),
  officialAnnouncementDate: z.string().optional(),
  referenceDocumentNo:      z.string().max(100).optional(),
  effectiveMonth:           z.number().int().min(1).max(12).nullable().optional(),

  // 상태 전환
  action:      z.enum(['REQUEST_REVIEW','MARK_REVIEWED','APPROVE','DEPRECATE']).optional(),
  reviewNote:  z.string().max(500).optional(),
})

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const version = await prisma.insuranceRateVersion.findUnique({ where: { id: params.id } })
    if (!version) return notFound('요율 버전을 찾을 수 없습니다.')

    return NextResponse.json({ success: true, data: version })
  } catch (err) {
    console.error('[admin/insurance-rates/[id] GET]', err)
    return internalError()
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const version = await prisma.insuranceRateVersion.findUnique({ where: { id: params.id } })
    if (!version) return notFound('요율 버전을 찾을 수 없습니다.')

    const body   = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { action, reviewNote, officialAnnouncementDate, ...fieldUpdates } = parsed.data

    // 상태 전환 처리
    const statusUpdate: Record<string, any> = {}
    if (action) {
      const denySuper = requireRole(session, SUPER_ADMIN_ONLY)
      if (action === 'APPROVE' && denySuper) return denySuper

      switch (action) {
        case 'REQUEST_REVIEW':
          if (version.status !== 'DRAFT') return badRequest('DRAFT 상태에서만 검토 요청할 수 있습니다.')
          statusUpdate.status = 'REVIEW_PENDING'
          break
        case 'MARK_REVIEWED':
          if (version.status !== 'REVIEW_PENDING') return badRequest('검토 요청 상태에서만 검토 완료 처리 가능합니다.')
          statusUpdate.status     = 'REVIEWED'
          statusUpdate.reviewedBy = session.sub
          statusUpdate.reviewedAt = new Date()
          statusUpdate.reviewNote = reviewNote ?? null
          break
        case 'APPROVE':
          if (!['REVIEWED', 'DRAFT'].includes(version.status)) return badRequest('REVIEWED 또는 DRAFT 상태에서만 승인 가능합니다.')
          statusUpdate.status     = 'APPROVED_FOR_USE'
          statusUpdate.approvedBy = session.sub
          statusUpdate.approvedAt = new Date()
          break
        case 'DEPRECATE':
          if (version.status !== 'APPROVED_FOR_USE') return badRequest('승인 완료 버전만 구버전 처리할 수 있습니다.')
          statusUpdate.status       = 'DEPRECATED'
          statusUpdate.deprecatedAt = new Date()
          break
      }
    }

    // 내용 수정: DRAFT 외에는 변경 제한
    const hasFieldUpdates = Object.keys(fieldUpdates).length > 0 || officialAnnouncementDate !== undefined
    if (hasFieldUpdates && version.status !== 'DRAFT') {
      return badRequest('DRAFT 상태에서만 내용을 수정할 수 있습니다.')
    }

    const updated = await prisma.insuranceRateVersion.update({
      where: { id: params.id },
      data: {
        ...fieldUpdates,
        ...(officialAnnouncementDate !== undefined
          ? { officialAnnouncementDate: officialAnnouncementDate ? new Date(officialAnnouncementDate) : null }
          : {}),
        ...statusUpdate,
      },
    })

    if (action) {
      await writeAuditLog({
        actorUserId: session.sub,
        actorType: 'ADMIN',
        actionType: 'INSURANCE_RATE_STATUS_CHANGED',
        targetType: 'InsuranceRateVersion',
        targetId: params.id,
        summary: `보험요율 상태 전환: ${version.rateType} ${version.effectiveYear}년 — ${version.status} → ${updated.status}`,
        metadataJson: { action, reviewNote },
      })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('[admin/insurance-rates/[id] PATCH]', err)
    return internalError()
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const version = await prisma.insuranceRateVersion.findUnique({ where: { id: params.id } })
    if (!version) return notFound('요율 버전을 찾을 수 없습니다.')
    if (version.status !== 'DRAFT') return forbidden('DRAFT 상태의 버전만 삭제할 수 있습니다.')

    await prisma.insuranceRateVersion.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true, message: '요율 버전이 삭제되었습니다.' })
  } catch (err) {
    console.error('[admin/insurance-rates/[id] DELETE]', err)
    return internalError()
  }
}
