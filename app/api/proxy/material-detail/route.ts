import { NextRequest, NextResponse } from 'next/server'

const MATERIAL_API = process.env.MATERIAL_API_URL ?? 'http://material-api:3020'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ success: false, message: 'id는 정수여야 합니다.' }, { status: 400 })
  }
  try {
    const res = await fetch(`${MATERIAL_API}/api/materials/${id}`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ success: false, message: 'material-api 연결 실패' }, { status: 502 })
  }
}
