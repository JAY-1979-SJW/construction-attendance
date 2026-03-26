/**
 * 사용자 단위 토큰 무효화
 * 비밀번호 변경, 계정 비활성화, 권한 변경 시 해당 사용자의 모든 토큰을 무효화
 * iat(발급시각)이 revocation 시점 이전인 토큰은 거부됨
 */

// userId → revokedAt (초 단위, JWT iat와 비교용)
const revocationMap = new Map<string, number>()

// 만료된 항목 주기적 정리 (30분마다, 최대 7일 보관)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
setInterval(() => {
  const cutoff = Date.now() - MAX_AGE_MS
  for (const [userId, revokedAtSec] of revocationMap) {
    if (revokedAtSec * 1000 < cutoff) {
      revocationMap.delete(userId)
    }
  }
}, 30 * 60 * 1000)

/** 사용자의 모든 기존 토큰 무효화 */
export function revokeUserTokens(userId: string): void {
  revocationMap.set(userId, Math.floor(Date.now() / 1000))
}

/** 토큰이 무효화되었는지 확인 (iat이 revocation 이전이면 무효) */
export function isUserRevoked(userId: string, iat: number | undefined): boolean {
  const revokedAt = revocationMap.get(userId)
  if (!revokedAt) return false
  return (iat ?? 0) < revokedAt
}
