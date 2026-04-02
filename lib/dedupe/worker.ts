/**
 * 근로자 중복 판정 모듈
 *
 * 판정 상태:
 * - OK: 즉시 등록
 * - REVIEW: 사용자 확인 후 등록 여부 결정
 * - BLOCK: 자동 등록 금지 (전화번호 완전 일치 등)
 */
import { prisma } from '@/lib/db/prisma'
import { normalizeName, normalizePhone, normalizeBirthDate } from './normalize'

export type WorkerDedupeStatus = 'OK' | 'REVIEW' | 'BLOCK'

export interface WorkerCandidate {
  id: string
  name: string
  phone: string | null
  birthDate: string | null
  jobTitle: string
  isActive: boolean
}

export interface WorkerDedupeResult {
  status: WorkerDedupeStatus
  reason: string
  matchedId: string | null
  matchedName: string | null
  candidates: WorkerCandidate[]
}

interface InputWorker {
  name: string
  phone: string       // 정규화 전 원본
  birthDate?: string | null
}

/** 기존 근로자 전체를 1회 로드 후 재사용 */
export async function loadExistingWorkers(): Promise<WorkerCandidate[]> {
  return prisma.worker.findMany({
    select: { id: true, name: true, phone: true, birthDate: true, jobTitle: true, isActive: true },
  })
}

/** 단건 근로자에 대한 중복 판정 */
export function classifyWorker(
  input: InputWorker,
  existingWorkers: WorkerCandidate[],
): WorkerDedupeResult {
  const normPhone = normalizePhone(input.phone)
  const normInputName = normalizeName(input.name)
  const normBirth = input.birthDate ? normalizeBirthDate(input.birthDate) : null
  const phoneLast4 = normPhone.length >= 4 ? normPhone.slice(-4) : null

  const candidates: Array<WorkerCandidate & {
    verdict: WorkerDedupeStatus
    reason: string
    priority: number
  }> = []

  for (const w of existingWorkers) {
    const exPhone = w.phone ? normalizePhone(w.phone) : null
    const exName = normalizeName(w.name)
    const exBirth = w.birthDate ? normalizeBirthDate(w.birthDate) : null
    const exPhoneLast4 = exPhone && exPhone.length >= 4 ? exPhone.slice(-4) : null

    let verdict: WorkerDedupeStatus = 'OK'
    let reason = ''
    let priority = 0

    // 1) 전화번호 완전 일치 → BLOCK
    if (exPhone && normPhone === exPhone) {
      verdict = 'BLOCK'
      reason = `전화번호 완전 일치 (기존: ${w.name}, ${w.phone})`
      priority = 100
    }
    // 2) 이름 + 생년월일 일치 → REVIEW
    else if (normInputName === exName && normBirth && exBirth && normBirth === exBirth) {
      verdict = 'REVIEW'
      reason = `이름·생년월일 일치 (기존: ${w.name}, ${w.birthDate})`
      priority = 80
    }
    // 3) 이름 같고 전화번호 끝 4자리 동일 → REVIEW
    else if (normInputName === exName && phoneLast4 && exPhoneLast4 && phoneLast4 === exPhoneLast4) {
      verdict = 'REVIEW'
      reason = `이름 일치, 전화번호 끝4자리 동일 (기존: ${w.name}, ...${exPhoneLast4})`
      priority = 60
    }

    if (verdict !== 'OK') {
      candidates.push({ ...w, verdict, reason, priority })
    }
  }

  if (candidates.length === 0) {
    return { status: 'OK', reason: '유의미한 중복 없음', matchedId: null, matchedName: null, candidates: [] }
  }

  // 가장 강한 판정 선택
  const sorted = candidates.sort((a, b) => b.priority - a.priority)
  const top = sorted[0]

  return {
    status: top.verdict,
    reason: top.reason,
    matchedId: top.id,
    matchedName: top.name,
    candidates: sorted.slice(0, 3).map(c => ({
      id: c.id, name: c.name, phone: c.phone, birthDate: c.birthDate,
      jobTitle: c.jobTitle, isActive: c.isActive,
    })),
  }
}

/** 파일 내 중복 감지 (전화번호 기준) */
export function detectInFileDuplicates(
  phones: Array<{ rowIndex: number; phone: string }>,
): Map<number, number[]> {
  const phoneMap: Record<string, number[]> = {}
  for (const { rowIndex, phone } of phones) {
    const norm = normalizePhone(phone)
    if (!norm) continue
    if (!phoneMap[norm]) phoneMap[norm] = []
    phoneMap[norm].push(rowIndex)
  }

  const dupes = new Map<number, number[]>()
  for (const rows of Object.values(phoneMap)) {
    if (rows.length > 1) {
      for (const r of rows) {
        dupes.set(r, rows.filter(x => x !== r))
      }
    }
  }
  return dupes
}
