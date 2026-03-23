import { describe, it, expect } from 'vitest'
import { detectSheetByName } from '../sheet-detector'

describe('detectSheetByName — 시트 유형 분류', () => {
  // ── SUMMARY ──────────────────────────────────────────────
  describe('SUMMARY 분류', () => {
    it.each([
      ['원가계산'],
      ['총괄표'],
      ['총괄'],
      ['원가'],
      ['공사 총괄'],
      ['Cost Summary'],
    ])('"%s" → SUMMARY', (name) => {
      const r = detectSheetByName(name)
      expect(r.sheetType).toBe('SUMMARY')
      expect(r.needsReview).toBe(false)
      expect(r.confidence).toBeGreaterThanOrEqual(0.8)
    })
  })

  // ── TRADE_SUMMARY ─────────────────────────────────────────
  describe('TRADE_SUMMARY 분류', () => {
    it.each([
      ['집계표', null],
      ['소방전기집계표', '소방전기'],
      ['소방기계집계표', '소방기계'],
      ['공종별집계표', '공종별'],
      ['공종집계', null],
    ])('"%s" → TRADE_SUMMARY (discipline=%s)', (name, expectedDiscipline) => {
      const r = detectSheetByName(name)
      expect(r.sheetType).toBe('TRADE_SUMMARY')
      expect(r.needsReview).toBe(false)
      if (expectedDiscipline !== null) {
        expect(r.discipline).toBe(expectedDiscipline)
      }
    })
  })

  // ── DETAIL_BILL ───────────────────────────────────────────
  describe('DETAIL_BILL 분류', () => {
    it.each([
      ['내역서', null],
      ['소방전기내역서', '소방전기'],
      ['소방기계내역서', '소방기계'],
      ['기계설비내역', '기계설비'],
      ['전기내역서', '전기'],
      ['BOQ'],
    ])('"%s" → DETAIL_BILL', (name) => {
      const r = detectSheetByName(name)
      expect(r.sheetType).toBe('DETAIL_BILL')
      expect(r.needsReview).toBe(false)
    })

    it('소방전기내역서 → discipline=소방전기', () => {
      const r = detectSheetByName('소방전기내역서')
      expect(r.discipline).toBe('소방전기')
    })

    it('소방기계내역서 → discipline=소방기계', () => {
      const r = detectSheetByName('소방기계내역서')
      expect(r.discipline).toBe('소방기계')
    })

    it('기계설비내역서 → discipline=기계설비', () => {
      const r = detectSheetByName('기계설비내역서')
      expect(r.discipline).toBe('기계설비')
    })
  })

  // ── UNIT_PRICE ────────────────────────────────────────────
  describe('UNIT_PRICE 분류', () => {
    it.each([
      ['일위대가'],
      ['일위'],
      ['Unit Price'],
    ])('"%s" → UNIT_PRICE', (name) => {
      const r = detectSheetByName(name)
      expect(r.sheetType).toBe('UNIT_PRICE')
      expect(r.needsReview).toBe(false)
    })
  })

  // ── PRICE_TABLE ───────────────────────────────────────────
  describe('PRICE_TABLE 분류', () => {
    it.each([
      ['단가표'],
      ['자재단가'],
      ['노무단가'],
      ['가격표'],
    ])('"%s" → PRICE_TABLE', (name) => {
      const r = detectSheetByName(name)
      expect(r.sheetType).toBe('PRICE_TABLE')
      expect(r.needsReview).toBe(false)
    })

    it('자재단가 → discipline=자재', () => {
      const r = detectSheetByName('자재단가')
      // '자재' prefix remains after stripping '단가'
      expect(r.discipline).toBe('자재')
    })
  })

  // ── REFERENCE ─────────────────────────────────────────────
  describe('REFERENCE 분류', () => {
    it.each([
      ['공사개요'],
      ['개요'],
      ['표지'],
      ['참고'],
      ['cover'],
      ['overview'],
    ])('"%s" → REFERENCE', (name) => {
      const r = detectSheetByName(name)
      expect(r.sheetType).toBe('REFERENCE')
      expect(r.needsReview).toBe(false)
    })
  })

  // ── UNKNOWN ───────────────────────────────────────────────
  describe('UNKNOWN 분류 (검토 필요)', () => {
    it.each([
      ['Sheet1'],
      ['Sheet2'],
      ['기타'],
      ['참조1'],
      ['DATA'],
    ])('"%s" → UNKNOWN, needsReview=true', (name) => {
      const r = detectSheetByName(name)
      expect(r.sheetType).toBe('UNKNOWN')
      expect(r.needsReview).toBe(true)
    })
  })

  // ── discipline 추출 정확도 ─────────────────────────────────
  describe('discipline 추출', () => {
    it('순수 공종명만 남는지 확인 — 소방전기내역서', () => {
      expect(detectSheetByName('소방전기내역서').discipline).toBe('소방전기')
    })

    it('총괄표는 discipline null', () => {
      expect(detectSheetByName('총괄표').discipline).toBeNull()
    })

    it('시트명이 접미사만으로 구성된 경우 discipline null', () => {
      expect(detectSheetByName('내역서').discipline).toBeNull()
    })

    it('공종+집계표 형태', () => {
      expect(detectSheetByName('건축집계표').discipline).toBe('건축')
    })
  })
})
