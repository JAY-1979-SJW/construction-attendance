import { describe, it, expect } from 'vitest'
import { normalizeUnit, normalizeSpec, normalizeItemName, buildGroupKey } from '../normalizer'

describe('normalizeUnit — 단위 표준화', () => {
  describe('EA 계열', () => {
    it.each([
      ['개', 'EA'],
      ['ea', 'EA'],
      ['EA', 'EA'],
      ['PCS', 'EA'],
      ['pcs', 'EA'],
      ['본', 'EA'],
      ['개소', 'EA'],
      ['처', 'EA'],
    ])('"%s" → "%s"', (input, expected) => {
      expect(normalizeUnit(input)).toBe(expected)
    })
  })

  describe('M(길이) 계열', () => {
    it.each([
      ['m', 'M'],
      ['M', 'M'],
      ['meter', 'M'],
    ])('"%s" → "%s"', (input, expected) => {
      expect(normalizeUnit(input)).toBe(expected)
    })
  })

  describe('SET 계열', () => {
    it.each([
      ['식', 'SET'],
      ['SET', 'SET'],
      ['set', 'SET'],
      ['조', 'SET'],
    ])('"%s" → "%s"', (input, expected) => {
      expect(normalizeUnit(input)).toBe(expected)
    })
  })

  describe('기타 단위', () => {
    it.each([
      ['LOT', 'LOT'],
      ['lot', 'LOT'],
      ['kg', 'KG'],
      ['KG', 'KG'],
      ['톤', 'TON'],
      ['TON', 'TON'],
      ['㎡', 'M2'],
      ['m2', 'M2'],
      ['M2', 'M2'],
      ['㎥', 'M3'],
      ['m3', 'M3'],
    ])('"%s" → "%s"', (input, expected) => {
      expect(normalizeUnit(input)).toBe(expected)
    })
  })

  describe('매핑 없는 단위 — 원문 유지', () => {
    it.each([
      ['병'],
      ['회'],
      ['장'],
      ['UNKNOWN_UNIT'],
    ])('"%s" → 원문 그대로', (input) => {
      expect(normalizeUnit(input)).toBe(input)
    })
  })

  describe('엣지 케이스', () => {
    it('빈 문자열 → 빈 문자열', () => {
      expect(normalizeUnit('')).toBe('')
    })

    it('앞뒤 공백 제거', () => {
      expect(normalizeUnit('  EA  ')).toBe('EA')
    })
  })
})

describe('normalizeSpec — 규격 표준화', () => {
  it('Ø 표기를 A로 변환', () => {
    expect(normalizeSpec('25Ø')).toBe('25A')
    expect(normalizeSpec('32 Ø')).toBe('32A')
  })

  it('다중 공백 제거', () => {
    expect(normalizeSpec('DC  24V')).toBe('DC 24V')
  })

  it('앞뒤 공백 트림', () => {
    expect(normalizeSpec('  25A  ')).toBe('25A')
  })

  it('정상 규격 유지', () => {
    expect(normalizeSpec('DC24V')).toBe('DC24V')
    expect(normalizeSpec('25A')).toBe('25A')
    expect(normalizeSpec('32mm')).toBe('32mm')
  })

  it('빈 문자열 → 빈 문자열', () => {
    expect(normalizeSpec('')).toBe('')
  })
})

describe('normalizeItemName — 항목명 정규화 (Phase 1: 공백 정리 + UNMAPPED)', () => {
  it('공백 정리', () => {
    const r = normalizeItemName('감지기  (광전식)')
    expect(r.normalized).toBe('감지기 (광전식)')
    expect(r.source).toBe('UNMAPPED')
  })

  it('앞뒤 공백 트림', () => {
    const r = normalizeItemName('  배관  ')
    expect(r.normalized).toBe('배관')
  })

  it('빈 문자열 → UNMAPPED', () => {
    const r = normalizeItemName('')
    expect(r.source).toBe('UNMAPPED')
  })

  it('정상 항목명 — source는 항상 UNMAPPED (Phase 1)', () => {
    const r = normalizeItemName('스프링클러헤드')
    expect(r.source).toBe('UNMAPPED')
    expect(r.normalized).toBe('스프링클러헤드')
  })
})

describe('buildGroupKey — 그룹키 생성', () => {
  describe('itemCode 있는 경우', () => {
    it('itemCode 기반 키 생성', () => {
      const key = buildGroupKey('소방전기', 'ITEM001', '감지기', 'DC24V', 'EA')
      expect(key).toBe('소방전기|ITEM001|DC24V|EA')
    })

    it('itemCode 있으면 항목명 무시', () => {
      const key1 = buildGroupKey('소방전기', 'ITEM001', '감지기A', 'DC24V', 'EA')
      const key2 = buildGroupKey('소방전기', 'ITEM001', '감지기B', 'DC24V', 'EA')
      expect(key1).toBe(key2)
    })
  })

  describe('itemCode 없는 경우', () => {
    it('항목명+규격+단위 기반 키 생성', () => {
      const key = buildGroupKey('소방기계', null, '배관', '25A', 'M')
      expect(key).toBe('소방기계|배관|25A|M')
    })

    it('discipline null이면 ALL 사용', () => {
      const key = buildGroupKey(null, null, '배관', '25A', 'M')
      expect(key).toBe('ALL|배관|25A|M')
    })
  })

  describe('동일 그룹 판정', () => {
    it('discipline이 다르면 다른 키', () => {
      const e = buildGroupKey('소방전기', null, '배관', '25A', 'M')
      const m = buildGroupKey('소방기계', null, '배관', '25A', 'M')
      expect(e).not.toBe(m)
    })

    it('규격이 다르면 다른 키', () => {
      const k1 = buildGroupKey('기계', null, '배관', '25A', 'M')
      const k2 = buildGroupKey('기계', null, '배관', '32A', 'M')
      expect(k1).not.toBe(k2)
    })

    it('단위가 다르면 다른 키', () => {
      const k1 = buildGroupKey('기계', null, '배관', '25A', 'M')
      const k2 = buildGroupKey('기계', null, '배관', '25A', 'EA')
      expect(k1).not.toBe(k2)
    })

    it('모두 동일하면 같은 키 (중복 합산 대상)', () => {
      const k1 = buildGroupKey('소방전기', null, '감지기', 'DC24V', 'EA')
      const k2 = buildGroupKey('소방전기', null, '감지기', 'DC24V', 'EA')
      expect(k1).toBe(k2)
    })
  })
})
