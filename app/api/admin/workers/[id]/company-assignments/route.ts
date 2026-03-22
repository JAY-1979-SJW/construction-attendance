import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assignments = await prisma.workerCompanyAssignment.findMany({
    where: { workerId: params.id },
    include: { company: { select: { id: true, companyName: true, companyType: true, businessNumber: true } } },
    orderBy: [{ isPrimary: 'desc' }, { validFrom: 'desc' }],
  })

  return NextResponse.json({ success: true, data: assignments })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { companyId, employmentType, contractorTier, roleTitle, validFrom, validTo, isPrimary, notes } = body

  if (!companyId || !validFrom) {
    return NextResponse.json({ error: '회사ID와 시작일은 필수입니다.' }, { status: 400 })
  }

  // isPrimary 설정 시 기존 primary 해제
  if (isPrimary) {
    await prisma.workerCompanyAssignment.updateMany({
      where: { workerId: params.id, isPrimary: true },
      data: { isPrimary: false },
    })
  }

  const assignment = await prisma.workerCompanyAssignment.create({
    data: {
      workerId: params.id,
      companyId,
      employmentType: employmentType ?? 'DAILY',
      contractorTier: contractorTier ?? 'PRIME',
      roleTitle: roleTitle ?? null,
      validFrom: new Date(validFrom),
      validTo: validTo ? new Date(validTo) : null,
      isPrimary: isPrimary ?? false,
      notes: notes ?? null,
    },
    include: { company: { select: { id: true, companyName: true } } },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'WORKER_COMPANY_ASSIGN',
    targetType: 'Worker',
    targetId: params.id,
    summary: `근로자 회사배정: ${assignment.company.companyName}`,
    metadataJson: { companyId, employmentType, validFrom },
  })

  return NextResponse.json({ success: true, data: assignment }, { status: 201 })
}
