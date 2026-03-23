/**
 * GET  /api/admin/site-admin-assignments  — SITE_ADMIN 배정 목록
 * POST /api/admin/site-admin-assignments  — SITE_ADMIN 배정 생성
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, unauthorized } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const createSchema = z.object({
  userId:    z.string().min(1),
  companyId: z.string().min(1),
  siteId:    z.string().min(1),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const userId    = searchParams.get('userId')
    const siteId    = searchParams.get('siteId')
    const companyId = searchParams.get('companyId')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const assignments = await prisma.siteAdminAssignment.findMany({
      where: {
        ...(userId    ? { userId }    : {}),
        ...(siteId    ? { siteId }    : {}),
        ...(companyId ? { companyId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        site: {
          select: { id: true, name: true, address: true },
        },
        company: {
          select: { id: true, companyName: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    })

    return ok({ assignments })
  } catch (err) {
    console.error('[site-admin-assignments GET]', err)
    return internalError()
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { userId, companyId, siteId } = parsed.data

    // 대상 사용자 검증
    const targetUser = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    })
    if (!targetUser) return badRequest('존재하지 않는 사용자입니다.')

    // SITE_ADMIN이 아니면 역할 자동 전환 안 함 — 호출자가 미리 역할을 맞춰야 함
    // 단, SUPER_ADMIN/ADMIN/COMPANY_ADMIN에 중복 배정은 거부
    if (['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN'].includes(targetUser.role)) {
      return badRequest(
        `${targetUser.role} 역할 사용자에게 현장 배정을 추가할 수 없습니다. ` +
        '먼저 해당 사용자의 역할을 SITE_ADMIN으로 변경하세요.'
      )
    }

    // 현장이 해당 회사 소속인지 검증
    const siteCompany = await prisma.siteCompanyAssignment.findFirst({
      where: { siteId, companyId },
    })
    if (!siteCompany) {
      return badRequest('해당 현장이 지정한 회사 소속이 아닙니다.')
    }

    // 이미 활성 배정 존재 여부 확인 (unique는 userId+siteId 쌍)
    const existing = await prisma.siteAdminAssignment.findFirst({
      where: { userId, siteId },
    })

    let assignment
    if (existing) {
      if (existing.isActive) {
        return badRequest('이미 해당 현장에 배정된 사용자입니다.')
      }
      // 비활성 상태 → 재활성화
      assignment = await prisma.siteAdminAssignment.update({
        where: { id: existing.id },
        data: {
          isActive:   true,
          companyId,
          assignedBy: session.sub,
          assignedAt: new Date(),
          revokedAt:  null,
          revokedBy:  null,
        },
        include: {
          user: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
      })
    } else {
      assignment = await prisma.siteAdminAssignment.create({
        data: { userId, companyId, siteId, assignedBy: session.sub },
        include: {
          user: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
      })
    }

    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actionType:  'SITE_ADMIN_ASSIGN',
      targetType:  'AdminUser',
      targetId:    userId,
      summary:     `현장 관리자 배정: ${targetUser.name} → ${assignment.site.name}`,
      metadataJson: { userId, companyId, siteId },
    })

    return created(assignment, '현장 관리자 배정이 완료되었습니다.')
  } catch (err) {
    console.error('[site-admin-assignments POST]', err)
    return internalError()
  }
}
