export type GenericSheetType = 'SUMMARY' | 'TRADE_SUMMARY' | 'DETAIL_BILL' | 'UNIT_PRICE' | 'PRICE_TABLE' | 'REFERENCE' | 'UNKNOWN'

export interface SheetDetectionResult {
  sheetType: GenericSheetType
  discipline: string | null
  confidence: number
  needsReview: boolean
}

// Generic discipline inference from sheet name (not hardcoded to specific trades)
function inferDiscipline(sheetName: string): string | null {
  const name = sheetName.trim()
  // Extract discipline hint from sheet name by removing generic suffixes
  const genericSuffixes = ['내역서', '내역', '집계표', '집계', '단가표', '단가', '일위대가', '원가계산', '총괄']
  let discipline = name
  for (const suffix of genericSuffixes) {
    discipline = discipline.replace(suffix, '').trim()
  }
  return discipline.length > 0 && discipline !== name ? discipline : null
}

export function detectSheetByName(sheetName: string): SheetDetectionResult {
  const name = sheetName.trim()
  const discipline = inferDiscipline(name)

  // Summary / cost calculation sheets
  if (/원가계산|총괄표|총괄|원가|cost\s*summary/i.test(name)) {
    return { sheetType: 'SUMMARY', discipline: null, confidence: 0.9, needsReview: false }
  }
  // Trade summary / aggregate sheets
  if (/집계표|공종별|공종집계|trade\s*summary/i.test(name)) {
    return { sheetType: 'TRADE_SUMMARY', discipline, confidence: 0.9, needsReview: false }
  }
  // Detail bill of quantities
  if (/내역서|내역|bill|BOQ/i.test(name)) {
    return { sheetType: 'DETAIL_BILL', discipline, confidence: 0.85, needsReview: false }
  }
  // Unit price / 일위대가
  if (/일위대가|unit\s*price|일위/i.test(name)) {
    return { sheetType: 'UNIT_PRICE', discipline, confidence: 0.9, needsReview: false }
  }
  // Price table
  if (/단가표|자재단가|노무단가|가격표|price\s*table/i.test(name)) {
    return { sheetType: 'PRICE_TABLE', discipline, confidence: 0.9, needsReview: false }
  }
  // Reference / overview
  if (/개요|표지|참고|cover|overview|공사개요/i.test(name)) {
    return { sheetType: 'REFERENCE', discipline: null, confidence: 0.85, needsReview: false }
  }

  return { sheetType: 'UNKNOWN', discipline, confidence: 0.3, needsReview: true }
}
