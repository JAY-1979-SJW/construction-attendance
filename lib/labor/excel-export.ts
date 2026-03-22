/**
 * Excel 실서식 출력 서비스
 * 노임대장, 월출역표, 보험판정표, 세금계산표, 퇴직공제요약표, 협력사정산서
 */
import { prisma } from '@/lib/db/prisma'

// ExcelJS will be imported dynamically to avoid build issues
// import ExcelJS from 'exceljs'

export type ExcelDocumentType =
  | 'WAGE_LEDGER'           // 노임대장
  | 'MONTHLY_ATTENDANCE'    // 월 출역표
  | 'INSURANCE_REPORT'      // 보험판정표
  | 'TAX_REPORT'            // 세금계산표
  | 'RETIREMENT_MUTUAL_SUMMARY'  // 퇴직공제 요약표
  | 'SUBCONTRACTOR_SETTLEMENT'   // 협력사 정산서

export interface ExcelExportOptions {
  monthKey: string
  documentType: ExcelDocumentType
  siteId?: string
  companyId?: string
  /** @deprecated use companyId */
  subcontractorId?: string
  createdBy?: string
}

export interface ExcelExportResult {
  buffer: Buffer
  fileName: string
  rowCount: number
}

/** 노임대장 데이터 조회 */
async function getWageLedgerData(monthKey: string, siteId?: string) {
  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      confirmedWorkType: { not: 'INVALID' },
      ...(siteId ? { siteId } : {}),
    },
    include: {
      worker: {
        select: {
          id: true, name: true, residentIdMasked: true,
          jobTitle: true,
          employmentType: true, incomeType: true,
        },
      },
      site: { select: { id: true, name: true } },
    },
    orderBy: [{ workerId: 'asc' }, { workDate: 'asc' }],
  })

  // 원천세 데이터 조회
  const workerIds = Array.from(new Set(confirmations.map(c => c.workerId)))
  const withholdingMap = new Map(
    (await prisma.withholdingCalculation.findMany({
      where: { monthKey, workerId: { in: workerIds } },
    })).map(w => [w.workerId, w])
  )

  return confirmations.map(c => ({
    현장명: c.site.name,
    성명: c.worker.name,
    주민번호: c.worker.residentIdMasked ?? '',
    직종: c.worker.jobTitle,
    근무일: c.workDate,
    공수: Number(c.confirmedWorkUnits),
    일당: c.confirmedBaseAmount,
    제수당: c.confirmedAllowanceAmount,
    지급총액: c.confirmedTotalAmount,
    소득세: withholdingMap.get(c.workerId)?.incomeTaxAmount ?? 0,
    지방소득세: withholdingMap.get(c.workerId)?.localIncomeTaxAmount ?? 0,
    비고: c.notes ?? '',
  }))
}

/** 월 출역표 데이터 조회 */
async function getMonthlyAttendanceData(monthKey: string, siteId?: string) {
  // 해당 월의 모든 날짜 생성
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const dates = Array.from({ length: daysInMonth }, (_, i) =>
    `${monthKey}-${String(i + 1).padStart(2, '0')}`
  )

  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      ...(siteId ? { siteId } : {}),
    },
    include: {
      worker: { select: { id: true, name: true, jobTitle: true } },
      site: { select: { id: true, name: true } },
    },
  })

  // worker별로 날짜 집계
  const workerMap = new Map<string, {
    name: string; jobTitle: string; siteName: string;
    days: Map<string, number>; totalUnits: number
  }>()

  for (const c of confirmations) {
    if (!workerMap.has(c.workerId)) {
      workerMap.set(c.workerId, {
        name: c.worker.name,
        jobTitle: c.worker.jobTitle,
        siteName: c.site.name,
        days: new Map(),
        totalUnits: 0,
      })
    }
    const entry = workerMap.get(c.workerId)!
    entry.days.set(c.workDate, Number(c.confirmedWorkUnits))
    entry.totalUnits += Number(c.confirmedWorkUnits)
  }

  return { workers: Array.from(workerMap.entries()), dates }
}

