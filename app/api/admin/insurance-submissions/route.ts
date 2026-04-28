import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin, buildWorkerScopeWhere } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, forbidden, internalError } from '@/lib/utils/response'

// GET /api/admin/insurance-submissions?month=YYYY-MM&status=PENDING&type=ACQUISITION
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return unauthorized()

    const sp = req.nextUrl.searchParams
    const month = sp.get('month')
    const status = sp.get('status')
    const type = sp.get('type')
    const workerScope = await buildWorkerScopeWhere(session)
    if (workerScope === false) return ok({ items: [], total: 0 })

    const where: Record<string, unknown> = {}
    if (month) where.monthKey = month
    if (status) where.status = status
    if (type) where.submissionType = type
    if (workerScope && typeof workerScope === 'object') {
      Object.assign(where, workerScope)
    }

    const items = await prisma.insuranceSubmissionHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        worker: { select: { id: true, name: true, jobTitle: true } },
        company: { select: { id: true, name: true } },
      },
    })

    return ok({ items, total: items.length })
  } catch (err) {
    console.error('[admin/insurance-submissions GET]', err)
    return internalError()
  }
}

const createSchema = z.object({
  workerId: z.string().min(1),
  companyId: z.string().min(1),
  siteId: z.string().optional(),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  submissionType: z.enum(['ACQUISITION', 'LOSS', 'CHANGE', 'MONTHLY_REPORT']),
  insuranceType: z.enum(['NATIONAL_PENSION', 'HEALTH_INSURANCE', 'EMPLOYMENT_INSURANCE', 'INDUSTRIAL_ACCIDENT']),
  status: z.enum(['PENDING', 'SUBMITTED', 'CONFIRMED', 'REJECTED']).default('PENDING'),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  submittedAt: z.string().datetime().optional(),
  filingExportId: z.string().optional(),
})

// POST /api/admin/insurance-submissions
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return unauthorized()
    if (session.role === 'VIEWER') return forbidden()

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? '입력값 오류')

    const data = parsed.data

    // scope 검증: workerId가 본인 접근 범위 안에 있는지 확인
    const workerScope = await buildWorkerScopeWhere(session)
    if (workerScope === false) return forbidden()
    if (workerScope && typeof workerScope === 'object') {
      const allowed = await prisma.worker.findFirst({
        where: { id: data.workerId, ...workerScope },
        select: { id: true },
      })
      if (!allowed) return forbidden()
    }

    const record = await prisma.insuranceSubmissionHistory.create({
      data: {
        workerId: data.workerId,
        companyId: data.companyId,
        siteId: data.siteId,
        monthKey: data.monthKey,
        submissionType: data.submissionType,
        insuranceType: data.insuranceType,
        status: data.status,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
        submittedAt: data.submittedAt ? new Date(data.submittedAt) : undefined,
        filingExportId: data.filingExportId,
        submittedBy: session.sub,
      },
    })

    return created(record)
  } catch (err) {
    console.error('[admin/insurance-submissions POST]', err)
    return internalError()
  }
}
