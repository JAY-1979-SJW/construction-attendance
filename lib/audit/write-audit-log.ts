import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

/** v2: 범용 감사 로그 (audit_logs 테이블) */
export interface AuditLogInput {
  actorUserId?: string
  actorType?: 'ADMIN' | 'WORKER' | 'SYSTEM'
  actorRole?: string          // SUPER_ADMIN / ADMIN / COMPANY_ADMIN 등
  companyId?: string          // 업체 스코프
  actionType: string
  targetType?: string
  targetId?: string
  summary?: string
  beforeJson?: Record<string, unknown>   // 수정 전 상태
  afterJson?: Record<string, unknown>    // 수정 후 상태
  reason?: string             // 변경 사유
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
        actorRole: input.actorRole ?? null,
        companyId: input.companyId ?? null,
        actionType: input.actionType,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        summary,
        beforeJson: (input.beforeJson ?? undefined) as Prisma.InputJsonValue | undefined,
        afterJson: (input.afterJson ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: input.reason ?? null,
        metadataJson: (input.metadataJson ?? undefined) as Prisma.InputJsonValue | undefined,
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