/** CSV 형태로 Excel 데이터를 생성 (exceljs 없을 때 fallback) */
function buildCsvFromRows(rows: Record<string, unknown>[]): Buffer {
  if (rows.length === 0) return Buffer.from('')
  const headers = Object.keys(rows[0])
  const lines = [
    '\uFEFF' + headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const v = String(row[h] ?? '')
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    ),
  ]
  return Buffer.from(lines.join('\n'), 'utf-8')
}

/** 노임대장 Excel/CSV 생성 */
export async function buildWageLedger(opts: ExcelExportOptions): Promise<ExcelExportResult> {
  const rows = await getWageLedgerData(opts.monthKey, opts.siteId)
  const buffer = buildCsvFromRows(rows)
  return {
    buffer,
    fileName: `${opts.monthKey}_노임대장.csv`,
    rowCount: rows.length,
  }
}

/** 월 출역표 Excel/CSV 생성 */
export async function buildMonthlyAttendance(opts: ExcelExportOptions): Promise<ExcelExportResult> {
  const { workers, dates } = await getMonthlyAttendanceData(opts.monthKey, opts.siteId)

  const rows = Array.from(workers).map(([, w]) => {
    const row: Record<string, unknown> = {
      현장: w.siteName,
      성명: w.name,
      직종: w.jobTitle,
    }
    for (const d of dates) {
      const day = d.split('-')[2]
      row[`${day}일`] = w.days.get(d) ?? ''
    }
    row['합계공수'] = w.totalUnits
    return row
  })

  const buffer = buildCsvFromRows(rows)
  return {
    buffer,
    fileName: `${opts.monthKey}_월출역표.csv`,
    rowCount: rows.length,
  }
}

/** 보험판정표 생성 */
export async function buildInsuranceReport(opts: ExcelExportOptions): Promise<ExcelExportResult> {
  const snapshots = await prisma.insuranceEligibilitySnapshot.findMany({
    where: { monthKey: opts.monthKey },
    include: { worker: { select: { name: true, residentIdMasked: true, jobTitle: true } } },
    orderBy: { workerId: 'asc' },
  })

  const rows = snapshots.map(s => ({
    성명: s.worker.name,
    주민번호: s.worker.residentIdMasked ?? '',
    직종: s.worker.jobTitle,
    귀속연월: s.monthKey,
    총근무일: s.totalWorkDays,
    총소득: s.totalConfirmedAmount,
    국민연금: s.nationalPensionEligible ? '적용' : '제외',
    국민연금사유: s.nationalPensionReason ?? '',
    건강보험: s.healthInsuranceEligible ? '적용' : '제외',
    건강보험사유: s.healthInsuranceReason ?? '',
    고용보험: s.employmentInsuranceEligible ? '적용' : '제외',
    고용보험사유: s.employmentInsuranceReason ?? '',
    산재보험: s.industrialAccidentEligible ? '적용' : '제외',
  }))

  const buffer = buildCsvFromRows(rows)
  return {
    buffer,
    fileName: `${opts.monthKey}_보험판정표.csv`,
    rowCount: rows.length,
  }
}

/** 세금계산표 생성 */
export async function buildTaxReport(opts: ExcelExportOptions): Promise<ExcelExportResult> {
  const calcs = await prisma.withholdingCalculation.findMany({
    where: { monthKey: opts.monthKey },
    include: {
      worker: { select: { name: true, residentIdMasked: true } },
      wageCalculation: true,
    },
    orderBy: { workerId: 'asc' },
  })

  const rows = calcs.map(c => ({
    성명: c.worker.name,
    주민번호: c.worker.residentIdMasked ?? '',
    귀속연월: c.monthKey,
    소득유형: c.incomeType,
    지급총액: c.grossAmount,
    비과세: c.wageCalculation?.nonTaxableAmount ?? 0,
    과세소득: c.wageCalculation?.taxableAmount ?? 0,
    소득세: c.incomeTaxAmount,
    지방소득세: c.localIncomeTaxAmount,
    합계세액: c.incomeTaxAmount + c.localIncomeTaxAmount,
    계산식코드: c.formulaCode,
  }))

  const buffer = buildCsvFromRows(rows)
  return {
    buffer,
    fileName: `${opts.monthKey}_세금계산표.csv`,
    rowCount: rows.length,
  }
}

