// Generic unit normalization
const UNIT_DICT: Record<string, string> = {
  // EA variants
  '개': 'EA', 'ea': 'EA', 'EA': 'EA', 'Ea': 'EA', 'PCS': 'EA', 'pcs': 'EA', 'Pcs': 'EA',
  '본': 'EA', '개소': 'EA', '처': 'EA', '대': 'EA', '문': 'EA', '짝': 'EA', '쌍': 'EA',
  '등': 'EA', '개 소': 'EA',
  // M variants
  'm': 'M', 'M': 'M', 'meter': 'M', 'METER': 'M', 'ml': 'ML', 'ML': 'ML',
  'm/m': 'M', 'M/M': 'M',
  // SET/LOT variants
  '식': 'SET', 'SET': 'SET', 'set': 'SET', 'Set': 'SET',
  '조': 'SET', '세트': 'SET',
  'LOT': 'LOT', 'lot': 'LOT', 'Lot': 'LOT',
  // KG variants
  'kg': 'KG', 'KG': 'KG', 'Kg': 'KG',
  // TON variants
  '톤': 'TON', 'TON': 'TON', 'ton': 'TON', 'Ton': 'TON', 't': 'TON', 'T': 'TON',
  // M2 variants
  '㎡': 'M2', 'm2': 'M2', 'M2': 'M2', 'm²': 'M2', 'M²': 'M2', 'SQM': 'M2', 'sqm': 'M2',
  // M3 variants
  '㎥': 'M3', 'm3': 'M3', 'M3': 'M3', 'm³': 'M3', 'M³': 'M3', 'CBM': 'M3', 'cbm': 'M3',
  // L variants
  'L': 'L', 'l': 'L', 'liter': 'L', 'LITER': 'L',
  // Roll/drum
  'ROLL': 'ROLL', 'roll': 'ROLL', '롤': 'ROLL',
  'DRUM': 'DRUM', 'drum': 'DRUM', '드럼': 'DRUM',
  // Box/bag
  'BOX': 'BOX', 'box': 'BOX', '박스': 'BOX',
  'BAG': 'BAG', 'bag': 'BAG', '포': 'BAG',
}

export function normalizeUnit(raw: string): string {
  if (!raw) return raw
  const trimmed = raw.trim()
  // Direct lookup
  if (UNIT_DICT[trimmed]) return UNIT_DICT[trimmed]
  // Case-insensitive lookup
  const upper = trimmed.toUpperCase()
  const upperMatch = Object.entries(UNIT_DICT).find(([k]) => k.toUpperCase() === upper)
  if (upperMatch) return upperMatch[1]
  // Remove spaces and retry
  const noSpace = trimmed.replace(/\s+/g, '')
  if (UNIT_DICT[noSpace]) return UNIT_DICT[noSpace]
  return trimmed
}

export function normalizeSpec(raw: string): string {
  if (!raw) return raw
  return raw.trim()
    .replace(/\s*Ø\s*/g, 'A')
    .replace(/\s*φ\s*/g, 'A')
    .replace(/\s*×\s*/g, 'x')
    .replace(/\s*✕\s*/g, 'x')
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ')
    .trim()
}

export function normalizeItemName(raw: string): { normalized: string; source: 'DICTIONARY' | 'SYNONYM' | 'UNMAPPED' } {
  if (!raw) return { normalized: raw, source: 'UNMAPPED' }
  const normalized = raw.trim()
    .replace(/\s+/g, ' ')
    .replace(/\(.*?\)/g, s => s.trim())  // keep parenthetical content but trim inside
    .trim()
  return { normalized, source: 'UNMAPPED' }
}

export function getItemCategory(_normalizedName: string): string | null {
  return null  // Phase 2: basic implementation, Phase 3 will use MaterialMaster
}

export function buildGroupKey(discipline: string | null, itemCode: string | null, normalizedName: string, normalizedSpec: string, normalizedUnit: string): string {
  const disc = discipline ?? 'ALL'
  if (itemCode) return `${disc}|${itemCode}|${normalizedSpec}|${normalizedUnit}`
  return `${disc}|${normalizedName}|${normalizedSpec}|${normalizedUnit}`
}
