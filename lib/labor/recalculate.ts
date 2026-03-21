/**
 * 재산출 서비스
 * worker+month, site+month, full-month 범위로 재산출
 */
import { prisma } from '@/lib/db/prisma'
import { runInsuranceEligibility } from './insurance'
import { runTaxCalculation } from './tax'
import { runRetirementMutual } from './retirement-mutual-engine'
import { runLaborCostSummary } from './labor-cost-summary'
import { logCorrection } from './correction-log'
import { isMonthLocked } from './month-closing'

export interface RecalculateOptions {
  monthKey: string
  workerIds?: string[]
  siteId?: string
  actedBy?: string
  reason?: string
}

/** worker+month 재산출 */
export async function recalculateWorkerMonth(opts: RecalculateOptions): Promise<void> {
  const { monthKey, workerIds, actedBy, reason } = opts

  if (!workerIds || workerIds.length === 0) {
    throw new Error('workerIds는 필수입니다.')
  }

  const locked = await isMonthLocked(monthKey)
  if (locked) {
    throw new Error(`${monthKey}는 마감된 월입니다. 재오픈 후 재산출하세요.`)
  }

  for (const workerId of workerIds) {
    // 보험판정 재산출
    await runInsuranceEligibility({ monthKey, workerIds: [workerId] })
    // 세금 재산출
    await runTaxCalculation({ monthKey, workerIds: [workerId] })
  }

  await logCorrection({
    domainType: 'INSURANCE',
    domainId: `${monthKey}`,
    actionType: 'RECALCULATE',
    afterJson: { monthKey, workerIds, scope: 'worker-month' },
    reason: reason ?? '재산출',
    actedBy,
  })
}

/** site+month 재산출 */
export async function recalculateSiteMonth(opts: RecalculateOptions): Promise<void> {
  const { monthKey, siteId, actedBy, reason } = opts

  if (!siteId) throw new Error('siteId는 필수입니다.')

  const locked = await isMonthLocked(monthKey)
  if (locked) {
    throw new Error(`${monthKey}는 마감된 월입니다.`)
  }

  // 해당 현장 근로자 목록
  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: { monthKey, siteId, confirmationStatus: 'CONFIRMED' },
    select: { workerId: true },
    distinct: ['workerId'],
  })
  const workerIds = confirmations.map((c) => c.workerId)

  if (workerIds.length > 0) {
    await runInsuranceEligibility({ monthKey, workerIds })
    await runTaxCalculation({ monthKey, workerIds })
  }

  await runRetirementMutual({ monthKey, siteId, actedBy })
  await runLaborCostSummary({ monthKey, siteId })

  await logCorrection({
    domainType: 'INSURANCE',
    domainId: `${monthKey}:${siteId}`,
    actionType: 'RECALCULATE',
    afterJson: { monthKey, siteId, scope: 'site-month' },
    reason: reason ?? '재산출',
    actedBy,
  })
}

/** full-month 재산출 */
export async function recalculateFullMonth(opts: RecalculateOptions): Promise<void> {
  const { monthKey, actedBy, reason } = opts

  const locked = await isMonthLocked(monthKey)
  if (locked) {
    throw new Error(`${monthKey}는 마감된 월입니다.`)
  }

  await runInsuranceEligibility({ monthKey })
  await runTaxCalculation({ monthKey })
  await runRetirementMutual({ monthKey, actedBy })
  await runLaborCostSummary({ monthKey })

  await logCorrection({
    domainType: 'INSURANCE',
    domainId: monthKey,
    actionType: 'RECALCULATE',
    afterJson: { monthKey, scope: 'full-month' },
    reason: reason ?? '전체 재산출',
    actedBy,
  })
}