/** 퇴직공제 요약표 생성 */
export async function buildRetirementMutualSummary(opts: ExcelExportOptions): Promise<ExcelExportResult> {
  const summaries = await prisma.retirementMutualMonthlySummary.findMany({
    where: {
      monthKey: opts.monthKey,
      ...(opts.siteId ? { siteId: opts.siteId } : {}),
    },
    include: {
      worker: { select: { name: true, residentIdMasked: true } },
      site: { select: { name: true } },
    },
    orderBy: [{ siteId: 'asc' }, { workerId: 'asc' }],
  })

  const rows = summaries.map(s => ({
    현장명: s.site.name,
    성명: s.worker.name,
    주민번호: s.worker.residentIdMasked ?? '',
    귀속연월: s.monthKey,
    인정일수: s.recognizedWorkDays,
    인정공수: Number(s.recognizedWorkUnits),
    대상여부: s.eligibleYn ? '대상' : '비대상',
    신고상태: s.reportStatus,
  }))

  const buffer = buildCsvFromRows(rows)
  return {
    buffer,
    fileName: `${opts.monthKey}_퇴직공제요약표.csv`,
    rowCount: rows.length,
  }
}

/** 협력사 정산서 생성 */
export async function buildSubcontractorSettlement(opts: ExcelExportOptions): Promise<ExcelExportResult> {
  const settlements = await prisma.companySettlement.findMany({
    where: {
      monthKey: opts.monthKey,
      ...(opts.siteId ? { siteId: opts.siteId } : {}),
      ...(opts.companyId ? { companyId: opts.companyId } : {}),
    },
    include: {
      site: { select: { name: true } },
      company: { select: { companyName: true, businessNumber: true } },
    },
    orderBy: [{ siteId: 'asc' }, { companyId: 'asc' }],
  })

  const rows = settlements.map(s => ({
    현장명: s.site.name,
    협력사명: s.company.companyName,
    사업자번호: s.company.businessNumber ?? '',
    귀속연월: s.monthKey,
    투입인원: s.workerCount,
    확정공수: Number(s.confirmedWorkUnits),
    지급총액: s.grossAmount,
    원천세: s.taxAmount,
    보험관련금액: s.insuranceRelatedAmount,
    퇴직공제금액: s.retirementMutualAmount ?? 0,
    최종지급예정액: s.finalPayableAmount,
  }))

  const buffer = buildCsvFromRows(rows)
  return {
    buffer,
    fileName: `${opts.monthKey}_협력사정산서.csv`,
    rowCount: rows.length,
  }
}

/** 메인 Excel 생성 함수 */
export async function createExcelDocument(opts: ExcelExportOptions): Promise<ExcelExportResult> {
  switch (opts.documentType) {
    case 'WAGE_LEDGER':           return buildWageLedger(opts)
    case 'MONTHLY_ATTENDANCE':    return buildMonthlyAttendance(opts)
    case 'INSURANCE_REPORT':      return buildInsuranceReport(opts)
    case 'TAX_REPORT':            return buildTaxReport(opts)
    case 'RETIREMENT_MUTUAL_SUMMARY': return buildRetirementMutualSummary(opts)
    case 'SUBCONTRACTOR_SETTLEMENT':  return buildSubcontractorSettlement(opts)
    default:
      throw new Error(`Unknown documentType: ${opts.documentType}`)
  }
}
