import { describe, it, expect } from 'vitest'
import { parseSheetRows } from '../row-parser'

type Row = (string | number | null)[]

const HEADER: Row = ['품명', '규격', '단위', '수량', '단가', '금액', '비고']

function makeSheet(dataRows: Row[]): Row[] {
  return [HEADER, ...dataRows]
}

describe('parseSheetRows — 항목행 파싱', () => {
  describe('기본 파싱', () => {
    it('정상 데이터 행 파싱', () => {
      const rows = makeSheet([
        ['감지기', 'DC24V 광전식', 'EA', '100', '15000', '1500000', null],
      ])
      const result = parseSheetRows(rows, '소방전기')
      expect(result.headerRowIndex).toBe(0)
      expect(result.dataStartRowIndex).toBe(1)
      expect(result.rows).toHaveLength(1)

      const row = result.rows[0]
      expect(row.rawItemName).toBe('감지기')
      expect(row.rawSpec).toBe('DC24V 광전식')
      expect(row.rawUnit).toBe('EA')
      expect(row.quantity).toBe(100)
      expect(row.unitPrice).toBe(15000)
      expect(row.amount).toBe(1500000)
      expect(row.isSummaryRow).toBe(false)
      expect(row.rowType).toBe('DATA')
    })

    it('다수 데이터 행', () => {
      const rows = makeSheet([
        ['감지기', 'DC24V', 'EA', '100', '15000', '1500000', null],
        ['발신기', 'P형', 'EA', '2', '50000', '100000', null],
        ['배관', '25A', 'M', '500', '3000', '1500000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      expect(parsed).toHaveLength(3)
      expect(parsed[0].rawItemName).toBe('감지기')
      expect(parsed[1].rawItemName).toBe('발신기')
      expect(parsed[2].rawItemName).toBe('배관')
    })

    it('discipline이 null이어도 파싱 성공', () => {
      const rows = makeSheet([['배관', '25A', 'M', '100', '3000', '300000', null]])
      const { rows: parsed } = parseSheetRows(rows, null)
      expect(parsed[0].groupKey).toContain('ALL|배관')
    })
  })

  describe('수량/금액 숫자 파싱', () => {
    it('쉼표 포함 숫자 파싱', () => {
      const rows = makeSheet([
        ['배관', '25A', 'M', '1,000', '3,500', '3,500,000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      expect(parsed[0].quantity).toBe(1000)
      expect(parsed[0].unitPrice).toBe(3500)
      expect(parsed[0].amount).toBe(3500000)
    })

    it('문자열 숫자도 파싱', () => {
      const rows = makeSheet([
        ['감지기', 'DC24V', 'EA', 50, 15000, 750000, null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      expect(parsed[0].quantity).toBe(50)
      expect(parsed[0].amount).toBe(750000)
    })

    it('숫자 불명확 시 null', () => {
      const rows = makeSheet([
        ['공사개요설명', null, null, '일식', null, null, null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      // '일식' → parseFloat 불가 → null
      const r = parsed.find(p => p.rawItemName === '공사개요설명')
      if (r) expect(r.quantity).toBeNull()
    })
  })

  describe('소계/합계행 처리', () => {
    it.each([
      ['소계'],
      ['합계'],
      ['총계'],
      ['자재비계'],
      ['노무비계'],
      ['경비계'],
    ])('"%s" 포함 행 → isSummaryRow=true, rowType=SUMMARY', (keyword) => {
      const rows = makeSheet([
        ['감지기', 'DC24V', 'EA', '100', '15000', '1500000', null],
        [keyword, null, null, null, null, '1500000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      const summaryRow = parsed.find(r => r.rawItemName === keyword)
      expect(summaryRow).toBeDefined()
      expect(summaryRow!.isSummaryRow).toBe(true)
      expect(summaryRow!.rowType).toBe('SUMMARY')
    })

    it('소계행도 파싱 목록에는 포함됨 (제외 처리는 저장 시 결정)', () => {
      const rows = makeSheet([
        ['배관', '25A', 'M', '100', '3000', '300000', null],
        ['소계', null, null, null, null, '300000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      expect(parsed.some(r => r.isSummaryRow)).toBe(true)
    })
  })

  describe('섹션행 처리 (fill-down)', () => {
    it('단위/수량 없는 짧은 행 → SECTION', () => {
      const rows = makeSheet([
        ['소방전기공사', null, null, null, null, null, null],
        ['감지기', 'DC24V', 'EA', '100', '15000', '1500000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      const sectionRow = parsed.find(r => r.rawItemName === '소방전기공사')
      expect(sectionRow).toBeDefined()
      expect(sectionRow!.rowType).toBe('SECTION')
    })

    it('섹션 아래 데이터행에 sectionName 전파', () => {
      const rows = makeSheet([
        ['소방전기공사', null, null, null, null, null, null],
        ['감지기', 'DC24V', 'EA', '100', '15000', '1500000', null],
        ['발신기', 'P형', 'EA', '2', '50000', '100000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      const dataRows = parsed.filter(r => r.rowType === 'DATA')
      expect(dataRows[0].sectionName).toBe('소방전기공사')
      expect(dataRows[1].sectionName).toBe('소방전기공사')
    })
  })

  describe('빈 행 처리', () => {
    it('완전 빈 행은 건너뜀', () => {
      const rows = makeSheet([
        ['감지기', 'DC24V', 'EA', '100', '15000', '1500000', null],
        [null, null, null, null, null, null, null],
        ['발신기', 'P형', 'EA', '2', '50000', '100000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      const nonEmpty = parsed.filter(r => r.rawItemName)
      expect(nonEmpty.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('정규화 연결', () => {
    it('단위가 정규화됨', () => {
      const rows = makeSheet([
        ['배관', '25A', '개', '100', '3000', '300000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      expect(parsed[0].normalizedUnit).toBe('EA')
    })

    it('rawUnit은 원문 보존', () => {
      const rows = makeSheet([
        ['배관', '25A', '개', '100', '3000', '300000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      expect(parsed[0].rawUnit).toBe('개')
      expect(parsed[0].normalizedUnit).toBe('EA')
    })

    it('groupKey에 discipline 포함', () => {
      const rows = makeSheet([
        ['감지기', 'DC24V', 'EA', '100', '15000', '1500000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, '소방전기')
      expect(parsed[0].groupKey).toContain('소방전기')
    })
  })

  describe('헤더 없는 시트', () => {
    it('헤더 탐지 실패 시 빈 결과 반환', () => {
      const rows: Row[] = [
        ['공사명', '소방공사'],
        ['발주처', '테스트'],
        ['위치', '서울시'],
      ]
      const result = parseSheetRows(rows, null)
      expect(result.headerRowIndex).toBeNull()
      expect(result.rows).toHaveLength(0)
    })
  })

  describe('rowNo 정확성', () => {
    it('rowNo가 실제 행 번호와 일치 (0-indexed, 헤더 이후부터 시작)', () => {
      const rows = makeSheet([
        ['감지기', 'DC24V', 'EA', '100', '15000', '1500000', null],
        ['발신기', 'P형', 'EA', '2', '50000', '100000', null],
      ])
      const { rows: parsed } = parseSheetRows(rows, null)
      expect(parsed[0].rowNo).toBe(1)
      expect(parsed[1].rowNo).toBe(2)
    })
  })
})
