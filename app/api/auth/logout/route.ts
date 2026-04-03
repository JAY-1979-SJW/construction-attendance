import { NextRequest, NextResponse } from 'next/server'
import { addToBlacklist } from '@/lib/auth/token-blacklist'
import { jwtVerify } from 'jose'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('worker_token')?.value
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
      const { payload } = await jwtVerify(token, secret)
      const exp = (payload.exp ?? 0) * 1000
      addToBlacklist(token, exp)
    } catch {
      // 만료된 토큰이면 블랙리스트 불필요
    }
  }

  const response = NextResponse.json({ success: true, message: '로그아웃되었습니다.' })
  response.cookies.delete('worker_token')
  response.cookies.delete('worker_rt')
  return response
}
