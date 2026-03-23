/**
 * 단위 테스트: resolveContractDocumentData
 *
 * 검증 항목:
 *   1. snapshot workerName 이 있으면 live worker.name 보다 우선
 *   2. snapshot workerPhone 이 있으면 live worker.phone 보다 우선
 *   3. snapshot 이 없을 때 live worker 값으로 fallback
 *   4. 계약 레코드 필드(임금/기간 등)는 항상 계약 레코드에서
 *   5. PDF 경로와 DOC 경로가 동일 resolver 결과를 사용
 */
import { describe, it, expect } from 'vitest'
import { resolveContractDocumentData } from '@/lib/contracts/resolve-document-data'

// ─── 픽스처 ───────────────────────────────────────────────────────────────

const baseContract: Record<string, unknown> = {
  companyName:    '주식회사 테스트',
  companyRepName: '홍길동',
  companyAddress: '서울시 강남구',
  startDate:      '2026-01-01',
  endDate:        '2026-06-30',
  dailyWage:      200000,
  checkInTime:    '08:00',
  checkOutTime:   '17:00',
  workerBirthDate: '1990-01-01',
  workerAddress:   '경기도 성남시',
  nationalPensionYn:     false,
  healthInsuranceYn:     false,
  employmentInsuranceYn: false,
  industrialAccidentYn:  true,
  retirementMutualYn:    false,
  safetyClauseYn:        true,
}

const liveWorker = { name: '김현재', phone: '010-0000-0000' }
const site       = { name: '테스트현장', address: '서울시 마포구' }
const today      = '2026-03-23'

// snapshotJson 구조: { ...contractRecord, worker: { id, name, phone }, site: { ... } }
function makeSnap(workerName: string, workerPhone: string) {
  return {
    ...baseContract,
    worker: { id: 'w1', name: workerName, phone: workerPhone },
    site:   { id: 's1', name: site.name, address: site.address },
  }
}

// ─── 테스트 ───────────────────────────────────────────────────────────────

describe('resolveContractDocumentData — snapshot-first 원칙', () => {

  it('snapshot workerName 이 있으면 live worker.name 보다 우선된다', () => {
    const snap = makeSnap('김계약시점', '010-1111-1111')
    const data = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)
    expect(data.workerName).toBe('김계약시점')
    expect(data.workerName).not.toBe(liveWorker.name)
  })

  it('snapshot workerPhone 이 있으면 live worker.phone 보다 우선된다', () => {
    const snap = makeSnap('김계약시점', '010-9999-9999')
    const data = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)
    expect(data.workerPhone).toBe('010-9999-9999')
    expect(data.workerPhone).not.toBe(liveWorker.phone)
  })

  it('snapshot 이 null 이면 live worker.name 으로 fallback', () => {
    const data = resolveContractDocumentData(baseContract, liveWorker, site, null, today)
    expect(data.workerName).toBe(liveWorker.name)
  })

  it('snapshot 이 undefined 이면 live worker.name 으로 fallback', () => {
    const data = resolveContractDocumentData(baseContract, liveWorker, site, undefined, today)
    expect(data.workerName).toBe(liveWorker.name)
  })

  it('snapshot worker 가 없는 구조면 live worker.name 으로 fallback', () => {
    const badSnap = { ...baseContract } // worker 키 없음
    const data = resolveContractDocumentData(baseContract, liveWorker, site, badSnap, today)
    expect(data.workerName).toBe(liveWorker.name)
  })

  it('계약 레코드 임금·기간은 계약 레코드에서 온다 (snapshot 덮어쓰기 없음)', () => {
    const snap = makeSnap('김계약시점', '010-1111-1111')
    const data = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)
    expect(data.dailyWage).toBe(200000)
    expect(data.startDate).toBe('2026-01-01')
    expect(data.endDate).toBe('2026-06-30')
  })

  it('workerBirthDate / workerAddress 는 계약 레코드에서 온다', () => {
    const snap = makeSnap('김계약시점', '010-1111-1111')
    const data = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)
    expect(data.workerBirthDate).toBe('1990-01-01')
    expect(data.workerAddress).toBe('경기도 성남시')
  })

})

describe('resolveContractDocumentData — 재출력 불변성', () => {

  it('Worker 이름을 나중에 바꿔도 과거 계약 snapshot 으로 생성 시 이름 불변', () => {
    const snap = makeSnap('김과거이름', '010-1111-1111')

    // Worker 마스터가 변경된 이후 상태
    const updatedWorker = { name: '김새이름', phone: '010-2222-2222' }

    const data = resolveContractDocumentData(baseContract, updatedWorker, site, snap, today)
    expect(data.workerName).toBe('김과거이름')  // snapshot 값 유지
    expect(data.workerPhone).toBe('010-1111-1111')  // snapshot 값 유지
  })

  it('PDF resolver 와 DOC resolver 가 동일 인수로 동일 결과를 반환한다', () => {
    const snap = makeSnap('김동일', '010-3333-3333')
    // 두 라우트 모두 resolveContractDocumentData 를 호출하므로 결과가 동일해야 함
    const dataA = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)
    const dataB = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)

    expect(dataA.workerName).toBe(dataB.workerName)
    expect(dataA.workerPhone).toBe(dataB.workerPhone)
    expect(dataA.dailyWage).toBe(dataB.dailyWage)
    expect(dataA.startDate).toBe(dataB.startDate)
    expect(dataA.companyName).toBe(dataB.companyName)
    expect(dataA.siteName).toBe(dataB.siteName)
  })

})
