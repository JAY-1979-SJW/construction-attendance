import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { Decimal } from '@prisma/client/runtime/library'
import { detectSheetByName } from './sheet-detector'
import { parseSheetRows } from './row-parser'
import { prisma } from '@/lib/db/prisma'

interface CellData {
  r: number
  c: number
  v: string | number | null
  t?: string
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

  const mergeMap: Record<string, { rowspan: number; colspan: number }> = {}
  const mergedCells = new Set<string>()
  for (const m of merges) {
    const key = `${m.s.r}_${m.s.c}`
    mergeMap[key] = {
      rowspan: m.e.r - m.s.r + 1,
      colspan: m.e.c - m.s.c + 1,
    }
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) {
          mergedCells.add(`${r}_${c}`)
        }
      }
    }
  }

  const cells: CellData[][] = []
  for (let r = 0; r < maxRows; r++) {
    const rowCells: CellData[] = []
    for (let c = 0; c < maxCols; c++) {
      const key = `${r}_${c}`
      if (mergedCells.has(key)) continue

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

/**
 * Convert CellData[][] to flat grid (string | number | null)[][].
 * Places cells at their actual column indices and fills down for vertical merges.
 */
function buildRawGrid(cells: CellData[][], maxCols: number): (string | number | null)[][] {
  const maxRows = cells.length
  const grid: (string | number | null)[][] = Array.from({ length: maxRows }, () => Array(maxCols).fill(null))

  // Track fill-down entries: { col, value, endRow }
  const fillDown: Array<{ col: number; value: string | number | null; endRow: number }> = []

  for (let r = 0; r < maxRows; r++) {
    // Apply pending fill-downs
    for (const fd of fillDown) {
      if (fd.endRow >= r) {
        grid[r][fd.col] = fd.value
      }
    }
    // Remove expired entries
    for (let i = fillDown.length - 1; i >= 0; i--) {
      if (fillDown[i].endRow < r) fillDown.splice(i, 1)
    }

    for (const cell of cells[r]) {
      grid[r][cell.c] = cell.v ?? null
      if (cell.rowspan && cell.rowspan > 1) {
        fillDown.push({ col: cell.c, value: cell.v ?? null, endRow: r + cell.rowspan - 1 })
      }
    }
  }

  return grid
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

      const detection = detectSheetByName(sheetName)
      if (detection.needsReview) needsReview = true

      const { cells, merges, maxRows, maxCols } = extractSheetData(ws)

      const sheetProps = workbook.Workbook?.Sheets?.[sheetIdx]
      const isHidden = sheetProps?.Hidden === 1 || sheetProps?.Hidden === 2

      const sheet = await prisma.estimateDocumentSheet.create({
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

      // Parse rows for DETAIL_BILL sheets
      if (detection.sheetType === 'DETAIL_BILL' && maxRows > 0 && maxCols > 0) {
        const rawGrid = buildRawGrid(cells, maxCols)
        const { headerRowIndex, dataStartRowIndex, rows } = parseSheetRows(rawGrid, detection.discipline)

        if (rows.length > 0) {
          // Update sheet parse metadata
          await prisma.estimateDocumentSheet.update({
            where: { id: sheet.id },
            data: {
              headerRowIndex: headerRowIndex ?? undefined,
              dataStartRowIndex: dataStartRowIndex ?? undefined,
              rowCount: rows.filter(r => r.rowType === 'DATA_ROW').length,
            },
          })

          // Save rows to DB (skip EMPTY_ROW)
          for (const row of rows) {
            if (row.rowType === 'EMPTY_ROW') continue

            const billRow = await prisma.estimateBillRow.create({
              data: {
                documentId,
                sheetId: sheet.id,
                sheetName,
                discipline: detection.discipline,
                rowNo: row.rowNo,
                sectionName: row.sectionName,
                subsectionName: row.subsectionName,
                rawItemName: row.rawItemName,
                rawSpec: row.rawSpec,
                rawUnit: row.rawUnit,
                rawQuantity: row.rawQuantity,
                rawUnitPrice: row.rawUnitPrice,
                rawAmount: row.rawAmount,
                rawNote: row.rawNote,
                quantity: row.quantity !== null ? new Decimal(row.quantity) : null,
                unitPrice: row.unitPrice !== null ? new Decimal(row.unitPrice) : null,
                amount: row.amount !== null ? new Decimal(row.amount) : null,
                isSummaryRow: row.isSummaryRow,
                rowType: row.rowType,
                parseConfidence: row.parseConfidence,
                headerPathJson: row.headerPath.length > 0 ? JSON.stringify(row.headerPath) : null,
                groupContextJson: Object.keys(row.groupContext).length > 0 ? JSON.stringify(row.groupContext) : null,
                rawRowJson: row.rawRowJson,
                aggregateCandidate: row.aggregateCandidate,
                reviewRequired: row.reviewRequired,
                reviewReasonsJson: row.reviewReasons.length > 0 ? JSON.stringify(row.reviewReasons) : null,
                sourceCellRange: row.sourceCellRange,
              },
            })

            // Save normalization for DATA_ROW
            if (row.rowType === 'DATA_ROW' && row.normalizedItemName) {
              await prisma.estimateBillRowNormalized.create({
                data: {
                  billRowId: billRow.id,
                  normalizedItemName: row.normalizedItemName,
                  normalizedSpec: row.normalizedSpec,
                  normalizedUnit: row.normalizedUnit,
                  itemCategory: row.itemCategory,
                  normalizationSource: row.normalizationSource as never,
                  normalizationConfidence: row.parseConfidence,
                  groupKey: row.groupKey,
                },
              })
            }
          }
        }
      }
    }

    // Build aggregation from all DATA_ROW with aggregateCandidate=true
    await buildAggregation(documentId)

    const hasReviewRows = await prisma.estimateBillRow.count({
      where: { documentId, reviewRequired: true }
    })

    await prisma.estimateDocument.update({
      where: { id: documentId },
      data: {
        parseStatus: (needsReview || hasReviewRows > 0) ? 'REVIEW_REQUIRED' : 'PARSED',
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

async function buildAggregation(documentId: string): Promise<void> {
  // Get all DATA_ROW candidates with normalization
  const candidateRows = await prisma.estimateBillRow.findMany({
    where: { documentId, rowType: 'DATA_ROW', aggregateCandidate: true },
    include: { normalized: true },
  })

  // Group by groupKey
  const groups = new Map<string, typeof candidateRows>()
  for (const row of candidateRows) {
    const key = row.normalized?.groupKey ?? null
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  // Create aggregate rows
  for (const [groupKey, rows] of Array.from(groups.entries())) {
    const first = rows[0]
    const norm = first.normalized!

    let totalQuantity = new Decimal(0)
    let totalAmount = new Decimal(0)
    let unitPriceInconsistent = false
    const unitPrices: Decimal[] = []

    for (const row of rows) {
      if (row.quantity) totalQuantity = totalQuantity.plus(row.quantity)
      if (row.amount) totalAmount = totalAmount.plus(row.amount)
      if (row.unitPrice) unitPrices.push(row.unitPrice)
    }

    if (unitPrices.length > 1) {
      const firstPrice = unitPrices[0]
      unitPriceInconsistent = unitPrices.some(p => !p.equals(firstPrice))
    }

    const hasReview = rows.some((r: { reviewRequired: boolean }) => r.reviewRequired)
    const sourceRowIds = rows.map((r: { id: string }) => r.id)

    await prisma.materialAggregateRow.create({
      data: {
        documentId,
        discipline: first.discipline,
        normalizedItemName: norm.normalizedItemName ?? first.rawItemName ?? '(미분류)',
        normalizedSpec: norm.normalizedSpec,
        normalizedUnit: norm.normalizedUnit,
        itemCategory: norm.itemCategory,
        totalQuantity,
        totalAmount: totalAmount.gt(0) ? totalAmount : null,
        sourceRowCount: rows.length,
        sourceRowIdsJson: JSON.stringify(sourceRowIds),
        unitPriceInconsistent,
        groupKey,
        reviewRequired: hasReview,
      },
    })
  }
}
