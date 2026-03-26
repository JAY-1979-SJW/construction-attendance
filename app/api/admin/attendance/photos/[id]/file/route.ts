import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getAdminSession, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, internalError } from '@/lib/utils/response'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads/attendance-photos'

/**
 * GET /api/admin/attendance/photos/[id]/file
 * 증빙 사진 파일 직접 서빙 (관리자 전용)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const photo = await prisma.attendancePhotoEvidence.findUnique({
      where: { id: params.id },
      select: { filePath: true, mimeType: true, siteId: true },
    })
    if (!photo) return notFound('사진을 찾을 수 없습니다.')

    if (photo.siteId && !(await canAccessSite(session, photo.siteId))) return siteAccessDenied()

    const fullPath = join(UPLOAD_DIR, photo.filePath)
    const buffer = await readFile(fullPath)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': photo.mimeType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return notFound('파일을 찾을 수 없습니다.')
    }
    console.error('[admin/attendance/photos/[id]/file]', err)
    return internalError()
  }
}
