/**
 * GET  /api/admin/workers/[id]/compliance  — 노무/보험 준비 상태 조회
 * POST /api/admin/workers/[id]/compliance  — 상태 갱신
 *
 * 출퇴근 상태(accountStatus)와 완전히 별개로 관리
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { unauthorized, badRequest, notFound, internalError } from '@/lib/utils/response'

const STATUS_VALUES = ['NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'EXEMPT'] as const
type StatusValue = typeof STATUS_VALUES[number]

const complianceSchema = z.object({
  basicIdentityChecked:      z.boolean().optional(),
  rrnCollected:              z.boolean().optional(),
  addressCollected:          z.boolean().optional(),
  bankInfoCollected:         z.boolean().optional(),
  nationalPensionStatus:     z.enum(STATUS_VALUES).optional(),
  healthInsuranceStatus:     z.enum(STATUS_VALUES).optional(),
  employmentInsuranceStatus: z.enum(STATUS_VALUES).optional(),
  industrialAccidentStatus:  z.enum(STATUS_VALUES).optional(),
  retirementMutualStatus:    z.enum(STATUS_VALUES).optional(),
  notes:                     z.string().max(500).optional(),
})

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const worker = await prisma.worker.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, accountStatus: true },
    })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const compliance = await prisma.workerComplianceStatus.findUnique({
      where: { workerId: params.id },
    })

    return NextResponse.json({
      success: true,
      data: {
        worker: { id: worker.id, name: worker.name, accountStatus: worker.accountStatus },
        compliance: compliance ?? null,
        // 출퇴근 가능 여부는 accountStatus 기준 — 노무 완료와 무관
        attendanceEnabled: worker.accountStatus === 'APPROVED',
      },
    })
  } catch (err) {
    console.error('[admin/workers/[id]/compliance GET]', err)
    return internalError()
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const worker = await prisma.worker.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = complianceSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const updateData = { ...parsed.data, updatedBy: session.sub }

    const compliance = await prisma.workerComplianceStatus.upsert({
      where: { workerId: params.id },
      create: { workerId: params.id, ...updateData },
      update: updateData,
    })

    // 보험 완료 항목 감사로그
    const completedFields = Object.entries(parsed.data)
      .filter(([_, v]) => v === 'COMPLETED')
      .map(([k]) => k)

    if (completedFields.length > 0) {
      await writeAuditLog({
        actorUserId: session.sub,
        actorType: 'ADMIN',
        actionType: 'INSURANCE_COMPLETED',
        targetType: 'WorkerComplianceStatus',
        targetId: compliance.id,
        summary: `노무/보험 상태 완료 처리: ${worker.name} — ${completedFields.join(', ')}`,
        metadataJson: { workerId: params.id, completedFields },
      })
    } else {
      await writeAuditLog({
        actorUserId: session.sub,
        actorType: 'ADMIN',
        actionType: 'INSURANCE_READY',
        targetType: 'WorkerComplianceStatus',
        targetId: compliance.id,
        summary: `노무/보험 상태 갱신: ${worker.name}`,
        metadataJson: { workerId: params.id, updated: parsed.data },
      })
    }

    return NextResponse.json({
      success: true,
      message: '노무/보험 상태가 갱신되었습니다.',
      data: compliance,
    })
  } catch (err) {
    console.error('[admin/workers/[id]/compliance POST]', err)
    return internalError()
  }
}
