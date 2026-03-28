import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, forbidden, badRequest, ok } from '@/lib/utils/response'

/**
 * POST /api/worker/contracts/[id]/confirm
 * 근로자 확인 단계 기록
 *
 * body: { stage: 'VIEW' | 'PRESIGN' }
 *
 * VIEW    — 계약 내용 열람 확인 (체크리스트 동의 후)
 * PRESIGN — 전자서명 직전 최종 확인 (서명 전 마지막 동의)
 *
 * 기록 방식: WorkerContract.notes 에 타임스탬프 태그 추가
 *   [WORKER_VIEW_CONFIRM:2026-03-23T10:00:00.000Z:DAILY_EMPLOYMENT]
 *   [WORKER_PRESIGN_CONFIRM:2026-03-23T10:05:00.000Z:DAILY_EMPLOYMENT]
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const stage = body.stage as string
  if (!['VIEW', 'PRESIGN'].includes(stage)) {
    return badRequest('stage는 VIEW 또는 PRESIGN 이어야 합니다.')
  }

  const contract = await prisma.workerContract.findUnique({
    where: { id },
    select: { workerId: true, contractTemplateType: true, notes: true },
  })

  if (!contract) return notFound()
  if (contract.workerId !== session.sub) return forbidden()

  const notes = contract.notes ?? ''

  // 단계 순서 강제: PRESIGN은 VIEW 확인 후에만 가능
  if (stage === 'PRESIGN' && !notes.includes('[WORKER_VIEW_CONFIRM:')) {
    return badRequest('계약 내용 열람 확인(VIEW)을 먼저 완료해야 합니다.')
  }

  const ts    = new Date().toISOString()
  const entry = `[WORKER_${stage}_CONFIRM:${ts}:${contract.contractTemplateType ?? 'UNKNOWN'}]`
  const newNotes = contract.notes ? `${contract.notes}\n${entry}` : entry

  await prisma.workerContract.update({
    where: { id },
    data:  { notes: newNotes },
  })

  return ok({ confirmed: true, stage, confirmedAt: ts })
}
