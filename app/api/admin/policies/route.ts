import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { unauthorized, badRequest, internalError } from '@/lib/utils/response'

const createSchema = z.object({
  documentType: z.enum(['TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'LOCATION_POLICY', 'MARKETING_NOTICE']),
  title: z.string().min(2).max(100),
  version: z.string().min(1).max(20),
  effectiveFrom: z.string().datetime(),
  contentMd: z.string().min(10),
  isRequired: z.boolean().default(true),
})

/**
 * GET /api/admin/policies
 * 모든 정책 문서 버전 목록 (SUPER_ADMIN)
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const deny = requireRole(session, SUPER_ADMIN_ONLY)
  if (deny) return deny

  const { searchParams } = new URL(request.url)
  const documentType = searchParams.get('type')

  const docs = await prisma.policyDocument.findMany({
    where: documentType ? { documentType: documentType as never } : undefined,
    select: {
      id: true,
      documentType: true,
      title: true,
      version: true,
      effectiveFrom: true,
      effectiveTo: true,
      isActive: true,
      isRequired: true,
      createdAt: true,
      _count: { select: { consents: true } },
    },
    orderBy: [{ documentType: 'asc' }, { effectiveFrom: 'desc' }],
  })

  return NextResponse.json({ success: true, data: docs })
}

/**
 * POST /api/admin/policies
 * 새 문서 버전 등록 — 같은 documentType의 기존 활성 문서는 effectiveTo 설정
 */
export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const deny = requireRole(session, SUPER_ADMIN_ONLY)
  if (deny) return deny

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { documentType, title, version, effectiveFrom, contentMd, isRequired } = parsed.data
  const effectiveDate = new Date(effectiveFrom)

  // 버전 중복 검사
  const dup = await prisma.policyDocument.findFirst({
    where: { documentType, version },
  })
  if (dup) return badRequest(`이미 존재하는 버전입니다: ${documentType} v${version}`)

  try {
    const newDoc = await prisma.$transaction(async (tx) => {
      // 기존 활성 문서 종료 처리
      await tx.policyDocument.updateMany({
        where: { documentType, isActive: true, effectiveTo: null },
        data: { effectiveTo: effectiveDate, isActive: false },
      })

      return tx.policyDocument.create({
        data: { documentType, title, version, effectiveFrom: effectiveDate, contentMd, isRequired, isActive: true },
      })
    })

    return NextResponse.json({ success: true, data: newDoc }, { status: 201 })
  } catch (err) {
    console.error('[admin/policies POST]', err)
    return internalError()
  }
}
