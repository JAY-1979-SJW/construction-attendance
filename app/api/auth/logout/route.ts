import { NextRequest, NextResponse } from 'next/server'
import { addToBlacklist } from '@/lib/auth/token-blacklist'
import { jwtVerify } from 'jose'

export async function POST(request: NextRequest) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

  // worker_token 블랙리스트 등록
  const token = request.cookies.get('worker_token')?.value
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret)
      await addToBlacklist(token, (payload.exp ?? 0) * 1000)
    } catch {
      // 만료된 토큰이면 블랙리스트 불필요
    }
  }

  // worker_rt (refresh token) 블랙리스트 등록
  const rt = request.cookies.get('worker_rt')?.value
  if (rt) {
    try {
      const { payload } = await jwtVerify(rt, secret)
      await addToBlacklist(rt, (payload.exp ?? 0) * 1000)
    } catch {
      // 만료된 토큰이면 블랙리스트 불필요
    }
  }

  const response = NextResponse.json({ success: true, message: '로그아웃되었습니다.' })
  response.cookies.delete('worker_token')
  response.cookies.delete('worker_rt')
  return response
}
