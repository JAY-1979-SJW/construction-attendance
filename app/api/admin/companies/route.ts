import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const companyType = searchParams.get('companyType') ?? ''
  const isActive = searchParams.get('isActive')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(200, parseInt(searchParams.get('pageSize') ?? '50'))

  const where = {
    ...(q ? {
      OR: [
        { companyName: { contains: q, mode: 'insensitive' as const } },
        { businessNumber: { contains: q } },
        { companyCode: { contains: q } },
      ],
    } : {}),
    ...(companyType ? { companyType: companyType as never } : {}),
    ...(isActive !== null && isActive !== '' ? { isActive: isActive === 'true' } : {}),
  }

  const [total, items] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { companyName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: {
            workerAssignments: true,
            siteAssignments: true,
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { companyName, companyCode, businessNumber, corpNumber, representativeName,
          companyType, contactName, contactPhone, email, address, notes } = body

  if (!companyName?.trim()) {
    return NextResponse.json({ error: '회사명은 필수입니다.' }, { status: 400 })
  }

  if (businessNumber) {
    const existing = await prisma.company.findFirst({ where: { businessNumber } })
    if (existing) {
      return NextResponse.json({ error: '이미 등록된 사업자번호입니다.' }, { status: 409 })
    }
  }

  const company = await prisma.company.create({
    data: {
      companyName: companyName.trim(),
      companyCode: companyCode?.trim() || null,
      businessNumber: businessNumber?.trim() || null,
      corpNumber: corpNumber?.trim() || null,
      representativeName: representativeName?.trim() || null,
      companyType: companyType ?? 'OTHER',
      contactName: contactName?.trim() || null,
      contactPhone: contactPhone?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
    },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'COMPANY_CREATE',
    targetType: 'Company',
    targetId: company.id,
    summary: `회사 등록: ${company.companyName}`,
    metadataJson: { companyType: company.companyType, businessNumber: company.businessNumber },
  })

  return NextResponse.json({ success: true, data: company }, { status: 201 })
}
