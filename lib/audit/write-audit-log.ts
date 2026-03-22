import { prisma } from '@/lib/db/prisma'

/** v2: 범용 감사 로그 (audit_logs 테이블) */
export interface AuditLogInput {
  actorUserId?: string
  actorType?: 'ADMIN' | 'WORKER' | 'SYSTEM'
  actionType: string
  targetType?: string
  targetId?: string
  summary?: string
  metadataJson?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  // 레거시 호환 필드
  adminId?: string
  description?: string
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const actorUserId = input.actorUserId ?? input.adminId
  const summary = input.summary ?? input.description ?? ''
  const actorType = input.actorType ?? (input.adminId ? 'ADMIN' : 'SYSTEM')

  // v2 audit_logs 기록
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId ?? null,
        actorType,
        actionType: input.actionType,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        summary,
        metadataJson: input.metadataJson ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  } catch (err) {
    // audit log 실패는 조용히 처리 (운영 영향 없음)
    console.error('[audit] write failed', err)
  }
}

/** 레거시: 관리자 감사 로그 (admin_audit_logs 테이블) */
export async function writeAdminAuditLog(input: {
  adminId: string
  actionType: string
  targetType?: string
  targetId?: string
  description: string
  ipAddress?: string
}): Promise<void> {
  try {
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
  } catch (err) {
    console.error('[admin-audit] write failed', err)
  }
}
