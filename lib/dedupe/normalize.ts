/**
 * 공통 정규화 함수
 * 현장/근로자/계약 중복 검증에서 사용하는 비교용 정규화 유틸리티
 */

/** 현장명 정규화: 공백·괄호·하이픈·쉼표·마침표 제거, 소문자 변환 */
export function normalizeSiteName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s()\-,.\[\]{}·•\/\\]/g, '')
    .replace(/[ㆍ‧]/g, '') // 가운데점 변형
}

/** 주소 정규화: 공백 축소, 괄호 제거, 소문자, 불필요 접미사 제거 */
export function normalizeAddress(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, ' ')
    .replace(/[()[\]{}]/g, '')
    .replace(/,\s*/g, ' ')
    .replace(/\s+/g, '')
}

/** 사람 이름 정규화: 공백 제거, 소문자 */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s/g, '')
}

/** 전화번호 정규화: 숫자만 남김 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** 생년월일 정규화: YYYYMMDD (숫자 8자리) */
export function normalizeBirthDate(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // 6자리 (YYMMDD) → 8자리 변환
  if (digits.length === 6) {
    const yy = parseInt(digits.slice(0, 2), 10)
    const prefix = yy >= 0 && yy <= 30 ? '20' : '19'
    return prefix + digits
  }
  if (digits.length === 8) return digits
  return digits // 파싱 불가 시 원본 숫자 반환
}

/** 두 좌표 간 거리 (미터, Haversine) */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** 두 문자열 간 유사도 (0~1, Dice coefficient) */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigramsA = new Set<string>()
  const bigramsB = new Set<string>()
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2))
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2))
  let intersection = 0
  bigramsA.forEach(bg => { if (bigramsB.has(bg)) intersection++ })
  return (2 * intersection) / (bigramsA.size + bigramsB.size)
}
