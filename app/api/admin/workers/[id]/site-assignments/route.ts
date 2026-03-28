import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { ensurePackageExists } from '@/lib/onboarding-docs/ensure-package'

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

  // 근로자 승인 상태 검증 — 미승인 근로자는 현장 배정 불가
  const worker = await prisma.worker.findUnique({
    where: { id: params.id },
    select: { accountStatus: true, isActive: true, name: true },
  })
  if (!worker) {
    return NextResponse.json({ error: '근로자를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (worker.accountStatus !== 'APPROVED') {
    return NextResponse.json({ error: `근로자 계정이 승인되지 않았습니다. (현재: ${worker.accountStatus})` }, { status: 400 })
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

  // 현장 배정 시 문서 패키지 자동 생성
  try {
    await ensurePackageExists(params.id, siteId)
  } catch (pkgErr) {
    console.error('[site-assignment] 문서 패키지 생성 실패 (배정은 유지)', pkgErr)
  }

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
