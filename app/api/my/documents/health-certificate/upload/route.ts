/**
 * POST /api/my/documents/health-certificate/upload
 * 건강증명서 파일 업로드
 * body: { fileBase64: string, fileName: string, mimeType: string, siteId?: string }
 */
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { submitWorkerDocument } from '@/lib/onboarding-docs'
import { ok, unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { prisma } from '@/lib/db/prisma'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

const schema = z.object({
  fileBase64: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  siteId: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { fileBase64, fileName, mimeType, siteId: rawSiteId } = parsed.data

  // base64 디코딩
  const buffer = Buffer.from(fileBase64, 'base64')
  if (buffer.length > MAX_SIZE_BYTES) {
    return badRequest('파일 크기가 10MB를 초과합니다.')
  }

  // 파일 저장
  const uploadDir = process.env.UPLOAD_DIR || '/app/uploads'
  const now = new Date()
  const monthDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const dirPath = path.join(uploadDir, 'health-certificates', monthDir)
  fs.mkdirSync(dirPath, { recursive: true })

  const ext = path.extname(fileName) || '.jpg'
  const storedName = `${session.sub}_health_${Date.now()}${ext}`
  const filePath = path.join(dirPath, storedName)
  fs.writeFileSync(filePath, buffer)

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')

  // FileRecord 생성
  const fileRecord = await prisma.fileRecord.create({
    data: {
      storageProvider: 'LOCAL',
      path: path.join('health-certificates', monthDir, storedName),
      originalFilename: fileName,
      mimeType,
      sizeBytes: buffer.length,
      sha256Hash: sha256,
      isEncrypted: false,
      uploadedBy: session.sub,
    },
  })

  // siteId 결정
  let siteId: string | null = rawSiteId ?? null
  if (!siteId) {
    const contract = await prisma.workerContract.findFirst({
      where: { workerId: session.sub, contractStatus: { in: ['ACTIVE', 'REVIEW_REQUESTED'] } },
      orderBy: { createdAt: 'desc' },
      select: { siteId: true },
    })
    siteId = contract?.siteId ?? null
  }

  try {
    const submission = await submitWorkerDocument({
      workerId: session.sub,
      siteId,
      docType: 'HEALTH_CERTIFICATE',
      submitMethod: 'UPLOAD',
      fileId: fileRecord.id,
    })

    return ok({ submissionId: submission.id, fileId: fileRecord.id, status: 'SUBMITTED' })
  } catch (err: any) {
    return internalError(err.message)
  }
}
