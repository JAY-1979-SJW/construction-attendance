/**
 * Excel XLSX 실서식 출력 서비스 (ExcelJS 기반)
 */
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/db/prisma'

export type XlsxDocumentType =
  | 'WAGE_LEDGER'
  | 'MONTHLY_ATTENDANCE'
  | 'INSURANCE_REPORT'
  | 'TAX_REPORT'
  | 'RETIREMENT_MUTUAL_SUMMARY'
  | 'SUBCONTRACTOR_SETTLEMENT'
  | 'OPERATIONS_SUMMARY'

export interface XlsxExportOptions {
  monthKey: string
  documentType: XlsxDocumentType
  siteId?: string
  subcontractorId?: string
}

// 스타일 헬퍼
function styleHeader(row: ExcelJS.Row, bgColor = 'FFD3D3D3') {
  row.eachCell(cell => {
    cell.font = { bold: true, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    }
  })
}

function styleDataRow(row: ExcelJS.Row, isEven = false) {
  row.eachCell(cell => {
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    }
    if (isEven) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    }
  })
}

function formatAmount(cell: ExcelJS.Cell, value: number) {
  cell.value = value
  cell.numFmt = '#,##0'
  cell.alignment = { horizontal: 'right' }
}

function addTitleRow(sheet: ExcelJS.Worksheet, title: string, colCount: number) {
  sheet.mergeCells(1, 1, 1, colCount)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  sheet.getRow(1).height = 30
}

