import { detectHeader } from './header-detector'
import { normalizeItemName, normalizeUnit, normalizeSpec, getItemCategory, buildGroupKey } from './normalizer'

export type RowType = 'HEADER_ROW' | 'DATA_ROW' | 'GROUP_ROW' | 'SUMMARY_ROW' | 'NOTE_ROW' | 'EMPTY_ROW'

const SUMMARY_KEYWORDS = ['소계', '합계', '총계', '자재비계', '노무비계', '경비계', '공사비계', '계']
const LABOR_COST_KEYWORDS = ['노무비', '노무', '인건비', '잡재료', '경비', '간접비', '안전관리비', '산재보험']

export interface ParsedRow {
  rowNo: number
  rowType: RowType
  parseConfidence: number
  reviewRequired: boolean
  reviewReasons: string[]
  // fill-down context
  sectionName: string | null
  subsectionName: string | null
  headerPath: string[]
  groupContext: Record<string, string>
  // raw values
  rawItemName: string | null
  rawSpec: string | null
  rawUnit: string | null
  rawQuantity: string | null
  rawUnitPrice: string | null
  rawAmount: string | null
  rawNote: string | null
  rawRowJson: string
  sourceCellRange: string | null
  // parsed numeric
  quantity: number | null
  unitPrice: number | null
  amount: number | null
  isSummaryRow: boolean
  aggregateCandidate: boolean
  // normalization
  normalizedItemName: string | null
  normalizedSpec: string | null
  normalizedUnit: string | null
  itemCategory: string | null
  normalizationSource: 'DICTIONARY' | 'SYNONYM' | 'UNMAPPED'
  groupKey: string | null
}

function parseNum(s: string | null): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function classifyRowType(
  rawItemName: string | null,
  rawUnit: string | null,
  rawQuantity: string | null,
  rawAmount: string | null,
  allCells: (string | number | null)[]
): { rowType: RowType; confidence: number } {
  const nonEmpty = allCells.filter(c => c !== null && c !== undefined && String(c).trim() !== '')
  if (nonEmpty.length === 0) return { rowType: 'EMPTY_ROW', confidence: 0.99 }

  const itemStr = (rawItemName ?? '').trim()
  const unitStr = (rawUnit ?? '').trim()
  const qtyStr = (rawQuantity ?? '').trim()
  const amtStr = (rawAmount ?? '').trim()

  // Summary row: item name contains summary keywords
  if (itemStr && SUMMARY_KEYWORDS.some(kw => itemStr.includes(kw))) {
    // Exclude cases where keyword is part of a normal item name (very short match at start)
    const isAtStart = SUMMARY_KEYWORDS.some(kw => itemStr === kw || itemStr.startsWith(kw + ' '))
    if (isAtStart || !unitStr) {
      return { rowType: 'SUMMARY_ROW', confidence: 0.9 }
    }
  }

  // Data row: has unit AND (quantity or amount)
  if (unitStr && (qtyStr || amtStr)) {
    return { rowType: 'DATA_ROW', confidence: unitStr && qtyStr ? 0.92 : 0.75 }
  }

  // Group row: has item name, no unit, no quantity/amount, short-ish text
  if (itemStr && !unitStr && !qtyStr && !amtStr && itemStr.length < 60) {
    return { rowType: 'GROUP_ROW', confidence: 0.82 }
  }

  // Note row: long text, few structured fields
  if (nonEmpty.length <= 2 && nonEmpty.some(c => String(c).length > 30)) {
    return { rowType: 'NOTE_ROW', confidence: 0.70 }
  }

  // Data row fallback: has numeric values
  const numericCount = allCells.filter(c => c !== null && /^[\d,.]+$/.test(String(c).trim()) && String(c).trim() !== '').length
  if (numericCount >= 2 && itemStr) {
    return { rowType: 'DATA_ROW', confidence: 0.60 }
  }

  // Group row fallback
  if (itemStr && !unitStr) {
    return { rowType: 'GROUP_ROW', confidence: 0.60 }
  }

  return { rowType: 'NOTE_ROW', confidence: 0.50 }
}

function determineAggregateCandidate(
  rowType: RowType,
  rawItemName: string | null,
  rawUnit: string | null,
  rawQuantity: string | null,
  rawAmount: string | null,
): { candidate: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (rowType !== 'DATA_ROW') return { candidate: false, reasons }

  const itemStr = (rawItemName ?? '').trim()
  const unitStr = (rawUnit ?? '').trim()
  const qtyStr = (rawQuantity ?? '').trim()
  const amtStr = (rawAmount ?? '').trim()

  if (!itemStr) { reasons.push('품명없음'); return { candidate: false, reasons } }
  if (!unitStr) { reasons.push('단위없음'); return { candidate: false, reasons } }

  if (!qtyStr && amtStr) {
    reasons.push('수량없음_금액만존재')
  }

  if (LABOR_COST_KEYWORDS.some(kw => itemStr.includes(kw))) {
    reasons.push('노무_경비_성격')
    return { candidate: false, reasons }
  }

  return { candidate: reasons.length === 0, reasons }
}

