/**
 * 보안 · 권한 · 개인정보 운영 정책
 *
 * 이 파일은 권한 경계, 개인정보 처리 원칙, 계좌정보 접근 규칙을 정의한다.
 * 실제 검증 로직은 lib/auth/guards.ts 가 담당한다.
 */

// ─── 역할 분류 ───────────────────────────────────────────────────────────────

/** 플랫폼 관리자 역할 목록 (업체 관리자 제외) */
export const PLATFORM_ADMIN_ROLES = ['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'VIEWER'] as const

/** 데이터 변경 허용 역할 (VIEWER 제외, COMPANY_ADMIN 포함) */
export const MUTATE_ALLOWED_ROLES = ['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'COMPANY_ADMIN'] as const

/** SUPER_ADMIN 전용 작업 (복호화, 강제 삭제 등) */
export const SUPER_ADMIN_ONLY_ROLES = ['SUPER_ADMIN'] as const

/** 업체 관리자 역할 */
export const COMPANY_ADMIN_ROLE = 'COMPANY_ADMIN' as const

/** 현장 관리자 역할 */
export const SITE_ADMIN_ROLE = 'SITE_ADMIN' as const

/** 외부 현장 관리자 역할 (협력사·파트너 — 접근 그룹으로만 현장 접근, 회사 데이터 완전 차단) */
export const EXTERNAL_SITE_ADMIN_ROLE = 'EXTERNAL_SITE_ADMIN' as const

/**
 * 현장 범위 접근 역할 (SITE_ADMIN + EXTERNAL_SITE_ADMIN)
 * - 현장 운영 데이터 읽기 허용
 * - 회사 수준 데이터는 각각의 canAccessCompany() 검사로 별도 통제
 */
export const SITE_SCOPE_ROLES = ['SITE_ADMIN', 'EXTERNAL_SITE_ADMIN'] as const

/**
 * /admin 포털 진입 허용 역할 (COMPANY_ADMIN 제외, SITE_ADMIN/EXTERNAL_SITE_ADMIN 포함)
 * middleware에서 COMPANY_ADMIN만 차단하므로 이 목록은 참조용
 */
export const ADMIN_PORTAL_ROLES = ['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'VIEWER', 'SITE_ADMIN', 'EXTERNAL_SITE_ADMIN'] as const

/**
 * 현장성 데이터 쓰기 허용 역할 (SITE_ADMIN은 scope 내에서만 허용)
 * EXTERNAL_SITE_ADMIN은 읽기 전용 — 쓰기 작업에는 포함하지 않음
 */
export const SITE_MUTATE_ROLES = ['SUPER_ADMIN', 'HQ_ADMIN', 'ADMIN', 'SITE_ADMIN'] as const

// ─── 기능별 권한 매트릭스 ─────────────────────────────────────────────────────

/**
 * 관리자 기능 식별자
 *
 * WORKER_VIEW       — 근로자 목록·상세 조회
 * ATTENDANCE_APPROVE — 출근 승인/반려 (REVIEW_REQUIRED 상태 처리)
 * SITE_WRITE        — 현장 등록·수정
 * COMPANY_MANAGE    — 업체 관리 (등록·수정·배정)
 * DOCUMENT_DOWNLOAD — 문서 조회·다운로드
 * STATS_VIEW        — 통계·리포트 조회
 */
export type AdminFeature =
  | 'WORKER_VIEW'
  | 'ATTENDANCE_APPROVE'
  | 'SITE_WRITE'
  | 'COMPANY_MANAGE'
  | 'DOCUMENT_DOWNLOAD'
  | 'STATS_VIEW'

/** 기능 한글 레이블 */
export const FEATURE_LABELS: Record<AdminFeature, string> = {
  WORKER_VIEW:        '근로자 조회',
  ATTENDANCE_APPROVE: '출근 승인/반려',
  SITE_WRITE:         '현장 등록/수정',
  COMPANY_MANAGE:     '업체 관리',
  DOCUMENT_DOWNLOAD:  '문서 조회/다운로드',
  STATS_VIEW:         '통계 조회',
}

/**
 * 역할별 허용 기능 목록
 *
 * - SUPER_ADMIN : 전체 허용 (계좌 복호화는 별도 SUPER_ADMIN_ONLY_ROLES로 제어)
 * - HQ_ADMIN    : 전체 허용 (계좌 복호화 제외)
 * - ADMIN       : HQ_ADMIN 동등 (레거시 호환)
 * - VIEWER      : 조회·다운로드·통계만
 * - SITE_ADMIN  : 담당 현장 내 근로자 조회 + 출근 승인 + 문서·통계
 * - EXTERNAL_SITE_ADMIN : 담당 현장 내 근로자 조회 + 통계 (읽기 전용)
 * - COMPANY_ADMIN : 자사 근로자 조회 + 문서·통계
 */
export const ROLE_FEATURE_PERMISSIONS: Record<string, readonly AdminFeature[]> = {
  SUPER_ADMIN:        ['WORKER_VIEW', 'ATTENDANCE_APPROVE', 'SITE_WRITE', 'COMPANY_MANAGE', 'DOCUMENT_DOWNLOAD', 'STATS_VIEW'],
  HQ_ADMIN:           ['WORKER_VIEW', 'ATTENDANCE_APPROVE', 'SITE_WRITE', 'COMPANY_MANAGE', 'DOCUMENT_DOWNLOAD', 'STATS_VIEW'],
  ADMIN:              ['WORKER_VIEW', 'ATTENDANCE_APPROVE', 'SITE_WRITE', 'COMPANY_MANAGE', 'DOCUMENT_DOWNLOAD', 'STATS_VIEW'],
  VIEWER:             ['WORKER_VIEW', 'DOCUMENT_DOWNLOAD', 'STATS_VIEW'],
  SITE_ADMIN:         ['WORKER_VIEW', 'ATTENDANCE_APPROVE', 'DOCUMENT_DOWNLOAD', 'STATS_VIEW'],
  EXTERNAL_SITE_ADMIN:['WORKER_VIEW', 'STATS_VIEW'],
  COMPANY_ADMIN:      ['WORKER_VIEW', 'DOCUMENT_DOWNLOAD', 'STATS_VIEW'],
}

/**
 * 역할이 특정 기능 권한을 보유하는지 확인한다.
 * 사용 예: if (!hasFeaturePermission(session.role, 'ATTENDANCE_APPROVE')) return forbidden(...)
 */
export function hasFeaturePermission(role: string | undefined, feature: AdminFeature): boolean {
  if (!role) return false
  return (ROLE_FEATURE_PERMISSIONS[role] ?? []).includes(feature)
}

/** 역할 한글 레이블 */
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:         '대표',
  HQ_ADMIN:            '본사관리자',
  ADMIN:               '관리자(레거시)',
  VIEWER:              '조회자',
  SITE_ADMIN:          '현장관리자',
  EXTERNAL_SITE_ADMIN: '외부현장관리자',
  COMPANY_ADMIN:       '업체관리자',
}

/** 역할별 접근 범위 설명 */
export const ROLE_SCOPE_DESCRIPTION: Record<string, string> = {
  SUPER_ADMIN:         '전체 현장 · 전체 업체',
  HQ_ADMIN:            '전체 현장 · 전체 업체',
  ADMIN:               '전체 현장 · 전체 업체',
  VIEWER:              '전체 현장 (읽기 전용)',
  SITE_ADMIN:          '담당 현장만 (SiteAdminAssignment)',
  EXTERNAL_SITE_ADMIN: '배정된 현장 그룹만 (읽기 전용)',
  COMPANY_ADMIN:       '소속 업체 + 해당 업체 참여 현장만',
}

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
