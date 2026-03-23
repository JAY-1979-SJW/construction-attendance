/**
 * GET   /api/admin/safety-documents/[id]
 * PATCH /api/admin/safety-documents/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const doc = await prisma.safetyDocument.findUnique({
    where: { id: params.id },
    include: {
      worker: { select: { id: true, name: true } },
      site:   { select: { id: true, name: true } },
    },
  })
  if (!doc) return NextResponse.json({ error: '문서 없음' }, { status: 404 })

  return NextResponse.json({ success: true, data: doc })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const doc = await prisma.safetyDocument.findUnique({ where: { id: params.id } })
  if (!doc) return NextResponse.json({ error: '문서 없음' }, { status: 404 })
  if (doc.status === 'SIGNED') {
    return NextResponse.json({ error: '서명 완료된 문서는 수정할 수 없습니다' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const allowedFields = [
    'documentDate', 'educationDate', 'educationHours', 'educationPlace',
    'educatorName', 'educationItems', 'prevTask', 'newTask',
    'issuedItemsJson', 'issuedBy',
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) updateData[field] = body[field]
  }

  const updated = await prisma.safetyDocument.update({
    where: { id: params.id },
    data: updateData,
  })

  await writeAdminAuditLog({
    adminId: session.sub,
    actionType: 'SAFETY_DOC_UPDATE',
    targetType: 'SafetyDocument',
    targetId:   params.id,
    description: `안전문서 수정: ${doc.documentType}`,
  })

  return NextResponse.json({ success: true, data: updated })
}
