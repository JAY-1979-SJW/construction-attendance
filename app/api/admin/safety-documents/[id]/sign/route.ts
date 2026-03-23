/**
 * POST /api/admin/safety-documents/[id]/sign
 * 안전문서 서명 처리
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const doc = await prisma.safetyDocument.findUnique({
    where: { id: params.id },
    include: { worker: { select: { name: true } } },
  })
  if (!doc) return NextResponse.json({ error: '문서 없음' }, { status: 404 })
  if (doc.status === 'SIGNED') {
    return NextResponse.json({ error: '이미 서명된 문서입니다' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const { signedBy } = body as { signedBy?: string }

  const now = new Date()

  await prisma.safetyDocument.update({
    where: { id: params.id },
    data: {
      status:   'SIGNED',
      signedAt: now,
      signedBy: signedBy || doc.worker.name,
    },
  })

  await writeAdminAuditLog({
    adminId: session.sub,
    actionType: 'SAFETY_DOC_SIGN',
    targetType: 'SafetyDocument',
    targetId:   params.id,
    description: `안전문서 서명: ${doc.documentType} / ${doc.worker.name}`,
  })

  return NextResponse.json({ success: true, data: { signedAt: now } })
}
