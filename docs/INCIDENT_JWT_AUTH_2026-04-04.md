# 장애: JWT 인증 전체 실패 (2026-04-04)

## 현상
모든 admin 보호 API (`/api/admin/*`) 요청 → HTTP 401 `유효하지 않은 토큰입니다.`  
로그인 자체는 정상(200)이나 발급된 토큰으로 이후 API 호출 시 전부 인증 실패.

## 원인
`lib/auth/jwt.ts` `verifyToken` 내에서 `isBlacklisted()` 호출 시 Prisma 연결 실패.

- Next.js 미들웨어(`middleware.ts`)는 **Edge Runtime**에서 실행됨
- `token-blacklist.ts`가 `@prisma/client`(네이티브 바이너리)를 import
- Edge Runtime에서 Prisma 초기화 시 throw 발생
- 기존 단일 try-catch가 이 예외를 잡아 `null` 반환 → 미들웨어가 모든 토큰을 무효로 판단

```typescript
// 수정 전 — isBlacklisted throw 시 전체가 null 반환
try {
  if (await isBlacklisted(token)) return null   // ← Edge Runtime에서 throw
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as JwtPayload
} catch {
  return null   // ← 여기서 잡혀 유효한 토큰도 null
}
```

## 수정
`lib/auth/jwt.ts` — `jwtVerify`와 `isBlacklisted` 예외 처리 분리 (커밋 `cf82fae`)

```typescript
// 수정 후
try {
  const { payload } = await jwtVerify(token, getSecret())
  try {
    if (await isBlacklisted(token)) return null
  } catch {
    // Edge Runtime: 블랙리스트 체크 생략, JWT 서명 검증만으로 통과
  }
  return payload as unknown as JwtPayload
} catch {
  return null
}
```

Node.js 런타임(API 라우트 핸들러)에서는 `requireAdmin()` → `verifyToken()` → `isBlacklisted()` 정상 동작.

## 검증 결과
`check_jwt_runtime.sh` 실행 (2026-04-04)

| 단계 | 결과 |
|------|------|
| 로그인 API | HTTP 200 |
| 토큰 발급 | 207자 |
| `/api/admin/sites` 검증 | HTTP 200 |
| 최종 판정 | **PASS** |
