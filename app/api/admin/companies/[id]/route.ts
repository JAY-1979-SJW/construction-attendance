import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole, requireFeature } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { MUTATE_ALLOWED_ROLES, SUPER_ADMIN_ONLY_ROLES } from '@/lib/policies/security-policy'

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
  // COMPANY_MANAGE 권한 강제 — SUPER_ADMIN/HQ_ADMIN/ADMIN만 업체 정보 수정 가능
  // COMPANY_ADMIN(자기 업체라도 마스터 데이터 직접 수정 불가), SITE_ADMIN, VIEWER 차단
  const deny = requireFeature(session, 'COMPANY_MANAGE')
  if (deny) return deny

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
    metadataJson: { changedFields: Object.keys(body).filter(k => body[k] !== undefined) },
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const deny = requireRole(session, SUPER_ADMIN_ONLY_ROLES)
  if (deny) return deny

  const body = await req.json().catch(() => ({}))
  const existing = await prisma.company.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.status !== undefined) data.status = body.status
  if (body.planType !== undefined) data.planType = body.planType ?? null
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (body.featureFlagsJson !== undefined) data.featureFlagsJson = body.featureFlagsJson ?? null
  if (body.isActive !== undefined) data.isActive = body.isActive

  const updated = await prisma.company.update({ where: { id: params.id }, data })

  // featureFlagsJson 변경 시 전용 액션 타입으로 분리
  if (body.featureFlagsJson !== undefined) {
    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actorRole:   session.role ?? 'ADMIN',
      companyId:   params.id,
      actionType:  'COMPANY_FEATURE_FLAGS_UPDATE',
      targetType:  'Company',
      targetId:    updated.id,
      summary:     `기능플래그 변경: ${updated.companyName}`,
      beforeJson:  { featureFlagsJson: existing.featureFlagsJson },
      afterJson:   { featureFlagsJson: updated.featureFlagsJson },
    })
  } else {
    await writeAuditLog({
      actorUserId: session.sub,
      actorType:   'ADMIN',
      actorRole:   session.role ?? 'ADMIN',
      companyId:   params.id,
      actionType:  'COMPANY_STATUS_UPDATE',
      targetType:  'Company',
      targetId:    updated.id,
      summary:     `회사 상태/설정 변경: ${updated.companyName}`,
      beforeJson:  { status: existing.status, planType: existing.planType, expiresAt: existing.expiresAt },
      afterJson:   { status: updated.status, planType: updated.planType, expiresAt: updated.expiresAt },
    })
  }

  return NextResponse.json({ success: true, data: updated })
}
