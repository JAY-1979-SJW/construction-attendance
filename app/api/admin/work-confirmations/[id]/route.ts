import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound, conflict, internalError } from '@/lib/utils/response'
import { confirmWorkDay } from '@/lib/labor/work-confirmations'
import { Decimal } from '@prisma/client/runtime/library'

// PATCH /api/admin/work-confirmations/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const { action, workType, workUnits, baseAmount, allowanceAmount, notes } = body

    const mc = await prisma.monthlyWorkConfirmation.findUnique({ where: { id: params.id } })
    if (!mc) return notFound('NOT_FOUND')

    if (action === 'confirm') {
      const updated = await confirmWorkDay({
        confirmationId: mc.id,
        confirmedBy:    session.sub,
        workType,
        workUnits,
        baseAmount,
        allowanceAmount,
        notes,
      })
      return ok(updated)
    }

    if (action === 'exclude') {
      const updated = await prisma.monthlyWorkConfirmation.update({
        where: { id: mc.id },
        data: {
          confirmationStatus: 'EXCLUDED',
          confirmedWorkType:  'INVALID' as never,
          confirmedWorkUnits: new Decimal(0),
          confirmedBaseAmount: 0,
          confirmedAllowanceAmount: 0,
          confirmedTotalAmount: 0,
          confirmedBy: session.sub,
          confirmedAt: new Date(),
          notes: notes ?? mc.notes,
        },
      })
      return ok(updated)
    }

    if (action === 'reset') {
      if (mc.confirmationStatus === 'CONFIRMED') return conflict('ALREADY_CONFIRMED')
      const updated = await prisma.monthlyWorkConfirmation.update({
        where: { id: mc.id },
        data: { confirmationStatus: 'DRAFT', confirmedBy: null, confirmedAt: null, notes: notes ?? mc.notes },
      })
      return ok(updated)
    }

    // 단순 필드 업데이트 (DRAFT 상태에서)
    const updated = await prisma.monthlyWorkConfirmation.update({
      where: { id: mc.id },
      data: {
        ...(workType        != null ? { confirmedWorkType: workType as never }              : {}),
        ...(workUnits       != null ? { confirmedWorkUnits: new Decimal(workUnits) }        : {}),
        ...(baseAmount      != null ? { confirmedBaseAmount: baseAmount, confirmedTotalAmount: (baseAmount + (allowanceAmount ?? mc.confirmedAllowanceAmount)) } : {}),
        ...(allowanceAmount != null ? { confirmedAllowanceAmount: allowanceAmount, confirmedTotalAmount: ((baseAmount ?? mc.confirmedBaseAmount) + allowanceAmount) } : {}),
        ...(notes           != null ? { notes }                                             : {}),
      },
    })
    return ok(updated)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ALREADY_CONFIRMED') return conflict('ALREADY_CONFIRMED')
    console.error('[work-confirmations PATCH]', err)
    return internalError()
  }
}
