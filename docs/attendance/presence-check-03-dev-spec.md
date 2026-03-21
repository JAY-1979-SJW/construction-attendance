# 중간 체류 확인 기능 — 개발 구현 상세 지시문

> 기준일: 2026-03-21
> 대상 시스템: attendance.haehan-ai.kr

---

## 1. 구현 원칙

- 기존 출근/이동/퇴근 핵심 흐름을 깨지 않음
- 유료 + 관리자 설정 조건일 때만 작동
- OFF 상태에서는 시스템 영향 최소화
- 실패/미응답 → 검토 플래그 중심 처리
- 기존 출퇴근 레코드 직접 무효화 금지

---

## 2. 구현 순서 (고정)

| 단계 | 내용 |
|------|------|
| 1 | Organization 설정 필드 추가 |
| 2 | PresenceCheck 테이블 생성 |
| 3 | Prisma 마이그레이션 |
| 4 | 관리자 설정 조회/저장 API |
| 5 | 관리자 설정 화면 |
| 6 | PresenceCheck 생성 스케줄러 |
| 7 | 만료 처리 배치 |
| 8 | 근로자 응답 API |
| 9 | 근로자 앱 체류 확인 화면 |
| 10 | 관리자 모니터링/검토 화면 |
| 11 | 무료/유료 권한 테스트 |
| 12 | 제한 조직 대상 시험 적용 |

---

## 3. DB 스키마

### Organization 테이블 추가 필드

```prisma
planType                             String  @default("FREE")  // FREE | PRO | ENTERPRISE
presenceCheckFeatureAvailable        Boolean @default(false)   // 플랜상 사용 가능 여부
presenceCheckEnabled                 Boolean @default(false)   // 관리자 활성화 여부
presenceCheckAmEnabled               Boolean @default(true)
presenceCheckPmEnabled               Boolean @default(true)
presenceCheckRadiusMeters            Int     @default(30)
presenceCheckResponseLimitMinutes    Int     @default(20)
presenceCheckFailureNeedsReview      Boolean @default(true)
```

### PresenceCheck 테이블 (신규)

```prisma
model PresenceCheck {
  id                  String    @id @default(cuid())
  organizationId      String
  workerId            String
  daySessionId        String
  siteSegmentId       String?
  siteId              String
  timeBucket          TimeBucket           // AM | PM
  scheduledAt         DateTime
  expiresAt           DateTime
  status              PresenceCheckStatus  // PENDING | COMPLETED | MISSED | OUT_OF_GEOFENCE | LOW_ACCURACY | SKIPPED
  respondedAt         DateTime?
  latitude            Float?
  longitude           Float?
  accuracyMeters      Float?
  distanceMeters      Float?
  appliedRadiusMeters Int?
  needsReview         Boolean   @default(false)
  reviewReason        String?   // MISSED_PRESENCE_CHECK | OUT_OF_GEOFENCE | LOW_ACCURACY
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([workerId, daySessionId, timeBucket])  // 동일 날짜+버킷 중복 방지
  @@index([organizationId, scheduledAt])
  @@index([workerId, scheduledAt])
  @@index([status])
}

enum TimeBucket { AM PM }
enum PresenceCheckStatus {
  PENDING COMPLETED MISSED OUT_OF_GEOFENCE LOW_ACCURACY SKIPPED
}
```

---

## 4. 관리자 설정 API

### GET `/api/admin/settings/attendance`

응답:
```json
{
  "planType": "PRO",
  "featureAvailable": true,
  "enabled": false,
  "amEnabled": true,
  "pmEnabled": true,
  "radiusMeters": 30,
  "responseLimitMinutes": 20,
  "failureNeedsReview": true
}
```

### POST `/api/admin/settings/attendance/presence-check`

요청:
```json
{
  "enabled": true,
  "amEnabled": true,
  "pmEnabled": true,
  "radiusMeters": 30,
  "responseLimitMinutes": 20,
  "failureNeedsReview": true
}
```

서버 검증:
- 관리자 권한 확인
- 유료 플랜 여부 확인
- radius: 10~100
- responseLimit: 5~60
- amEnabled=false AND pmEnabled=false AND enabled=true → 경고 반환

---

## 5. 스케줄러 설계

### 방식: 출근 후 생성 (권장)

출근 이벤트 발생 시, 또는 출근 후 남은 버킷에 대해 생성.

```
출근 시각 기준:
- 08:00 이전 출근 → AM + PM 모두 생성
- 11:30 이전 출근 → AM 생성 가능 여부 판단 + PM 생성
- 13:30 이후 출근 → PM만 생성
- 16:30 이후 출근 → 생성 안 함
```

### 랜덤 시각 생성

- AM: 09:30~11:30 사이 랜덤 1회
- PM: 13:30~16:30 사이 랜덤 1회

### 생성 조건 체크

```
1. organizationId 기준 planType = PRO 이상
2. presenceCheckEnabled = true
3. amEnabled / pmEnabled 해당 버킷 확인
4. 대상 근로자가 WORKING 상태
5. 이미 해당 (daySessionId, timeBucket) 생성 여부 확인
```

