import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string; rowId: string } }

// PATCH /api/admin/materials/estimates/[id]/rows/[rowId]
// 수동 보정값 저장. 원문은 절대 수정하지 않음.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await prisma.estimateBillRow.findUnique({ where: { id: params.rowId } })
  if (!row || row.documentId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json() as {
    manualItemName?: string | null
    manualSpec?: string | null
    manualUnit?: string | null
    manualQuantity?: number | null
    manualGroupKey?: string | null
    excludeFromAggregation?: boolean
    overrideReason?: string | null
  }

  const now = new Date()
  const changedBy = (session as { id?: string; email?: string }).id ?? (session as { id?: string; email?: string }).email ?? 'admin'

  // 변경 필드별 이력 기록
  const overrideFields: Array<{
    fieldName: string
    beforeValue: string | null
    afterValue: string | null
  }> = []

  const updateData: Record<string, unknown> = {
    overriddenBy: changedBy,
    overriddenAt: now,
  }

  if (body.overrideReason !== undefined) updateData.overrideReason = body.overrideReason

  const trackField = (
    fieldName: string,
    before: unknown,
    after: unknown
  ) => {
    if (after !== undefined) {
      overrideFields.push({
        fieldName,
        beforeValue: before != null ? String(before) : null,
        afterValue: after != null ? String(after) : null,
      })
      updateData[fieldName] = after
    }
  }

  trackField('manualItemName', row.manualItemName, body.manualItemName)
  trackField('manualSpec', row.manualSpec, body.manualSpec)
  trackField('manualUnit', row.manualUnit, body.manualUnit)
  trackField('manualQuantity', row.manualQuantity, body.manualQuantity)
  trackField('manualGroupKey', row.manualGroupKey, body.manualGroupKey)
  if (body.excludeFromAggregation !== undefined) {
    trackField('excludeFromAggregation', row.excludeFromAggregation, body.excludeFromAggregation)
  }

  const [updated] = await prisma.$transaction([
    prisma.estimateBillRow.update({
      where: { id: params.rowId },
      data: updateData,
      include: { normalized: true },
    }),
    ...overrideFields.map(f =>
      prisma.estimateRowOverride.create({
        data: {
          rowId: params.rowId,
          fieldName: f.fieldName,
          beforeValue: f.beforeValue,
          afterValue: f.afterValue,
          reason: body.overrideReason ?? null,
          changedBy,
          changedAt: now,
        },
      })
    ),
  ])

  return NextResponse.json({ success: true, data: updated })
}

// DELETE /api/admin/materials/estimates/[id]/rows/[rowId]
// 수동 보정 전체 해제 — 자동값으로 복귀
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await prisma.estimateBillRow.findUnique({ where: { id: params.rowId } })
  if (!row || row.documentId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const changedBy = (session as { id?: string; email?: string }).id ?? (session as { id?: string; email?: string }).email ?? 'admin'

  // 보정 해제 이력 기록
  const fields = [
    { name: 'manualItemName', before: row.manualItemName },
    { name: 'manualSpec', before: row.manualSpec },
    { name: 'manualUnit', before: row.manualUnit },
    { name: 'manualQuantity', before: row.manualQuantity },
    { name: 'manualGroupKey', before: row.manualGroupKey },
    { name: 'excludeFromAggregation', before: row.excludeFromAggregation },
  ].filter(f => f.before != null && f.before !== false)

  await prisma.$transaction([
    prisma.estimateBillRow.update({
      where: { id: params.rowId },
      data: {
        manualItemName: null,
        manualSpec: null,
        manualUnit: null,
        manualQuantity: null,
        manualGroupKey: null,
        excludeFromAggregation: false,
        overrideReason: null,
        overriddenBy: changedBy,
        overriddenAt: new Date(),
      },
    }),
    ...fields.map(f =>
      prisma.estimateRowOverride.create({
        data: {
          rowId: params.rowId,
          fieldName: f.name,
          beforeValue: f.before != null ? String(f.before) : null,
          afterValue: null,
          reason: '보정 해제',
          changedBy,
        },
      })
    ),
  ])

  return NextResponse.json({ success: true })
}

// GET /api/admin/materials/estimates/[id]/rows/[rowId]
// 단일 행 + 보정 이력 조회
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await prisma.estimateBillRow.findUnique({
    where: { id: params.rowId },
    include: {
      normalized: true,
      overrides: { orderBy: { changedAt: 'desc' }, take: 50 },
    },
  })
  if (!row || row.documentId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: row })
}
