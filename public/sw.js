/**
 * 해한 현장 출퇴근 — Service Worker
 *
 * 역할:
 *   - PWA 홈화면 추가(설치) 가능 상태 조건 충족
 *   - 네트워크 우선 전략: 항상 최신 데이터를 서버에서 가져옴
 *   - 정적 shell(HTML/JS/CSS)만 캐시하여 오프라인 시 기본 화면 표시
 *
 * 웹 푸시:
 *   현재는 FCM 네이티브 앱 푸시 기반이므로 Service Worker push 이벤트 미사용.
 *   향후 Web Push (VAPID) 도입 시 push/notificationclick 핸들러 추가.
 */

const CACHE_NAME = 'haehan-attendance-v1'

// 설치 — 핵심 shell 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/attendance',
        '/login',
      ]).catch(() => {/* 캐시 실패 무시 — 오프라인 지원 선택사항 */})
    )
  )
  self.skipWaiting()
})

// 활성화 — 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// fetch — 네트워크 우선, 실패 시 캐시 폴백
self.addEventListener('fetch', (event) => {
  // API 요청은 항상 네트워크 직접 (캐시 안 함)
  if (event.request.url.includes('/api/')) return

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached ?? fetch(event.request))
    )
  )
})
