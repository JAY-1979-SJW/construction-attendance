import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET() {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const sites = await prisma.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    })

    return ok(sites)
  } catch (err) {
    console.error('[sites/list]', err)
    return internalError()
  }
}
