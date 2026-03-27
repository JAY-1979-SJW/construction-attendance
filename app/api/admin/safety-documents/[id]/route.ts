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

  // 이전 반려 문서 이력 조회 (previousDocId 체인)
  const history: { id: string; status: string; rejectReason: string | null; createdAt: Date; reviewedAt: Date | null }[] = []
  let prevId = doc.previousDocId
  while (prevId) {
    const prev = await prisma.safetyDocument.findUnique({
      where: { id: prevId },
      select: { id: true, status: true, rejectReason: true, createdAt: true, reviewedAt: true, previousDocId: true },
    })
    if (!prev) break
    history.push({ id: prev.id, status: prev.status, rejectReason: prev.rejectReason, createdAt: prev.createdAt, reviewedAt: prev.reviewedAt })
    prevId = prev.previousDocId
    if (history.length > 10) break // 무한 루프 방지
  }

  return NextResponse.json({ success: true, data: { ...doc, history } })
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
