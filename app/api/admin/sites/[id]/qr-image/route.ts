import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { getAdminSession, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, internalError } from '@/lib/utils/response'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params
    if (!await canAccessSite(session, id)) return siteAccessDenied()

    const site = await prisma.site.findUnique({
      where: { id },
      select: { qrToken: true, name: true },
    })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const format = req.nextUrl.searchParams.get('format') ?? 'png'
    const origin = req.nextUrl.searchParams.get('origin') ?? req.headers.get('origin') ?? ''
    const qrUrl = `${origin}/qr/${site.qrToken}`

    if (format === 'svg') {
      const svg = await QRCode.toString(qrUrl, { type: 'svg', width: 400, margin: 2 })
      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `inline; filename="${encodeURIComponent(site.name)}-qr.svg"`,
        },
      })
    }

    // PNG (기본)
    const buffer = await QRCode.toBuffer(qrUrl, { type: 'png', width: 400, margin: 2 })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="${encodeURIComponent(site.name)}-qr.png"`,
      },
    })
  } catch (err) {
    console.error('[admin/sites/[id]/qr-image]', err)
    return internalError()
  }
}
