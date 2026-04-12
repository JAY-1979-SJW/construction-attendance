import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, ok, badRequest, notFound } from '@/lib/utils/response'

type Ctx = { params: { id: string } }

/**
 * PATCH /api/admin/consent-docs/[id]
 * 문서 수정 (제목/내용/버전/활성화 여부/정렬순서)
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const doc = await prisma.consentDoc.findUnique({ where: { id: params.id } })
  if (!doc) return notFound('존재하지 않는 문서입니다.')

  let body: {
    title?:      string
    contentMd?:  string
    version?:    number
    isActive?:   boolean
    isRequired?: boolean
    sortOrder?:  number
  }
  try { body = await request.json() }
  catch { return badRequest('JSON 파싱 실패') }

  const updated = await prisma.consentDoc.update({
    where: { id: params.id },
    data: {
      ...(body.title      !== undefined && { title:      body.title      }),
      ...(body.contentMd  !== undefined && { contentMd:  body.contentMd  }),
      ...(body.version    !== undefined && { version:    body.version    }),
      ...(body.isActive   !== undefined && { isActive:   body.isActive   }),
      ...(body.isRequired !== undefined && { isRequired: body.isRequired }),
      ...(body.sortOrder  !== undefined && { sortOrder:  body.sortOrder  }),
    },
  })

  return ok({ doc: updated })
}

/**
 * DELETE /api/admin/consent-docs/[id]
 * 문서 비활성화 (soft delete — isActive = false)
 * 실제 삭제는 하지 않음 (동의 이력 보존)
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const doc = await prisma.consentDoc.findUnique({ where: { id: params.id } })
  if (!doc) return notFound('존재하지 않는 문서입니다.')

  const updated = await prisma.consentDoc.update({
    where: { id: params.id },
    data: { isActive: false },
  })

  return ok({ doc: updated })
}
