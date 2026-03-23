import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { detectSheetByName } from './sheet-detector'
import { prisma } from '@/lib/db/prisma'

interface CellData {
  r: number
  c: number
  v: string | number | null
  t?: string  // value type: 'n'=number, 's'=string, 'b'=boolean
  rowspan?: number
  colspan?: number
}

interface MergeRange {
  s: { r: number; c: number }
  e: { r: number; c: number }
}

export function extractSheetData(ws: XLSX.WorkSheet): {
  cells: CellData[][]
  merges: MergeRange[]
  maxRows: number
  maxCols: number
} {
  const ref = ws['!ref']
  if (!ref) return { cells: [], merges: [], maxRows: 0, maxCols: 0 }

  const range = XLSX.utils.decode_range(ref)
  const maxRows = range.e.r + 1
  const maxCols = range.e.c + 1
  const merges: MergeRange[] = (ws['!merges'] ?? []).map((m: XLSX.Range) => ({
    s: { r: m.s.r, c: m.s.c },
    e: { r: m.e.r, c: m.e.c },
  }))

  // Build merge lookup: [r][c] → {rowspan, colspan}
  const mergeMap: Record<string, { rowspan: number; colspan: number }> = {}
  const mergedCells = new Set<string>()
  for (const m of merges) {
    const key = `${m.s.r}_${m.s.c}`
    mergeMap[key] = {
      rowspan: m.e.r - m.s.r + 1,
      colspan: m.e.c - m.s.c + 1,
    }
    // Mark all covered cells (except origin)
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) {
          mergedCells.add(`${r}_${c}`)
        }
      }
    }
  }

  // Build cell grid (skip merged non-origin cells)
  const cells: CellData[][] = []
  for (let r = 0; r < maxRows; r++) {
    const rowCells: CellData[] = []
    for (let c = 0; c < maxCols; c++) {
      const key = `${r}_${c}`
      if (mergedCells.has(key)) continue  // skip covered cells

      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      const v = cell ? cell.v ?? null : null
      const cellData: CellData = { r, c, v, t: cell?.t }
      const merge = mergeMap[key]
      if (merge) {
        if (merge.rowspan > 1) cellData.rowspan = merge.rowspan
        if (merge.colspan > 1) cellData.colspan = merge.colspan
      }
      rowCells.push(cellData)
    }
    cells.push(rowCells)
  }

  return { cells, merges, maxRows, maxCols }
}

export async function parseEstimateDocument(documentId: string): Promise<void> {
  const doc = await prisma.estimateDocument.findUnique({ where: { id: documentId } })
  if (!doc) throw new Error('Document not found')

  await prisma.estimateDocument.update({
    where: { id: documentId },
    data: { parseStatus: 'PARSING', errorMessage: null },
  })

  try {
    const fileBuffer = readFileSync(doc.filePath)
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheetNames = workbook.SheetNames

    // Clean up previous results
    await prisma.estimateDocumentSheet.deleteMany({ where: { documentId } })
    await prisma.estimateBillRow.deleteMany({ where: { documentId } })
    await prisma.materialAggregateRow.deleteMany({ where: { documentId } })

    let needsReview = false

    for (let sheetIdx = 0; sheetIdx < sheetNames.length; sheetIdx++) {
      const sheetName = sheetNames[sheetIdx]
      const ws = workbook.Sheets[sheetName]

      // Detect sheet type
      const detection = detectSheetByName(sheetName)
      if (detection.needsReview) needsReview = true

      // Extract raw data with merge info
      const { cells, merges, maxRows, maxCols } = extractSheetData(ws)

      // Check if sheet is hidden
      const sheetProps = workbook.Workbook?.Sheets?.[sheetIdx]
      const isHidden = sheetProps?.Hidden === 1 || sheetProps?.Hidden === 2

      await prisma.estimateDocumentSheet.create({
        data: {
          documentId,
          sheetName,
          sheetIndex: sheetIdx,
          sheetType: detection.sheetType as never,
          discipline: detection.discipline,
          maxRows,
          maxCols,
          mergeRangesJson: merges.length > 0 ? JSON.stringify(merges) : null,
          rawDataJson: JSON.stringify(cells),
          isHidden,
          needsReview: detection.needsReview,
          parseStatus: 'PARSED',
        },
      })
    }

    await prisma.estimateDocument.update({
      where: { id: documentId },
      data: {
        parseStatus: needsReview ? 'REVIEW_REQUIRED' : 'PARSED',
        parseVersion: { increment: 1 },
        sheetCount: sheetNames.length,
      },
    })
  } catch (err) {
    await prisma.estimateDocument.update({
      where: { id: documentId },
      data: { parseStatus: 'FAILED', errorMessage: String(err) },
    })
    throw err
  }
}
