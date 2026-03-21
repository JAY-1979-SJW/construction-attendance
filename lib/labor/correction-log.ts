/**
 * 정정 이력 저장 서비스
 */
import { prisma } from '@/lib/db/prisma'
import { CorrectionDomainType, CorrectionActionType } from '@prisma/client'

export interface LogCorrectionInput {
  domainType: CorrectionDomainType
  domainId: string
  actionType: CorrectionActionType
  beforeJson?: unknown
  afterJson?: unknown
  reason?: string
  actedBy?: string
}

export async function logCorrection(input: LogCorrectionInput) {
  return prisma.correctionLog.create({
    data: {
      domainType: input.domainType,
      domainId: input.domainId,
      actionType: input.actionType,
      beforeJson: input.beforeJson as never ?? undefined,
      afterJson: input.afterJson as never ?? undefined,
      reason: input.reason ?? null,
      actedBy: input.actedBy ?? null,
    },
  })
}
