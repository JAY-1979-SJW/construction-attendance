// Generic unit normalization
const UNIT_DICT: Record<string, string> = {
  '개': 'EA', 'ea': 'EA', 'EA': 'EA', 'PCS': 'EA', 'pcs': 'EA', '본': 'EA', '개소': 'EA', '처': 'EA',
  'm': 'M', 'M': 'M', 'meter': 'M',
  '식': 'SET', 'SET': 'SET', 'set': 'SET',
  '조': 'SET', 'LOT': 'LOT', 'lot': 'LOT',
  'kg': 'KG', 'KG': 'KG',
  '톤': 'TON', 'TON': 'TON', 't': 'TON',
  '㎡': 'M2', 'm2': 'M2', 'M2': 'M2',
  '㎥': 'M3', 'm3': 'M3', 'M3': 'M3',
}

export function normalizeUnit(raw: string): string {
  if (!raw) return raw
  return UNIT_DICT[raw.trim()] ?? UNIT_DICT[raw.trim().toUpperCase()] ?? raw.trim()
}

export function normalizeSpec(raw: string): string {
  if (!raw) return raw
  return raw.trim()
    .replace(/\s*Ø\s*/g, 'A')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeItemName(raw: string): { normalized: string; source: 'DICTIONARY' | 'SYNONYM' | 'UNMAPPED' } {
  if (!raw) return { normalized: raw, source: 'UNMAPPED' }
  // Phase 1: just clean whitespace, return as-is (material master lookup in phase 2)
  return { normalized: raw.trim().replace(/\s+/g, ' '), source: 'UNMAPPED' }
}

export function getItemCategory(_normalizedName: string): string | null {
  return null  // Phase 2: lookup from MaterialMaster
}

export function buildGroupKey(discipline: string | null, itemCode: string | null, normalizedName: string, normalizedSpec: string, normalizedUnit: string): string {
  const disc = discipline ?? 'ALL'
  if (itemCode) return `${disc}|${itemCode}|${normalizedSpec}|${normalizedUnit}`
  return `${disc}|${normalizedName}|${normalizedSpec}|${normalizedUnit}`
}