/** 노임대장 XLSX */
async function buildWageLedgerXlsx(opts: XlsxExportOptions): Promise<Buffer> {
  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey: opts.monthKey,
      confirmationStatus: 'CONFIRMED',
      confirmedWorkType: { not: 'INVALID' },
      ...(opts.siteId ? { siteId: opts.siteId } : {}),
    },
    include: {
      worker: { select: { name: true, residentIdMasked: true, jobTitle: true } },
      site: { select: { name: true } },
    },
    orderBy: [{ siteId: 'asc' }, { workerId: 'asc' }, { workDate: 'asc' }],
  })

  const workerIds = Array.from(new Set(confirmations.map(c => c.workerId)))
  const withholdingMap = new Map(
    (await prisma.withholdingCalculation.findMany({ where: { monthKey: opts.monthKey, workerId: { in: workerIds } } }))
      .map(w => [w.workerId, w])
  )

  const wb = new ExcelJS.Workbook()
  wb.creator = '해한 출퇴근 시스템'
  const ws = wb.addWorksheet('노임대장')

  const headers = ['현장명', '성명', '주민등록번호', '직종', '근무일자', '공수', '일급', '제수당', '지급총액', '소득세', '지방소득세', '비고']
  const colWidths = [16, 10, 16, 10, 12, 8, 10, 10, 12, 10, 10, 15]

  addTitleRow(ws, `${opts.monthKey} 노임대장`, headers.length)

  const headerRow = ws.addRow(headers)
  styleHeader(headerRow)
  ws.getRow(2).height = 22

  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = colWidths[i]
  })

  let totalGross = 0, totalTax = 0, totalLocal = 0

  confirmations.forEach((c, idx) => {
    const wh = withholdingMap.get(c.workerId)
    const gross = c.confirmedTotalAmount
    const tax = wh?.incomeTaxAmount ?? 0
    const local = wh?.localIncomeTaxAmount ?? 0
    totalGross += gross; totalTax += tax; totalLocal += local

    const row = ws.addRow([
      c.site.name, c.worker.name, c.worker.residentIdMasked ?? '', c.worker.jobTitle,
      c.workDate, Number(c.confirmedWorkUnits), c.confirmedBaseAmount, c.confirmedAllowanceAmount,
      gross, tax, local, c.notes ?? '',
    ])
    styleDataRow(row, idx % 2 === 1)
    formatAmount(ws.getRow(ws.rowCount).getCell(7), c.confirmedBaseAmount)
    formatAmount(ws.getRow(ws.rowCount).getCell(9), gross)
    formatAmount(ws.getRow(ws.rowCount).getCell(10), tax)
    formatAmount(ws.getRow(ws.rowCount).getCell(11), local)
  })

  // 합계 행
  const totalRow = ws.addRow(['합계', '', '', '', '', '', '', '', totalGross, totalTax, totalLocal, ''])
  styleHeader(totalRow, 'FFFFE0B2')
  formatAmount(totalRow.getCell(9), totalGross)
  formatAmount(totalRow.getCell(10), totalTax)
  formatAmount(totalRow.getCell(11), totalLocal)

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }]

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/** 보험판정표 XLSX */
async function buildInsuranceReportXlsx(opts: XlsxExportOptions): Promise<Buffer> {
  const snapshots = await prisma.insuranceEligibilitySnapshot.findMany({
    where: { monthKey: opts.monthKey },
    include: { worker: { select: { name: true, residentIdMasked: true, jobTitle: true } } },
    orderBy: { workerId: 'asc' },
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('보험판정표')
  const headers = ['성명', '주민번호', '직종', '귀속연월', '총근무일', '총소득', '국민연금', '건강보험', '고용보험', '산재보험']
  const colWidths = [10, 16, 10, 10, 10, 12, 10, 10, 10, 10]

  addTitleRow(ws, `${opts.monthKey} 보험판정표`, headers.length)
  styleHeader(ws.addRow(headers))
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = colWidths[i] })

  snapshots.forEach((s, idx) => {
    const row = ws.addRow([
      s.worker.name, s.worker.residentIdMasked ?? '', s.worker.jobTitle,
      s.monthKey, s.totalWorkDays, s.totalConfirmedAmount,
      s.nationalPensionEligible ? '적용' : '제외',
      s.healthInsuranceEligible ? '적용' : '제외',
      s.employmentInsuranceEligible ? '적용' : '제외',
      s.industrialAccidentEligible ? '적용' : '제외',
    ])
    styleDataRow(row, idx % 2 === 1)
    formatAmount(row.getCell(6), s.totalConfirmedAmount)
    // Color code: 적용=green, 제외=red
    ;[7, 8, 9, 10].forEach(col => {
      const cell = row.getCell(col)
      cell.font = { color: { argb: cell.value === '적용' ? 'FF006400' : 'FFCC0000' } }
    })
  })

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/** 협력사 정산서 XLSX */
async function buildSubcontractorSettlementXlsx(opts: XlsxExportOptions): Promise<Buffer> {
  const settlements = await prisma.subcontractorSettlement.findMany({
    where: {
      monthKey: opts.monthKey,
      ...(opts.siteId ? { siteId: opts.siteId } : {}),
      ...(opts.subcontractorId ? { subcontractorId: opts.subcontractorId } : {}),
    },
    include: {
      site: { select: { name: true } },
      subcontractor: { select: { name: true, businessNumber: true } },
    },
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('협력사정산서')
  const headers = ['현장명', '협력사명', '사업자번호', '귀속연월', '투입인원', '확정공수', '지급총액', '원천세', '퇴직공제', '최종지급예정액']
  const colWidths = [16, 16, 14, 10, 10, 10, 12, 10, 10, 14]

  addTitleRow(ws, `${opts.monthKey} 협력사 정산서`, headers.length)
  styleHeader(ws.addRow(headers))
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = colWidths[i] })

  let totalGross = 0, totalTax = 0, totalFinal = 0

  settlements.forEach((s, idx) => {
    const row = ws.addRow([
      s.site.name, s.subcontractor.name, s.subcontractor.businessNumber ?? '',
      s.monthKey, s.workerCount, Number(s.confirmedWorkUnits),
      s.grossAmount, s.taxAmount, s.retirementMutualAmount ?? 0, s.finalPayableAmount,
    ])
    styleDataRow(row, idx % 2 === 1)
    ;[7, 8, 9, 10].forEach(col => formatAmount(row.getCell(col), row.getCell(col).value as number))
    totalGross += s.grossAmount; totalTax += s.taxAmount; totalFinal += s.finalPayableAmount
  })

  const totalRow = ws.addRow(['합계', '', '', '', '', '', totalGross, totalTax, '', totalFinal])
  styleHeader(totalRow, 'FFFFE0B2')
  ;[7, 8, 10].forEach(col => formatAmount(totalRow.getCell(col), totalRow.getCell(col).value as number))

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/** 퇴직공제 요약표 XLSX */
async function buildRetirementSummaryXlsx(opts: XlsxExportOptions): Promise<Buffer> {
  const summaries = await prisma.retirementMutualMonthlySummary.findMany({
    where: { monthKey: opts.monthKey, ...(opts.siteId ? { siteId: opts.siteId } : {}) },
    include: {
      worker: { select: { name: true, residentIdMasked: true } },
      site: { select: { name: true } },
    },
    orderBy: [{ siteId: 'asc' }, { workerId: 'asc' }],
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('퇴직공제요약')
  const headers = ['현장명', '성명', '주민번호', '귀속연월', '인정일수', '인정공수', '대상여부', '신고상태']
  const colWidths = [16, 10, 16, 10, 10, 10, 10, 10]

  addTitleRow(ws, `${opts.monthKey} 퇴직공제 요약표`, headers.length)
  styleHeader(ws.addRow(headers))
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = colWidths[i] })

  let totalDays = 0
  summaries.forEach((s, idx) => {
    const row = ws.addRow([
      s.site.name, s.worker.name, s.worker.residentIdMasked ?? '',
      s.monthKey, s.recognizedWorkDays, Number(s.recognizedWorkUnits),
      s.eligibleYn ? '대상' : '비대상', s.reportStatus,
    ])
    styleDataRow(row, idx % 2 === 1)
    totalDays += s.recognizedWorkDays
  })

  const totalRow = ws.addRow(['합계', '', '', '', totalDays, '', '', ''])
  styleHeader(totalRow, 'FFFFE0B2')

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/** 메인 XLSX 생성 함수 */
export async function createXlsxDocument(opts: XlsxExportOptions): Promise<{ buffer: Buffer; fileName: string }> {
  let buffer: Buffer
  let fileName: string

  switch (opts.documentType) {
    case 'WAGE_LEDGER':
      buffer = await buildWageLedgerXlsx(opts)
      fileName = `${opts.monthKey}_노임대장.xlsx`
      break
    case 'INSURANCE_REPORT':
      buffer = await buildInsuranceReportXlsx(opts)
      fileName = `${opts.monthKey}_보험판정표.xlsx`
      break
    case 'SUBCONTRACTOR_SETTLEMENT':
      buffer = await buildSubcontractorSettlementXlsx(opts)
      fileName = `${opts.monthKey}_협력사정산서.xlsx`
      break
    case 'RETIREMENT_MUTUAL_SUMMARY':
      buffer = await buildRetirementSummaryXlsx(opts)
      fileName = `${opts.monthKey}_퇴직공제요약표.xlsx`
      break
    default:
      throw new Error(`XLSX not supported for: ${opts.documentType}. Use CSV instead.`)
  }

  return { buffer, fileName }
}
