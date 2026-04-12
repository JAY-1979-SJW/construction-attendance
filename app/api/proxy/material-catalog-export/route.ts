import { NextRequest, NextResponse } from 'next/server'

const MATERIAL_API = process.env.MATERIAL_API_URL ?? 'http://material-api:3020'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const qs = searchParams.toString()
  try {
    const res = await fetch(
      `${MATERIAL_API}/api/materials/export.csv${qs ? `?${qs}` : ''}`,
      { cache: 'no-store' },
    )
    // CSV 응답을 그대로 전달
    const blob = await res.blob()
    const headers = new Headers()
    headers.set('Content-Type', res.headers.get('content-type') ?? 'text/csv; charset=utf-8')
    const cd = res.headers.get('content-disposition')
    if (cd) headers.set('Content-Disposition', cd)
    return new NextResponse(blob, { status: res.status, headers })
  } catch {
    return NextResponse.json({ success: false, message: 'material-api 연결 실패' }, { status: 502 })
  }
}
