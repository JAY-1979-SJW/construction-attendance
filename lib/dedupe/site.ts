/**
 * 현장 중복 판정 모듈
 *
 * 판정 상태:
 * - OK: 즉시 등록 가능
 * - REVIEW: 사용자 확인 후 등록 여부 결정
 * - BLOCK: 확정 중복 — 자동 등록 금지, 사용자 명시 선택 시만 허용
 */
import { prisma } from '@/lib/db/prisma'
import {
  normalizeSiteName,
  normalizeAddress,
  haversineDistance,
  similarity,
} from './normalize'

export type DedupeStatus = 'OK' | 'REVIEW' | 'BLOCK'

export interface SiteCandidate {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}

export interface SiteDedupeResult {
  status: DedupeStatus
  reason: string
  matchedId: string | null
  matchedName: string | null
  candidates: SiteCandidate[]
}

interface InputSite {
  name: string
  address: string
  latitude?: number | null
  longitude?: number | null
}

/** 기존 현장 전체를 1회 로드 후 재사용할 수 있도록 분리 */
export async function loadExistingSites(): Promise<SiteCandidate[]> {
  return prisma.site.findMany({
    where: { isActive: true },
    select: { id: true, name: true, address: true, latitude: true, longitude: true },
  })
}

/** 단건 현장에 대한 중복 판정 */
export function classifySite(
  input: InputSite,
  existingSites: SiteCandidate[],
): SiteDedupeResult {
  const normName = normalizeSiteName(input.name)
  const normAddr = normalizeAddress(input.address)

  const candidates: Array<SiteCandidate & {
    nameScore: number
    addrScore: number
    distMeters: number | null
    verdict: DedupeStatus
    reason: string
  }> = []

  for (const site of existingSites) {
    const exName = normalizeSiteName(site.name)
    const exAddr = normalizeAddress(site.address)

    const nameExact = normName === exName
    const addrExact = normAddr === exAddr
    const nameScore = nameExact ? 1 : similarity(normName, exName)
    const addrScore = addrExact ? 1 : similarity(normAddr, exAddr)

    let distMeters: number | null = null
    if (input.latitude && input.longitude) {
      distMeters = haversineDistance(
        input.latitude, input.longitude,
        site.latitude, site.longitude,
      )
    }

    // 판정 로직
    let verdict: DedupeStatus = 'OK'
    let reason = ''

    // 1) 정규화 이름 + 주소 완전 일치 → BLOCK
    if (nameExact && addrExact) {
      verdict = 'BLOCK'
      reason = `현장명·주소 완전 일치 (기존: ${site.name})`
    }
    // 2) 이름 완전 일치 + 주소 유사 (0.7+)
    else if (nameExact && addrScore >= 0.7) {
      verdict = 'BLOCK'
      reason = `현장명 일치, 주소 유사도 ${(addrScore * 100).toFixed(0)}% (기존: ${site.name})`
    }
    // 3) 이름 유사 + 주소 유사
    else if (nameScore >= 0.7 && addrScore >= 0.7) {
      verdict = 'REVIEW'
      reason = `현장명 유사도 ${(nameScore * 100).toFixed(0)}%, 주소 유사도 ${(addrScore * 100).toFixed(0)}% (기존: ${site.name})`
    }
    // 4) 좌표 매우 가깝고 이름 유사
    else if (distMeters !== null && distMeters < 200 && nameScore >= 0.5) {
      verdict = distMeters < 50 && nameScore >= 0.7 ? 'BLOCK' : 'REVIEW'
      reason = `좌표 거리 ${Math.round(distMeters)}m, 현장명 유사도 ${(nameScore * 100).toFixed(0)}% (기존: ${site.name})`
    }
    // 5) 좌표 매우 가깝지만 이름 다름
    else if (distMeters !== null && distMeters < 100) {
      verdict = 'REVIEW'
      reason = `좌표 거리 ${Math.round(distMeters)}m — 동일 위치 가능성 (기존: ${site.name})`
    }

    if (verdict !== 'OK') {
      candidates.push({ ...site, nameScore, addrScore, distMeters, verdict, reason })
    }
  }

  if (candidates.length === 0) {
    return { status: 'OK', reason: '유의미한 중복 없음', matchedId: null, matchedName: null, candidates: [] }
  }

  // 가장 강한 판정 선택 (BLOCK > REVIEW)
  const sorted = candidates.sort((a, b) => {
    if (a.verdict === 'BLOCK' && b.verdict !== 'BLOCK') return -1
    if (a.verdict !== 'BLOCK' && b.verdict === 'BLOCK') return 1
    return (b.nameScore + b.addrScore) - (a.nameScore + a.addrScore)
  })

  const top = sorted[0]
  return {
    status: top.verdict,
    reason: top.reason,
    matchedId: top.id,
    matchedName: top.name,
    candidates: sorted.slice(0, 3).map(c => ({
      id: c.id, name: c.name, address: c.address,
      latitude: c.latitude, longitude: c.longitude,
    })),
  }
}
