import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { generateQrBuffer } from '@/lib/qr/qr-image'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'

/**
 * GET /api/admin/sites/qr?siteId=xxx
 * 현장 QR 코드 이미지(PNG) 반환
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const siteId = request.nextUrl.searchParams.get('siteId')
    if (!siteId) return badRequest('siteId 파라미터가 필요합니다.')

    const site = await prisma.site.findUnique({ where: { id: siteId } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const qrUrl = `${baseUrl}/qr/${site.qrToken}`

    const buffer = await generateQrBuffer(qrUrl)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="qr-${site.name}.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[admin/sites/qr]', err)
    return internalError()
  }
}
