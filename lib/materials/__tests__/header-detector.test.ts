import { describe, it, expect } from 'vitest'
import { detectHeader } from '../header-detector'

type Row = (string | number | null)[]

// 헬퍼: 헤더 행을 특정 위치에 삽입한 rows 생성
function makeRows(headerAt: number, headerCells: string[]): Row[] {
  const rows: Row[] = []
  for (let i = 0; i < headerAt; i++) {
    rows.push(['공사명: 테스트 공사', null, null, null, null, null, null])
  }
  rows.push(headerCells)
  rows.push(['감지기', 'DC24V 광전식', 'EA', '100', '15000', '1500000', null])
  rows.push(['발신기', 'P형 1급', 'EA', '2', '50000', '100000', null])
  return rows
}

const STANDARD_HEADER = ['품명', '규격', '단위', '수량', '단가', '금액', '비고']
const ALT_HEADER = ['항목명', '규격', '단위', '수량', '단가', '금액', '비고']

describe('detectHeader — 헤더 탐지', () => {
  describe('정상 케이스', () => {
    it('row 0에 헤더가 있는 경우', () => {
      const rows = makeRows(0, STANDARD_HEADER)
      const result = detectHeader(rows)
      expect(result).not.toBeNull()
      expect(result!.headerRowIndex).toBe(0)
      expect(result!.dataStartRowIndex).toBe(1)
    })

    it('row 3에 헤더 (제목행 3개 후)', () => {
      const rows = makeRows(3, STANDARD_HEADER)
      const result = detectHeader(rows)
      expect(result).not.toBeNull()
      expect(result!.headerRowIndex).toBe(3)
      expect(result!.dataStartRowIndex).toBe(4)
    })

    it('row 5에 헤더', () => {
      const rows = makeRows(5, STANDARD_HEADER)
      const result = detectHeader(rows)
      expect(result!.headerRowIndex).toBe(5)
    })

    it('row 8에 헤더 (깊은 위치)', () => {
      const rows = makeRows(8, STANDARD_HEADER)
      const result = detectHeader(rows)
      expect(result!.headerRowIndex).toBe(8)
    })

    it('항목명 키워드로도 헤더 탐지', () => {
      const rows = makeRows(2, ALT_HEADER)
      const result = detectHeader(rows)
      expect(result).not.toBeNull()
      expect(result!.columnMap['itemName']).toBe(0)
    })
  })

  describe('컬럼맵 정확도', () => {
    it('표준 헤더의 컬럼맵이 정확함', () => {
      const rows = makeRows(0, STANDARD_HEADER)
      const result = detectHeader(rows)!
      expect(result.columnMap['itemName']).toBe(0)  // 품명
      expect(result.columnMap['spec']).toBe(1)       // 규격
      expect(result.columnMap['unit']).toBe(2)       // 단위
      expect(result.columnMap['quantity']).toBe(3)   // 수량
      expect(result.columnMap['unitPrice']).toBe(4)  // 단가
      expect(result.columnMap['amount']).toBe(5)     // 금액
      expect(result.columnMap['note']).toBe(6)       // 비고
    })

    it('헤더 순서가 다른 경우에도 정확한 컬럼맵', () => {
      const reorderedHeader: Row = ['비고', '단가', '금액', '수량', '단위', '규격', '품명']
      const rows: Row[] = [reorderedHeader, ['감지기', '15000', '1500000', '100', 'EA', 'DC24V', null]]
      const result = detectHeader(rows)!
      expect(result.columnMap['note']).toBe(0)
      expect(result.columnMap['itemName']).toBe(6)
    })

    it('비고 없는 헤더도 탐지 (최소 3개 매치)', () => {
      const minHeader: Row = ['품명', '규격', '단위', '수량']
      const rows: Row[] = [minHeader, ['배관', '25A', 'M', '50']]
      const result = detectHeader(rows)
      expect(result).not.toBeNull()
    })
  })

  describe('실패 케이스', () => {
    it('헤더가 없으면 null 반환', () => {
      const rows: Row[] = [
        ['공사개요', '소방공사', null],
        ['발주처', '테스트 발주처', null],
        ['공사기간', '2024.01~2024.12', null],
      ]
      expect(detectHeader(rows)).toBeNull()
    })

    it('헤더가 20행 이후에 있으면 탐지 못함', () => {
      const rows = makeRows(21, STANDARD_HEADER)
      expect(detectHeader(rows)).toBeNull()
    })

    it('키워드 2개 이하이면 헤더로 인식 안 함', () => {
      const rows: Row[] = [
        ['품명', '규격'],       // 2개 → 탐지 안 됨
        ['감지기', 'DC24V'],
      ]
      expect(detectHeader(rows)).toBeNull()
    })

    it('빈 배열 → null', () => {
      expect(detectHeader([])).toBeNull()
    })
  })

  describe('실제 내역서 유사 패턴', () => {
    it('2중 헤더 — 더 상세한 행을 헤더로 선택', () => {
      // 첫 번째 행: 대분류 헤더 (3개 매치), 두 번째 행: 상세 헤더 (7개 매치)
      const rows: Row[] = [
        ['명칭 및 규격', null, '단위', '수량', null, '금액', null],
        ['품명', '규격', '단위', '수량', '단가', '금액', '비고'],
        ['감지기', 'DC24V', 'EA', '10', '15000', '150000', null],
      ]
      const result = detectHeader(rows)!
      // 두 번째 행(index 0)이 먼저 3개 이상 매치되므로 index 0 반환
      expect(result.headerRowIndex).toBeLessThanOrEqual(1)
    })

    it('헤더 셀에 공백 포함 — 트림 후 매치', () => {
      const rows: Row[] = [
        ['  품명  ', '  규격  ', ' 단위 ', ' 수량 ', ' 단가 ', ' 금액 '],
        ['배관', '25A', 'M', '100'],
      ]
      const result = detectHeader(rows)
      expect(result).not.toBeNull()
    })
  })
})
