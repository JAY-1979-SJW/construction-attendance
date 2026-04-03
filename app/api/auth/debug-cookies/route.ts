/**
 * GET /api/auth/debug-cookies
 * 실기기 PWA 환경에서 쿠키 저장·재전송 상태를 확인하는 진단 엔드포인트
 * HttpOnly 쿠키는 JS에서 읽을 수 없으므로 서버에서 확인해야 한다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'

export async function GET(req: NextRequest) {
  const workerToken = req.cookies.get('worker_token')?.value
  const workerRt = req.cookies.get('worker_rt')?.value
  const adminToken = req.cookies.get('admin_token')?.value

  const ua = req.headers.get('user-agent') ?? ''
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isStandalone = /standalone/.test(ua) || req.headers.get('sec-fetch-mode') === 'navigate'

  let workerPayload = null
  let rtPayload = null
  if (workerToken) {
    workerPayload = await verifyToken(workerToken)
  }
  if (workerRt) {
    rtPayload = await verifyToken(workerRt)
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    cookies: {
      worker_token: workerToken ? {
        present: true,
        length: workerToken.length,
        valid: !!workerPayload,
        type: workerPayload?.type ?? null,
        sub: workerPayload?.sub ?? null,
        exp: workerPayload?.exp ? new Date(workerPayload.exp * 1000).toISOString() : null,
      } : { present: false },
      worker_rt: workerRt ? {
        present: true,
        length: workerRt.length,
        valid: !!rtPayload,
        type: rtPayload?.type ?? null,
        sub: rtPayload?.sub ?? null,
        exp: rtPayload?.exp ? new Date(rtPayload.exp * 1000).toISOString() : null,
      } : { present: false },
      admin_token: { present: !!adminToken },
    },
    client: {
      userAgent: ua.substring(0, 200),
      mobile: isMobile,
      standalone: isStandalone,
    },
    allCookieNames: Array.from(req.cookies.getAll().map(c => c.name)),
  })
}
