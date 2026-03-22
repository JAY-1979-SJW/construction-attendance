/**
 * 월마감 엔진
 * 사전검사 → 마감 실행 → 잠금 → 재오픈 흐름 관리
 */
import { prisma } from '@/lib/db/prisma'
import { logCorrection } from './correction-log'

export interface PrecheckResult {
  canClose: boolean
  errors: string[]
  warnings: string[]
  summary: {
    totalWorkers: number
    draftConfirmations: number
    missingInsurance: number
    missingWage: number
    missingRetirement: number
    missingExports: number
  }
}

/** 월마감 사전검사 */
export async function precheckMonthClosing(monthKey: string): Promise<PrecheckResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. DRAFT 근무확정 확인
  const draftCount = await prisma.monthlyWorkConfirmation.count({
    where: { monthKey, confirmationStatus: 'DRAFT' },
  })
  if (draftCount > 0) {
    errors.push(`미확정 근무가 ${draftCount}건 남아있습니다.`)
  }

  // 2. 확정 근로자 수
  const confirmedWorkerIds = await prisma.monthlyWorkConfirmation.findMany({
    where: { monthKey, confirmationStatus: 'CONFIRMED' },
    select: { workerId: true },
    distinct: ['workerId'],
  })
  const workerIds = confirmedWorkerIds.map((w) => w.workerId)
  const totalWorkers = workerIds.length

  // 3. 보험판정 미생성 확인
  const insuranceCount = await prisma.insuranceEligibilitySnapshot.count({
    where: { monthKey, workerId: { in: workerIds } },
  })
  const missingInsurance = totalWorkers - insuranceCount
  if (missingInsurance > 0) {
    errors.push(`보험판정이 생성되지 않은 근로자가 ${missingInsurance}명 있습니다.`)
  }

  // 4. 세금계산 미생성 확인
  const wageCount = await prisma.wageCalculation.count({
    where: { monthKey, workerId: { in: workerIds } },
  })
  const missingWage = totalWorkers - wageCount
  if (missingWage > 0) {
    errors.push(`세금계산이 생성되지 않은 근로자가 ${missingWage}명 있습니다.`)
  }

  // 5. 퇴직공제 대상자 확인
  const retirementTargetIds = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      retirementMutualTargetSnapshot: true,
    },
    select: { workerId: true },
    distinct: ['workerId'],
  })
  const retirementTargetWorkerIds = retirementTargetIds.map((w) => w.workerId)

  let missingRetirement = 0
  if (retirementTargetWorkerIds.length > 0) {
    const retirementSummaryCount = await prisma.retirementMutualMonthlySummary.count({
      where: { monthKey, workerId: { in: retirementTargetWorkerIds } },
    })
    missingRetirement = retirementTargetWorkerIds.length - retirementSummaryCount
    if (missingRetirement > 0) {
      warnings.push(`퇴직공제 월별 요약이 생성되지 않은 근로자가 ${missingRetirement}명 있습니다.`)
    }
  }

  // 6. export 생성 여부
  const exportCount = await prisma.filingExport.count({
    where: { monthKey, isLatestYn: true, outdatedYn: false },
  })
  const missingExports = exportCount === 0 ? 1 : 0
  if (exportCount === 0) {
    warnings.push('이번 월의 신고자료가 아직 생성되지 않았습니다.')
  }

  // 7. 온보딩 미완료 근로자 확인
  try {
    const { detectPendingOnboardingForMonth } = await import('./onboarding-engine')
    const pendingWorkers = await detectPendingOnboardingForMonth(monthKey)
    if (pendingWorkers.length > 0) {
      warnings.push(`퇴직공제 대상 여부 등 온보딩이 미완료된 근로자가 ${pendingWorkers.length}명 있습니다.`)
    }
  } catch {
    // onboarding engine optional
  }

  const canClose = errors.length === 0

  return {
    canClose,
    errors,
    warnings,
    summary: {
      totalWorkers,
      draftConfirmations: draftCount,
      missingInsurance,
      missingWage,
      missingRetirement,
      missingExports,
    },
  }
}

