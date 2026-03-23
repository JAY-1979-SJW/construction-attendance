import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, badRequest, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const schema = z.object({
  siteId:    z.string().min(1, '현장 ID가 필요합니다.'),
  photoType: z.enum(['CHECK_IN', 'CHECK_OUT']),
  photoBase64: z.string().min(100, '사진 데이터가 필요합니다.'),
  mimeType:    z.string().default('image/jpeg'),
  latitude:    z.number().optional(),
  longitude:   z.number().optional(),
  deviceToken: z.string().optional(),
  capturedAt:  z.string().datetime().optional(),
})

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads/attendance-photos'
const MAX_SIZE_BYTES = 5 * 1024 * 1024  // 5MB

/**
 * POST /api/attendance/photo/upload
 * 출퇴근 증빙 사진 업로드 (base64)
 * 출근/퇴근 버튼 클릭 전 먼저 호출 → photoId 반환
 *
 * 반환값:
 *   photoId: AttendancePhotoEvidence.id
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { siteId, photoType, photoBase64, mimeType, latitude, longitude, deviceToken, capturedAt } = parsed.data

    // 계정 승인 상태 확인
    const worker = await prisma.worker.findUnique({
      where: { id: session.sub },
      select: { id: true, accountStatus: true, isActive: true },
    })
    if (!worker || !worker.isActive || worker.accountStatus !== 'APPROVED') {
      return NextResponse.json({ success: false, message: '출퇴근 권한이 없습니다.' }, { status: 403 })
    }

    // 현장 존재 확인
    const site = await prisma.site.findUnique({ where: { id: siteId, isActive: true }, select: { id: true } })
    if (!site) return badRequest('유효하지 않은 현장입니다.')

    // base64 → Buffer
    const base64Data = photoBase64.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.byteLength > MAX_SIZE_BYTES) {
      return badRequest(`사진 크기가 너무 큽니다. 최대 ${MAX_SIZE_BYTES / 1024 / 1024}MB`)
    }

    // 파일명: workerId_siteId_type_timestamp.jpg
    const timestamp = Date.now()
    const ext = mimeType === 'image/png' ? 'png' : 'jpg'
    const fileName = `${session.sub}_${siteId}_${photoType}_${timestamp}.${ext}`

    // 월별 서브디렉토리
    const now = new Date()
    const subDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const fullDir = join(UPLOAD_DIR, subDir)
    await mkdir(fullDir, { recursive: true })

    const filePath = join(subDir, fileName)
    const fullPath = join(UPLOAD_DIR, filePath)
    await writeFile(fullPath, buffer)

    // SHA256 해시
    const sha256Hash = createHash('sha256').update(buffer).digest('hex')

    // DB 저장
    const photo = await prisma.attendancePhotoEvidence.create({
      data: {
        workerId:      session.sub,
        siteId,
        photoType,
        filePath,
        mimeType,
        fileSizeBytes: buffer.byteLength,
        sha256Hash,
        capturedAt:    capturedAt ? new Date(capturedAt) : new Date(),
        latitude:      latitude ?? null,
        longitude:     longitude ?? null,
        deviceToken:   deviceToken ?? null,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'WORKER',
      actionType: 'PHOTO_UPLOADED',
      targetType: 'AttendancePhotoEvidence',
      targetId: photo.id,
      summary: `출퇴근 사진 업로드 — ${photoType} / 현장: ${siteId}`,
      metadataJson: { siteId, photoType, fileSizeBytes: buffer.byteLength },
    })

    return NextResponse.json({
      success: true,
      photoId: photo.id,
      message: '사진이 업로드되었습니다.',
    })
  } catch (err) {
    console.error('[attendance/photo/upload]', err)
    return internalError()
  }
}
