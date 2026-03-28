import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, forbidden, ok, badRequest } from '@/lib/utils/response'

/**
 * POST /api/worker/contracts/[id]/sign
 * 근로자 전자서명 — 캔버스 서명 이미지를 저장하고 계약 상태를 전환
 * body: { signatureData: string (base64 data URI) }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const contract = await prisma.workerContract.findUnique({
    where: { id },
    select: {
      workerId:       true,
      contractStatus: true,
      notes:          true,
      worker:         { select: { name: true } },
    },
  })

  if (!contract) return notFound()
  if (contract.workerId !== session.sub) return forbidden()

  // DRAFT 상태에서만 근로자 서명 가능 (이미 서명/검토/활성 상태면 거부)
  if (contract.contractStatus !== 'DRAFT') {
    return badRequest('이미 서명이 완료되었거나 현재 상태에서는 서명할 수 없습니다.')
  }

  // 단계 순서 강제: VIEW + PRESIGN 모두 완료된 경우에만 서명 가능
  const notes = contract.notes ?? ''
  if (!notes.includes('[WORKER_VIEW_CONFIRM:')) {
    return badRequest('계약 내용 열람 확인(VIEW)을 먼저 완료해야 합니다.')
  }
  if (!notes.includes('[WORKER_PRESIGN_CONFIRM:')) {
    return badRequest('서명 전 최종 확인(PRESIGN)을 먼저 완료해야 합니다.')
  }

  const body = await req.json().catch(() => ({}))
  const { signatureData } = body as { signatureData?: string }

  if (!signatureData || !signatureData.startsWith('data:image/')) {
    return badRequest('유효한 서명 이미지가 필요합니다.')
  }

  // 서명 이미지 크기 제한 (500KB)
  if (signatureData.length > 500_000) {
    return badRequest('서명 이미지가 너무 큽니다.')
  }

  const now = new Date()
  const tag = `[WORKER_SIGNATURE:${now.toISOString()}]`
  const updatedNotes = contract.notes
    ? `${contract.notes}\n${tag}`
    : tag

  await prisma.workerContract.update({
    where: { id },
    data: {
      workerSignatureData: signatureData,
      signedAt:            now,
      signedBy:            contract.worker.name,
      contractStatus:      'REVIEW_REQUESTED',
      notes:               updatedNotes,
    },
  })

  return ok({
    signed: true,
    signedAt: now.toISOString(),
    contractStatus: 'REVIEW_REQUESTED',
  })
}
