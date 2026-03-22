import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const assignments = await prisma.siteCompanyAssignment.findMany({
    where: { siteId: id },
    include: { company: { select: { id: true, companyName: true, companyType: true, businessNumber: true } } },
    orderBy: { startDate: 'desc' },
  })

  return NextResponse.json({ success: true, data: assignments })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { companyId, contractType, startDate, endDate, managerName, managerPhone, notes } = body

  if (!companyId || !startDate) {
    return NextResponse.json({ error: '회사ID와 시작일은 필수입니다.' }, { status: 400 })
  }

  const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!site) return NextResponse.json({ error: '현장을 찾을 수 없습니다.' }, { status: 404 })

  const assignment = await prisma.siteCompanyAssignment.create({
    data: {
      siteId: id,
      companyId,
      contractType: contractType ?? 'SUBCONTRACT',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      managerName: managerName ?? null,
      managerPhone: managerPhone ?? null,
      notes: notes ?? null,
    },
    include: { company: { select: { id: true, companyName: true, companyType: true } } },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'SITE_COMPANY_ASSIGN',
    targetType: 'Site',
    targetId: id,
    summary: `현장 회사배정: ${site.name} ← ${assignment.company.companyName}`,
    metadataJson: { companyId, contractType, startDate },
  })

  return NextResponse.json({ success: true, data: assignment }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignmentId')

  if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })

  const existing = await prisma.siteCompanyAssignment.findFirst({
    where: { id: assignmentId, siteId: id },
  })
  if (!existing) return NextResponse.json({ error: '배정 내역을 찾을 수 없습니다.' }, { status: 404 })

  await prisma.siteCompanyAssignment.delete({ where: { id: assignmentId } })

  return NextResponse.json({ success: true })
}
