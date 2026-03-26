/**
 * GET /api/admin/daily-reports/photos/file?path=daily-report-photos/...
 * 작업일보 사진 파일 서빙 (관리자 전용, 현장 scope 적용)
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getAdminSession, getAccessibleSiteIds } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, badRequest, forbidden, notFound, internalError } from '@/lib/utils/response'

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

    // 현장 scope 검사: 해당 사진이 접근 가능한 현장의 일보에 속하는지 확인
    const siteIds = await getAccessibleSiteIds(session)
    if (siteIds !== null) {
      // siteIds가 null이면 전체 접근 가능 (SUPER_ADMIN/ADMIN)
      const report = await prisma.workerDailyReport.findFirst({
        where: {
          photos: { has: filePath },
          siteId: { in: siteIds },
        },
        select: { id: true },
      })
      if (!report) return forbidden('접근 권한이 없습니다.')
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
