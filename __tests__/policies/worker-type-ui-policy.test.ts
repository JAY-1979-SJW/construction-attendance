/**
 * worker-type-ui-policy.ts 단위 테스트
 *
 * 검증 항목:
 *   1. 정책 데이터 완전성 — 모든 유형 카드에 필수 필드 존재
 *   2. resolveRecommendedType — 퀴즈 로직 분기
 *   3. detectEmploymentMismatch — 오선택 조합 경고
 *   4. 비교표 일관성 — 모든 유형이 모든 항목을 가짐
 *   5. LABOR_RELATION_GUIDES 구조
 *   6. getTemplateSummary / getOfficialName
 */

import { describe, it, expect } from 'vitest'
import {
  WORKER_TYPE_CARDS,
  WORKER_TYPE_COMPARISON,
  RECOMMENDATION_QUIZ,
  LABOR_RELATION_GUIDES,
  OFFICIAL_TYPE_NAMES,
  ADMIN_TYPE_GUIDES,
  ADMIN_TYPE_WARNINGS,
  resolveRecommendedType,
  detectEmploymentMismatch,
  detectWorkerContractMismatch,
  getTemplateSummary,
  getOfficialName,
} from '@/lib/policies/worker-type-ui-policy'

// ─── 1. 정책 데이터 완전성 ────────────────────────────────────────────────────

