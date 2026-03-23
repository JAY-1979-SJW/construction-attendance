/**
 * 계약서 · 문서 운영 정책
 *
 * 이 파일은 계약서 검증 기준, 문서 생성 원칙, 위험 문구 목록을 정의한다.
 * 실제 검출 로직은 lib/contracts/validate-contract.ts 가 담당한다.
 * 실제 PDF/DOC 생성 로직은 app/api/admin/contracts/[id]/generate-pdf/route.ts 등이 담당한다.
 */

// ─── 위험 문구 검출 모드 ─────────────────────────────────────────────────────

/**
 * 위험 문구 감지 시 동작 모드
 * - 'ADVISORY': 경고만 표시, 생성 차단 안 함 (현재 운영 정책)
 * - 'BLOCKING': 경고 + 생성 차단 (추후 강화 시 사용)
 */
export const DANGER_PHRASE_MODE: 'ADVISORY' | 'BLOCKING' = 'ADVISORY'

/**
 * 위험 문구 검출 적용 대상 계약 유형
 * 이 목록에 없는 유형은 위험 문구 검출을 수행하지 않는다.
 */
export const DANGER_PHRASE_APPLICABLE_TEMPLATES: string[] = [
  'DAILY_EMPLOYMENT',
]

// ─── 일용직 계약서 금지 문구 목록 ────────────────────────────────────────────

/**
 * 일용직 계약서에 포함되면 안 되는 문구 (근로관계 법적 해석 오해 방지)
 * 근거: 일용직 계약서 운영 체크리스트 D-4항
 *
 * 규칙 변경 시 이 배열만 수정하면 된다.
 * validate-contract.ts는 이 배열을 참조하여 검출 수행.
 */
export const DAILY_CONTRACT_FORBIDDEN_PATTERNS: RegExp[] = [
  // "계속 고용"을 보장하는 표현
  /계속\s*고용\s*(을\s*)?보장/,
  /고용\s*보장/,
  /계속적\s*(으로\s*)?고용/,

  // "상시 근로" 표현
  /상시\s*(근로|고용|채용)/,

  // "무기계약" / "정규직" 표현
  /무기\s*계약\s*(으로\s*)?전환/,
  /정규직\s*(으로\s*)?전환/,
  /무기\s*근로자/,

  // 월급제 또는 고정급 표현이 일용직 계약서에 포함된 경우
  /기본급\s*\d[\d,]*\s*원/,
]

// ─── 문서 스냅샷 불변성 원칙 ─────────────────────────────────────────────────

/**
 * 계약서 생성 시 workerName 출처 우선순위
 * 1. ContractVersion.snapshotJson.worker.name (기존 버전 스냅샷)
 * 2. contract.worker.name (live DB — 최초 생성 시에만)
 *
 * 이유: 근로자 마스터 이름이 변경되어도 과거 계약서는 원래 이름을 유지해야 한다.
 */
export const SNAPSHOT_WORKER_NAME_PRIORITY = 'SNAPSHOT_FIRST' as const

/**
 * snapshotJson에서 workerName을 추출하는 헬퍼
 * generate-pdf / generate-doc 라우트에서 사용
 */
export function extractSnapshotWorkerName(
  snapshotJson: unknown
): string | undefined {
  if (!snapshotJson || typeof snapshotJson !== 'object') return undefined
  const snap = snapshotJson as Record<string, unknown>
  const worker = snap.worker
  if (!worker || typeof worker !== 'object') return undefined
  const name = (worker as Record<string, unknown>).name
  return typeof name === 'string' ? name : undefined
}

// ─── 위험 문구 경고 UI 표시 문구 ─────────────────────────────────────────────

export const DANGER_PHRASE_UI = {
  title: '계약서에 위험 문구가 감지되었습니다',
  description:
    '아래 표현은 일용직 계약서에 포함될 경우 근로관계의 법적 해석이 달라질 수 있습니다. '
    + '계약서를 저장·교부하기 전에 반드시 검토하십시오. (생성 자체는 완료되었습니다.)',
  checklist: [
    '해당 문구가 특약사항 또는 메모에서 유입된 것인지 확인',
    '계속고용·정규직 전환 의미로 오해될 표현은 삭제 또는 수정',
    '수정 후 계약서를 재생성하십시오',
  ],
} as const
