/**
 * 해한 현장 출퇴근 — Service Worker
 *
 * 역할:
 *   - PWA 홈화면 추가(설치) 가능 상태 조건 충족
 *   - HTML은 캐시하지 않음: Next.js 배포마다 JS 번들 해시가 바뀌어
 *     구버전 HTML이 새 번들을 못 찾아 앱이 깨지는 문제 방지
 *   - SW는 PWA 설치 조건 충족 용도로만 존재
 *
 * 웹 푸시:
 *   현재는 FCM 네이티브 앱 푸시 기반이므로 Service Worker push 이벤트 미사용.
 *   향후 Web Push (VAPID) 도입 시 push/notificationclick 핸들러 추가.
 */

const CACHE_NAME = 'haehan-attendance-v2'

// 설치 — HTML 캐시 없음 (배포 후 번들 해시 불일치 방지)
self.addEventListener('install', () => {
  self.skipWaiting()
})

// 활성화 — 이전 캐시(v1 포함) 전부 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// fetch — 모든 요청을 네트워크 직접 처리
// SW는 intercepting 없이 통과만 시킴 → 쿠키 자동 포함, 항상 최신 코드 로딩
self.addEventListener('fetch', () => {
  // respondWith 호출하지 않음: 브라우저 기본 네트워크 동작 유지
})
