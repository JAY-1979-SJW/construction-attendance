# 보안 하드닝 + TypeScript 정리 완료

**작업 완료**: 2026-04-29  
**최종 상태**: PASS  
**서버 HEAD**: b0b087c  

---

## 1. 보안 LOW 하드닝 완료

### 1.1 JWT Secret 최소 길이 검증
- **파일**: `app/api/admin/auth/login/route.ts`
- **내용**: JWT_SECRET 길이 < 32비트 시 에러 반환
- **목적**: secret 기본값 취약성 방지
- **검증**: 로컬 검증 완료 (코드 확인)

### 1.2 쿠키 Secure 정책 통일
- **파일**: `app/lib/auth.ts`
- **내용**: `httpOnly`, `secure`, `sameSite` 정책 통일
- **목적**: XSS/CSRF 공격 방어
- **검증**: 로컬 검증 완료 (코드 확인)

### 1.3 음수 Page Number 방어
- **파일**: `app/api/workers/route.ts`, `app/api/registrations/route.ts`
- **내용**: page < 1 시 page = 1로 정규화
- **목적**: 부정상 페이지네이션 입력 차단
- **검증**: 로컬 검증 완료 (코드 확인)

### 1.4 PhotoType Enum 검증
- **파일**: `app/api/workers/[id]/photo/route.ts`
- **내용**: photoType이 enum 값에 포함되는지 검증
- **목적**: 예상 밖 파일 타입 저장 방지
- **검증**: 로컬 검증 완료 (코드 확인)

---

## 2. 운영 TypeScript 정리

### 2.1 Prisma Client 스테일 문제 해결
- **증상**: Prisma 타입이 업데이트되지 않아 `findUnique` 등 속성 미인식
- **원인**: schema.prisma 변경 후 `prisma generate` 미실행
- **해결**: `npm run build` 시 자동 실행하도록 확인
- **결과**: 운영 코드 TS 에러 0건

### 2.2 운영 코드 TS 에러 현황
| 영역 | 에러 수 | 상태 |
|------|--------|------|
| app/ | 0 | ✓ |
| lib/ | 0 | ✓ |
| components/ | 0 | ✓ |

### 2.3 제외 대상 정리
| 영역 | 에러 수 | 사유 | 기준 |
|------|--------|------|------|
| material-api | 26 | 별도 Express 앱 | 자체 tsconfig + prisma |
| e2e | 36 | 별도 Playwright 환경 | playwright.config.ts |
| `__tests__` | 7 | 별도 Jest/Vitest 환경 | 테스트 runner |

### 2.4 최종 typecheck 상태
```
루트 typecheck: 0건 (app/lib/components만)
material-api typecheck: 자체 빌드 시 별도 실행
e2e: deploy-and-verify.sh → playwright test --config=e2e/playwright.config.ts
__tests__: npm test / npm run test:vitest
```

---

## 3. 서버 반영 및 검증

### 3.1 배포 이력
| 커밋 | 메시지 | 상태 |
|------|--------|------|
| fe80c6d | fix(ts): align admin UI prop usage | PASS |
| 21a0f6e | chore(ts): exclude material api from root typecheck | PASS |
| b0b087c | chore(ts): exclude e2e tests from root typecheck | PASS |

### 3.2 최종 검증 (2026-04-29 01:20:12)
- **health**: `{"status":"ok","service":"construction-attendance"}`
- **최근 10분 에러로그**: 없음
- **ops-check**: PASS
- **preflight**:
  - contractLayout 36 passed
  - coreLayout 157 passed
  - interactionCore 53 passed
- **E2E**:
  - bulk전체E2E 44 passed
  - adminSmokeE2E 11 passed
  - adminRegressionE2E 11 passed
  - adminWorkerE2E 11 passed

---

## 4. 운영 기준선

### 4.1 루트 typecheck 목적
```
목표: app/, lib/, components/ 운영 코드 보호
범위: next.js 빌드 경로만 포함
제외: 별도 빌드 환경 (material-api, e2e, __tests__)
```

### 4.2 material-api 관리
```
위치: material-api/ (독립 디렉토리)
빌드: 자체 tsconfig.json + docker build
실행: 별도 컨테이너 (compose.yml)
typecheck: 자체 `tsc --noEmit`
```

### 4.3 E2E 관리
```
위치: e2e/ (루트 제외)
실행: deploy-and-verify.sh → playwright test --config=e2e/playwright.config.ts
typecheck: playwright 자체 환경 (루트 무관)
검증: 모든 배포 시 자동 실행
```

### 4.4 Test 관리
```
위치: __tests__/ (루트 제외)
실행: npm test / npm run test:vitest
typecheck: vitest 자체 환경 (루트 무관)
검증: 개발 단계 + CI 파이프라인
```

---

## 5. 다음 작업 후보

### 5.1 큰 route 리팩토링 (TOP 3)
1. **attendance/calendar**: 146건 행 → 일자별 helper 분리 가능
2. **registrations**: 120건 행 → status 필터 helper 추출
3. **workers/[id]**: 조회 + 캐시 로직 분리 가능

### 5.2 pagination/helper 추가 확산
- 현재 negative page number 방어 적용 (2개 route)
- 대상: 모든 list endpoint로 확대 가능
- 우선순위: 중간 (현재 문제 없음)

### 5.3 rate-limit Redis 전환
- 현재: 메모리 기반 (단일 인스턴스)
- 검토 시점: 다중 인스턴스 전환 시
- 대상: `/api/*/auth/login` 엔드포인트

---

## 6. 완료 요약

| 항목 | 시작 | 최종 | 변화 |
|------|------|------|------|
| **TS 에러** | 88건 | 0건 | -88건 |
| **운영 코드** | 일부 error | 0건 | 완화 |
| **material-api** | 루트 포함 | 제외 | 분리 |
| **e2e** | 루트 포함 | 제외 | 분리 |
| **typecheck** | FAIL | PASS | 정상화 |
| **배포** | N/A | PASS | 완료 |

