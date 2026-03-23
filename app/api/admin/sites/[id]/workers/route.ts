/**
 * GET /api/admin/sites/[id]/workers  — 현장 배정 근로자 목록
 * POST /api/admin/sites/[id]/workers — 현장에 근로자 배정
 * DELETE /api/admin/sites/[id]/workers?assignmentId=xxx — 배정 해제
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('activeOnly') !== 'false'

  const assignments = await prisma.workerSiteAssignment.findMany({
    where: {
      siteId: id,
      ...(activeOnly ? { isActive: true } : {}),
    },
    include: {
      worker: {
        select: {
          id: true,
          name: true,
          phone: true,
          jobTitle: true,
        },
      },
      company: {
        select: { id: true, companyName: true },
      },
    },
    orderBy: [{ isPrimary: 'desc' }, { assignedFrom: 'desc' }],
  })

  return NextResponse.json({ success: true, data: { assignments } })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const deny = requireRole(session, MUTATE_ROLES)
  if (deny) return deny

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { workerId, companyId, assignedFrom, assignedTo, tradeType, isPrimary, notes } = body

  if (!workerId || !companyId || !assignedFrom) {
    return NextResponse.json({ error: '근로자ID, 회사ID, 배정일은 필수입니다.' }, { status: 400 })
  }

  const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!site) return NextResponse.json({ error: '현장을 찾을 수 없습니다.' }, { status: 404 })

  const existing = await prisma.workerSiteAssignment.findFirst({
    where: { workerId, siteId: id, isActive: true },
  })
  if (existing) {
    return NextResponse.json({ error: '이미 해당 현장에 배정된 근로자입니다.' }, { status: 409 })
  }

  const assignment = await prisma.workerSiteAssignment.create({
    data: {
      workerId,
      siteId: id,
      companyId,
      assignedFrom: new Date(assignedFrom),
      assignedTo: assignedTo ? new Date(assignedTo) : null,
      tradeType: tradeType ?? null,
      isPrimary: isPrimary ?? false,
      isActive: true,
      notes: notes ?? null,
    },
    include: {
      worker: { select: { id: true, name: true } },
      company: { select: { id: true, companyName: true } },
    },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'WORKER_SITE_ASSIGN',
    targetType: 'Site',
    targetId: id,
    summary: `현장 근로자 배정: ${site.name} ← ${assignment.worker.name} (${assignment.company.companyName})`,
    metadataJson: { workerId, companyId, tradeType, assignedFrom },
  })

  return NextResponse.json({ success: true, data: assignment }, { status: 201 })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const deny = requireRole(session, MUTATE_ROLES)
  if (deny) return deny

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignmentId')
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })

  const existing = await prisma.workerSiteAssignment.findFirst({
    where: { id: assignmentId, siteId: id },
  })
  if (!existing) return NextResponse.json({ error: '배정 내역을 찾을 수 없습니다.' }, { status: 404 })

  // 소프트 삭제 (isActive = false)
  await prisma.workerSiteAssignment.update({
    where: { id: assignmentId },
    data: { isActive: false, assignedTo: new Date() },
  })

  return NextResponse.json({ success: true })
}
