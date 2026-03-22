import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, notFound } from '@/lib/utils/response'

export async function GET() {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const worker = await prisma.worker.findUnique({
      where: { id: session.sub },
      include: {
        devices: {
          where: { isActive: true },
          select: { id: true, deviceName: true, isPrimary: true, lastLoginAt: true },
        },
        companyAssignments: {
          where: { isPrimary: true, validTo: null },
          include: { company: { select: { companyName: true } } },
          take: 1,
        },
      },
    })

    if (!worker) return notFound('근로자를 찾을 수 없습니다.')

    return ok({
      id: worker.id,
      name: worker.name,
      phone: worker.phone,
      company: worker.companyAssignments[0]?.company.companyName ?? '',
      jobTitle: worker.jobTitle,
      devices: worker.devices,
    })
  } catch (err) {
    console.error('[auth/me]', err)
    return unauthorized()
  }
}
