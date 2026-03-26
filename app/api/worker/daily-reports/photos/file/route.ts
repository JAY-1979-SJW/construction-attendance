/**
 * GET /api/worker/daily-reports/photos/file?path=daily-report-photos/2026-03/xxx.jpg
 * 작업일보 사진 파일 서빙
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getWorkerSession } from '@/lib/auth/guards'
import { unauthorized, badRequest, internalError } from '@/lib/utils/response'

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
