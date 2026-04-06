export interface GeocodedResult {
  normalizedAddress: string
  latitude: number
  longitude: number
  confidence: 'HIGH' | 'LOW'
}

/** VWorld Geocoder API로 주소 → 좌표 변환
 *  type=road(도로명) 먼저 시도, 없으면 type=parcel(지번) 재시도
 */
async function geocodeWithVWorld(address: string): Promise<GeocodedResult | null> {
  const key = process.env.NEXT_PUBLIC_VWORLD_API_KEY
  if (!key) return null

  const tryType = async (type: 'road' | 'parcel'): Promise<GeocodedResult | null> => {
    try {
      const url =
        `https://api.vworld.kr/req/address` +
        `?service=address&request=getcoord&version=2.0&crs=epsg:4326` +
        `&address=${encodeURIComponent(address)}&format=json&type=${type}&key=${key}`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return null
      const data = await res.json()
      if (data?.response?.status !== 'OK') return null
      const point = data.response?.result?.point
      if (!point?.x || !point?.y) return null
      return {
        normalizedAddress: address,
        latitude:  parseFloat(point.y),
        longitude: parseFloat(point.x),
        confidence: 'HIGH',
      }
    } catch { return null }
  }

  const road = await tryType('road')
  if (road) return road
  return tryType('parcel')
}

/**
 * 주소 → 좌표 변환.
 * VWorld Geocoder API (NEXT_PUBLIC_VWORLD_API_KEY 설정 시) 사용.
 * 키 없으면 null 반환.
 */
export async function geocodeAddress(address: string): Promise<GeocodedResult | null> {
  return geocodeWithVWorld(address)
}

/** ms 단위 sleep */
export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
