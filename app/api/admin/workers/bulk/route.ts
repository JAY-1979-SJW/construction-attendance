import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

/**
 * POST /api/admin/workers/bulk
 * Body: { action: 'record-education', ids: string[], educationDate: 'YYYY-MM-DD' }
 * Response: { succeeded: number, failed: number, failedItems: { id, reason }[] }
 *
 * 대상 조건: accountStatus IN (APPROVED, ACTIVE) + 교육 기록 없음
 * 교육 기록 없음 = safetyDocuments 중 BASIC_SAFETY_EDU_CONFIRM / SAFETY_EDUCATION_NEW_HIRE 없음
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const deny = requireRole(session, [...MUTATE_ROLES, 'SITE_ADMIN'])
    if (deny) return deny

    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.ids) || !body.ids.length) {
      return badRequest('ids 배열이 필요합니다')
    }

    const action: string = body.action
    if (action !== 'record-education') {
      return badRequest('action은 record-education 이어야 합니다')
    }

    const educationDate: string = body.educationDate
    if (!educationDate || !/^\d{4}-\d{2}-\d{2}$/.test(educationDate)) {
      return badRequest('educationDate는 YYYY-MM-DD 형식이어야 합니다')
    }

    const ids: string[] = body.ids

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: { name: true },
    })
    const adminName = adminUser?.name ?? session.sub

    // 1. FK 선조회 원칙 — 대상 근로자 + 기존 교육 문서 함께 조회
    const workers = await prisma.worker.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        accountStatus: true,
        safetyDocuments: {
          where: {
            documentType: { in: ['BASIC_SAFETY_EDU_CONFIRM', 'SAFETY_EDUCATION_NEW_HIRE'] },
          },
          select: { id: true },
          take: 1,
        },
      },
    })
    const workerMap = new Map(workers.map((w) => [w.id, w]))

    const succeeded: string[] = []
    const failedItems: { id: string; reason: string }[] = []

    for (const id of ids) {
      const w = workerMap.get(id)
      if (!w) { failedItems.push({ id, reason: 'NOT_FOUND' }); continue }

      if (w.accountStatus !== 'APPROVED') {
        failedItems.push({ id, reason: 'NOT_APPROVED' }); continue
      }

      if (w.safetyDocuments.length > 0) {
        failedItems.push({ id, reason: 'ALREADY_RECORDED' }); continue
      }

      await prisma.safetyDocument.create({
        data: {
          workerId:      w.id,
          documentType:  'BASIC_SAFETY_EDU_CONFIRM' as never,
          status:        'DRAFT' as never,
          educationDate,
          documentDate:  educationDate,
          createdBy:     session.sub,
        },
      })

      await writeAuditLog({
        adminId:     session.sub,
        actionType:  'SAFETY_DOC_CREATE',
        targetType:  'Worker',
        targetId:    w.id,
        description: `안전교육 일괄 기록: ${w.name} / 교육일 ${educationDate} — 처리자: ${adminName}`,
      })

      succeeded.push(id)
    }

    return ok({ succeeded: succeeded.length, failed: failedItems.length, failedItems })
  } catch (err) {
    console.error('[admin/workers/bulk]', err)
    return internalError()
  }
}
