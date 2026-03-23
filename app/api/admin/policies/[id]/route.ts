import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, internalError } from '@/lib/utils/response'

/**
 * GET /api/admin/policies/[id]
 * 정책 문서 상세 (contentMd 포함) — SUPER_ADMIN
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const doc = await prisma.policyDocument.findUnique({ where: { id: params.id } })
    if (!doc) return notFound('문서를 찾을 수 없습니다.')

    return NextResponse.json({ success: true, data: doc })
  } catch (err) {
    console.error('[admin/policies/[id] GET]', err)
    return internalError()
  }
}
