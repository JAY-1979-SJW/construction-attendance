import { prisma } from '@/lib/db/prisma'

export interface AuditLogInput {
  adminId: string
  actionType: string
  targetType?: string
  targetId?: string
  description: string
  ipAddress?: string
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId,
      description: input.description,
      ipAddress: input.ipAddress,
    },
  })
}
