/**
 * 임시 민감 서류 보관 · 삭제 정책
 *
 * 이 파일은 TempSensitiveDocument 자동 삭제 기준을 정의한다.
 * 실제 삭제 로직은 app/api/cron/cleanup-temp-docs/route.ts 가 담당한다.
 */

// ─── 보관 기간 ───────────────────────────────────────────────────────────────

/** 서류 최대 보관 기간 (일) — 이 기간 초과 시 자동 삭제 */
export const TEMP_DOC_MAX_RETENTION_DAYS = 5

/** 다운로드 후 자동 삭제 대기 시간 (시간) */
export const TEMP_DOC_POST_DOWNLOAD_DELETE_HOURS = 24

// ─── 삭제 사유 문구 (DB 저장 및 감사로그용) ──────────────────────────────────

export const TEMP_DOC_DELETE_REASON = {
  EXPIRED:        `${TEMP_DOC_MAX_RETENTION_DAYS}일 보관 기간 초과 자동 삭제`,
  POST_DOWNLOAD:  `다운로드 후 ${TEMP_DOC_POST_DOWNLOAD_DELETE_HOURS}시간 경과 자동 삭제`,
} as const

export const TEMP_DOC_EVENT_REASON = {
  EXPIRED:        `${TEMP_DOC_MAX_RETENTION_DAYS}일 보관 기간 초과`,
  POST_DOWNLOAD:  `다운로드 후 ${TEMP_DOC_POST_DOWNLOAD_DELETE_HOURS}h 경과`,
} as const
