import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, created, badRequest, unauthorized, notFound, conflict } from '@/lib/utils/response'
import { buildSnapshotFromMaster } from '@/lib/materials/request-service'

const AddItemSchema = z.object({
  materialMasterId: z.string().optional(),
  itemCode:         z.string().optional(),
  itemName:         z.string().optional(),
  spec:             z.string().optional(),
  unit:             z.string().optional(),
  disciplineCode:   z.string().optional(),
  requestedQty:     z.number().positive('수량은 0보다 커야 합니다.'),
  unitPrice:        z.number().nonnegative().optional(),
  isUrgent:         z.boolean().optional(),
  allowSubstitute:  z.boolean().optional(),
  notes:            z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!request) return notFound('청구서를 찾을 수 없습니다.')
  if (request.status !== 'DRAFT') {
    return conflict('작성중 상태에서만 항목을 추가할 수 있습니다.')
  }

  const body = await req.json().catch(() => null)
  const parsed = AddItemSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const d = parsed.data
  let snapshot = {
    itemCode:         d.itemCode ?? '',
    itemName:         d.itemName ?? '',
    spec:             d.spec ?? null,
    unit:             d.unit ?? null,
    disciplineCode:   d.disciplineCode ?? null,
    subDisciplineCode: null as string | null,
  }

  if (d.materialMasterId) {
    try {
      const s = await buildSnapshotFromMaster(d.materialMasterId)
      snapshot = { ...s }
    } catch (e: unknown) {
      return badRequest((e as Error).message)
    }
  }

  if (!snapshot.itemCode || !snapshot.itemName) {
    return badRequest('품목코드와 품목명은 필수입니다.')
  }

  const item = await prisma.materialRequestItem.create({
    data: {
      id:               randomUUID(),
      requestId:        id,
      materialMasterId: d.materialMasterId ?? null,
      itemCode:         snapshot.itemCode,
      itemName:         snapshot.itemName,
      spec:             snapshot.spec,
      unit:             snapshot.unit,
      disciplineCode:   snapshot.disciplineCode,
      subDisciplineCode: snapshot.subDisciplineCode,
      requestedQty:     new Decimal(d.requestedQty),
      unitPrice:        d.unitPrice != null ? new Decimal(d.unitPrice) : null,
      isUrgent:         d.isUrgent ?? false,
      allowSubstitute:  d.allowSubstitute ?? false,
      notes:            d.notes ?? null,
    },
  })

  return created(item)
}
