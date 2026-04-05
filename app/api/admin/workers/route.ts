import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, requireFeature, MUTATE_ROLES, buildWorkerScopeWhere } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// ── birthDate 유효성 검증 ──────────────────────────────────────────────────
function isValidBirthDate(s: string): string | null {
  if (!/^\d{8}$/.test(s)) return 'YYYYMMDD 8자리 숫자를 입력하세요.'
  const y = parseInt(s.slice(0, 4), 10)
  const m = parseInt(s.slice(4, 6), 10)
  const d = parseInt(s.slice(6, 8), 10)
  const now = new Date()
  if (y < 1930 || y > now.getFullYear()) return `연도 범위 오류 (1930~${now.getFullYear()})`
  if (m < 1 || m > 12) return '월 범위 오류 (01~12)'
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return '존재하지 않는 날짜입니다.'
  if (date > now) return '미래 날짜는 입력할 수 없습니다.'
  return null
}

// ── 전화번호 정규화 (숫자만 추출) ─────────────────────────────────────────
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

const createSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다.'),
  phone: z.string().min(1, '연락처는 필수입니다.'),
  birthDate: z.string().optional(),
  jobTitle: z.string().optional().default('미설정'),
  employmentType: z.enum(['REGULAR', 'DAILY_CONSTRUCTION', 'BUSINESS_33', 'FIXED_TERM', 'CONTINUOUS_SITE', 'OTHER']).optional(),
  organizationType: z.enum(['DIRECT', 'DAILY_WORKER', 'OUTSOURCED', 'SUBCONTRACTOR']).optional(),
  foreignerYn: z.boolean().optional(),
  nationalityCode: z.string().optional(),
  skillLevel: z.string().optional(),
  subcontractorName: z.string().max(100).optional(),
  // 실무 필수 항목
  hireDate: z.string().optional(),
  emergencyContact: z.string().optional(),
  teamName: z.string().max(50).optional(),
  supervisorName: z.string().max(20).optional(),
  foremanName: z.string().max(20).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireFeature(session, 'WORKER_VIEW')
    if (deny) return deny

    const { searchParams } = new URL(request.url)
    const search     = searchParams.get('search') ?? ''
    const teamFilter = searchParams.get('team') ?? ''
    const statusFilter = searchParams.get('status') ?? ''  // 'active' | 'inactive' | ''
    const page     = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10)

    // ── site scope 강제 ──────────────────────────────────────────────────────
    const workerScope = await buildWorkerScopeWhere(session)
    if (workerScope === false) return ok({ items: [], total: 0, page: 1, pageSize, totalPages: 0 })
    // ────────────────────────────────────────────────────────────────────────

    const where: Record<string, unknown> = {
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
      ...(teamFilter ? { teamName: teamFilter } : {}),
      ...(statusFilter === 'active'   ? { isActive: true }  : {}),
      ...(statusFilter === 'inactive' ? { isActive: false } : {}),
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

    // ── 최근 출근일 조회 ────────────────────────────────────────
    const latestLogs = workerIds.length > 0
      ? await prisma.attendanceLog.findMany({
          where: { workerId: { in: workerIds } },
          select: { workerId: true, workDate: true },
          orderBy: { workDate: 'desc' },
          distinct: ['workerId'],
        })
      : []
    const latestCheckInMap = new Map(latestLogs.map(l => [l.workerId, l.workDate?.toISOString().slice(0, 10) ?? null]))

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
        // 실무 필수 항목
        hireDate: w.hireDate ?? null,
        emergencyContact: w.emergencyContact ?? null,
        teamName: w.teamName ?? null,
        supervisorName: w.supervisorName ?? null,
        foremanName: w.foremanName ?? null,
        latestCheckInDate: latestCheckInMap.get(w.id) ?? null,
        // 서류/교육 상태
        hasContract: w.workerDocuments.some(d => d.documentType === 'CONTRACT') || w.safetyDocuments.some(d => d.documentType === 'WORK_CONDITIONS_RECEIPT'),
        contractDate: (w.workerDocuments.find(d => d.documentType === 'CONTRACT')?.createdAt?.toISOString().slice(0, 10)) ?? (w.safetyDocuments.find(d => d.documentType === 'WORK_CONDITIONS_RECEIPT')?.documentDate) ?? null,
        contractIssuedYn: w.workerDocuments.some(d => d.documentType === 'CONTRACT' && d.status === 'APPROVED'),
        contractAttachedYn: w.workerDocuments.some(d => d.documentType === 'CONTRACT'),
        hasSafetyCert: w.workerDocuments.some(d => d.documentType === 'SAFETY_CERT'),
        safetyCertDate: w.workerDocuments.find(d => d.documentType === 'SAFETY_CERT')?.createdAt?.toISOString().slice(0, 10) ?? null,
        hasSafetyEducation: w.safetyDocuments.some(d => d.documentType === 'BASIC_SAFETY_EDU_CONFIRM' || d.documentType === 'SAFETY_EDUCATION_NEW_HIRE'),
        safetyEducationType: (() => {
          const doc = w.safetyDocuments.find(d => d.documentType === 'BASIC_SAFETY_EDU_CONFIRM' || d.documentType === 'SAFETY_EDUCATION_NEW_HIRE')
          if (!doc) return null
          return doc.documentType === 'BASIC_SAFETY_EDU_CONFIRM' ? '기초안전교육' : '신규채용교육'
        })(),
        safetyEducationDate: (w.safetyDocuments.find(d => d.documentType === 'BASIC_SAFETY_EDU_CONFIRM' || d.documentType === 'SAFETY_EDUCATION_NEW_HIRE'))?.educationDate ?? null,
        safetyEduCertAttachedYn: w.workerDocuments.some(d => d.documentType === 'SAFETY_CERT'),
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

    const { name, jobTitle, employmentType, organizationType, foreignerYn, nationalityCode, skillLevel, birthDate, subcontractorName, hireDate, emergencyContact, teamName, supervisorName, foremanName } = parsed.data

    // ── 전화번호 정규화 및 검증 ─────────────────────────────────
    const phone = normalizePhone(parsed.data.phone)
    if (!/^010\d{8}$/.test(phone)) return badRequest('010으로 시작하는 11자리 번호를 입력하세요.')

    // ── birthDate 유효성 검증 ───────────────────────────────────
    if (birthDate) {
      const birthErr = isValidBirthDate(birthDate)
      if (birthErr) return badRequest(`생년월일: ${birthErr}`)
    }

    // ── 전화번호 중복 검사 ──────────────────────────────────────
    const existing = await prisma.worker.findUnique({ where: { phone } })
    if (existing) return badRequest('이미 등록된 휴대폰 번호입니다.')

    // ── 이름+생년월일 유사 중복 경고 (차단하지 않고 경고 반환) ──
    let duplicateWarning: string | null = null
    if (birthDate) {
      const similar = await prisma.worker.findFirst({
        where: { name: name.trim(), birthDate },
        select: { id: true, name: true, phone: true },
      })
      if (similar) {
        duplicateWarning = `동일 이름+생년월일 근로자 존재: ${similar.name} (${similar.phone ?? '번호없음'})`
      }
    }

    const worker = await prisma.worker.create({
      data: {
        name: name.trim(),
        phone,
        jobTitle: jobTitle.trim(),
        employmentType: employmentType ?? 'DAILY_CONSTRUCTION',
        organizationType: organizationType ?? 'DIRECT',
        foreignerYn: foreignerYn ?? false,
        nationalityCode: nationalityCode ?? 'KR',
        skillLevel: skillLevel ?? null,
        birthDate: birthDate ?? null,
        subcontractorName: (organizationType === 'SUBCONTRACTOR' && subcontractorName) ? subcontractorName.trim() : null,
        hireDate: hireDate ?? null,
        emergencyContact: emergencyContact?.trim() || null,
        teamName: teamName?.trim() || null,
        supervisorName: supervisorName?.trim() || null,
        foremanName: foremanName?.trim() || null,
      },
    })

    await writeAuditLog({
      adminId: session.sub,
      actorType: 'ADMIN',
      actionType: 'REGISTER_WORKER',
      targetType: 'Worker',
      targetId: worker.id,
      description: `근로자 등록: ${name} (${phone})${subcontractorName ? ` [협력사: ${subcontractorName}]` : ''}`,
      summary: `근로자 등록: ${name} (${phone})`,
    })

    return created({ id: worker.id, duplicateWarning }, '근로자가 등록되었습니다.')
  } catch (err) {
    console.error('[admin/workers POST]', err)
    return internalError()
  }
}
