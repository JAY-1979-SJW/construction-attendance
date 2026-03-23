/**
 * 마스킹 유틸
 *
 * 정책:
 *   주민등록번호: 800101-1****** (뒷자리 마지막 6자 마스킹)
 *   휴대폰번호: 010-12**-5678 (중간 2자리 마스킹)
 *   계좌번호: ****5678 (마지막 4자리만 표시)
 *   주소: 시/도 + 시/군/구 + 나머지 마스킹
 */

/**
 * 주민등록번호 마스킹
 * 입력: "8001011234567" 또는 "800101-1234567"
 * 출력: "800101-1******"
 */
export function maskRrn(rrn: string): string {
  const clean = rrn.replace(/-/g, '')
  if (clean.length !== 13) return '******-*******'
  return `${clean.slice(0, 6)}-${clean[6]}******`
}

/**
 * 휴대폰번호 마스킹
 * 입력: "01012345678" 또는 "010-1234-5678"
 * 출력: "010-12**-5678"
 */
export function maskPhone(phone: string): string {
  const clean = phone.replace(/-/g, '')
  if (clean.length === 11) {
    // 010-XXXX-XXXX
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}**-${clean.slice(7)}`
  }
  if (clean.length === 10) {
    // 02-XXXX-XXXX 또는 031-XXX-XXXX
    return `${clean.slice(0, 3)}-**-${clean.slice(6)}`
  }
  return phone.slice(0, 4) + '****' + phone.slice(-4)
}

/**
 * 계좌번호 마스킹
 * 출력: 마지막 4자리만 표시 ("****5678")
 */
export function maskAccountNumber(account: string): string {
  const clean = account.replace(/-/g, '')
  if (clean.length <= 4) return clean
  return '*'.repeat(clean.length - 4) + clean.slice(-4)
}

/**
 * 주소 마스킹
 * 시/도 + 시/군/구까지만 표시, 나머지는 ***
 */
export function maskAddress(address: string): string {
  if (!address) return ''
  // 공백 기준으로 토큰 분리
  const tokens = address.trim().split(/\s+/)
  if (tokens.length <= 2) return address
  // 앞 2토큰 유지, 나머지 마스킹
  return `${tokens[0]} ${tokens[1]} ***`
}

/**
 * 이름 마스킹
 * "홍길동" → "홍*동" (이름 중간 마스킹)
 */
export function maskName(name: string): string {
  if (!name || name.length < 2) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}