/** 월마감 실행 */
export async function closeMonth(monthKey: string, closedBy: string): Promise<void> {
  // 사전검사 재확인
  const precheck = await precheckMonthClosing(monthKey)
  if (!precheck.canClose) {
    throw new Error(`사전검사 실패: ${precheck.errors.join(', ')}`)
  }

  const existing = await prisma.monthClosing.findFirst({
    where: { monthKey, closingScope: 'GLOBAL', siteId: null },
  })

  const closingData = {
    status: 'CLOSED' as const,
    precheckPassedYn: true,
    workConfirmationLockedYn: true,
    insuranceLockedYn: true,
    wageLockedYn: true,
    retirementMutualLockedYn: true,
    closedBy,
    closedAt: new Date(),
  }

  const closing = existing
    ? await prisma.monthClosing.update({ where: { id: existing.id }, data: closingData })
    : await prisma.monthClosing.create({
        data: { monthKey, closingScope: 'GLOBAL', siteId: null, ...closingData },
      })

  // 스냅샷 저장 (3종)
  const confirmedWorkers = await prisma.monthlyWorkConfirmation.findMany({
    where: { monthKey, confirmationStatus: 'CONFIRMED' },
    include: { worker: { select: { id: true, name: true, company: true, employmentType: true, retirementMutualStatus: true } } },
    distinct: ['workerId'],
  })

  const wageCalcs = await prisma.wageCalculation.findMany({
    where: { monthKey },
    select: { workerId: true, grossAmount: true, taxableAmount: true },
  })

  const withholdingCalcs = await prisma.withholdingCalculation.findMany({
    where: { monthKey },
    select: { workerId: true, incomeTaxAmount: true, localIncomeTaxAmount: true },
  })
  const withholdingByWorker = new Map(withholdingCalcs.map(w => [w.workerId, w]))

  const settlements = await prisma.subcontractorSettlement.findMany({
    where: { monthKey },
    select: { subcontractorId: true, workerCount: true, grossAmount: true, status: true },
  })

  // WORKER_SUMMARY 스냅샷
  await prisma.monthClosingSnapshot.create({
    data: {
      closingId: closing.id,
      siteId: null,
      monthKey,
      snapshotType: 'WORKER_SUMMARY',
      payloadJson: {
        workerCount: confirmedWorkers.length,
        workers: confirmedWorkers.map(w => ({
          workerId: w.workerId,
          name: w.worker.name,
          company: w.worker.company,
          employmentType: w.worker.employmentType,
          retirementMutualStatus: w.worker.retirementMutualStatus,
        })),
      } as never,
      createdBy: closedBy,
    },
  })

  // SUBCONTRACTOR_SUMMARY 스냅샷
  await prisma.monthClosingSnapshot.create({
    data: {
      closingId: closing.id,
      siteId: null,
      monthKey,
      snapshotType: 'SUBCONTRACTOR_SUMMARY',
      payloadJson: {
        settlementCount: settlements.length,
        settlements,
      } as never,
      createdBy: closedBy,
    },
  })

  // DOCUMENT_EXPORT_BASE 스냅샷
  const wageMap: Record<string, { grossAmount: number; taxableAmount: number; withholdingTax: number }> = {}
  for (const w of wageCalcs) {
    const wh = withholdingByWorker.get(w.workerId)
    const withholdingTax = wh ? wh.incomeTaxAmount + wh.localIncomeTaxAmount : 0
    wageMap[w.workerId] = {
      grossAmount: Number(w.grossAmount),
      taxableAmount: Number(w.taxableAmount),
      withholdingTax,
    }
  }

  await prisma.monthClosingSnapshot.create({
    data: {
      closingId: closing.id,
      siteId: null,
      monthKey,
      snapshotType: 'DOCUMENT_EXPORT_BASE',
      payloadJson: {
        totalGrossAmount: wageCalcs.reduce((sum, w) => sum + Number(w.grossAmount), 0),
        totalWithholdingTax: Object.values(wageMap).reduce((sum, w) => sum + w.withholdingTax, 0),
        workerWages: wageMap,
      } as never,
      createdBy: closedBy,
    },
  })

  await logCorrection({
    domainType: 'MONTH_CLOSING',
    domainId: closing.id,
    actionType: 'UPDATE',
    afterJson: { monthKey, status: 'CLOSED' },
    reason: '월마감 실행',
    actedBy: closedBy,
  })
}

/** 월마감 재오픈 */
export async function reopenMonth(monthKey: string, reopenedBy: string, reason: string): Promise<void> {
  if (!reason || reason.trim() === '') {
    throw new Error('재오픈 사유를 입력해야 합니다.')
  }

  const closing = await prisma.monthClosing.findFirst({
    where: { monthKey, closingScope: 'GLOBAL' },
  })

  if (!closing) {
    throw new Error('마감 이력이 없습니다.')
  }

  if (closing.status !== 'CLOSED') {
    throw new Error('마감된 상태에서만 재오픈할 수 있습니다.')
  }

  const before = { ...closing }

  await prisma.monthClosing.update({
    where: { id: closing.id },
    data: {
      status: 'REOPENED',
      workConfirmationLockedYn: false,
      insuranceLockedYn: false,
      wageLockedYn: false,
      retirementMutualLockedYn: false,
      reopenedBy,
      reopenedAt: new Date(),
      reopenReason: reason,
    },
  })

  await logCorrection({
    domainType: 'MONTH_CLOSING',
    domainId: closing.id,
    actionType: 'REOPEN',
    beforeJson: before,
    afterJson: { status: 'REOPENED', reopenReason: reason },
    reason,
    actedBy: reopenedBy,
  })
}

/** 마감 상태 조회 */
export async function getMonthClosingStatus(monthKey: string) {
  return prisma.monthClosing.findFirst({
    where: { monthKey, closingScope: 'GLOBAL' },
  })
}

/** 마감 잠금 여부 확인 */
export async function isMonthLocked(monthKey: string): Promise<boolean> {
  const closing = await prisma.monthClosing.findFirst({
    where: { monthKey, closingScope: 'GLOBAL' },
  })
  return closing?.status === 'CLOSED'
}
