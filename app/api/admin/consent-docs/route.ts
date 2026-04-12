import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, ok, badRequest } from '@/lib/utils/response'

/**
 * GET /api/admin/consent-docs
 * 전체 문서 목록 (GLOBAL + 업체별 + 현장별)
 */
export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const docs = await prisma.consentDoc.findMany({
    orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      company: { select: { companyName: true } },
      site:    { select: { name: true } },
      _count:  { select: { workerConsents: true } },
    },
  })

  return ok({ docs })
}

/**
 * POST /api/admin/consent-docs
 * 새 문서 등록
 */
export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  let body: {
    docType:    string
    scope:      string
    companyId?: string
    siteId?:    string
    title:      string
    contentMd:  string
    version?:   number
    isRequired?: boolean
    sortOrder?:  number
  }
  try {
    body = await request.json()
    if (!body.docType || !body.title || !body.contentMd) throw new Error()
  } catch {
    return badRequest('docType, title, contentMd 필드가 필요합니다.')
  }

  const doc = await prisma.consentDoc.create({
    data: {
      docType:    body.docType   as never,
      scope:      (body.scope ?? 'GLOBAL') as never,
      companyId:  body.companyId ?? null,
      siteId:     body.siteId    ?? null,
      title:      body.title,
      contentMd:  body.contentMd,
      version:    body.version   ?? 1,
      isRequired: body.isRequired ?? true,
      sortOrder:  body.sortOrder  ?? 0,
    },
  })

  return ok({ doc })
}
