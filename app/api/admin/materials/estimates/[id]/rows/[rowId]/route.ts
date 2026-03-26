import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, notFound } from '@/lib/utils/response'

const PatchSchema = z.object({
  manualItemName:         z.string().nullable().optional(),
  manualSpec:             z.string().nullable().optional(),
  manualUnit:             z.string().nullable().optional(),
  manualQuantity:         z.number().nullable().optional(),
  manualGroupKey:         z.string().nullable().optional(),
  excludeFromAggregation: z.boolean().optional(),
  overrideReason:         z.string().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id, rowId } = await params
  const row = await prisma.estimateBillRow.findFirst({
    where: { id: rowId, documentId: id },
    select: {
      id: true,
      manualItemName: true, manualSpec: true, manualUnit: true,
      manualQuantity: true, manualGroupKey: true,
      excludeFromAggregation: true, overrideReason: true,
    },
  })
  if (!row) return notFound('행을 찾을 수 없습니다')

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const {
    manualItemName, manualSpec, manualUnit, manualQuantity,
    manualGroupKey, excludeFromAggregation, overrideReason,
  } = parsed.data

  // 변경 이력 기록
  const overrideRows: {
    id: string; rowId: string; fieldName: string;
    beforeValue: string | null; afterValue: string | null;
    reason: string | null; changedBy: string;
  }[] = []

  const trackField = (
    fieldName: string,
    before: unknown,
    after: unknown
  ) => {
    if (after !== undefined && String(after ?? '') !== String(before ?? '')) {
      overrideRows.push({
        id:          randomUUID(),
        rowId,
        fieldName,
        beforeValue: before != null ? String(before) : null,
        afterValue:  after  != null ? String(after)  : null,
        reason:      overrideReason ?? null,
        changedBy:   session.sub,
      })
    }
  }

  if (manualItemName !== undefined) trackField('manualItemName', row.manualItemName, manualItemName)
  if (manualSpec     !== undefined) trackField('manualSpec',     row.manualSpec,     manualSpec)
  if (manualUnit     !== undefined) trackField('manualUnit',     row.manualUnit,     manualUnit)
  if (manualQuantity !== undefined) trackField('manualQuantity', row.manualQuantity, manualQuantity)
  if (manualGroupKey !== undefined) trackField('manualGroupKey', row.manualGroupKey, manualGroupKey)
  if (excludeFromAggregation !== undefined) {
    trackField('excludeFromAggregation', row.excludeFromAggregation, excludeFromAggregation)
  }

  const hasChange = overrideRows.length > 0 || overrideReason !== undefined

  await prisma.$transaction(async (tx) => {
    await tx.estimateBillRow.update({
      where: { id: rowId },
      data: {
        ...(manualItemName         !== undefined && { manualItemName }),
        ...(manualSpec             !== undefined && { manualSpec }),
        ...(manualUnit             !== undefined && { manualUnit }),
        ...(manualQuantity         !== undefined && { manualQuantity }),
        ...(manualGroupKey         !== undefined && { manualGroupKey }),
        ...(excludeFromAggregation !== undefined && { excludeFromAggregation }),
        ...(overrideReason         !== undefined && { overrideReason }),
        ...(hasChange && {
          overriddenBy: session.sub,
          overriddenAt: new Date(),
        }),
      },
    })
    if (overrideRows.length > 0) {
      await tx.estimateRowOverride.createMany({ data: overrideRows })
    }
  })

  return ok({ id: rowId })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id, rowId } = await params
  const row = await prisma.estimateBillRow.findFirst({
    where: { id: rowId, documentId: id },
    select: { id: true },
  })
  if (!row) return notFound('행을 찾을 수 없습니다')

  // 보정값 전체 초기화
  await prisma.estimateBillRow.update({
    where: { id: rowId },
    data: {
      manualItemName:         null,
      manualSpec:             null,
      manualUnit:             null,
      manualQuantity:         null,
      manualGroupKey:         null,
      excludeFromAggregation: false,
      overrideReason:         null,
      overriddenBy:           null,
      overriddenAt:           null,
    },
  })

  return ok({ id: rowId })
}
