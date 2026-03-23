# bankAccount 레거시 구조 정리 현황 (2026-03-23)

## 1. 현재 구조

### 레거시 구조 (Worker 테이블 내)
```prisma
model Worker {
  bankName    String?  // 은행명 (평문, 레거시)
  bankAccount String?  // 계좌번호 (평문, 레거시 — 마이그레이션 중)
}
```

### 신규 구조 (별도 테이블)
```prisma
model WorkerBankAccountSecure {
  bankCode                   String?  // 은행 코드
  bankName                   String?  // 은행명
  accountNumberEncrypted     String?  // AES-256-GCM 암호화
  accountNumberMasked        String?  // "****5678"
  accountNumberHash          String?  // HMAC-SHA256 (중복검색용)
  accountHolderNameEncrypted String?  // AES-256-GCM
  accountHolderNameMasked    String?  // 마스킹
  verifiedBy                 String?
  verifiedAt                 DateTime?
  collectedBy                String?
  collectedAt                DateTime?
}
```

## 2. 참조 경로 전수 조사

| 참조 위치 | 필드 | 용도 | 평가 |
|-----------|------|------|------|
| `app/admin/workers/[id]/page.tsx:513` | `worker.bankName` | 표시용 fallback | 수정 불필요 (표시용 허용) |
| `app/admin/workers/[id]/page.tsx:511-513` | `bankAccountSecure` 우선 | 마스킹 표시 | 정상 |
| `app/admin/contracts/new/page.tsx:252` | `bankAccountSecure?.bankName \|\| bankName` | 계약 자동채움 | 정상 (bankName은 평문 은행명으로 무방) |
| `app/admin/contracts/new/page.tsx:253` | `bankAccountSecure?.accountNumberMasked \|\| bankAccount` | **계약 자동채움 계좌번호** | **수정 완료** |
| `app/api/admin/workers/[id]/bank/route.ts` | `WorkerBankAccountSecure` 전용 | 입력/마스킹 조회 | 정상 |
| `app/api/admin/workers/[id]/bank/decrypt/route.ts` | SUPER_ADMIN 전용 복호화 | 원문 조회 | 정상 |

## 3. 권한/복호화 리스크

| 항목 | 결과 |
|------|------|
| 계좌 원문 복호화 권한 | SUPER_ADMIN 전용 (`requireRole(session, SUPER_ADMIN_ONLY)`) ✓ |
| COMPANY_ADMIN 평문 노출 경로 | 없음 — `/api/admin/` 하위이므로 미들웨어 차단 ✓ |
| 일반 ADMIN 계좌 조회 | 마스킹 값만 (`accountNumberMasked`) — 원문 접근 불가 ✓ |
| 감사로그 | 복호화 시 `ACCOUNT_DECRYPT_VIEW` 기록 ✓ |

## 4. 즉시 수정 항목

**`app/admin/contracts/new/page.tsx:253`**
- 수정 전: `w.bankAccountSecure?.accountNumberMasked || w.bankAccount || ''`
- 수정 후: `w.bankAccountSecure?.accountNumberMasked || ''`
- 이유: 레거시 `bankAccount` (평문 계좌번호)가 계약 필드에 직접 삽입되는 경로 차단

## 5. 잔여 마이그레이션 항목

| 항목 | 상태 | 우선순위 |
|------|------|----------|
| `Worker.bankAccount` DB 컬럼 물리 삭제 | 미완 — 기존 데이터 보존 중 | 낮음 (데이터 마이그레이션 후) |
| `Worker.bankName` DB 컬럼 물리 삭제 | 미완 | 낮음 |
| 기존 레거시 데이터 → `WorkerBankAccountSecure` 이행 스크립트 | 미작성 | 중간 |
| 근로자 상세 화면 `worker.bankName` fallback 제거 | 표시용이므로 허용 | 낮음 (데이터 이행 후) |

## 6. 판정

**핵심 리스크(계약 자동채움에 평문 계좌번호 삽입) 차단 완료.**

잔여 레거시 컬럼은 기존 데이터 보존을 위해 유지 중이며, 신규 데이터는 모두 `WorkerBankAccountSecure`로 저장. 레거시 컬럼 물리 삭제는 전체 데이터 이행 완료 후 별도 마이그레이션으로 진행.
