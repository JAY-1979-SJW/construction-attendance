/**
 * DELETE /api/admin/workers/[id]/temp-docs/[docId]
 * 임시 서류 수동 삭제 — 관리자 명시적 삭제
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { unauthorized, badRequest, notFound, forbidden, internalError } from '@/lib/utils/response'
import { unlink } from 'fs/promises'

const schema = z.object({
  reason: z.string().min(2, '삭제 사유를 입력하세요.').max(200),
})

type Params = { params: { id: string; docId: string } }

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const doc = await prisma.tempSensitiveDocument.findFirst({
      where: { id: params.docId, workerId: params.id },
    })
    if (!doc) return notFound('서류를 찾을 수 없습니다.')
    if (doc.deletedAt) return forbidden('이미 삭제된 서류입니다.')

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { reason } = parsed.data
    const now = new Date()

    // 파일 삭제
    try {
      await unlink(doc.filePath)
    } catch {
      // 파일이 이미 없어도 DB는 삭제 처리
    }

    await prisma.tempSensitiveDocument.update({
      where: { id: doc.id },
      data: { deletedAt: now, deleteReason: `관리자 수동 삭제: ${reason}` },
    })

    await prisma.tempSensitiveDocumentEvent.create({
      data: {
        documentId:  doc.id,
        eventType:   'DELETED',
        actorUserId: session.sub,
        actorType:   'ADMIN',
        reason,
        ipAddress:   req.headers.get('x-forwarded-for') ?? undefined,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'TEMP_DOC_DELETED',
      targetType: 'TempSensitiveDocument',
      targetId: doc.id,
      summary: `임시 서류 수동 삭제: ${doc.fileName} — 사유: ${reason}`,
      reason,
      metadataJson: { workerId: params.id },
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ success: true, message: '서류가 삭제되었습니다.' })
  } catch (err) {
    console.error('[temp-docs/[docId] DELETE]', err)
    return internalError()
  }
}
