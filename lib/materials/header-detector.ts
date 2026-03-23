const HEADER_KEYWORDS = ['품명', '항목명', '명칭', '규격', '단위', '수량', '단가', '금액', '비고']

export interface HeaderDetectionResult {
  headerRowIndex: number
  dataStartRowIndex: number
  columnMap: Record<string, number>
}

export function detectHeader(rows: (string | number | null)[][]): HeaderDetectionResult | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i].map(c => String(c ?? '').trim())
    const matchCount = HEADER_KEYWORDS.filter(kw => row.some(cell => cell.includes(kw))).length

    if (matchCount >= 3) {
      const columnMap: Record<string, number> = {}
      row.forEach((cell, idx) => {
        if (cell.includes('품명') || cell.includes('항목명') || cell.includes('명칭')) columnMap['itemName'] = idx
        if (cell.includes('규격')) columnMap['spec'] = idx
        if (cell.includes('단위')) columnMap['unit'] = idx
        if (cell.includes('수량')) columnMap['quantity'] = idx
        if (cell.includes('단가')) columnMap['unitPrice'] = idx
        if (cell.includes('금액')) columnMap['amount'] = idx
        if (cell.includes('비고')) columnMap['note'] = idx
      })
      return { headerRowIndex: i, dataStartRowIndex: i + 1, columnMap }
    }
  }
  return null
}
