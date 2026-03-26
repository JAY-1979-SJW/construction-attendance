import { SignJWT, jwtVerify } from 'jose'
import type { JwtPayload } from '@/types/auth'

if (!process.env.JWT_SECRET) {
  throw new Error('[FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 시작할 수 없습니다.')
}
const secret = new TextEncoder().encode(process.env.JWT_SECRET)
const algorithm = 'HS256'

export async function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d'
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}
