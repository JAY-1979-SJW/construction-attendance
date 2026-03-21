import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, created, unauthorized, badRequest, internalError } from '@/lib/utils/response'

// GET /api/admin/contracts?workerId=&siteId=&isActive=
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const workerId = searchParams.get('workerId') ?? undefined
    const siteId   = searchParams.get('siteId')   ?? undefined
    const isActive = searchParams.get('isActive')

    const items = await prisma.workerContract.findMany({
      where: {
        ...(workerId ? { workerId }                          : {}),
        ...(siteId   ? { siteId }                            : {}),
        ...(isActive ? { isActive: isActive === 'true' }     : {}),
      },
      include: {
        worker: { select: { id: true, name: true, company: true } },
        site:   { select: { id: true, name: true } },
      },
      orderBy: [{ workerId: 'asc' }, { startDate: 'desc' }],
    })

    return ok({ items, total: items.length })
  } catch (err) {
    console.error('[contracts GET]', err)
    return internalError()
  }
}

// POST /api/admin/contracts
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const {
      workerId, siteId, contractType, startDate, endDate,
      dailyWage, monthlySalary, hourlyRate,
      overtimeRate, nightRate, holidayRate,
      halfDayRule, taxRuleType, insuranceRuleType, retirementMutualRuleType,
      notes,
    } = body

    if (!workerId || !startDate || !contractType) {
      return badRequest('REQUIRED_FIELDS_MISSING')
    }

    const contract = await prisma.workerContract.create({
      data: {
        workerId,
        siteId:                  siteId ?? null,
        contractType:            contractType as never,
        startDate,
        endDate:                 endDate ?? null,
        dailyWage:               dailyWage ?? 0,
        monthlySalary:           monthlySalary ?? null,
        hourlyRate:              hourlyRate ?? null,
        overtimeRate:            overtimeRate ?? null,
        nightRate:               nightRate ?? null,
        holidayRate:             holidayRate ?? null,
        halfDayRule:             halfDayRule ?? 'HALF',
        taxRuleType:             taxRuleType ?? 'DAILY_WAGE',
        insuranceRuleType:       insuranceRuleType ?? 'DEFAULT',
        retirementMutualRuleType: retirementMutualRuleType ?? 'DEFAULT',
        notes:                   notes ?? null,
      },
    })

    return created(contract)
  } catch (err) {
    console.error('[contracts POST]', err)
    return internalError()
  }
}
