/**
 * 메모리 기반 토큰 블랙리스트
 * 로그아웃 시 토큰을 블랙리스트에 등록하여 즉시 무효화
 * 만료된 토큰은 자동 정리
 */

const blacklist = new Map<string, number>() // token → expiry timestamp (ms)

// 만료된 항목 주기적 정리 (10분마다)
setInterval(() => {
  const now = Date.now()
  for (const [token, expiry] of blacklist) {
    if (now > expiry) {
      blacklist.delete(token)
    }
  }
}, 10 * 60 * 1000)

/** 토큰을 블랙리스트에 추가 (만료 시간까지 유지) */
export function addToBlacklist(token: string, expiresAt: number): void {
  blacklist.set(token, expiresAt)
}

/** 토큰이 블랙리스트에 있는지 확인 */
export function isBlacklisted(token: string): boolean {
  if (!blacklist.has(token)) return false
  const expiry = blacklist.get(token)!
  if (Date.now() > expiry) {
    blacklist.delete(token)
    return false
  }
  return true
}
