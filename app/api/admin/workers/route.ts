import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES, buildWorkerScopeWhere } from '@/lib/auth/guards'
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

    // ── site scope 강제 ──────────────────────────────────────────────────────
    const workerScope = await buildWorkerScopeWhere(session)
    if (workerScope === false) return ok({ items: [], total: 0, page: 1, pageSize, totalPages: 0 })
    // ────────────────────────────────────────────────────────────────────────

    const where = {
      ...workerScope,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { jobTitle: { contains: search } },
            ],
          }
        : {}),
    }

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
          workerDocuments: {
            where: { documentType: { in: ['CONTRACT', 'SAFETY_CERT'] } },
            select: { id: true, documentType: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' as const },
          },
          safetyDocuments: {
            where: {
              documentType: { in: ['BASIC_SAFETY_EDU_CONFIRM', 'SAFETY_EDUCATION_NEW_HIRE', 'WORK_CONDITIONS_RECEIPT'] },
            },
            select: { id: true, documentType: true, educationDate: true, documentDate: true, createdAt: true },
            orderBy: { createdAt: 'desc' as const },
            take: 3,
          },
          contracts: {
            where: { isActive: true },
            select: { dailyWage: true, startDate: true },
            orderBy: { createdAt: 'desc' as const },
            take: 1,
          },
        },
      }),
    ])

    const workerIds = workers.map(w => w.id)

    // ── 오늘 출근 현황 조회 ─────────────────────────────────────
    const now = new Date()
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayLogs = workerIds.length > 0
      ? await prisma.attendanceLog.findMany({
          where: { workerId: { in: workerIds }, workDate: todayDate },
          select: {
            workerId: true,
            siteId: true,
            checkInAt: true,
            checkOutAt: true,
            status: true,
            checkInSite: { select: { name: true } },
          },
        })
      : []
    const todayMap = new Map(todayLogs.map(l => [l.workerId, { ...l, siteName: l.checkInSite.name }]))

    const monthKey = new Date().toISOString().slice(0, 7)
    const [monthWages, totalWages] = workerIds.length > 0
      ? await Promise.all([
          prisma.monthlyWorkConfirmation.groupBy({
            by: ['workerId'],
            where: { monthKey, confirmationStatus: 'CONFIRMED', workerId: { in: workerIds } },
            _sum: { confirmedTotalAmount: true },
          }),
          prisma.monthlyWorkConfirmation.groupBy({
            by: ['workerId'],
            where: { confirmationStatus: 'CONFIRMED', workerId: { in: workerIds } },
            _sum: { confirmedTotalAmount: true },
          }),
        ])
      : [[], []]
    const monthWageMap = new Map(monthWages.map((r: { workerId: string; _sum: { confirmedTotalAmount: number | null } }) => [r.workerId, r._sum.confirmedTotalAmount ?? 0]))
    const totalWageMap = new Map(totalWages.map((r: { workerId: string; _sum: { confirmedTotalAmount: number | null } }) => [r.workerId, r._sum.confirmedTotalAmount ?? 0]))

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
        activeSites: w.siteAssignments.map(a => ({ ...a.site, isPrimary: a.isPrimary })),
        todayAttendance: (() => {
          const log = todayMap.get(w.id)
          if (!log) return null
          return { siteId: log.siteId, siteName: log.siteName, checkInAt: log.checkInAt, checkOutAt: log.checkOutAt, status: log.status }
        })(),
        // 계약 자동채움용 마스킹 계좌 — 레거시 bankName/bankAccount 응답 제외
        bankAccountSecure: w.bankAccountSecure
          ? { bankName: w.bankAccountSecure.bankName, accountNumberMasked: w.bankAccountSecure.accountNumberMasked }
          : null,
        accountStatus: w.accountStatus,
        birthDate: w.birthDate ?? null,
        // 서류/교육 상태
        hasContract: w.workerDocuments.some(d => d.documentType === 'CONTRACT') || w.safetyDocuments.some(d => d.documentType === 'WORK_CONDITIONS_RECEIPT'),
        contractDate: (w.workerDocuments.find(d => d.documentType === 'CONTRACT')?.createdAt?.toISOString().slice(0, 10)) ?? (w.safetyDocuments.find(d => d.documentType === 'WORK_CONDITIONS_RECEIPT')?.documentDate) ?? null,
        hasSafetyCert: w.workerDocuments.some(d => d.documentType === 'SAFETY_CERT'),
        safetyCertDate: w.workerDocuments.find(d => d.documentType === 'SAFETY_CERT')?.createdAt?.toISOString().slice(0, 10) ?? null,
        hasSafetyEducation: w.safetyDocuments.some(d => d.documentType === 'BASIC_SAFETY_EDU_CONFIRM' || d.documentType === 'SAFETY_EDUCATION_NEW_HIRE'),
        safetyEducationDate: (w.safetyDocuments.find(d => d.documentType === 'BASIC_SAFETY_EDU_CONFIRM' || d.documentType === 'SAFETY_EDUCATION_NEW_HIRE'))?.educationDate ?? null,
        dailyWage: w.contracts[0]?.dailyWage ?? 0,
        monthWage: monthWageMap.get(w.id) ?? 0,
        totalWage: totalWageMap.get(w.id) ?? 0,
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
