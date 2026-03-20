import { SignJWT, jwtVerify } from 'jose'
import type { JwtPayload } from '@/types/auth'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-dev-secret-change-in-production'
)
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
