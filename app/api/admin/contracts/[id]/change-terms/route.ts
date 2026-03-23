/**
 * POST /api/admin/contracts/[id]/change-terms
 * 근로조건 변경확인서: 변경 항목 기록 + 버전 증가
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const contract = await prisma.workerContract.findUnique({
    where: { id: params.id },
    include: { worker: { select: { id: true, name: true } } },
  })
  if (!contract) return NextResponse.json({ error: '계약 없음' }, { status: 404 })
  if (!contract.isActive) {
    return NextResponse.json({ error: '활성 계약에만 조건 변경 가능합니다' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { changes, changeReason } = body as {
    changes: { field: string; before: unknown; after: unknown }[]
    changeReason?: string
  }

  if (!changes || changes.length === 0) {
    return NextResponse.json({ error: '변경 항목이 없습니다' }, { status: 400 })
  }

  // 변경 항목을 실제 컬럼에 반영
  const updateData: Record<string, unknown> = {}
  const allowedFields = [
    'dailyWage', 'monthlySalary', 'checkInTime', 'checkOutTime',
    'breakStartTime', 'breakEndTime', 'workDays', 'weeklyWorkDays', 'weeklyWorkHours',
    'paymentDay', 'paymentMethod', 'holidayRule', 'specialTerms',
    'siteStopRule', 'rainDayRule', 'workUnitRule',
  ]

  for (const c of changes) {
    if (allowedFields.includes(c.field)) {
      updateData[c.field] = c.after
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workerContract.update({
      where: { id: params.id },
      data: {
        ...updateData,
        currentVersion: { increment: 1 },
      },
    })

    const updatedContract = await tx.workerContract.findUnique({ where: { id: params.id } })
    await tx.contractVersion.create({
      data: {
        contractId:   params.id,
        versionNo:    updatedContract!.currentVersion,
        snapshotJson: updatedContract as never,
        changeNote:   changeReason || `근로조건 변경 (${changes.map(c => c.field).join(', ')})`,
        createdBy:    session.sub,
      },
    })
  })

  await writeAdminAuditLog({
    adminId: session.sub,
    actionType: 'CONTRACT_CHANGE_TERMS',
    targetType: 'WorkerContract',
    targetId:   params.id,
    description: `근로조건 변경: ${contract.worker.name} / ${changes.map(c => c.field).join(', ')}`,
  })

  return NextResponse.json({ success: true, data: { changedFields: Object.keys(updateData) } })
}
