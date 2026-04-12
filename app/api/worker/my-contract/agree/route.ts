import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, ok } from '@/lib/utils/response'

/**
 * POST /api/worker/my-contract/agree
 * 근로계약서 동의 저장 — laborContractAgreedAt = now()
 * 이미 동의한 경우에도 OK (멱등)
 */
export async function POST() {
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const agreedAt = new Date()
  await prisma.worker.update({
    where: { id: session.sub },
    data:  { laborContractAgreedAt: agreedAt },
  })

  return ok({ agreedAt: agreedAt.toISOString() })
}
