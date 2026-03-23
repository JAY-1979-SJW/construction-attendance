import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { extractSheetData } from '../estimate-parser'

// xlsx WorkSheet를 AoA(Array of Arrays)로 생성하는 헬퍼
function makeWorksheet(data: (string | number | null)[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(data)
}

// 병합 범위를 직접 추가하는 헬퍼
function addMerges(ws: XLSX.WorkSheet, merges: XLSX.Range[]): XLSX.WorkSheet {
  ws['!merges'] = merges
  return ws
}

function range(sr: number, sc: number, er: number, ec: number): XLSX.Range {
  return { s: { r: sr, c: sc }, e: { r: er, c: ec } }
}

describe('extractSheetData — 시트 원문 추출 및 병합셀 처리', () => {
  describe('기본 셀 추출', () => {
    it('3×3 단순 시트 — 모든 셀 추출', () => {
      const ws = makeWorksheet([
        ['품명', '규격', '단위'],
        ['감지기', 'DC24V', 'EA'],
        ['배관', '25A', 'M'],
      ])
      const { cells, maxRows, maxCols } = extractSheetData(ws)
      expect(maxRows).toBe(3)
      expect(maxCols).toBe(3)
      // 각 행에 3셀
      expect(cells[0]).toHaveLength(3)
      expect(cells[1]).toHaveLength(3)
    })

    it('셀 값이 정확히 저장됨', () => {
      const ws = makeWorksheet([
        ['품명', '규격', '단위'],
        ['감지기', 'DC24V', 'EA'],
      ])
      const { cells } = extractSheetData(ws)
      expect(cells[0][0].v).toBe('품명')
      expect(cells[0][1].v).toBe('규격')
      expect(cells[1][0].v).toBe('감지기')
      expect(cells[1][2].v).toBe('EA')
    })

    it('숫자 셀도 저장됨', () => {
      const ws = makeWorksheet([
        ['품명', '수량', '금액'],
        ['감지기', 100, 1500000],
      ])
      const { cells } = extractSheetData(ws)
      expect(cells[1][1].v).toBe(100)
      expect(cells[1][2].v).toBe(1500000)
    })

    it('null/빈 셀도 포함됨 (v=null)', () => {
      const ws = makeWorksheet([
        ['품명', null, '단위'],
        [null, 'DC24V', null],
      ])
      const { cells } = extractSheetData(ws)
      expect(cells[0][1].v).toBeNull()
      expect(cells[1][0].v).toBeNull()
    })
  })

  describe('병합셀 처리 — rowspan/colspan', () => {
    it('가로 2칸 병합 → colspan=2', () => {
      const ws = makeWorksheet([
        ['제목1', null, '제목2'],
        ['값A', '값B', '값C'],
      ])
      addMerges(ws, [range(0, 0, 0, 1)])  // A1:B1 병합
      const { cells } = extractSheetData(ws)

      // 첫 행: 원점 셀(0,0)은 colspan=2, 덮어진 셀(0,1)은 제외
      const row0 = cells[0]
      const originCell = row0.find(c => c.r === 0 && c.c === 0)
      expect(originCell).toBeDefined()
      expect(originCell!.colspan).toBe(2)
      expect(originCell!.rowspan).toBeUndefined()  // rowspan은 없음

      // 덮어진 셀(0,1)은 row에 없음
      expect(row0.find(c => c.r === 0 && c.c === 1)).toBeUndefined()
    })

    it('세로 2칸 병합 → rowspan=2', () => {
      const ws = makeWorksheet([
        ['제목', '값1'],
        [null, '값2'],
      ])
      addMerges(ws, [range(0, 0, 1, 0)])  // A1:A2 병합
      const { cells } = extractSheetData(ws)

      const originCell = cells[0].find(c => c.r === 0 && c.c === 0)
      expect(originCell!.rowspan).toBe(2)
      expect(originCell!.colspan).toBeUndefined()

      // 덮어진 셀(1,0)은 row1에 없음
      expect(cells[1].find(c => c.r === 1 && c.c === 0)).toBeUndefined()
    })

    it('가로+세로 복합 병합 (2×3) → rowspan=2, colspan=3', () => {
      const ws = makeWorksheet([
        ['대제목', null, null, '값'],
        [null, null, null, '값2'],
      ])
      addMerges(ws, [range(0, 0, 1, 2)])  // A1:C2 병합
      const { cells } = extractSheetData(ws)

      const originCell = cells[0].find(c => c.r === 0 && c.c === 0)
      expect(originCell!.rowspan).toBe(2)
      expect(originCell!.colspan).toBe(3)

      // 덮어진 셀들은 모두 없음
      expect(cells[0].find(c => c.c === 1)).toBeUndefined()
      expect(cells[0].find(c => c.c === 2)).toBeUndefined()
      expect(cells[1].find(c => c.c === 0)).toBeUndefined()
    })

    it('병합 없는 시트 — merges 빈 배열', () => {
      const ws = makeWorksheet([['A', 'B'], ['C', 'D']])
      const { merges } = extractSheetData(ws)
      expect(merges).toHaveLength(0)
    })

    it('병합범위 좌표가 정확히 보존됨', () => {
      const ws = makeWorksheet([
        ['A', 'B', 'C'],
        ['D', null, 'F'],
      ])
      addMerges(ws, [range(1, 1, 1, 2)])  // B2:C2 병합
      const { merges } = extractSheetData(ws)
      expect(merges).toHaveLength(1)
      expect(merges[0].s).toEqual({ r: 1, c: 1 })
      expect(merges[0].e).toEqual({ r: 1, c: 2 })
    })
  })

  describe('실제 내역서 유사 패턴 — 샘플 A (병합 많은 구조)', () => {
    it('다중 헤더 행 (3행 병합 제목 + 세부 헤더)', () => {
      //   행0: [공사명(colspan=7)]
      //   행1: [품명, 규격, 단위, 수량, 단가, 금액, 비고]
      //   행2: [데이터...]
      const ws = makeWorksheet([
        ['소방설비 공사 내역서', null, null, null, null, null, null],
        ['품명', '규격', '단위', '수량', '단가', '금액', '비고'],
        ['감지기', 'DC24V', 'EA', 100, 15000, 1500000, null],
      ])
      addMerges(ws, [range(0, 0, 0, 6)])  // 첫 행 전체 병합
      const { cells, merges, maxRows, maxCols } = extractSheetData(ws)

      expect(maxRows).toBe(3)
      expect(maxCols).toBe(7)
      expect(merges).toHaveLength(1)

      // 첫 행 원점 셀 colspan=7
      const titleCell = cells[0].find(c => c.c === 0)
      expect(titleCell!.colspan).toBe(7)
      expect(titleCell!.v).toBe('소방설비 공사 내역서')

      // 두 번째 행은 7셀 전부
      expect(cells[1]).toHaveLength(7)
    })

    it('중간 소계행 병합 패턴', () => {
      const ws = makeWorksheet([
        ['감지기', 'DC24V', 'EA', 100, 15000, 1500000, null],
        ['소계', null, null, null, null, 1500000, null],
        ['배관', '25A', 'M', 500, 3000, 1500000, null],
      ])
      addMerges(ws, [range(1, 0, 1, 4)])  // 소계 텍스트가 5칸 병합
      const { cells } = extractSheetData(ws)

      const sumCell = cells[1].find(c => c.c === 0)
      expect(sumCell!.v).toBe('소계')
      expect(sumCell!.colspan).toBe(5)
    })
  })

  describe('샘플 B — 시트 구조 정보', () => {
    it('행/열 수 정확성', () => {
      const data: (string | number | null)[][] = Array.from({ length: 50 }, (_, i) =>
        Array.from({ length: 10 }, (_, j) => `R${i}C${j}`)
      )
      const ws = makeWorksheet(data)
      const { maxRows, maxCols } = extractSheetData(ws)
      expect(maxRows).toBe(50)
      expect(maxCols).toBe(10)
    })

    it('빈 시트 → maxRows/maxCols=0, 빈 배열', () => {
      const ws: XLSX.WorkSheet = {}
      const { cells, merges, maxRows, maxCols } = extractSheetData(ws)
      expect(maxRows).toBe(0)
      expect(maxCols).toBe(0)
      expect(cells).toHaveLength(0)
      expect(merges).toHaveLength(0)
    })

    it('단일 셀 시트', () => {
      const ws = makeWorksheet([['유일한값']])
      const { cells, maxRows, maxCols } = extractSheetData(ws)
      expect(maxRows).toBe(1)
      expect(maxCols).toBe(1)
      expect(cells[0][0].v).toBe('유일한값')
    })
  })

  describe('rawDataJson 직렬화 안전성', () => {
    it('extractSheetData 결과가 JSON.stringify 가능', () => {
      const ws = makeWorksheet([
        ['A', 'B', null],
        [1, 2, 3],
      ])
      addMerges(ws, [range(0, 0, 0, 1)])
      const { cells, merges } = extractSheetData(ws)
      expect(() => JSON.stringify(cells)).not.toThrow()
      expect(() => JSON.stringify(merges)).not.toThrow()
    })

    it('JSON → 역직렬화 후 구조 유지', () => {
      const ws = makeWorksheet([['품명', null, '단위'], [null, null, 'EA']])
      addMerges(ws, [range(0, 0, 0, 1)])
      const { cells } = extractSheetData(ws)
      const json = JSON.stringify(cells)
      const restored = JSON.parse(json) as typeof cells
      expect(restored[0][0].colspan).toBe(2)
      expect(restored[0][0].v).toBe('품명')
    })
  })
})