### 만료 처리 배치 (별도 cron)

- 주기: 5분마다 또는 expiresAt 도달 시
- PENDING 이고 expiresAt 지남 → MISSED
- failureNeedsReview=true → needsReview=true, reviewReason='MISSED_PRESENCE_CHECK'

---

## 6. 근로자 응답 API

### POST `/api/attendance/presence-check/respond`

요청:
```json
{
  "presenceCheckId": "...",
  "latitude": 37.123,
  "longitude": 127.456,
  "accuracy": 15.0
}
```

서버 처리 순서:
1. worker_token 인증
2. presenceCheck 존재 확인
3. 본인 요청 확인
4. status = PENDING 확인
5. expiresAt 이내 확인
6. 정확도 검사 (권장 기준: 50m 이하)
7. 현재 열린 siteSegment의 site 중심점과 거리 계산
8. 반경 내 → COMPLETED
9. 반경 밖 → OUT_OF_GEOFENCE
10. 정확도 낮음 → LOW_ACCURACY
11. failureNeedsReview=true면 needsReview=true 설정

응답 케이스:
- `{ success: true, status: "COMPLETED", distance: 25 }`
- `{ success: false, status: "OUT_OF_GEOFENCE", distance: 120 }`
- `{ success: false, status: "EXPIRED" }`
- `{ success: false, status: "LOW_ACCURACY" }`

---

## 7. 근로자 앱 UI

### 노출 조건
- 기능 활성화 조직
- 본인에게 PENDING 요청 존재
- expiresAt 이전

### 화면 요소
- 제목: "현장 체류 확인"
- 현재 현장명
- 남은 응답 시간 카운트다운
- 확인 버튼
- 안내: "확인 버튼을 누르면 현재 위치를 확인합니다."

### 응답 결과 메시지
| 상태 | 메시지 |
|------|--------|
| COMPLETED | "현장 체류 확인이 완료되었습니다." |
| OUT_OF_GEOFENCE | "현재 위치가 현장 반경 밖입니다." |
| LOW_ACCURACY | "위치 정확도가 낮습니다. 다시 시도해 주세요." |
| EXPIRED | "응답 시간이 지났습니다." |

---

## 8. 관리자 모니터링

### 경로: `/admin/presence-checks`

### 요약 카드
- 오늘 AM 대상/완료/미응답
- 오늘 PM 대상/완료/미응답
- 반경 밖 실패 수
- 정확도 부족 수

### 목록 컬럼
근로자명 / 현장명 / AM·PM / 예약시각 / 만료시각 / 상태 / 거리 / 정확도 / 검토 여부

### 필터
날짜 / 현장 / 상태 / 검토 필요만

---

## 9. needsReview 연계 정책

`needsReview=true` 설정 조건:
- MISSED
- OUT_OF_GEOFENCE
- LOW_ACCURACY

단, 조직 설정 `presenceCheckFailureNeedsReview=true`일 때만 적용.

연계 정책:
- 자동 미지급 처리 안 함
- 기존 노임 집계 검토 대상 목록에 포함
- 관리자 확인 후 최종 반영

---

## 10. 다중 현장 대응

- 응답 시점 기준 현재 열린 siteSegment로 거리 계산
- 기록에 생성 당시 siteId + 응답 당시 siteId 모두 저장 (향후 확장 고려)
- 초기 단순화: 생성 시점 연결된 site 기준으로 처리

---

## 11. 테스트 항목

### 정책
- [ ] 무료 플랜 → 기능 비활성화 확인
- [ ] 유료 플랜 → 설정 저장 가능 확인
- [ ] enabled=false → 스케줄 생성 안 됨

### 관리자 설정
- [ ] 반경/제한시간 저장
- [ ] 오전/오후 토글 저장
- [ ] invalid 값 차단 (반경<10, >100 등)
- [ ] 오전/오후 둘 다 OFF + enabled=true → 경고

### 스케줄러
- [ ] 오전/오후 랜덤 생성
- [ ] 출근 후 남은 버킷만 생성
- [ ] 이미 퇴근한 사람 제외
- [ ] 동일 (daySession+timeBucket) 중복 생성 방지

### 근로자 응답
- [ ] 반경 내 성공
- [ ] 반경 밖 실패
- [ ] 정확도 낮음 실패
- [ ] 제한시간 초과 실패
- [ ] 타인 요청 접근 차단

### 모니터링
- [ ] 상태별 집계 카드
- [ ] 검토 대상 필터
- [ ] AM/PM 구분 표시

---

## 12. 최종 구현 원칙 문구

> 중간 체류 확인 기능은 유료 플랜 조직에 한해 제공하며, 관리자 설정으로 활성화된 경우에만 작동한다. 출근 후 근무 중인 근로자에 대해 오전 및 오후 랜덤 시각에 PresenceCheck를 생성하고, 근로자가 확인 버튼을 누르면 현재 위치가 설정 반경 내인지 검사한다. 실패 또는 미응답 건은 설정에 따라 검토 대상으로 분류한다.
