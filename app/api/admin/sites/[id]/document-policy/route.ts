/**
 * GET  /api/admin/sites/[id]/document-policy — 현장 문서정책 조회
 * PUT  /api/admin/sites/[id]/document-policy — 현장 문서정책 일괄 저장
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { REQUIRED_DOC_TYPES, DOC_TYPE_LABELS } from '@/lib/onboarding-docs/constants'

const policyItemSchema = z.object({
  docType: z.enum(['CONTRACT', 'PRIVACY_CONSENT', 'HEALTH_DECLARATION', 'HEALTH_CERTIFICATE', 'SAFETY_ACK']),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).optional(),
})

const putSchema = z.object({
  policies: z.array(policyItemSchema).min(1).max(10),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const policies = await prisma.siteDocumentPolicy.findMany({
      where: { siteId: id },
      orderBy: { sortOrder: 'asc' },
    })

    // 저장된 정책이 없으면 기본값(전부 필수) 반환
    const policyMap = new Map(policies.map(p => [p.docType, p]))

    const result = REQUIRED_DOC_TYPES.map((docType, idx) => {
      const saved = policyMap.get(docType)
      return {
        docType,
        label: DOC_TYPE_LABELS[docType],
        isRequired: saved?.isRequired ?? true,
        isActive: saved?.isActive ?? true,
        sortOrder: saved?.sortOrder ?? idx,
        isCustom: !!saved,
      }
    })

    return ok({
      siteId: id,
      siteName: site.name,
      policies: result,
      hasCustomPolicy: policies.length > 0,
    })
  } catch (err) {
    console.error('[sites/[id]/document-policy GET]', err)
    return internalError()
  }
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id } = await params

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const body = await request.json()
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { policies } = parsed.data

    // 트랜잭션으로 일괄 upsert
    await prisma.$transaction(
      policies.map((p, idx) =>
        prisma.siteDocumentPolicy.upsert({
          where: { siteId_docType: { siteId: id, docType: p.docType } },
          create: {
            siteId: id,
            docType: p.docType,
            isRequired: p.isRequired,
            isActive: p.isActive,
            sortOrder: p.sortOrder ?? idx,
          },
          update: {
            isRequired: p.isRequired,
            isActive: p.isActive,
            sortOrder: p.sortOrder ?? idx,
          },
        })
      )
    )

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'UPDATE_SITE',
      targetType: 'Site',
      targetId: id,
      description: `현장 문서정책 설정: ${site.name} | ${policies.filter(p => p.isRequired && p.isActive).length}개 필수`,
    })

    return ok({ siteId: id }, '현장 문서정책이 저장되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/document-policy PUT]', err)
    return internalError()
  }
}
