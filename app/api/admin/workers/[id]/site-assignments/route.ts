import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assignments = await prisma.workerSiteAssignment.findMany({
    where: { workerId: params.id },
    include: {
      site: { select: { id: true, name: true, address: true, isActive: true } },
      company: { select: { id: true, companyName: true } },
    },
    orderBy: [{ isActive: 'desc' }, { isPrimary: 'desc' }, { assignedFrom: 'desc' }],
  })

  return NextResponse.json({ success: true, data: assignments })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { siteId, companyId, assignedFrom, assignedTo, tradeType, isPrimary, notes } = body

  if (!siteId || !companyId || !assignedFrom) {
    return NextResponse.json({ error: '현장ID, 회사ID, 배정일은 필수입니다.' }, { status: 400 })
  }

  // 중복 배정 체크 (동일 현장 활성 배정)
  const existing = await prisma.workerSiteAssignment.findFirst({
    where: { workerId: params.id, siteId, isActive: true },
  })
  if (existing) {
    return NextResponse.json({ error: '이미 해당 현장에 배정되어 있습니다.' }, { status: 409 })
  }

  const assignment = await prisma.workerSiteAssignment.create({
    data: {
      workerId: params.id,
      siteId,
      companyId,
      assignedFrom: new Date(assignedFrom),
      assignedTo: assignedTo ? new Date(assignedTo) : null,
      tradeType: tradeType ?? null,
      isPrimary: isPrimary ?? false,
      isActive: true,
      notes: notes ?? null,
    },
    include: {
      site: { select: { id: true, name: true } },
      company: { select: { id: true, companyName: true } },
    },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'WORKER_SITE_ASSIGN',
    targetType: 'Worker',
    targetId: params.id,
    summary: `근로자 현장배정: ${assignment.site.name} / ${assignment.company.companyName}`,
    metadataJson: { siteId, companyId, tradeType, assignedFrom },
  })

  return NextResponse.json({ success: true, data: assignment }, { status: 201 })
}
