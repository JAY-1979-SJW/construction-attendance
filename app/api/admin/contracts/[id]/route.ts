import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound, internalError } from '@/lib/utils/response'

// PATCH /api/admin/contracts/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const existing = await prisma.workerContract.findUnique({ where: { id: params.id } })
    if (!existing) return notFound('NOT_FOUND')

    const body = await req.json().catch(() => ({}))
    const {
      endDate, dailyWage, monthlySalary, hourlyRate,
      overtimeRate, nightRate, holidayRate,
      halfDayRule, taxRuleType, insuranceRuleType, retirementMutualRuleType,
      notes, isActive,
    } = body

    const updated = await prisma.workerContract.update({
      where: { id: params.id },
      data: {
        ...(endDate                  != null ? { endDate }                  : {}),
        ...(dailyWage                != null ? { dailyWage }                : {}),
        ...(monthlySalary            != null ? { monthlySalary }            : {}),
        ...(hourlyRate               != null ? { hourlyRate }               : {}),
        ...(overtimeRate             != null ? { overtimeRate }             : {}),
        ...(nightRate                != null ? { nightRate }                : {}),
        ...(holidayRate              != null ? { holidayRate }              : {}),
        ...(halfDayRule              != null ? { halfDayRule }              : {}),
        ...(taxRuleType              != null ? { taxRuleType }              : {}),
        ...(insuranceRuleType        != null ? { insuranceRuleType }        : {}),
        ...(retirementMutualRuleType != null ? { retirementMutualRuleType } : {}),
        ...(notes                    != null ? { notes }                    : {}),
        ...(isActive                 != null ? { isActive }                 : {}),
      },
    })

    return ok(updated)
  } catch (err) {
    console.error('[contracts PATCH]', err)
    return internalError()
  }
}
