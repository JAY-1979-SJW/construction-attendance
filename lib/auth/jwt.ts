import { SignJWT, jwtVerify } from 'jose'
import type { JwtPayload } from '@/types/auth'
import { isBlacklisted } from '@/lib/auth/token-blacklist'

const algorithm = 'HS256'

let _secret: Uint8Array | null = null
function getSecret(): Uint8Array {
  if (!_secret) {
    if (!process.env.JWT_SECRET) {
      throw new Error('[FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.')
    }
    _secret = new TextEncoder().encode(process.env.JWT_SECRET)
  }
  return _secret
}

export async function signToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn?: string,
): Promise<string> {
  // admin: 30일, worker: 30일 (모바일 로그인 시 호출자가 3650d로 override)
  const defaultExpiry = payload.type === 'admin' ? '30d' : '30d'
  const resolvedExpiry = expiresIn ?? process.env.JWT_EXPIRES_IN ?? defaultExpiry
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(resolvedExpiry)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    // isBlacklisted는 Prisma를 사용하므로 Edge Runtime(미들웨어)에서는 실패할 수 있음.
    // 실패 시 skip하고 JWT 서명 검증만으로 통과 — Node.js 런타임(API 라우트)에서는 정상 동작.
    try {
      if (await isBlacklisted(token)) return null
    } catch {
      // Edge Runtime 또는 DB 불가 시 블랙리스트 확인 생략
    }
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}
