/**
 * GET /api/worker/daily-reports/photos/file?path=daily-report-photos/2026-03/xxx.jpg
 * 작업일보 사진 파일 서빙 — 본인 사진만 접근 가능
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, badRequest, forbidden, internalError } from '@/lib/utils/response'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads'

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const filePath = req.nextUrl.searchParams.get('path')
    if (!filePath) return badRequest('path 파라미터 필수')

    // 경로 탈출 방지
    if (filePath.includes('..') || !filePath.startsWith('daily-report-photos/')) {
      return badRequest('잘못된 경로')
    }

    // IDOR 방어: 해당 사진이 본인의 작업일보에 속하는지 확인
    const report = await prisma.workerDailyReport.findFirst({
      where: {
        workerId: session.sub,
        photos: { has: filePath },
      },
      select: { id: true },
    })
    if (!report) return forbidden('접근 권한이 없습니다.')

    const fullPath = join(UPLOAD_DIR, filePath)
    const buffer = await readFile(fullPath)

    const ext = filePath.split('.').pop()?.toLowerCase()
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return new NextResponse('Not found', { status: 404 })
    }
    console.error('[daily-reports/photos/file]', err)
    return internalError()
  }
}
