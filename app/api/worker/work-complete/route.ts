/**
 * GET  /api/worker/work-complete — 오늘 작업완료 보고 상태 조회
 * POST /api/worker/work-complete — 작업완료 사진 + 건강이상 없음 확인 제출
 */
import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'
import { z } from 'zod'
import { writeFile, mkdir } from 'fs/promises'
import { createHash } from 'crypto'
import { join } from 'path'

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || '/mnt/nas/attendance/uploads'

export async function GET(req: NextRequest) {
  const session = await getWorkerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workDate = toKSTDateString()
  const dateAsDate = kstDateStringToDate(workDate)

  const report = await prisma.workerDailyReport.findFirst({
    where: { workerId: session.sub, reportDate: dateAsDate },
    select: {
      healthCheckedYn: true, healthCheckedAt: true,
      workCompletionPhotos: true, siteId: true,
      site: { select: { name: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      workDate,
      healthChecked: report?.healthCheckedYn ?? false,
      healthCheckedAt: report?.healthCheckedAt ?? null,
      completionPhotos: report?.workCompletionPhotos ?? [],
      siteName: report?.site?.name ?? null,
    },
  })
}

const submitSchema = z.object({
  siteId: z.string().min(1),
  healthCheckedYn: z.boolean(),
  healthSignature: z.string().optional(),
  photos: z.array(z.object({
    base64: z.string().min(100),
    mimeType: z.string().default('image/jpeg'),
  })).max(5).optional(),
})

export async function POST(req: NextRequest) {
  const session = await getWorkerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const { siteId, healthCheckedYn, healthSignature, photos } = parsed.data
  const workDate = toKSTDateString()
  const dateAsDate = kstDateStringToDate(workDate)

  // 사진 저장
  const photoPaths: string[] = []
  if (photos && photos.length > 0) {
    const dir = join(UPLOAD_ROOT, 'work-completion', workDate.slice(0, 7))
    await mkdir(dir, { recursive: true }).catch(() => {})

    for (let i = 0; i < photos.length; i++) {
      const buffer = Buffer.from(photos[i].base64, 'base64')
      const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12)
      const ext = photos[i].mimeType === 'image/png' ? 'png' : 'jpg'
      const filename = `${session.sub}_${Date.now()}_${hash}.${ext}`
      const filePath = join(dir, filename)
      await writeFile(filePath, buffer)
      photoPaths.push(`work-completion/${workDate.slice(0, 7)}/${filename}`)
    }
  }

  await prisma.workerDailyReport.upsert({
    where: {
      workerId_siteId_reportDate: {
        workerId: session.sub,
        siteId,
        reportDate: dateAsDate,
      },
    },
    create: {
      workerId: session.sub,
      siteId,
      reportDate: dateAsDate,
      healthCheckedYn,
      healthCheckedAt: healthCheckedYn ? new Date() : null,
      healthSignature: healthSignature ?? null,
      workCompletionPhotos: photoPaths,
    },
    update: {
      healthCheckedYn,
      healthCheckedAt: healthCheckedYn ? new Date() : null,
      healthSignature: healthSignature ?? undefined,
      ...(photoPaths.length > 0 ? {
        workCompletionPhotos: { push: photoPaths },
      } : {}),
    },
  })

  return NextResponse.json({
    success: true,
    message: healthCheckedYn
      ? '작업완료 보고 및 건강이상 없음이 확인되었습니다.'
      : '작업완료 보고가 저장되었습니다.',
  })
}