export function parseSheetRows(rawRows: (string | number | null)[][], discipline: string | null): {
  headerRowIndex: number | null
  dataStartRowIndex: number | null
  rows: ParsedRow[]
} {
  const header = detectHeader(rawRows)
  if (!header) return { headerRowIndex: null, dataStartRowIndex: null, rows: [] }

  const { headerRowIndex, dataStartRowIndex, columnMap } = header

  let currentSection: string | null = null
  let currentSubsection: string | null = null
  const parsed: ParsedRow[] = []

  for (let rowNo = 0; rowNo < rawRows.length; rowNo++) {
    const row = rawRows[rowNo]

    const getCellStr = (col: string): string | null => {
      const idx = columnMap[col]
      if (idx === undefined) return null
      const val = row[idx]
      return val !== null && val !== undefined ? String(val).trim() : null
    }

    const rawItemName = getCellStr('itemName')
    const rawSpec = getCellStr('spec')
    const rawUnit = getCellStr('unit')
    const rawQuantity = getCellStr('quantity')
    const rawUnitPrice = getCellStr('unitPrice')
    const rawAmount = getCellStr('amount')
    const rawNote = getCellStr('note')

    // Header rows: already classified, save for completeness
    if (rowNo < dataStartRowIndex) {
      if (rowNo === headerRowIndex) {
        parsed.push({
          rowNo, rowType: 'HEADER_ROW', parseConfidence: 0.99, reviewRequired: false, reviewReasons: [],
          sectionName: null, subsectionName: null, headerPath: [], groupContext: {},
          rawItemName, rawSpec, rawUnit, rawQuantity, rawUnitPrice, rawAmount, rawNote,
          rawRowJson: JSON.stringify(row), sourceCellRange: null,
          quantity: null, unitPrice: null, amount: null,
          isSummaryRow: false, aggregateCandidate: false,
          normalizedItemName: null, normalizedSpec: null, normalizedUnit: null,
          itemCategory: null, normalizationSource: 'UNMAPPED', groupKey: null,
        })
      }
      continue
    }

    // Skip fully empty rows
    const allCells = row
    const nonEmpty = allCells.filter(c => c !== null && c !== undefined && String(c).trim() !== '')
    if (nonEmpty.length === 0) continue

    const { rowType, confidence } = classifyRowType(rawItemName, rawUnit, rawQuantity, rawAmount, allCells)

    // Update fill-down context
    if (rowType === 'GROUP_ROW' && rawItemName) {
      if (!currentSection) {
        currentSection = rawItemName
        currentSubsection = null
      } else if (currentSection !== rawItemName) {
        // Heuristic: if new group looks like sub-group (e.g., shorter or different prefix), use as subsection
        // Simple rule: always set as subsection if we have a section
        currentSubsection = rawItemName
      }
    }

    const headerPath = [currentSection, currentSubsection].filter(Boolean) as string[]
    const groupContext: Record<string, string> = {}
    if (currentSection) groupContext['section'] = currentSection
    if (currentSubsection) groupContext['subsection'] = currentSubsection

    const isSummaryRow = rowType === 'SUMMARY_ROW'
    const { candidate: aggregateCandidate, reasons: reviewReasons } = determineAggregateCandidate(
      rowType, rawItemName, rawUnit, rawQuantity, rawAmount
    )
    const reviewRequired = reviewReasons.length > 0

    const { normalized: normalizedItemName, source: normSource } = rawItemName
      ? normalizeItemName(rawItemName)
      : { normalized: null, source: 'UNMAPPED' as const }
    const normalizedSpec = rawSpec ? normalizeSpec(rawSpec) : null
    const normalizedUnit = rawUnit ? normalizeUnit(rawUnit) : null
    const itemCategory = normalizedItemName ? getItemCategory(normalizedItemName) : null
    const groupKey = normalizedItemName
      ? buildGroupKey(discipline, null, normalizedItemName, normalizedSpec ?? '', normalizedUnit ?? '')
      : null

    parsed.push({
      rowNo, rowType, parseConfidence: confidence, reviewRequired, reviewReasons,
      sectionName: currentSection, subsectionName: currentSubsection,
      headerPath, groupContext,
      rawItemName, rawSpec, rawUnit, rawQuantity, rawUnitPrice, rawAmount, rawNote,
      rawRowJson: JSON.stringify(row), sourceCellRange: `${rowNo + 1}:${rowNo + 1}`,
      quantity: parseNum(rawQuantity), unitPrice: parseNum(rawUnitPrice), amount: parseNum(rawAmount),
      isSummaryRow, aggregateCandidate,
      normalizedItemName, normalizedSpec, normalizedUnit, itemCategory,
      normalizationSource: normSource, groupKey,
    })
  }

  return { headerRowIndex, dataStartRowIndex, rows: parsed }
}
