export interface GeocodedResult {
  normalizedAddress: string
  latitude: number
  longitude: number
  confidence: 'HIGH' | 'LOW'
}

/** 카카오 REST API로 주소 → 좌표 변환 */
async function geocodeWithKakao(address: string): Promise<GeocodedResult | null> {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) return null
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const doc = data.documents?.[0]
    if (!doc) return null
    return {
      normalizedAddress: doc.address_name ?? address,
      latitude: parseFloat(doc.y),
      longitude: parseFloat(doc.x),
      confidence: 'HIGH',
    }
  } catch {
    return null
  }
}

/** Nominatim(OpenStreetMap) 무료 지오코딩 — 한국 주소 보조 */
async function geocodeWithNominatim(address: string): Promise<GeocodedResult | null> {
  try {
    const query = encodeURIComponent(`${address} 대한민국`)
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=ko&countrycodes=kr`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HaehanAttendanceSystem/1.0 (construction-attendance)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const item = data[0]
    if (!item || parseFloat(item.lat) === 0) return null
    return {
      normalizedAddress: item.display_name ?? address,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      confidence: 'LOW',
    }
  } catch {
    return null
  }
}

/**
 * 주소 → 좌표 변환.
 * 우선순위: Kakao REST API (KAKAO_REST_API_KEY 설정 시) → Nominatim 무료 API → null
 */
export async function geocodeAddress(address: string): Promise<GeocodedResult | null> {
  const kakao = await geocodeWithKakao(address)
  if (kakao) return kakao

  // Nominatim 1 req/s 제한 — 호출 측에서 delay 처리
  return geocodeWithNominatim(address)
}

/** ms 단위 sleep */
export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
