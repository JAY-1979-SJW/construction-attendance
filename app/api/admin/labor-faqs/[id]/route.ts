/**
 * GET   /api/admin/labor-faqs/:id  — FAQ 단건 조회
 * PATCH /api/admin/labor-faqs/:id  — FAQ 수정 (SUPER_ADMIN 전용)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const faq = await prisma.laborFaq.findUnique({ where: { id } })
  if (!faq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 일반 관리자는 APPROVED + active만 조회 가능
  if (session.role !== 'SUPER_ADMIN' && (faq.status !== 'APPROVED' || !faq.isActive)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 조회수 증가 (비동기 처리)
  prisma.laborFaq.update({
    where: { id },
    data:  { viewCount: { increment: 1 } },
  }).catch(() => {})

  return NextResponse.json({ faq })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession(req)
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const faq = await prisma.laborFaq.findUnique({ where: { id } })
  if (!faq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const allowedFields = [
    'category', 'question', 'questionAliases', 'shortAnswer', 'fullAnswer',
    'appRule', 'caution', 'sourceOrg', 'sourceTitle', 'sourceUrl', 'effectiveDate',
    'relatedContractTypes', 'triggerConditions', 'priority', 'status', 'isActive',
  ]

  const updateData: Record<string, unknown> = { updatedBy: session.sub }
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field]
  }

  const updated = await prisma.laborFaq.update({ where: { id }, data: updateData })

  // 변경 이력 기록
  await prisma.laborFaqChangeLog.create({
    data: {
      faqId:          id,
      changedBy:      session.sub,
      changeType:     'UPDATE',
      beforeSnapshot: faq   as unknown as Record<string, unknown>,
      afterSnapshot:  updated as unknown as Record<string, unknown>,
      note:           body.note ?? null,
    },
  })

  return NextResponse.json({ faq: updated })
}
