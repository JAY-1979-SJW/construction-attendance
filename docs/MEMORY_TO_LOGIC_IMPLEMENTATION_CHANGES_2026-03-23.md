# 메모리 → 로직 변환 실제 반영 내역

- 작성일: 2026-03-23
- 목적: 이번 단계에서 새로 로직화한 항목 상세 기록

---

## 반영 항목 1. 일용직 계약서 위험 문구 방지 로직

### 반영 메모리 항목

> 일용직 계약서에 "계속고용 보장", "상시근로", "무기계약", "정규직" 표현 금지
> (출처: `docs/DAILY_WORKER_DOCUMENTS_OPERATIONS_CHECKLIST_2026-03-23.md` D-4항)

### 신규 파일

**`lib/contracts/validate-contract.ts`**

```
validateDailyContractDangerPhrases(text: string): DangerPhraseResult
extractContractText(rendered: RenderedContract): string
```

금지 패턴 목록:
- `/계속\s*고용\s*(을\s*)?보장/`
- `/고용\s*보장/`
- `/상시\s*(근로|고용|채용)/`
- `/무기\s*계약\s*(으로\s*)?전환/`
- `/정규직\s*(으로\s*)?전환/`
- `/기본급\s*\d[\d,]*\s*원/` (일용직 계약서에 기본급 금액 표현 금지)

### 수정 파일

**`app/api/admin/contracts/[id]/generate-pdf/route.ts`**

- `validateDailyContractDangerPhrases`, `extractContractText` import 추가
- `tmpl === 'DAILY_EMPLOYMENT'`일 때 렌더링 후 위험 문구 검출 실행
- 위험 문구 발견 시 응답에 `warnings` 배열 포함 (경고, 차단 아님)
- 예시 응답:
  ```json
  {
    "success": true,
    "data": {
      "id": "...",
      "contentText": "...",
      "warnings": ["[위험문구] \"고용 보장\" 발견: ...앞뒤 문맥..."]
    }
  }
  ```

### 테스트 결과

- 현재 `renderDailyEmploymentContract` 템플릿 자체는 위험 문구 없음 (정상)
- `specialTerms` 또는 `taskDescription`에 관리자가 직접 입력한 경우 검출 가능
- 이번 구현은 **경고(warning)** 수준 — 생성 자체를 차단하지 않음
- 관리자 UI에서 경고 표시 연동은 후속 과제

---

## 반영 항목 2. 체류확인 featureAvailable 이중 게이트 강화

### 반영 메모리 항목

> "체류확인 기능은 유료 플랜 전용. 기본값 OFF. 관리자 활성화 시에만 동작."
> (출처: `project_presence_check.md`)

### 수정 파일

**`lib/attendance/presence-scheduler.ts`**

기존: `presenceCheckEnabled` 체크만 있었음

추가:
```typescript
// 유료 플랜 기능 게이트 — featureAvailable이 false이면 무조건 스킵
if (!settings?.presenceCheckFeatureAvailable) {
  console.info('[presence] skipped: feature not available (paid plan required)', { attendanceLogId })
  return
}
```

이중 게이트:
1. `presenceCheckFeatureAvailable` — 유료 플랜 활성화 여부 (SUPER_ADMIN이 수동 설정)
2. `presenceCheckEnabled` — 관리자가 실제로 켰는지

### 기존에 이미 있던 게이트

- 설정 변경 API (`app/api/admin/settings/attendance/route.ts` L78): featureAvailable 체크로 설정 변경 자체를 차단

### 영향

- `presenceCheckEnabled=true`이지만 `presenceCheckFeatureAvailable=false`인 경우 → 이제 스케줄링 차단됨
- 기존 운영 중 데이터에 영향 없음

---

## 반영 항목 3. 공수 계산 주석 정확화

### 반영 메모리 항목

> "오전 7시부터 오후 4시까지 근무해야 1.0 공수 인정"
> (메모리/운영 규칙)

### 수정 파일

**`lib/labor/work-confirmations.ts`** — 파일 상단 주석

기존 주석: `"공수 판정 기준 (07:00~16:00, 점심 1시간, 실근로 8시간 = 1.0 공수)"`

수정 후:
```
공수 판정 기준 (점심 1시간 자동 차감 → 실근로 시간 기준 판정)
  예: 07:00~16:00 근무(9h 경과) → 점심 1h 차감 → 실근로 8h → 1.0 공수

  판정 규칙 (workedMinutesRawFinal 기준):
  - 경과 4시간(240분) 초과 시 점심 60분 자동 차감 → effectiveMinutes 산출
  - effectiveMinutes ≥ 480분 (8시간) → FULL_DAY  1.0
  - effectiveMinutes ≥ 240분 (4시간) → HALF_DAY  0.5
  - effectiveMinutes <  240분 / 미퇴근 / INVALID presenceStatus → INVALID  0

  주의: 07:00~16:00은 예시 시나리오. 실제 출근 허용 시간은 .env CHECKIN_ALLOWED_START_TIME 설정.
  임계값(480분/240분)은 근로기준법 기반 고정값이며 관리자 설정으로 변경 불가.
```

### 의미

- 운영자/개발자가 "공수 기준 = 07:00~16:00 고정"으로 오해하지 않도록 명시
- 실제 임계값(480분/240분)이 법정 기준 고정값임을 문서화

---

## 검증 (TypeScript 컴파일)

```
npx tsc --noEmit 2>&1 | grep -E "validate-contract|presence-scheduler|work-confirmations"
```

결과: 새로 추가한 파일에 관련된 새 오류 없음 (기존 Prisma 스키마 드리프트 오류는 사전 존재)

---

## 배포

코드 변경 파일:
- `lib/contracts/validate-contract.ts` (신규)
- `app/api/admin/contracts/[id]/generate-pdf/route.ts`
- `lib/attendance/presence-scheduler.ts`
- `lib/labor/work-confirmations.ts`

다음 배포 시 Docker rebuild 필요 (정기 배포에 포함).
