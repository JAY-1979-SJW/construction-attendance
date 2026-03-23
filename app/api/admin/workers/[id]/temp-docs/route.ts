/**
 * GET  /api/admin/workers/[id]/temp-docs  — 임시 서류 목록
 * POST /api/admin/workers/[id]/temp-docs  — 서류 업로드 (최대 5일)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10MB
const ALLOWED_MIME  = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_DAYS      = 5

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const worker = await prisma.worker.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const docs = await prisma.tempSensitiveDocument.findMany({
      where:   { workerId: params.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        documentType: true,
        purpose: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        expiresAt: true,
        downloadedAt: true,
        deleteScheduledAt: true,
        deletedAt: true,
        deleteReason: true,
        uploadedBy: true,
        uploadedAt: true,
        // filePath 제외 (서버 내부 경로 노출 금지)
      },
    })

    return NextResponse.json({ success: true, data: docs })
  } catch (err) {
    console.error('[admin/workers/[id]/temp-docs GET]', err)
    return internalError()
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const worker = await prisma.worker.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const formData = await req.formData()
    const file     = formData.get('file') as File | null
    const docType  = (formData.get('documentType') as string) || 'OTHER'
    const purpose  = (formData.get('purpose') as string)?.trim() || ''

    if (!file)           return badRequest('파일을 첨부해주세요.')
    if (purpose.length < 5) return badRequest('업로드 목적을 5자 이상 입력하세요.')
    if (file.size > MAX_FILE_SIZE) return badRequest('파일 크기는 10MB를 초과할 수 없습니다.')
    if (!ALLOWED_MIME.includes(file.type)) return badRequest('PDF, JPEG, PNG, WEBP 파일만 허용됩니다.')

    // 저장 경로: /app/uploads/temp-sensitive/{workerId}/{timestamp}_{filename}
    const uploadRoot = process.env.UPLOAD_DIR ?? '/app/uploads'
    const dir        = path.join(uploadRoot, 'temp-sensitive', params.id)
    await mkdir(dir, { recursive: true })

    const timestamp = Date.now()
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = path.join(dir, `${timestamp}_${safeFileName}`)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const now      = new Date()
    const expiresAt = new Date(now.getTime() + MAX_DAYS * 24 * 60 * 60 * 1000)

    const doc = await prisma.tempSensitiveDocument.create({
      data: {
        workerId:     params.id,
        documentType: docType,
        purpose,
        fileName:  file.name,
        fileSize:  file.size,
        mimeType:  file.type,
        filePath,
        expiresAt,
        uploadedBy: session.sub,
        uploadedAt: now,
      },
    })

    // 업로드 이벤트 기록
    await prisma.tempSensitiveDocumentEvent.create({
      data: {
        documentId:  doc.id,
        eventType:   'UPLOADED',
        actorUserId: session.sub,
        actorType:   'ADMIN',
        reason:      purpose,
        ipAddress:   req.headers.get('x-forwarded-for') ?? undefined,
        metadataJson: { workerId: params.id, fileName: file.name, fileSize: file.size },
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'TEMP_DOC_UPLOADED',
      targetType: 'TempSensitiveDocument',
      targetId: doc.id,
      summary: `임시 서류 업로드: ${worker.name} — ${file.name} (${docType})`,
      reason: purpose,
      metadataJson: { workerId: params.id, fileName: file.name, expiresAt },
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({
      success: true,
      message: `서류가 업로드되었습니다. ${MAX_DAYS}일 후 자동 삭제됩니다.`,
      data: {
        id: doc.id,
        fileName: doc.fileName,
        expiresAt: doc.expiresAt,
        _warning: '이 파일은 임시 보관 전용입니다. 다운로드 후 24시간, 또는 최대 5일 내 자동 삭제됩니다.',
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[admin/workers/[id]/temp-docs POST]', err)
    return internalError()
  }
}
