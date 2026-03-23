import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [assignments, managerCounts] = await Promise.all([
    prisma.siteCompanyAssignment.findMany({
      where: { siteId: id },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            companyType: true,
            businessNumber: true,
            externalVerificationStatus: true,
            verifiedAt: true,
            isActive: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.siteAdminAssignment.groupBy({
      by: ['companyId'],
      where: { siteId: id, isActive: true },
      _count: { id: true },
    }),
  ])

  const managerCountMap: Record<string, number> = {}
  for (const mc of managerCounts) {
    managerCountMap[mc.companyId] = mc._count.id
  }

  const data = assignments.map((a) => ({
    ...a,
    managerCount: managerCountMap[a.companyId] ?? 0,
  }))

  return NextResponse.json({ success: true, data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const {
    companyId,
    // 신규 회사 생성용
    newCompany,
    contractType,
    startDate,
    endDate,
    managerName,
    managerPhone,
    notes,
  } = body

  if (!startDate) {
    return NextResponse.json({ error: '시작일은 필수입니다.' }, { status: 400 })
  }

  const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!site) return NextResponse.json({ error: '현장을 찾을 수 없습니다.' }, { status: 404 })

  let resolvedCompanyId = companyId as string | undefined

  // 신규 회사 생성 경로
  if (!resolvedCompanyId && newCompany) {
    const { companyName, businessNumber, representativeName, contactPhone, email, address, companyType } = newCompany

    if (!companyName?.trim()) {
      return NextResponse.json({ error: '회사명은 필수입니다.' }, { status: 400 })
    }

    // 사업자번호 중복 확인
    if (businessNumber) {
      const existing = await prisma.company.findFirst({ where: { businessNumber: businessNumber.trim() } })
      if (existing) {
        return NextResponse.json({
          error: '이미 등록된 사업자번호입니다.',
          existingCompanyId: existing.id,
          existingCompanyName: existing.companyName,
        }, { status: 409 })
      }
    }

    const created = await prisma.company.create({
      data: {
        companyName: companyName.trim(),
        businessNumber: businessNumber?.trim() || null,
        representativeName: representativeName?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        companyType: companyType ?? 'PARTNER',
        externalVerificationStatus: 'PENDING_VERIFICATION',
      },
    })

    resolvedCompanyId = created.id

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'EXTERNAL_COMPANY_CREATE',
      targetType: 'Company',
      targetId: created.id,
      summary: `외부회사 신규 등록: ${created.companyName} (PENDING_VERIFICATION)`,
      metadataJson: { siteId: id, siteName: site.name, businessNumber },
    })
  }

  if (!resolvedCompanyId) {
    return NextResponse.json({ error: '회사를 선택하거나 신규 회사 정보를 입력하세요.' }, { status: 400 })
  }

  // 같은 현장 중복 연결 방지
  const duplicate = await prisma.siteCompanyAssignment.findFirst({
    where: { siteId: id, companyId: resolvedCompanyId },
  })
  if (duplicate) {
    return NextResponse.json({ error: '이미 이 현장에 연결된 회사입니다.' }, { status: 409 })
  }

  const assignment = await prisma.siteCompanyAssignment.create({
    data: {
      siteId: id,
      companyId: resolvedCompanyId,
      contractType: contractType ?? 'SUBCONTRACT',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      managerName: managerName ?? null,
      managerPhone: managerPhone ?? null,
      notes: notes ?? null,
      participationStatus: 'PLANNED',
    },
    include: { company: { select: { id: true, companyName: true, companyType: true, externalVerificationStatus: true } } },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'SITE_COMPANY_ASSIGN',
    targetType: 'Site',
    targetId: id,
    summary: `현장 참여회사 등록: ${site.name} ← ${assignment.company.companyName}`,
    metadataJson: { companyId: resolvedCompanyId, contractType, startDate },
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
    include: { company: { select: { companyName: true } } },
  })
  if (!existing) return NextResponse.json({ error: '배정 내역을 찾을 수 없습니다.' }, { status: 404 })

  await prisma.siteCompanyAssignment.delete({ where: { id: assignmentId } })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'SITE_COMPANY_UNASSIGN',
    targetType: 'Site',
    targetId: id,
    summary: `현장 참여회사 해제: ${existing.company.companyName}`,
    metadataJson: { assignmentId },
  })

  return NextResponse.json({ success: true })
}
