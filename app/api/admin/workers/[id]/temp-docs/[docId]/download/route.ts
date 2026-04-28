/**
 * POST /api/admin/workers/[id]/temp-docs/[docId]/download
 * 임시 서류 다운로드 — 사유 필수, 감사로그, 다운로드 후 24h 자동삭제 예약
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { unauthorized, badRequest, notFound, forbidden, internalError } from '@/lib/utils/response'
import { buildWorkerScopeWhere } from '@/lib/auth/guards'
import { readFile } from 'fs/promises'
import path from 'path'

const schema = z.object({
  reason: z.string().min(5, '다운로드 사유를 5자 이상 입력하세요.').max(200),
})

type Params = { params: { id: string; docId: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    // worker scope 검증 — 타사 근로자 문서 차단
    const workerScope = await buildWorkerScopeWhere(session)
    if (workerScope === false) return forbidden('이 근로자에 대한 접근 권한이 없습니다.')
    if (Object.keys(workerScope).length > 0) {
      const workerInScope = await prisma.worker.findFirst({
        where: { id: params.id, ...workerScope },
        select: { id: true },
      })
      if (!workerInScope) return forbidden('이 근로자에 대한 접근 권한이 없습니다.')
    }

    const doc = await prisma.tempSensitiveDocument.findFirst({
      where: { id: params.docId, workerId: params.id },
    })
    if (!doc) return notFound('서류를 찾을 수 없습니다.')

    if (doc.deletedAt) return forbidden('이미 삭제된 서류입니다.')

    const now = new Date()
    if (doc.expiresAt < now) {
      return forbidden('서류 보관 기간이 만료되었습니다. (최대 5일)')
    }

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { reason } = parsed.data

    // 파일 읽기
    let fileBuffer: Buffer
    try {
      fileBuffer = await readFile(doc.filePath)
    } catch {
      return internalError('파일을 읽을 수 없습니다. 관리자에게 문의하세요.')
    }

    // 최초 다운로드: 24h 후 자동삭제 예약
    const updateData: Record<string, any> = {}
    if (!doc.downloadedAt) {
      const deleteScheduledAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      updateData.downloadedAt      = now
      updateData.deleteScheduledAt = deleteScheduledAt
    }

    await prisma.tempSensitiveDocument.update({
      where: { id: doc.id },
      data: updateData,
    })

    // 이벤트 기록
    await prisma.tempSensitiveDocumentEvent.create({
      data: {
        documentId:  doc.id,
        eventType:   'DOWNLOADED',
        actorUserId: session.sub,
        actorType:   'ADMIN',
        reason,
        ipAddress:   req.headers.get('x-forwarded-for') ?? undefined,
        metadataJson: { workerId: params.id, fileName: doc.fileName },
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'TEMP_DOC_DOWNLOADED',
      targetType: 'TempSensitiveDocument',
      targetId: doc.id,
      summary: `임시 서류 다운로드: ${doc.fileName} — 사유: ${reason}`,
      reason,
      metadataJson: { workerId: params.id, docId: doc.id, firstDownload: !doc.downloadedAt },
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })

    const fileName = encodeURIComponent(doc.fileName)
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type':        doc.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
        'Content-Length':      String(fileBuffer.length),
        'X-Warning':           'Sensitive data. Do not redistribute or screenshot.',
        'Cache-Control':       'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[temp-docs/download POST]', err)
    return internalError()
  }
}
