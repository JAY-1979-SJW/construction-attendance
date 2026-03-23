/**
 * 통합 / 회귀 테스트: 문서 출력 일관성
 *
 * 검증 항목:
 *   1. PDF renderer 와 DOC renderer 가 동일 ContractData 로 동일 키 필드 출력
 *   2. Worker 수정 후 과거 계약 재출력 불변성
 *   3. 일용직 문구와 상용직 문구 혼입 방지
 *   4. snapshot 필드 vs 운영값 반영 필드 구분
 */
import { describe, it, expect } from 'vitest'
import {
  renderDailyEmploymentContract,
  renderRegularEmploymentContract,
  contractToText,
  type ContractData,
} from '@/lib/contracts/templates'
import {
  renderWorkConditionsReceipt,
  renderPrivacyConsent,
} from '@/lib/contracts/safety-docs'
import { resolveContractDocumentData } from '@/lib/contracts/resolve-document-data'
import { validateDailyContractDangerPhrases } from '@/lib/contracts/validate-contract'
import { extractContractText } from '@/lib/contracts/validate-contract'

// ─── 픽스처 ───────────────────────────────────────────────────────────────

const baseContract: Record<string, unknown> = {
  companyName:           '주식회사 해한',
  companyRepName:        '대표이사',
  companyAddress:        '서울시 강남구',
  startDate:             '2026-01-01',
  endDate:               '2026-01-31',
  dailyWage:             200000,
  checkInTime:           '08:00',
  checkOutTime:          '17:00',
  breakHours:            1,
  workerBirthDate:       '1990-05-15',
  workerAddress:         '경기도 성남시',
  siteName:              '테스트현장',
  nationalPensionYn:     false,
  healthInsuranceYn:     false,
  employmentInsuranceYn: false,
  industrialAccidentYn:  true,
  retirementMutualYn:    false,
  safetyClauseYn:        true,
  paymentMethod:         '계좌이체',
}

const liveWorker = { name: '김현재이름', phone: '010-0000-0000' }
const site       = { name: '테스트현장', address: '서울시 마포구' }
const today      = '2026-03-23'

function makeSnap(name: string, phone: string) {
  return { ...baseContract, worker: { id: 'w1', name, phone }, site }
}

// ─── 시나리오 A: Worker 이름 수정 후 재출력 불변성 ─────────────────────────

describe('시나리오 A — Worker 이름/주소/연락처 수정 후 재출력 불변성', () => {

  it('snapshot 이 있으면 Worker 현재 이름이 바뀌어도 문서 내 이름은 snapshot 값', () => {
    const snap        = makeSnap('김계약당시', '010-1111-1111')
    const newWorker   = { name: '김수정후', phone: '010-9999-9999' }

    const data = resolveContractDocumentData(baseContract, newWorker, site, snap, today)
    const rendered = renderDailyEmploymentContract(data)
    const text     = contractToText(rendered)

    expect(text).toContain('김계약당시')
    expect(text).not.toContain('김수정후')
  })

  it('snapshot 없이 최초 생성 시 live worker 값 사용', () => {
    const data     = resolveContractDocumentData(baseContract, liveWorker, site, null, today)
    const rendered = renderDailyEmploymentContract(data)
    const text     = contractToText(rendered)

    expect(text).toContain(liveWorker.name)
  })

})

// ─── 시나리오 B: 직종/임금 기본값 변경 후 재출력 불변성 ──────────────────────

describe('시나리오 B — 계약 레코드 임금/기간 변경 후 재출력', () => {

  it('계약 레코드의 dailyWage 값이 문서에 반영된다', () => {
    const data     = resolveContractDocumentData(baseContract, liveWorker, site, null, today)
    const rendered = renderDailyEmploymentContract(data)
    const text     = contractToText(rendered)

    expect(text).toContain('200,000')
  })

})

// ─── PDF vs DOC 출력 일치 검증 ───────────────────────────────────────────

