import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

// GET /api/admin/wage-calculations?monthKey=YYYY-MM&incomeType=
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const monthKey   = searchParams.get('monthKey')   ?? ''
    const incomeType = searchParams.get('incomeType') ?? undefined

    if (!monthKey) return ok({ items: [] })

    const [wages, withholdings] = await Promise.all([
      prisma.wageCalculation.findMany({
        where: {
          monthKey,
          ...(incomeType ? { incomeType: incomeType as never } : {}),
        },
        include: { worker: { select: { id: true, name: true, company: true, employmentType: true, incomeType: true } } },
        orderBy: { worker: { name: 'asc' } },
      }),
      prisma.withholdingCalculation.findMany({
        where: { monthKey },
        select: { workerId: true, incomeTaxAmount: true, localIncomeTaxAmount: true, formulaCode: true },
      }),
    ])

    const wMap = new Map(withholdings.map((w) => [w.workerId, w]))
    const items = wages.map((w) => ({
      ...w,
      withholding: wMap.get(w.workerId) ?? null,
    }))

    // 합계
    const totals = items.reduce(
      (acc, i) => ({
        gross:       acc.gross + i.grossAmount,
        nonTaxable:  acc.nonTaxable + i.nonTaxableAmount,
        taxable:     acc.taxable + i.taxableAmount,
        incomeTax:   acc.incomeTax + (i.withholding?.incomeTaxAmount ?? 0),
        localTax:    acc.localTax + (i.withholding?.localIncomeTaxAmount ?? 0),
      }),
      { gross: 0, nonTaxable: 0, taxable: 0, incomeTax: 0, localTax: 0 }
    )

    return ok({ items, totals, total: items.length, monthKey })
  } catch (err) {
    console.error('[wage-calculations GET]', err)
    return internalError()
  }
}