describe('WORKER_TYPE_CARDS 데이터 완전성', () => {
  const REQUIRED_CODES = [
    'DAILY_CONSTRUCTION',
    'REGULAR',
    'FIXED_TERM',
    'CONTINUOUS_SITE',
    'SUBCONTRACTOR',
    'BUSINESS_33',
  ]

  it('6개 유형 카드가 모두 정의되어 있어야 한다', () => {
    const codes = WORKER_TYPE_CARDS.map(c => c.code)
    for (const code of REQUIRED_CODES) {
      expect(codes).toContain(code)
    }
  })

  it('각 카드에 필수 필드가 모두 있어야 한다', () => {
    for (const card of WORKER_TYPE_CARDS) {
      expect(card.code).toBeTruthy()
      expect(card.label).toBeTruthy()
      expect(card.icon).toBeTruthy()
      expect(card.shortDef).toBeTruthy()
      expect(card.accentColor).toBeTruthy()
      expect(Array.isArray(card.whenToUse)).toBe(true)
      expect(card.whenToUse.length).toBeGreaterThan(0)
      expect(Array.isArray(card.whenNotToUse)).toBe(true)
      expect(card.whenNotToUse.length).toBeGreaterThan(0)
      expect(Array.isArray(card.appliedDocuments)).toBe(true)
      expect(card.appliedDocuments.length).toBeGreaterThan(0)
      expect(card.calcMethod).toBeTruthy()
    }
  })

  it('accentColor는 #로 시작하는 16진수 색상이어야 한다', () => {
    for (const card of WORKER_TYPE_CARDS) {
      expect(card.accentColor).toMatch(/^#[0-9a-fA-F]{3,6}$/)
    }
  })
})

// ─── 2. resolveRecommendedType 퀴즈 로직 ─────────────────────────────────────

describe('resolveRecommendedType', () => {
  it('자사 소속 아님 → SUBCONTRACTOR', () => {
    expect(resolveRecommendedType({ isInternal: false })).toBe('SUBCONTRACTOR')
  })

  it('자사 소속 + 일당/공수 → DAILY_CONSTRUCTION', () => {
    expect(resolveRecommendedType({ isInternal: true, isDailyWage: true })).toBe('DAILY_CONSTRUCTION')
  })

  it('자사 소속 + 월급 + 종료일 있음 → FIXED_TERM', () => {
    expect(resolveRecommendedType({ isInternal: true, isDailyWage: false, hasEndDate: true })).toBe('FIXED_TERM')
  })

  it('자사 소속 + 월급 + 종료일 없음 → REGULAR', () => {
    expect(resolveRecommendedType({ isInternal: true, isDailyWage: false, hasEndDate: false })).toBe('REGULAR')
  })

  it('아직 답변이 완료되지 않으면 빈 문자열 반환', () => {
    expect(resolveRecommendedType({})).toBe('')
    expect(resolveRecommendedType({ isInternal: true })).toBe('')
  })

  it('isInternal=false 이면 나머지 답변 무관하게 SUBCONTRACTOR', () => {
    expect(resolveRecommendedType({ isInternal: false, isDailyWage: true, hasEndDate: true })).toBe('SUBCONTRACTOR')
    expect(resolveRecommendedType({ isInternal: false, isDailyWage: false, hasEndDate: false })).toBe('SUBCONTRACTOR')
  })
})

// ─── 3. detectEmploymentMismatch ─────────────────────────────────────────────

describe('detectEmploymentMismatch', () => {
  it('직영 + 건설일용 → 경고 없음', () => {
    expect(detectEmploymentMismatch('DAILY_CONSTRUCTION', 'DIRECT')).toBeNull()
  })

  it('직영 + 상용직 → 경고 없음', () => {
    expect(detectEmploymentMismatch('REGULAR', 'DIRECT')).toBeNull()
  })

  it('협력사 + 상용직 → WARN 경고', () => {
    const result = detectEmploymentMismatch('REGULAR', 'SUBCONTRACTOR')
    expect(result).not.toBeNull()
    expect(result!.level).toBe('WARN')
    expect(result!.code).toBe('OUTSOURCED_WITH_EMPLOYMENT_TYPE')
  })

  it('협력사 + 기간제 → WARN 경고', () => {
    const result = detectEmploymentMismatch('FIXED_TERM', 'SUBCONTRACTOR')
    expect(result).not.toBeNull()
    expect(result!.level).toBe('WARN')
  })

  it('협력사 + 계속근로형 → WARN 경고', () => {
    const result = detectEmploymentMismatch('CONTINUOUS_SITE', 'SUBCONTRACTOR')
    expect(result).not.toBeNull()
    expect(result!.level).toBe('WARN')
  })

  it('협력사 + 건설일용 → 별도 경고 (OUTSOURCED_DAILY_CONSTRUCTION)', () => {
    const result = detectEmploymentMismatch('DAILY_CONSTRUCTION', 'SUBCONTRACTOR')
    expect(result).not.toBeNull()
    expect(result!.code).toBe('OUTSOURCED_DAILY_CONSTRUCTION')
    expect(result!.level).toBe('WARN')
  })

  it('경고 메시지가 비어 있지 않아야 한다', () => {
    const cases: [string, string][] = [
      ['REGULAR', 'SUBCONTRACTOR'],
      ['FIXED_TERM', 'SUBCONTRACTOR'],
      ['DAILY_CONSTRUCTION', 'SUBCONTRACTOR'],
    ]
    for (const [empType, orgType] of cases) {
      const result = detectEmploymentMismatch(empType, orgType)
      expect(result?.message.length).toBeGreaterThan(0)
    }
  })
})

// ─── 4. 비교표 일관성 ─────────────────────────────────────────────────────────

describe('WORKER_TYPE_COMPARISON 비교표', () => {
  const ALL_CODES = ['DAILY_CONSTRUCTION', 'REGULAR', 'FIXED_TERM', 'CONTINUOUS_SITE', 'SUBCONTRACTOR', 'BUSINESS_33']

  it('7개 이상 비교 항목이 있어야 한다', () => {
    expect(WORKER_TYPE_COMPARISON.length).toBeGreaterThanOrEqual(7)
  })

  it('각 행이 criterion을 가져야 한다', () => {
    for (const row of WORKER_TYPE_COMPARISON) {
      expect(row.criterion).toBeTruthy()
    }
  })

  it('각 행의 values 객체가 모든 주요 유형을 포함해야 한다', () => {
    for (const row of WORKER_TYPE_COMPARISON) {
      for (const code of ALL_CODES) {
        expect(row.values).toHaveProperty(code)
        expect(typeof row.values[code]).toBe('string')
      }
    }
  })

  it('중복 criterion이 없어야 한다', () => {
    const criterions = WORKER_TYPE_COMPARISON.map(r => r.criterion)
    const unique = new Set(criterions)
    expect(unique.size).toBe(criterions.length)
  })
})

// ─── 5. RECOMMENDATION_QUIZ 구조 ─────────────────────────────────────────────

describe('RECOMMENDATION_QUIZ', () => {
  it('3개 질문이 있어야 한다', () => {
    expect(RECOMMENDATION_QUIZ.length).toBe(3)
  })

  it('각 질문에 id, text, yesLabel, noLabel이 있어야 한다', () => {
    for (const q of RECOMMENDATION_QUIZ) {
      expect(q.id).toBeTruthy()
      expect(q.text).toBeTruthy()
      expect(q.yesLabel).toBeTruthy()
      expect(q.noLabel).toBeTruthy()
    }
  })

  it('quiz id가 isInternal, isDailyWage, hasEndDate 여야 한다', () => {
    const ids = RECOMMENDATION_QUIZ.map(q => q.id)
    expect(ids).toContain('isInternal')
    expect(ids).toContain('isDailyWage')
    expect(ids).toContain('hasEndDate')
  })
})

// ─── 6. LABOR_RELATION_GUIDES 구조 ───────────────────────────────────────────

describe('LABOR_RELATION_GUIDES', () => {
  it('3개 가이드가 있어야 한다 (직접고용, 외주팀, 팀장형)', () => {
    expect(LABOR_RELATION_GUIDES.length).toBe(3)
    const codes = LABOR_RELATION_GUIDES.map(g => g.code)
    expect(codes).toContain('DIRECT_EMPLOYEE')
    expect(codes).toContain('SUBCONTRACT_BIZ')
    expect(codes).toContain('TEAM_NONBIZ_REVIEW')
  })

  it('각 가이드에 templateOptions가 1개 이상 있어야 한다', () => {
    for (const guide of LABOR_RELATION_GUIDES) {
      expect(guide.templateOptions.length).toBeGreaterThan(0)
    }
  })

  it('각 templateOption에 value, label, desc가 있어야 한다', () => {
    for (const guide of LABOR_RELATION_GUIDES) {
      for (const t of guide.templateOptions) {
        expect(t.value).toBeTruthy()
        expect(t.label).toBeTruthy()
        expect(t.desc).toBeTruthy()
      }
    }
  })

  it('warningChecklist가 있는 가이드는 비어 있지 않아야 한다', () => {
    for (const guide of LABOR_RELATION_GUIDES) {
      if (guide.warningChecklist) {
        expect(guide.warningChecklist.length).toBeGreaterThan(0)
      }
    }
  })
})

// ─── 7. getTemplateSummary / getOfficialName ─────────────────────────────────

describe('getTemplateSummary', () => {
  it('알려진 template에 대해 비어 있지 않은 설명을 반환한다', () => {
    expect(getTemplateSummary('DAILY_EMPLOYMENT')).toBeTruthy()
    expect(getTemplateSummary('REGULAR_EMPLOYMENT')).toBeTruthy()
    expect(getTemplateSummary('FIXED_TERM_EMPLOYMENT')).toBeTruthy()
    expect(getTemplateSummary('SUBCONTRACT_WITH_BIZ')).toBeTruthy()
  })

  it('알 수 없는 template은 빈 문자열을 반환한다', () => {
    expect(getTemplateSummary('UNKNOWN_TEMPLATE')).toBe('')
  })
})

describe('getOfficialName', () => {
  it('알려진 코드에 대해 한글 공식명을 반환한다', () => {
    expect(getOfficialName('DAILY_CONSTRUCTION')).toBe('건설일용')
    expect(getOfficialName('REGULAR')).toBe('상용직')
    expect(getOfficialName('FIXED_TERM')).toBe('기간제')
    expect(getOfficialName('SUBCONTRACTOR')).toBe('외주/협력팀')
    expect(getOfficialName('DIRECT_EMPLOYEE')).toBe('직접고용')
  })

  it('알 수 없는 코드는 코드 자체를 반환한다', () => {
    expect(getOfficialName('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')
  })

  it('OFFICIAL_TYPE_NAMES 객체에 모든 주요 고용유형이 있어야 한다', () => {
    const required = ['DAILY_CONSTRUCTION', 'REGULAR', 'FIXED_TERM', 'CONTINUOUS_SITE', 'SUBCONTRACTOR', 'BUSINESS_33']
    for (const code of required) {
      expect(OFFICIAL_TYPE_NAMES[code]).toBeTruthy()
    }
  })
})

// ─── 8. ADMIN_TYPE_GUIDES 관리자 안내표 ─────────────────────────────────────

describe('ADMIN_TYPE_GUIDES', () => {
  it('4개 유형이 있어야 한다 (일용직, 상용직, 기간제, 외주/협력팀)', () => {
    expect(ADMIN_TYPE_GUIDES.length).toBe(4)
    const codes = ADMIN_TYPE_GUIDES.map(g => g.code)
    expect(codes).toContain('DAILY_CONSTRUCTION')
    expect(codes).toContain('REGULAR')
    expect(codes).toContain('FIXED_TERM')
    expect(codes).toContain('SUBCONTRACTOR')
  })

  it('각 가이드에 tableRow 4개 필드가 있어야 한다', () => {
    for (const g of ADMIN_TYPE_GUIDES) {
      expect(g.tableRow.whenToSelect).toBeTruthy()
      expect(g.tableRow.endDateConcept).toBeTruthy()
      expect(g.tableRow.calcBasis).toBeTruthy()
      expect(g.tableRow.documents).toBeTruthy()
    }
  })

  it('각 가이드에 buttonLabel, detail, whenItFits, caution이 있어야 한다', () => {
    for (const g of ADMIN_TYPE_GUIDES) {
      expect(g.buttonLabel).toBeTruthy()
      expect(g.detail).toBeTruthy()
      expect(Array.isArray(g.whenItFits) && g.whenItFits.length > 0).toBe(true)
      expect(g.caution).toBeTruthy()
    }
  })

  it('각 가이드에 contractMapping이 있어야 한다', () => {
    for (const g of ADMIN_TYPE_GUIDES) {
      expect(g.contractMapping.laborRelation).toBeTruthy()
      expect(g.contractMapping.templateType).toBeTruthy()
    }
  })

  it('기간제의 endDateConcept은 필수 입력임을 명시해야 한다', () => {
    const fixedTerm = ADMIN_TYPE_GUIDES.find(g => g.code === 'FIXED_TERM')!
    expect(fixedTerm.tableRow.endDateConcept).toContain('있음')
  })

  it('외주/협력팀의 contractMapping은 SUBCONTRACT_BIZ laborRelation이어야 한다', () => {
    const sub = ADMIN_TYPE_GUIDES.find(g => g.code === 'SUBCONTRACTOR')!
    expect(sub.contractMapping.laborRelation).toBe('SUBCONTRACT_BIZ')
  })
})

// ─── 9. ADMIN_TYPE_WARNINGS ──────────────────────────────────────────────────

describe('ADMIN_TYPE_WARNINGS', () => {
  it('5개 경고 문구가 있어야 한다', () => {
    expect(ADMIN_TYPE_WARNINGS.length).toBe(5)
  })

  it('모든 경고 문구가 비어 있지 않아야 한다', () => {
    for (const w of ADMIN_TYPE_WARNINGS) {
      expect(w.length).toBeGreaterThan(0)
    }
  })

  it('기간제 관련 경고가 포함되어야 한다', () => {
    expect(ADMIN_TYPE_WARNINGS.some(w => w.includes('기간제'))).toBe(true)
  })

  it('외주/협력팀 관련 경고가 포함되어야 한다', () => {
    expect(ADMIN_TYPE_WARNINGS.some(w => w.includes('외주'))).toBe(true)
  })
})

// ─── 10. detectWorkerContractMismatch ────────────────────────────────────────

describe('detectWorkerContractMismatch', () => {
  it('일치하는 조합은 null 반환', () => {
    expect(detectWorkerContractMismatch('DAILY_CONSTRUCTION', 'DAILY_EMPLOYMENT')).toBeNull()
    expect(detectWorkerContractMismatch('REGULAR', 'REGULAR_EMPLOYMENT')).toBeNull()
    expect(detectWorkerContractMismatch('FIXED_TERM', 'FIXED_TERM_EMPLOYMENT')).toBeNull()
  })

  it('상용직 근로자 + 일용직 계약서 → 경고', () => {
    expect(detectWorkerContractMismatch('REGULAR', 'DAILY_EMPLOYMENT')).toBeTruthy()
    expect(detectWorkerContractMismatch('REGULAR', 'MONTHLY_FIXED_EMPLOYMENT')).toBeTruthy()
  })

  it('기간제 근로자 + 일용직 계약서 → 경고', () => {
    expect(detectWorkerContractMismatch('FIXED_TERM', 'DAILY_EMPLOYMENT')).toBeTruthy()
  })

  it('건설일용 근로자 + 상용직 계약서 → 경고', () => {
    expect(detectWorkerContractMismatch('DAILY_CONSTRUCTION', 'REGULAR_EMPLOYMENT')).toBeTruthy()
  })

  it('건설일용 근로자 + 기간제 계약서 → 경고', () => {
    expect(detectWorkerContractMismatch('DAILY_CONSTRUCTION', 'FIXED_TERM_EMPLOYMENT')).toBeTruthy()
  })

  it('기간제 근로자 + 기간제 계약서 → 경고 없음', () => {
    expect(detectWorkerContractMismatch('FIXED_TERM', 'FIXED_TERM_EMPLOYMENT')).toBeNull()
  })

  it('경고 메시지가 비어 있지 않아야 한다', () => {
    const cases: [string, string][] = [
      ['REGULAR', 'DAILY_EMPLOYMENT'],
      ['DAILY_CONSTRUCTION', 'REGULAR_EMPLOYMENT'],
      ['FIXED_TERM', 'DAILY_EMPLOYMENT'],
    ]
    for (const [empType, tmpl] of cases) {
      const msg = detectWorkerContractMismatch(empType, tmpl)
      expect(msg).not.toBeNull()
      expect(msg!.length).toBeGreaterThan(0)
    }
  })
})
