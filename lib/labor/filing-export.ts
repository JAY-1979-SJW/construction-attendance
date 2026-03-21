/**
 * 신고 기초자료 생성 서비스
 * monthly_work_confirmations 기반으로 각종 신고용 기초자료 생성
 */
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export type ExportType =
  | 'DAILY_WAGE_NTS'
  | 'BUSINESS_INCOME_NTS'
  | 'EI_DAILY_REPORT'
  | 'NP_BASE'
  | 'HI_BASE'
  | 'RETIREMENT_MUTUAL_BASE'

export interface FilingExportOptions {
  monthKey:   string
  exportType: ExportType
  createdBy?: string
  siteId?:    string
}

export interface FilingExportResult {
  exportId: string
  rowCount: number
  rows: Record<string, unknown>[]
}

/** 일용근로소득 지급명세서 기초자료 */
async function buildDailyWageNts(monthKey: string, siteId?: string) {
  const wc = await prisma.withholdingCalculation.findMany({
    where: {
      monthKey,
      incomeType: 'DAILY_WAGE',
    },
    include: { worker: true, wageCalculation: true },
  })

  return wc.map((w) => ({
    거주구분:     w.worker.foreignerYn ? '비거주자' : '거주자',
    성명:         w.worker.name,
    주민등록번호: w.worker.residentIdMasked ?? '',
    근무처명:     '',
    귀속연월:     monthKey,
    지급총액:     w.grossAmount,
    비과세소득:   w.wageCalculation?.nonTaxableAmount ?? 0,
    과세소득:     w.wageCalculation?.taxableAmount    ?? 0,
    소득세:       w.incomeTaxAmount,
    지방소득세:   w.localIncomeTaxAmount,
    근무일수:     Number(w.wageCalculation?.regularDays ?? 0) + Number(w.wageCalculation?.halfDays ?? 0),
  }))
}

/** 사업소득 간이지급명세서 기초자료 */
async function buildBusinessIncomeNts(monthKey: string) {
  const wc = await prisma.withholdingCalculation.findMany({
    where: { monthKey, incomeType: 'BUSINESS_INCOME' },
    include: { worker: true },
  })

  return wc.map((w) => ({
    성명:         w.worker.name,
    주민등록번호: w.worker.residentIdMasked ?? '',
    귀속연월:     monthKey,
    지급금액:     w.grossAmount,
    소득세_3:     w.incomeTaxAmount,
    지방소득세_03: w.localIncomeTaxAmount,
    합계세액:     w.incomeTaxAmount + w.localIncomeTaxAmount,
  }))
}

/** 고용보험 근로내용확인신고 기초자료 */
async function buildEiDailyReport(monthKey: string, siteId?: string) {
  const ins = await prisma.insuranceEligibilitySnapshot.findMany({
    where: { monthKey, employmentInsuranceEligible: true },
    include: { worker: true },
  })

  // 일별 확정 데이터도 포함
  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      worker: { employmentType: 'DAILY_CONSTRUCTION' },
      ...(siteId ? { siteId } : {}),
    },
    include: { worker: true, site: true },
    orderBy: [{ workerId: 'asc' }, { workDate: 'asc' }],
  })

  return confirmations
    .filter((c) => c.confirmedWorkType !== 'INVALID')
    .map((c) => ({
      성명:        c.worker.name,
      주민번호:    c.worker.residentIdMasked ?? '',
      현장명:      c.site.name,
      근무일:      c.workDate,
      근무시간:    Math.round(c.confirmedWorkMinutes / 60 * 10) / 10,
      일당:        c.confirmedBaseAmount,
      공수:        Number(c.confirmedWorkUnits),
    }))
}

/** 국민연금 판정 기초자료 */
async function buildNpBase(monthKey: string) {
  const ins = await prisma.insuranceEligibilitySnapshot.findMany({
    where: { monthKey },
    include: { worker: true },
  })

  return ins.map((i) => ({
    성명:        i.worker.name,
    주민번호:    i.worker.residentIdMasked ?? '',
    귀속연월:    monthKey,
    총근무일수:  i.totalWorkDays,
    총소득금액:  i.totalConfirmedAmount,
    국민연금적용: i.nationalPensionEligible ? '적용' : '제외',
    판정사유:    i.nationalPensionReason ?? '',
  }))
}

/** 건강보험 판정 기초자료 */
async function buildHiBase(monthKey: string) {
  const ins = await prisma.insuranceEligibilitySnapshot.findMany({
    where: { monthKey },
    include: { worker: true },
  })

  return ins.map((i) => ({
    성명:        i.worker.name,
    주민번호:    i.worker.residentIdMasked ?? '',
    귀속연월:    monthKey,
    건강보험적용: i.healthInsuranceEligible ? '적용' : '제외',
    판정사유:    i.healthInsuranceReason ?? '',
  }))
}

/** 퇴직공제 기초자료 */
async function buildRetirementMutualBase(monthKey: string, siteId?: string) {
  const recs = await prisma.retirementMutualDailyRecord.findMany({
    where: {
      monthKey,
      eligibleYn: true,
      ...(siteId ? { siteId } : {}),
    },
    include: { worker: true, site: true },
    orderBy: [{ workerId: 'asc' }, { workDate: 'asc' }],
  })

  return recs.map((r) => ({
    성명:     r.worker.name,
    주민번호: r.worker.residentIdMasked ?? '',
    현장명:   r.site.name,
    근무일:   r.workDate,
    인정공수: Number(r.recognizedWorkUnit),
  }))
}

/** 신고 기초자료 생성 메인 함수 */
export async function createFilingExport(opts: FilingExportOptions): Promise<FilingExportResult> {
  const { monthKey, exportType, createdBy, siteId } = opts

  let rows: Record<string, unknown>[] = []

  switch (exportType) {
    case 'DAILY_WAGE_NTS':
      rows = await buildDailyWageNts(monthKey, siteId)
      break
    case 'BUSINESS_INCOME_NTS':
      rows = await buildBusinessIncomeNts(monthKey)
      break
    case 'EI_DAILY_REPORT':
      rows = await buildEiDailyReport(monthKey, siteId)
      break
    case 'NP_BASE':
      rows = await buildNpBase(monthKey)
      break
    case 'HI_BASE':
      rows = await buildHiBase(monthKey)
      break
    case 'RETIREMENT_MUTUAL_BASE':
      rows = await buildRetirementMutualBase(monthKey, siteId)
      break
    default:
      throw new Error(`Unknown exportType: ${exportType}`)
  }

  const record = await prisma.filingExport.create({
    data: {
      monthKey,
      exportType: exportType as never,
      status:      'COMPLETED',
      rowCount:    rows.length,
      snapshotJson: { rows: rows.slice(0, 5) as Prisma.JsonArray, totalRows: rows.length } as Prisma.InputJsonObject, // 미리보기용 스냅샷
      createdBy:   createdBy ?? null,
    },
  })

  return { exportId: record.id, rowCount: rows.length, rows }
}
