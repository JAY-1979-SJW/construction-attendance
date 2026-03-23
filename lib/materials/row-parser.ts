import { detectHeader } from './header-detector'
import { normalizeItemName, normalizeUnit, normalizeSpec, getItemCategory, buildGroupKey } from './normalizer'

const SUMMARY_KEYWORDS = ['소계', '합계', '총계', '자재비계', '노무비계', '경비계', '일위대가', '계']
const SECTION_KEYWORDS = ['공종', '분류', '구분']

export type RowType = 'DATA' | 'SECTION' | 'SUBSECTION' | 'SUMMARY' | 'TITLE'

// suppress unused variable warning
void SECTION_KEYWORDS

export interface ParsedRow {
  rowNo: number
  sectionName: string | null
  subsectionName: string | null
  rawItemName: string | null
  rawSpec: string | null
  rawUnit: string | null
  rawQuantity: string | null
  rawUnitPrice: string | null
  rawAmount: string | null
  rawNote: string | null
  quantity: number | null
  unitPrice: number | null
  amount: number | null
  isSummaryRow: boolean
  rowType: RowType
  normalizedItemName: string | null
  normalizedSpec: string | null
  normalizedUnit: string | null
  itemCategory: string | null
  normalizationSource: 'DICTIONARY' | 'SYNONYM' | 'UNMAPPED'
  groupKey: string | null
}

export function parseSheetRows(rawRows: (string | number | null)[][], discipline: string | null): {
  headerRowIndex: number | null
  dataStartRowIndex: number | null
  rows: ParsedRow[]
} {
  const header = detectHeader(rawRows)
  if (!header) return { headerRowIndex: null, dataStartRowIndex: null, rows: [] }

  const { headerRowIndex, dataStartRowIndex, columnMap } = header
  const dataRows = rawRows.slice(dataStartRowIndex)

  let currentSection: string | null = null
  let currentSubsection: string | null = null
  const parsed: ParsedRow[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNo = dataStartRowIndex + i

    const getCellStr = (col: string) => {
      const idx = columnMap[col]
      if (idx === undefined) return null
      const val = row[idx]
      return val !== null && val !== undefined ? String(val).trim() : null
    }
    const getCellNum = (col: string) => {
      const s = getCellStr(col)
      if (!s) return null
      const n = parseFloat(s.replace(/,/g, ''))
      return isNaN(n) ? null : n
    }

    const rawItemName = getCellStr('itemName')
    const rawSpec = getCellStr('spec')
    const rawUnit = getCellStr('unit')
    const rawQuantity = getCellStr('quantity')
    const rawUnitPrice = getCellStr('unitPrice')
    const rawAmount = getCellStr('amount')
    const rawNote = getCellStr('note')

    const validFields = [rawItemName, rawQuantity, rawAmount].filter(Boolean)
    if (validFields.length === 0) continue

    const isSummaryRow = SUMMARY_KEYWORDS.some(kw => (rawItemName ?? '').includes(kw))
    const isSectionRow = !rawUnit && !rawQuantity && rawItemName && rawItemName.length < 30

    let rowType: RowType = 'DATA'
    if (isSummaryRow) rowType = 'SUMMARY'
    else if (isSectionRow) {
      rowType = currentSection ? 'SUBSECTION' : 'SECTION'
      if (!currentSection) currentSection = rawItemName
      else currentSubsection = rawItemName
    }

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
      rowNo, sectionName: currentSection, subsectionName: currentSubsection,
      rawItemName, rawSpec, rawUnit, rawQuantity, rawUnitPrice, rawAmount, rawNote,
      quantity: getCellNum('quantity'), unitPrice: getCellNum('unitPrice'), amount: getCellNum('amount'),
      isSummaryRow, rowType,
      normalizedItemName, normalizedSpec, normalizedUnit, itemCategory,
      normalizationSource: normSource, groupKey,
    })
  }

  return { headerRowIndex, dataStartRowIndex, rows: parsed }
}
