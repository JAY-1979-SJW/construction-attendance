/**
 * presence-time.ts
 * PresenceCheck 시간 계산 유틸리티 — 외부 라이브러리 불필요 (KST = UTC+9)
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 'HH:mm' 문자열 → 하루 중 분(minute-of-day) 변환
 * 예: "09:30" → 570
 */
export function parseTimeStringToMinutes(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error(`Invalid time format: "${value}" (expected HH:mm)`)
  }
  const [hh, mm] = value.split(':').map(Number)
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw new Error(`Time out of range: "${value}"`)
  }
  return hh * 60 + mm
}

/**
 * 시작/종료 시각 문자열 검증
 */
export function validateWindow(
  start: string,
  end: string,
): { ok: boolean; startMinutes?: number; endMinutes?: number; reason?: string } {
  if (!start || !end) {
    return { ok: false, reason: 'start or end is empty' }
  }
  try {
    const startMinutes = parseTimeStringToMinutes(start)
    const endMinutes   = parseTimeStringToMinutes(end)
    if (startMinutes >= endMinutes) {
      return { ok: false, reason: `start(${start}) must be before end(${end})` }
    }
    return { ok: true, startMinutes, endMinutes }
  } catch (e) {
    return { ok: false, reason: (e as Error).message }
  }
}

/**
 * [startMinutes, endMinutes] 범위 내 임의 분(minute-of-day) 반환
 */
export function randomMinuteBetween(startMinutes: number, endMinutes: number): number {
  const range = endMinutes - startMinutes
  return startMinutes + Math.floor(Math.random() * (range + 1))
}

/**
 * Date → KST 기준 'YYYY-MM-DD' 문자열
 * 예: UTC 2026-03-20T16:00:00Z → "2026-03-21" (KST 01:00)
 */
export function toSeoulDateKey(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS)
  return kst.toISOString().slice(0, 10)
}

/**
 * 'YYYY-MM-DD' + minute-of-day → KST 해당 시각의 UTC Date
 * 예: ("2026-03-21", 617) → 2026-03-21T01:17:00.000Z (UTC)
 *     → KST 기준 10:17
 */
export function buildSeoulScheduledAt(dateKey: string, minuteOfDay: number): Date {
  const hh = Math.floor(minuteOfDay / 60)
  const mm = minuteOfDay % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  // KST 시각을 ISO 문자열로 구성 → Date 파싱 (자동 UTC 변환)
  return new Date(`${dateKey}T${pad(hh)}:${pad(mm)}:00+09:00`)
}
