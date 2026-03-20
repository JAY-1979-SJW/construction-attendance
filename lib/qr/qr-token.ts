import { prisma } from '@/lib/db/prisma'
import { generateToken } from '@/lib/utils/random'

/**
 * 신규 QR 토큰 생성 (충분히 긴 URL-safe 난수)
 */
export function generateQrToken(): string {
  return generateToken(32) // 43자 base64url
}

/**
 * QR 토큰으로 현장 조회
 */
export async function getSiteByQrToken(qrToken: string) {
  return prisma.site.findUnique({
    where: { qrToken, isActive: true },
  })
}

/**
 * 현장 QR 토큰 재발급
 */
export async function rotateQrToken(siteId: string): Promise<string> {
  const newToken = generateQrToken()
  await prisma.site.update({
    where: { id: siteId },
    data: { qrToken: newToken },
  })
  return newToken
}
