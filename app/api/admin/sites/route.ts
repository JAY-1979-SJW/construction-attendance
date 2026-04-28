import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, requireFeature, MUTATE_ROLES, getAccessibleSiteIds } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { parsePagination } from '@/lib/utils/pagination'
import { generateToken } from '@/lib/utils/random'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

const createSchema = z.object({
  name: z.string().optional().default(''),
  address: z.string().min(1, '현장주소는 필수입니다.'),
  addressJibun: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  allowedRadius: z.number().int().min(10).max(5000).default(100),
  siteCode: z.string().optional(),
  openedAt: z.string().min(1, '공사 시작일은 필수입니다.'),
  closedAt: z.string().min(1, '공사 종료일은 필수입니다.'),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const includeStats   = searchParams.get('includeStats') === 'true'
    const { page, pageSize } = parsePagination(searchParams, { page: 1, pageSize: 200 })

    // SITE_ADMIN / COMPANY_ADMIN scope 필터
    const accessibleSiteIds = await getAccessibleSiteIds(session)

    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(accessibleSiteIds !== null ? { id: { in: accessibleSiteIds } } : {}),
    }
    const [total, sites] = await Promise.all([
      prisma.site.count({ where }),
      prisma.site.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          companyAssignments: {
            include: {
              company: { select: { id: true, companyName: true, companyType: true } },
            },
            orderBy: { startDate: 'desc' },
          },
        },
      }),
    ])

    // 위도/경도는 DB에만 보관, API 응답에서 제외
    const sanitizedSites = sites.map(({ latitude, longitude, ...rest }) => rest)

    if (!includeStats) {
      return ok({ items: sanitizedSites, total, page, pageSize })
    }

    // ── 현장별 통계 집계 (배치 쿼리 5개) ──────────────────────────────────
    const siteIds = sites.map(s => s.id)
    const today    = toKSTDateString()
    const monthKey = today.slice(0, 7)
    const todayDate = kstDateStringToDate(today)

    const [assignedCounts, todayAttend, todayWages, monthWages, totalWages] = await Promise.all([
      // 활성 배정 인원 수 (WorkerSiteAssignment)
      prisma.workerSiteAssignment.groupBy({
        by: ['siteId'],
        where: { siteId: { in: siteIds }, isActive: true },
        _count: { id: true },
      }),
      // 오늘 출근 인원 수
      prisma.attendanceLog.groupBy({
        by: ['siteId'],
        where: { siteId: { in: siteIds }, workDate: todayDate },
        _count: { id: true },
      }),
      // 오늘 확정 노임 (MonthlyWorkConfirmation.workDate = 'YYYY-MM-DD')
      prisma.monthlyWorkConfirmation.groupBy({
        by: ['siteId'],
        where: { siteId: { in: siteIds }, workDate: today, confirmationStatus: 'CONFIRMED' },
        _sum: { confirmedTotalAmount: true },
      }),
      // 이번 달 누계 노임
      prisma.monthlyWorkConfirmation.groupBy({
        by: ['siteId'],
        where: { siteId: { in: siteIds }, monthKey, confirmationStatus: 'CONFIRMED' },
        _sum: { confirmedTotalAmount: true },
      }),
      // 총 누계 노임
      prisma.monthlyWorkConfirmation.groupBy({
        by: ['siteId'],
        where: { siteId: { in: siteIds }, confirmationStatus: 'CONFIRMED' },
        _sum: { confirmedTotalAmount: true },
      }),
    ])

    const assignedMap  = new Map(assignedCounts.map((r: { siteId: string; _count: { id: number } }) => [r.siteId, r._count.id]))
    const attendMap    = new Map(todayAttend.map((r: { siteId: string; _count: { id: number } }) => [r.siteId, r._count.id]))
    const todayWageMap = new Map(todayWages.map((r: { siteId: string; _sum: { confirmedTotalAmount: number | null } }) => [r.siteId, r._sum.confirmedTotalAmount ?? 0]))
    const monthWageMap = new Map(monthWages.map((r: { siteId: string; _sum: { confirmedTotalAmount: number | null } }) => [r.siteId, r._sum.confirmedTotalAmount ?? 0]))
    const totalWageMap = new Map(totalWages.map((r: { siteId: string; _sum: { confirmedTotalAmount: number | null } }) => [r.siteId, r._sum.confirmedTotalAmount ?? 0]))

    const items = sites.map(s => {
      const { latitude: _lat, longitude: _lng, ...siteRest } = s
      const assigned  = assignedMap.get(s.id) ?? 0
      const checkedIn = attendMap.get(s.id) ?? 0
      return {
        ...siteRest,
        assignedWorkerCount: assigned,
        todayCheckInCount:   checkedIn,
        absentCount:         Math.max(0, assigned - checkedIn),
        todayWage:  todayWageMap.get(s.id) ?? 0,
        monthWage:  monthWageMap.get(s.id) ?? 0,
        totalWage:  totalWageMap.get(s.id) ?? 0,
        today,
      }
    })

    return ok({ items, total, page, pageSize, today })
  } catch (err) {
    console.error('[admin/sites GET]', err)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    // SITE_WRITE 권한 강제 — SUPER_ADMIN/HQ_ADMIN/ADMIN만 현장 신규 생성 가능
    // SITE_ADMIN(담당 현장 관리만), COMPANY_ADMIN, VIEWER 차단
    const deny = requireFeature(session, 'SITE_WRITE')
    if (deny) return deny

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { siteCode, openedAt, closedAt, notes, ...coreData } = parsed.data
    // name이 비어 있으면 주소에서 자동 생성
    if (!coreData.name) {
      coreData.name = coreData.address.split(' ').slice(0, 3).join(' ') + ' 현장'
    }
    const qrToken = generateToken(32)
    const site = await prisma.site.create({
      data: {
        ...coreData,
        qrToken,
        siteCode: siteCode ?? null,
        openedAt: openedAt ? new Date(openedAt) : null,
        closedAt: closedAt ? new Date(closedAt) : null,
        notes: notes ?? null,
      },
    })

    // COMPANY_ADMIN이 현장 생성 시 자기 회사-현장 자동 연결 (접근 권한 확보)
    if (session.role === 'COMPANY_ADMIN' && session.companyId) {
      await prisma.siteCompanyAssignment.create({
        data: {
          siteId: site.id,
          companyId: session.companyId,
          contractType: 'DIRECT_WORK',
          startDate: new Date(),
          participationStatus: 'ACTIVE',
        },
      }).catch(() => {}) // 중복 방지
    }

    await writeAuditLog({
      adminId: session.sub,
      actionType: 'CREATE_SITE',
      targetType: 'Site',
      targetId: site.id,
      description: `현장 등록: ${site.name}`,
    })

    return created({ id: site.id }, '현장이 등록되었습니다.')
  } catch (err) {
    console.error('[admin/sites POST]', err)
    return internalError()
  }
}
