/**
 * GET /api/admin/daily-reports/photos/file?path=daily-report-photos/...
 * 작업일보 사진 파일 서빙 (관리자 전용)
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getAdminSession } from '@/lib/auth/guards'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const filePath = req.nextUrl.searchParams.get('path')
    if (!filePath) return badRequest('path 파라미터 필수')

    // 경로 탈출 방지 + daily-report-photos 경로만 허용
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
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return notFound('파일을 찾을 수 없습니다.')
    }
    console.error('[admin/daily-reports/photos/file]', err)
    return internalError()
  }
}
