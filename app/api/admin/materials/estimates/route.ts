import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { parseEstimateDocument } from '@/lib/materials/estimate-parser'

const ESTIMATE_UPLOAD_ROOT = process.env.UPLOAD_ROOT_ESTIMATES ?? path.join(process.cwd(), 'uploads', 'estimates')

const ALLOWED_EXTS = ['.xlsx', '.xls']
const MAX_SIZE = 50 * 1024 * 1024 // 50MB

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { searchParams } = req.nextUrl
  const siteId   = searchParams.get('siteId') ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20', 10))

  const where: Record<string, unknown> = {}
  if (siteId) where.siteId = siteId

  const [total, items] = await Promise.all([
    prisma.estimateDocument.count({ where }),
    prisma.estimateDocument.findMany({
      where,
      select: {
        id:           true,
        fileName:     true,
        fileSize:     true,
        documentType: true,
        parseStatus:  true,
        parseVersion: true,
        sheetCount:   true,
        notes:        true,
        uploadedAt:   true,
        site:         { select: { id: true, name: true } },
        _count:       { select: { billRows: true, aggregateRows: true } },
      },
      orderBy: { uploadedAt: 'desc' },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
  ])

  return ok({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return badRequest('FormData 파싱 실패')
  }

  const file = formData.get('file') as File | null
  if (!file) return badRequest('파일을 선택하세요')

  const originalName = file.name
  const ext = path.extname(originalName).toLowerCase()
  if (!ALLOWED_EXTS.includes(ext)) return badRequest('xlsx 또는 xls 파일만 허용됩니다')
  if (file.size > MAX_SIZE) return badRequest('파일 크기가 50MB를 초과합니다')

  const siteId       = (formData.get('siteId') as string | null) || null
  const documentType = (formData.get('documentType') as string | null) || 'ESTIMATE'
  const notes        = (formData.get('notes') as string | null) || null

  // 파일 저장
  const now = new Date()
  const subDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
  const absDir = path.join(ESTIMATE_UPLOAD_ROOT, subDir)
  if (!existsSync(absDir)) await mkdir(absDir, { recursive: true })

  const savedName = `${randomUUID()}${ext}`
  const absPath   = path.join(absDir, savedName)

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    await writeFile(absPath, buffer)
  } catch {
    return internalError('파일 저장 실패')
  }

  // DB 레코드 생성
  const docId = randomUUID()
  await prisma.estimateDocument.create({
    data: {
      id:           docId,
      fileName:     originalName,
      filePath:     absPath,
      fileSize:     file.size,
      documentType: documentType as never,
      uploadedBy:   session.sub,
      siteId:       siteId || null,
      notes:        notes || null,
      parseStatus:  'UPLOADED',
    },
  })

  // 비동기 파싱 시작 (fire & forget)
  parseEstimateDocument(docId).catch(() => {})

  return created({ id: docId, fileName: originalName })
}
