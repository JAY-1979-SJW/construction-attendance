import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, ok, badRequest } from '@/lib/utils/response'

/**
 * POST /api/worker/required-documents/agree
 * Body: { docId: string }
 *
 * docId = "labor-contract:<contractId>" → laborContractAgreedAt 갱신
 * docId = ConsentDoc.id                 → WorkerDocConsent upsert
 */
export async function POST(request: Request) {
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const workerId = session.sub
  let docId: string
  try {
    const body = await request.json()
    docId = body.docId
    if (!docId || typeof docId !== 'string') throw new Error()
  } catch {
    return badRequest('docId 필드가 필요합니다.')
  }

  const agreedAt = new Date()

  // 근로계약서 가상 문서
  if (docId.startsWith('labor-contract:')) {
    await prisma.worker.update({
      where: { id: workerId },
      data:  { laborContractAgreedAt: agreedAt },
    })
    return ok({ docId, agreedAt: agreedAt.toISOString() })
  }

  // 일반 ConsentDoc
  const doc = await prisma.consentDoc.findUnique({ where: { id: docId } })
  if (!doc) return badRequest('존재하지 않는 문서입니다.')

  await prisma.workerDocConsent.upsert({
    where: { workerId_consentDocId: { workerId, consentDocId: docId } },
    create: { workerId, consentDocId: docId, agreedAt },
    update: { agreedAt },
  })

  return ok({ docId, agreedAt: agreedAt.toISOString() })
}
