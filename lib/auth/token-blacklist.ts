/**
 * DB 기반 토큰 블랙리스트
 * 로그아웃 시 토큰을 블랙리스트에 등록하여 즉시 무효화
 * 서버 재시작에도 유지됨 (PostgreSQL 영속)
 */
import { createHash } from 'crypto'
import { prisma } from '@/lib/db/prisma'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 토큰을 블랙리스트에 추가 (만료 시간까지 유지) */
export async function addToBlacklist(token: string, expiresAtMs: number): Promise<void> {
  const tokenHash = hashToken(token)
  await prisma.tokenBlacklist.upsert({
    where: { tokenHash },
    update: {},
    create: { tokenHash, expiresAt: new Date(expiresAtMs) },
  })
}

/** 토큰이 블랙리스트에 있는지 확인 */
export async function isBlacklisted(token: string): Promise<boolean> {
  const tokenHash = hashToken(token)
  const row = await prisma.tokenBlacklist.findUnique({ where: { tokenHash } })
  if (!row) return false
  if (new Date() > row.expiresAt) {
    // 만료된 항목 제거
    await prisma.tokenBlacklist.delete({ where: { tokenHash } }).catch(() => {})
    return false
  }
  return true
}

/** 만료된 블랙리스트 항목 일괄 정리 */
export async function cleanupExpiredBlacklist(): Promise<number> {
  const { count } = await prisma.tokenBlacklist.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return count
}
