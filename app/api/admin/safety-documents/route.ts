/**
 * GET /api/admin/safety-documents — 전체 안전서류 목록 (필터 지원)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const siteId   = searchParams.get('siteId') || undefined
  const docType  = searchParams.get('docType') || undefined
  const status   = searchParams.get('status') || undefined
  const search   = searchParams.get('search') || undefined

  const docs = await prisma.safetyDocument.findMany({
    where: {
      ...(siteId  && { siteId }),
      ...(docType && { documentType: docType as never }),
      ...(status  && { status: status as never }),
      ...(search  && {
        worker: { name: { contains: search } },
      }),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      worker: { select: { id: true, name: true, phone: true } },
      site:   { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ success: true, data: docs })
}
