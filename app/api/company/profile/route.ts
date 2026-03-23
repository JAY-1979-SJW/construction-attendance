import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// GET /api/company/profile — 업체 관리자: 자기 회사 정보 조회
export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.companyId) return NextResponse.json({ error: '회사 정보가 없습니다.' }, { status: 400 })

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      id: true,
      companyName: true,
      companyCode: true,
      businessNumber: true,
      corpNumber: true,
      representativeName: true,
      companyType: true,
      contactName: true,
      contactPhone: true,
      email: true,
      address: true,
      notes: true,
      status: true,
      externalVerificationStatus: true,
      verificationNotes: true,
      verifiedAt: true,
      createdAt: true,
    },
  })
  if (!company) return NextResponse.json({ error: '회사를 찾을 수 없습니다.' }, { status: 404 })

  return NextResponse.json({ success: true, data: company })
}

// PATCH /api/company/profile — 업체 관리자: 연락처 정보 수정 (공식 정보 제외)
export async function PATCH(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.companyId) return NextResponse.json({ error: '회사 정보가 없습니다.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const { contactName, contactPhone, email, address, notes } = body

  const updated = await prisma.company.update({
    where: { id: session.companyId },
    data: {
      ...(contactName  !== undefined ? { contactName:  contactName  || null } : {}),
      ...(contactPhone !== undefined ? { contactPhone: contactPhone || null } : {}),
      ...(email        !== undefined ? { email:        email        || null } : {}),
      ...(address      !== undefined ? { address:      address      || null } : {}),
      ...(notes        !== undefined ? { notes:        notes        || null } : {}),
    },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'COMPANY_PROFILE_UPDATE',
    targetType: 'Company',
    targetId: session.companyId,
    summary: `회사 프로필 수정: ${updated.companyName}`,
    metadataJson: { contactName, contactPhone, email },
  })

  return NextResponse.json({ success: true, data: updated })
}
