import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      workerAssignments: {
        where: { validTo: null },
        include: { worker: { select: { id: true, name: true, phone: true } } },
        orderBy: { validFrom: 'desc' },
        take: 20,
      },
      siteAssignments: {
        where: { endDate: null },
        include: { site: { select: { id: true, name: true, address: true } } },
        orderBy: { startDate: 'desc' },
        take: 20,
      },
      _count: {
        select: {
          workerAssignments: true,
          siteAssignments: true,
          workerSiteAssignments: true,
        },
      },
    },
  })

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ success: true, data: company })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const existing = await prisma.company.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.businessNumber && body.businessNumber !== existing.businessNumber) {
    const dup = await prisma.company.findFirst({
      where: { businessNumber: body.businessNumber, id: { not: params.id } },
    })
    if (dup) return NextResponse.json({ error: '이미 등록된 사업자번호입니다.' }, { status: 409 })
  }

  const updated = await prisma.company.update({
    where: { id: params.id },
    data: {
      companyName: body.companyName?.trim() ?? existing.companyName,
      companyCode: body.companyCode !== undefined ? (body.companyCode?.trim() || null) : existing.companyCode,
      businessNumber: body.businessNumber !== undefined ? (body.businessNumber?.trim() || null) : existing.businessNumber,
      corpNumber: body.corpNumber !== undefined ? (body.corpNumber?.trim() || null) : existing.corpNumber,
      representativeName: body.representativeName !== undefined ? (body.representativeName?.trim() || null) : existing.representativeName,
      companyType: body.companyType ?? existing.companyType,
      contactName: body.contactName !== undefined ? (body.contactName?.trim() || null) : existing.contactName,
      contactPhone: body.contactPhone !== undefined ? (body.contactPhone?.trim() || null) : existing.contactPhone,
      email: body.email !== undefined ? (body.email?.trim() || null) : existing.email,
      address: body.address !== undefined ? (body.address?.trim() || null) : existing.address,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
      notes: body.notes !== undefined ? (body.notes?.trim() || null) : existing.notes,
    },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'COMPANY_UPDATE',
    targetType: 'Company',
    targetId: updated.id,
    summary: `회사 수정: ${updated.companyName}`,
    metadataJson: { changes: body },
  })

  return NextResponse.json({ success: true, data: updated })
}
