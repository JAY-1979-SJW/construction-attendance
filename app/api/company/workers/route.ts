import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { requireCompanyAdmin } from '@/lib/auth/guards'
import { ok, created, badRequest, unauthorized, forbidden, internalError } from '@/lib/utils/response'
import { toKSTDateString } from '@/lib/utils/date'

const createSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다.'),
  phone: z.string().regex(/^010\d{8}$/, '010으로 시작하는 11자리 번호를 입력하세요.'),
  jobTitle: z.string().min(1, '직종은 필수입니다.'),
  employmentType: z.enum(['DAILY_CONSTRUCTION', 'REGULAR', 'BUSINESS_33', 'OTHER']),
})

async function getSession(label: string) {
  try {
    return await requireCompanyAdmin()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'UNAUTHORIZED') return { error: unauthorized() }
    if (msg === 'FORBIDDEN') return { error: forbidden() }
    throw e
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await getSession('workers GET')
    if ('error' in result) return result.error
    const session = result

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? ''

    // 이 회사에 배정된 근로자 ID 목록
    const assignments = await prisma.workerCompanyAssignment.findMany({
      where: { companyId: session.companyId, validTo: null },
      select: { workerId: true },
    })
    const companyWorkerIds = assignments.map((a) => a.workerId)

    const where = {
      id: { in: companyWorkerIds },
      ...(search ? { name: { contains: search } } : {}),
    }

    const [total, workers] = await Promise.all([
      prisma.worker.count({ where }),
      prisma.worker.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          jobTitle: true,
          employmentType: true,
          isActive: true,
          siteAssignments: {
            where: { isActive: true },
            include: { site: { select: { id: true, name: true } } },
            take: 3,
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
        employmentType: w.employmentType,
        isActive: w.isActive,
        activeSites: w.siteAssignments.map((a) => ({ id: a.site.id, name: a.site.name })),
      })),
      total,
    })
  } catch (err) {
    console.error('[company/workers GET]', err)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getSession('workers POST')
    if ('error' in result) return result.error
    const session = result

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { name, phone, jobTitle, employmentType } = parsed.data

    // 동일 연락처 중복 확인
    const existing = await prisma.worker.findFirst({ where: { phone } })
    if (existing) return badRequest('이미 등록된 연락처입니다.')

    const validFrom = toKSTDateString()

    const worker = await prisma.$transaction(async (tx) => {
      const w = await tx.worker.create({
        data: { name, phone, jobTitle, employmentType },
      })
      await tx.workerCompanyAssignment.create({
        data: {
          workerId: w.id,
          companyId: session.companyId,
          validFrom,
          isPrimary: true,
        },
      })
      return w
    })

    return created({
      id: worker.id,
      name: worker.name,
      phone: worker.phone,
      jobTitle: worker.jobTitle,
      employmentType: worker.employmentType,
      isActive: worker.isActive,
    })
  } catch (err) {
    console.error('[company/workers POST]', err)
    return internalError()
  }
}
