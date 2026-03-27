/**
 * 메모리 기반 로그인 Rate Limiter
 * 같은 키(IP 또는 email) 기준으로 maxAttempts 초과 시 windowMs 동안 차단
 */

interface Entry {
  count: number
  firstAttempt: number
}

const store = new Map<string, Entry>()

// 오래된 항목 주기적 정리 (5분마다)
const CLEANUP_INTERVAL = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of Array.from(store)) {
    if (now - entry.firstAttempt > CLEANUP_INTERVAL) {
      store.delete(key)
    }
  }
}, CLEANUP_INTERVAL)

export function checkRateLimit(
  key: string,
  { maxAttempts = 5, windowMs = 60_000 } = {}
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.firstAttempt > windowMs) {
    // 윈도우 만료 또는 첫 시도 → 카운트 시작
    store.set(key, { count: 1, firstAttempt: now })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= maxAttempts) {
    const retryAfterMs = windowMs - (now - entry.firstAttempt)
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) }
  }

  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}

export function resetRateLimit(key: string): void {
  store.delete(key)
}
