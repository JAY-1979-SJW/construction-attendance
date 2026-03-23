import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// POST /api/admin/companies/[id]/reject — 외부회사 사업자 인증 반려
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { reason } = body

  const company = await prisma.company.findUnique({ where: { id } })
  if (!company) return NextResponse.json({ error: '회사를 찾을 수 없습니다.' }, { status: 404 })

  const updated = await prisma.company.update({
    where: { id },
    data: {
      externalVerificationStatus: 'REJECTED',
      verificationNotes: reason ?? null,
    },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actionType: 'COMPANY_REJECT',
    targetType: 'Company',
    targetId: id,
    summary: `외부회사 인증 반려: ${company.companyName}`,
    metadataJson: { previousStatus: company.externalVerificationStatus, reason },
  })

  return NextResponse.json({ success: true, data: updated })
}
