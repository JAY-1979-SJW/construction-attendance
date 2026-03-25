import { NextRequest } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { saveDocumentFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/storage/document-storage'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// ─── GET /api/admin/workers/[id]/documents ───────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id: workerId } = await params
    const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { id: true } })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const { searchParams } = new URL(request.url)
    const docType = searchParams.get('documentType') ?? ''

    const docs = await prisma.workerDocument.findMany({
      where: {
        workerId,
        ...(docType ? { documentType: docType as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        file: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            storageProvider: true,
            uploadedAt: true,
          },
        },
      },
    })

    return ok({ items: docs })
  } catch (err) {
    console.error('[workers/documents GET]', err)
    return internalError()
  }
}

// ─── POST /api/admin/workers/[id]/documents ──────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id: workerId } = await params
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, name: true },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return badRequest('파일이 없습니다.')

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return badRequest(`지원하지 않는 파일 형식입니다. (${file.type})`)
    }
    if (file.size > MAX_FILE_SIZE) {
      return badRequest('파일 크기는 20MB 이하여야 합니다.')
    }

    const documentType = (formData.get('documentType') as string) || 'OTHER'
    const validTypes = ['ID_CARD', 'INSURANCE_DOC', 'CONTRACT', 'SAFETY_CERT', 'OTHER']
    if (!validTypes.includes(documentType)) return badRequest('유효하지 않은 문서 유형입니다.')

    const notes    = (formData.get('notes') as string) || null
    const expiresAt = formData.get('expiresAt') as string | null

    const buffer = Buffer.from(await file.arrayBuffer())
    const { path: storagePath, sha256Hash, sizeBytes } = await saveDocumentFile(buffer, workerId, file.type)

    // DB 저장: FileRecord 먼저 생성 → WorkerDocument에 fileId로 연결
    const fileRecord = await prisma.fileRecord.create({
      data: {
        storageProvider: process.env.STORAGE_PROVIDER ?? 'NAS',
        path: storagePath,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes,
        sha256Hash,
        isEncrypted: false,
        uploadedBy: session.sub,
      },
    })

    const doc = await prisma.workerDocument.create({
      data: {
        workerId,
        fileId: fileRecord.id,
        documentType: documentType as never,
        status: 'UPLOADED',
        notes: notes ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        file: { select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, uploadedAt: true } },
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'DOCUMENT_UPLOAD',
      targetType: 'Worker',
      targetId: workerId,
      summary: `문서 업로드: ${worker.name} — ${documentType} (${file.name})`,
      metadataJson: { documentId: doc.id, documentType, filename: file.name, sizeBytes },
    })

    return created(doc, '문서가 업로드되었습니다.')
  } catch (err) {
    console.error('[workers/documents POST]', err)
    return internalError()
  }
}
