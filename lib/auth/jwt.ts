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
    if (await isBlacklisted(token)) return null
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}