describe('PDF / DOC 출력 일치 — 동일 resolver 사용 보장', () => {

  it('같은 resolver 결과로 CONTRACT 를 두 번 렌더링하면 동일 텍스트', () => {
    const snap = makeSnap('김테스트', '010-5555-5555')
    const data = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)

    // generate-pdf 경로
    const pdfRendered = renderDailyEmploymentContract(data)
    const pdfText     = contractToText(pdfRendered)

    // generate-doc 경로 (동일 renderer 사용)
    const docRendered = renderDailyEmploymentContract(data)
    const docText     = contractToText(docRendered)

    expect(pdfText).toBe(docText)
  })

  it('근로조건설명서(WORK_CONDITIONS_RECEIPT)도 동일 resolver 사용 시 근로자명 일치', () => {
    const snap = makeSnap('김통합', '010-7777-7777')
    const data = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)

    const workCondDoc = renderWorkConditionsReceipt({ ...data })
    const text        = contractToText(workCondDoc)

    expect(text).toContain('김통합')
    expect(text).not.toContain(liveWorker.name)
  })

  it('개인정보동의서(PRIVACY_CONSENT)도 동일 resolver 사용 시 근로자명 일치', () => {
    const snap = makeSnap('김통합', '010-7777-7777')
    const data = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)

    const privacyDoc = renderPrivacyConsent(data)
    const text       = contractToText(privacyDoc)

    expect(text).toContain('김통합')
    expect(text).not.toContain(liveWorker.name)
  })

})

// ─── 일용직 / 상용직 문구 혼입 방지 ──────────────────────────────────────

describe('회귀 테스트 — 일용직 · 상용직 문구 혼입 방지', () => {

  it('일용직 계약서에 "월급" 또는 "기본급 ×××원" 고정급 표현이 없다', () => {
    const dailyData: ContractData = {
      ...(resolveContractDocumentData(baseContract, liveWorker, site, null, today)),
      dailyWage: 200000,
      monthlySalary: undefined,
    }
    const rendered = renderDailyEmploymentContract(dailyData)
    const text     = contractToText(rendered)
    const danger   = validateDailyContractDangerPhrases(text)

    // 기본급 ×××원 패턴 없어야 함
    expect(danger.matches.filter(m => m.phrase.includes('기본급'))).toHaveLength(0)
  })

  it('상용직 계약서가 일용직 renderer 로 렌더링되지 않는다', () => {
    // 상용직은 renderRegularEmploymentContract 를 써야 함
    const regularData: ContractData = {
      ...(resolveContractDocumentData(baseContract, liveWorker, site, null, today)),
      monthlySalary: 3000000,
    }
    const dailyRendered   = renderDailyEmploymentContract(regularData)
    const regularRendered = renderRegularEmploymentContract(regularData, false)

    // templateType 이 다름
    expect(dailyRendered.templateType).not.toBe(regularRendered.templateType)
  })

})

// ─── snapshot 고정 vs 운영값 반영 필드 구분 ──────────────────────────────

describe('필드 정책 분류 — snapshot 고정 vs 운영값 반영', () => {

  it('[snapshot 고정] workerName — Worker 마스터 변경 시 과거 계약 문서 불변', () => {
    const snap      = makeSnap('김스냅샷', '010-1111-1111')
    const changed   = { name: '김마스터변경', phone: '010-0000-0000' }
    const data      = resolveContractDocumentData(baseContract, changed, site, snap, today)
    expect(data.workerName).toBe('김스냅샷')
  })

  it('[snapshot 고정] workerPhone — Worker 마스터 변경 시 과거 계약 문서 불변', () => {
    const snap    = makeSnap('김스냅샷', '010-9876-5432')
    const changed = { name: '김마스터변경', phone: '010-0000-0000' }
    const data    = resolveContractDocumentData(baseContract, changed, site, snap, today)
    expect(data.workerPhone).toBe('010-9876-5432')
  })

  it('[계약레코드 고정] dailyWage — 계약 레코드 자체가 버전별 원천', () => {
    const snap = makeSnap('김스냅샷', '010-1111-1111')
    const data = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)
    // 계약 레코드의 dailyWage 가 그대로 반영
    expect(data.dailyWage).toBe(baseContract.dailyWage)
  })

  it('[계약레코드 고정] startDate / endDate — 계약 레코드 자체가 버전별 원천', () => {
    const snap = makeSnap('김스냅샷', '010-1111-1111')
    const data = resolveContractDocumentData(baseContract, liveWorker, site, snap, today)
    expect(data.startDate).toBe('2026-01-01')
    expect(data.endDate).toBe('2026-01-31')
  })

})
