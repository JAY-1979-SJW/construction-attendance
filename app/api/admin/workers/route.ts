import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const createSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다.'),
  phone: z.string().regex(/^010\d{8}$/, '010으로 시작하는 11자리 번호'),
  jobTitle: z.string().min(1, '직종은 필수입니다.'),
  employmentType: z.enum(['REGULAR', 'DAILY_CONSTRUCTION', 'BUSINESS_33', 'OTHER']).optional(),
  organizationType: z.enum(['DIRECT', 'SUBCONTRACTOR']).optional(),
  foreignerYn: z.boolean().optional(),
  nationalityCode: z.string().optional(),
  skillLevel: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10)

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { jobTitle: { contains: search } },
          ],
        }
      : {}

    const [total, workers] = await Promise.all([
      prisma.worker.count({ where }),
      prisma.worker.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { devices: { where: { isActive: true } } } },
          companyAssignments: {
            where: { validTo: null, isPrimary: true },
            include: { company: { select: { id: true, companyName: true } } },
            take: 1,
          },
          siteAssignments: {
            where: { isActive: true },
            include: { site: { select: { id: true, name: true } } },
            take: 3,
          },
          // 계약 자동채움용 마스킹 계좌 (레거시 bankName/bankAccount 대체)
          bankAccountSecure: {
            select: { bankName: true, accountNumberMasked: true },
          },
        },
      }),
    ])

    return ok({
      items: workers.map((w) => ({
        id: w.id,
        name: w.name,
        phone: w.phone,
        jobTitle: w.jobTitle,
        isActive: w.isActive,
        deviceCount: w._count.devices,
        retirementMutualStatus: w.retirementMutualStatus,
        foreignerYn: w.foreignerYn,
        employmentType: w.employmentType,
        organizationType: w.organizationType,
        idVerificationStatus: w.idVerificationStatus,
        createdAt: w.createdAt,
        primaryCompany: w.companyAssignments[0]?.company ?? null,
        activeSites: w.siteAssignments.map(a => a.site),
        // 계약 자동채움용 마스킹 계좌 — 레거시 bankName/bankAccount 응답 제외
        bankAccountSecure: w.bankAccountSecure
          ? { bankName: w.bankAccountSecure.bankName, accountNumberMasked: w.bankAccountSecure.accountNumberMasked }
          : null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('[admin/workers GET]', err)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { name, phone, jobTitle, employmentType, organizationType, foreignerYn, nationalityCode, skillLevel } = parsed.data

    const existing = await prisma.worker.findUnique({ where: { phone } })
    if (existing) return badRequest('이미 등록된 휴대폰 번호입니다.')

    const worker = await prisma.worker.create({
      data: {
        name,
        phone,
        jobTitle,
        employmentType: employmentType ?? 'DAILY_CONSTRUCTION',
        organizationType: organizationType ?? 'DIRECT',
        foreignerYn: foreignerYn ?? false,
        nationalityCode: nationalityCode ?? 'KR',
        skillLevel: skillLevel ?? null,
      },
    })

    await writeAuditLog({
      adminId: session.sub,
      actorType: 'ADMIN',
      actionType: 'REGISTER_WORKER',
      targetType: 'Worker',
      targetId: worker.id,
      description: `근로자 등록: ${name} (${phone})`,
      summary: `근로자 등록: ${name} (${phone})`,
    })

    return created({ id: worker.id }, '근로자가 등록되었습니다.')
  } catch (err) {
    console.error('[admin/workers POST]', err)
    return internalError()
  }
}
