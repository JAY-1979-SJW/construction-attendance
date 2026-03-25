import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/geocoding/geocode'
import { ok, badRequest, unauthorized } from '@/lib/utils/response'
import { getAdminSession } from '@/lib/auth/guards'

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const address = req.nextUrl.searchParams.get('address')?.trim()
    if (!address) return badRequest('address 파라미터가 필요합니다.')

    const result = await geocodeAddress(address)
    if (!result) {
      return NextResponse.json(
        { success: false, message: '주소에 해당하는 좌표를 찾을 수 없습니다.', code: 'GEOCODE_FAILED' },
        { status: 422 },
      )
    }

    return ok({ lat: result.latitude, lng: result.longitude })
  } catch (err) {
    console.error('[geocode GET]', err)
    return NextResponse.json(
      { success: false, message: '서버 오류', code: 'SERVER_ERROR' },
      { status: 500 },
    )
  }
}
