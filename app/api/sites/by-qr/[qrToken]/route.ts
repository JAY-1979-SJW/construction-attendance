import { NextRequest } from 'next/server'
import { getSiteByQrToken } from '@/lib/qr/qr-token'
import { ok, notFound, internalError } from '@/lib/utils/response'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ qrToken: string }> }
) {
  try {
    const { qrToken } = await params
    const site = await getSiteByQrToken(qrToken)

    if (!site) return notFound('현장을 찾을 수 없거나 비활성 상태입니다.')

    return ok({
      id: site.id,
      name: site.name,
      address: site.address,
      latitude: site.latitude,
      longitude: site.longitude,
      allowedRadius: site.allowedRadius,
    })
  } catch (err) {
    console.error('[sites/by-qr]', err)
    return internalError()
  }
}
