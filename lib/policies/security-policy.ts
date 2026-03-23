/**
 * 보안 · 권한 · 개인정보 운영 정책
 *
 * 이 파일은 권한 경계, 개인정보 처리 원칙, 계좌정보 접근 규칙을 정의한다.
 * 실제 검증 로직은 lib/auth/guards.ts 가 담당한다.
 */

// ─── 역할 분류 ───────────────────────────────────────────────────────────────

/** 플랫폼 관리자 역할 목록 (업체 관리자 제외) */
export const PLATFORM_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] as const

/** 데이터 변경 허용 역할 (VIEWER 제외) */
export const MUTATE_ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const

/** SUPER_ADMIN 전용 작업 (복호화, 강제 삭제 등) */
export const SUPER_ADMIN_ONLY_ROLES = ['SUPER_ADMIN'] as const

/** 업체 관리자 역할 */
export const COMPANY_ADMIN_ROLE = 'COMPANY_ADMIN' as const

// ─── bankAccount 접근 원칙 ───────────────────────────────────────────────────

/**
 * 계좌정보 접근 원칙
 *
 * 1. 신규 데이터는 반드시 WorkerBankAccountSecure에 저장 (AES-256-GCM 암호화)
 * 2. 레거시 Worker.bankAccount / bankName 필드는 이행 완료 — 코드 참조 전면 제거
 *    컬럼 삭제 migration 준비 완료 (prisma/migrations/bank_legacy_column_drop.sql 참조)
 * 3. 계좌 원문(accountNumberEncrypted) 복호화는 SUPER_ADMIN 전용 + 사유 필수 + 감사로그 의무
 * 4. 마스킹값(accountNumberMasked)은 ADMIN 이상 조회 가능
 * 5. COMPANY_ADMIN은 계좌정보에 접근할 수 없음 (/api/admin/ 경로 차단)
 */
export const BANK_ACCOUNT_POLICY = {
  /** 원문 복호화 허용 역할 */
  decryptAllowedRoles: SUPER_ADMIN_ONLY_ROLES,
  /** 마스킹 조회 허용 역할 */
  maskedViewAllowedRoles: MUTATE_ALLOWED_ROLES,
  /** 계약 자동채움 시 레거시 Worker.bankAccount 사용 허용 여부 */
  allowLegacyBankAccountFallback: false,
  /** 레거시 Worker.bankName 표시용 fallback 허용 여부 — 이행 완료로 false 고정 */
  allowLegacyBankNameDisplay: false,
} as const

// ─── 개인정보 마스킹 원칙 ────────────────────────────────────────────────────

/**
 * 마스킹 원칙 요약 (실제 마스킹 함수는 lib/crypto/mask.ts 참조)
 * - 주민등록번호: 앞 7자(YYMMDD-S) 표시, 뒷자리 6개 마스킹
 * - 휴대폰번호: 중간 번호 2자리 마스킹 (010-12**-5678)
 * - 계좌번호: 마지막 4자리만 표시 (****5678)
 * - 주소: 시/도 + 시/군/구까지만 표시, 이하 *** 처리
 * - 이름: 이름 중간 글자 마스킹 (홍*동)
 */
export const MASKING_POLICY = {
  rrnVisibleChars: 7,       // 앞 7자 (YYMMDD-S)
  phoneMiddleMaskLen: 2,    // 중간 2자리 마스킹
  accountLastVisible: 4,    // 마지막 4자리 표시
  addressVisibleTokens: 2,  // 시/도, 시군구 2토큰
} as const

// ─── 감사로그 의무 작업 목록 ─────────────────────────────────────────────────

/**
 * 반드시 감사로그를 남겨야 하는 작업 유형
 * (실제 기록은 lib/audit/write-audit-log.ts 담당)
 */
export const AUDIT_REQUIRED_ACTIONS = [
  'ACCOUNT_DECRYPT_VIEW',   // 계좌 원문 복호화 조회
  'SENSITIVE_PROFILE_UPDATED',  // 민감정보 수정
  'UPDATE_WORKED_MINUTES',  // 공수 수동 수정
  'APPROVE_DEVICE',         // 기기 승인
  'REJECT_DEVICE',          // 기기 거절
  'DOCUMENT_GENERATE',      // 문서 생성
] as const
