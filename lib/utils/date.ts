// 한국 시간(KST = UTC+9) 기준 날짜 처리
//
// ※ workDate 저장 규칙
//   - DB 컬럼 타입: @db.Date (PostgreSQL DATE)
//   - PostgreSQL은 TIMESTAMP를 DATE로 캐스팅할 때 UTC 날짜 기준으로 처리
//   - 따라서 '2026-03-22'(KST 업무일)를 저장할 때는
//     반드시 UTC 자정(2026-03-22T00:00:00Z)으로 변환해야 올바른 날짜가 저장됨
//   - kstDateStringToDate()가 이 변환을 담당

const KST_OFFSET = 9 * 60 * 60 * 1000

/**
 * Date → KST 기준 'YYYY-MM-DD' 문자열
 * 예: new Date('2026-03-22T01:00:00Z') → '2026-03-22' (KST 10:00)
 */
export function toKSTDateString(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + KST_OFFSET)
  return kst.toISOString().slice(0, 10)
}

/**
 * 'YYYY-MM-DD' 문자열 → DB 저장용 Date (UTC 자정)
 *
 * PostgreSQL DATE 컬럼은 UTC 타임스탬프의 날짜 부분으로 저장되므로
 * KST 업무일 'YYYY-MM-DD'를 그대로 UTC 자정으로 변환해 저장해야 한다.
 * '+09:00' 사용 시 UTC로 환산하면 전날 15:00가 되어 하루 밀리는 버그 발생.
 *
 * 예: '2026-03-22' → new Date('2026-03-22T00:00:00.000Z') → DB에 2026-03-22 저장
 */
export function kstDateStringToDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/**
 * Date → KST 'HH:mm' 문자열
 * 예: new Date('2026-03-22T00:00:00Z') → '09:00'
 */
export function toKSTTimeString(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET)
  return kst.toISOString().slice(11, 16)
}

/**
 * OTP 만료 시각 계산
 */
export function otpExpiresAt(minutes = 5): Date {
  return new Date(Date.now() + minutes * 60 * 1000)
}
