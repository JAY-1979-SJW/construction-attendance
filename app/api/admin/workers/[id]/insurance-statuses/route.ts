import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const statuses = await prisma.workerInsuranceStatus.findMany({
    where: { workerId: params.id },
    include: { company: { select: { id: true, companyName: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: statuses })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    companyId,
    nationalPensionStatus, healthInsuranceStatus, employmentInsuranceStatus, industrialAccidentStatus,
    dailyWorkerFlag, constructionWorkerFlag,
    acquisitionDate, lossDate,
    reportingStatus, verificationDate, notes,
  } = body

  if (!companyId) {
    return NextResponse.json({ error: '회사ID는 필수입니다.' }, { status: 400 })
  }

  // 동일 근로자+회사 조합 upsert
  const status = await prisma.workerInsuranceStatus.upsert({
    where: {
      // 복합 unique가 없으므로 findFirst + update/create
      id: (await prisma.workerInsuranceStatus.findFirst({
        where: { workerId: params.id, companyId },
        select: { id: true },
      }))?.id ?? '',
    },
    create: {
      workerId: params.id,
      companyId,
      nationalPensionStatus: nationalPensionStatus ?? 'UNKNOWN',
      healthInsuranceStatus: healthInsuranceStatus ?? 'UNKNOWN',
      employmentInsuranceStatus: employmentInsuranceStatus ?? 'UNKNOWN',
      industrialAccidentStatus: industrialAccidentStatus ?? 'UNKNOWN',
      dailyWorkerFlag: dailyWorkerFlag ?? false,
      constructionWorkerFlag: constructionWorkerFlag ?? true,
      acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
      lossDate: lossDate ? new Date(lossDate) : null,
      reportingStatus: reportingStatus ?? 'NOT_CHECKED',
      verificationDate: verificationDate ? new Date(verificationDate) : null,
      verifiedBy: verificationDate ? session.sub : null,
      notes: notes ?? null,
    },
    update: {
      nationalPensionStatus: nationalPensionStatus ?? undefined,
      healthInsuranceStatus: healthInsuranceStatus ?? undefined,
      employmentInsuranceStatus: employmentInsuranceStatus ?? undefined,
      industrialAccidentStatus: industrialAccidentStatus ?? undefined,
      dailyWorkerFlag: dailyWorkerFlag ?? undefined,
      constructionWorkerFlag: constructionWorkerFlag ?? undefined,
      acquisitionDate: acquisitionDate !== undefined ? (acquisitionDate ? new Date(acquisitionDate) : null) : undefined,
      lossDate: lossDate !== undefined ? (lossDate ? new Date(lossDate) : null) : undefined,
      reportingStatus: reportingStatus ?? undefined,
      verificationDate: verificationDate !== undefined ? (verificationDate ? new Date(verificationDate) : null) : undefined,
      verifiedBy: verificationDate ? session.sub : undefined,
      notes: notes !== undefined ? (notes ?? null) : undefined,
    },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'WORKER_INSURANCE_UPDATE',
    targetType: 'Worker',
    targetId: params.id,
    summary: `보험 상태 변경 — 회사: ${companyId}`,
    metadataJson: { nationalPensionStatus, healthInsuranceStatus, employmentInsuranceStatus, industrialAccidentStatus },
  })

  return NextResponse.json({ success: true, data: status })
}
