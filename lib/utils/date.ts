// 한국 시간(KST = UTC+9) 기준 날짜 처리

const KST_OFFSET = 9 * 60 * 60 * 1000

/**
 * 현재 KST 시각 반환
 */
export function nowKST(): Date {
  return new Date(Date.now() + KST_OFFSET)
}

/**
 * Date → KST 기준 'YYYY-MM-DD' 문자열
 */
export function toKSTDateString(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + KST_OFFSET)
  return kst.toISOString().slice(0, 10)
}

/**
 * 'YYYY-MM-DD' 문자열 → KST 자정 Date (DB work_date 저장용)
 */
export function kstDateStringToDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`)
}

/**
 * Date → KST 'HH:mm' 문자열
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
