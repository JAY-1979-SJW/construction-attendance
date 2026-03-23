/**
 * GET  /api/admin/insurance-rates  — 보험요율 버전 목록
 * POST /api/admin/insurance-rates  — 신규 버전 생성 (DRAFT)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, badRequest, internalError } from '@/lib/utils/response'

const RATE_TYPES = [
  'NATIONAL_PENSION','HEALTH_INSURANCE','LONG_TERM_CARE',
  'EMPLOYMENT_INSURANCE','EMPLOYMENT_STABILITY','INDUSTRIAL_ACCIDENT','RETIREMENT_MUTUAL',
] as const

const createSchema = z.object({
  rateType:                 z.enum(RATE_TYPES),
  effectiveYear:            z.number().int().min(2020).max(2099),
  effectiveMonth:           z.number().int().min(1).max(12).optional(),
  totalRatePct:             z.number().min(0).max(100).optional(),
  employeeRatePct:          z.number().min(0).max(100).optional(),
  employerRatePct:          z.number().min(0).max(100).optional(),
  rateNote:                 z.string().max(500).optional(),
  industryCode:             z.string().max(20).optional(),
  officialSourceName:       z.string().max(100).optional(),
  officialSourceUrl:        z.string().max(500).optional(),
  officialAnnouncementDate: z.string().optional(), // ISO date string
  referenceDocumentNo:      z.string().max(100).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const rateType  = searchParams.get('rateType') ?? undefined
    const year      = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
    const status    = searchParams.get('status') ?? undefined

    const versions = await prisma.insuranceRateVersion.findMany({
      where: {
        ...(rateType ? { rateType: rateType as any } : {}),
        ...(year     ? { effectiveYear: year }        : {}),
        ...(status   ? { status: status as any }       : {}),
      },
      orderBy: [{ effectiveYear: 'desc' }, { rateType: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ success: true, data: versions })
  } catch (err) {
    console.error('[admin/insurance-rates GET]', err)
    return internalError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const body   = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { officialAnnouncementDate, ...rest } = parsed.data

    const version = await prisma.insuranceRateVersion.create({
      data: {
        ...rest,
        totalRatePct:    rest.totalRatePct    != null ? rest.totalRatePct    : undefined,
        employeeRatePct: rest.employeeRatePct != null ? rest.employeeRatePct : undefined,
        employerRatePct: rest.employerRatePct != null ? rest.employerRatePct : undefined,
        officialAnnouncementDate: officialAnnouncementDate
          ? new Date(officialAnnouncementDate) : undefined,
        createdBy: session.sub,
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ success: true, data: version }, { status: 201 })
  } catch (err) {
    console.error('[admin/insurance-rates POST]', err)
    return internalError()
  }
}
