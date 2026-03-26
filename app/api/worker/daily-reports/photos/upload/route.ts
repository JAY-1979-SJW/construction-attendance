/**
 * POST /api/worker/daily-reports/photos/upload
 * 작업일보 사진 업로드 (base64)
 *
 * Request:  { siteId, photoBase64, mimeType? }
 * Response: { success, photoPath }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, badRequest, internalError } from '@/lib/utils/response'

const schema = z.object({
  siteId:      z.string().min(1, '현장 ID가 필요합니다.'),
  photoBase64: z.string().min(100, '사진 데이터가 필요합니다.'),
  mimeType:    z.string().default('image/jpeg'),
})

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads'
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { siteId, photoBase64, mimeType } = parsed.data

    // 현장 확인
    const site = await prisma.site.findUnique({ where: { id: siteId, isActive: true }, select: { id: true } })
    if (!site) return badRequest('유효하지 않은 현장입니다.')

    // base64 → Buffer
    const base64Data = photoBase64.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.byteLength > MAX_SIZE_BYTES) {
      return badRequest(`사진 크기가 너무 큽니다. 최대 ${MAX_SIZE_BYTES / 1024 / 1024}MB`)
    }

    // 파일 저장
    const timestamp = Date.now()
    const ext = mimeType === 'image/png' ? 'png' : 'jpg'
    const fileName = `${session.sub}_${siteId}_${timestamp}.${ext}`

    const now = new Date()
    const subDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const fullDir = join(UPLOAD_DIR, 'daily-report-photos', subDir)
    await mkdir(fullDir, { recursive: true })

    const relativePath = `daily-report-photos/${subDir}/${fileName}`
    const fullPath = join(UPLOAD_DIR, relativePath)
    await writeFile(fullPath, buffer)

    return NextResponse.json({
      success: true,
      photoPath: relativePath,
    })
  } catch (err) {
    console.error('[daily-reports/photos/upload]', err)
    return internalError()
  }
}
