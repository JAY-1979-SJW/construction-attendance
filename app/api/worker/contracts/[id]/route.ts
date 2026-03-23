import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, forbidden, ok } from '@/lib/utils/response'
import { getWorkerConfirmationByTemplate } from '@/lib/policies/worker-type-ui-policy'

/**
 * GET /api/worker/contracts/[id]
 * 근로자 본인의 계약 요약 정보 조회 (열람·서명 전 확인 화면용)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const contract = await prisma.workerContract.findUnique({
    where: { id },
    select: {
      id:                   true,
      workerId:             true,
      contractStatus:       true,
      contractTemplateType: true,
      startDate:            true,
      endDate:              true,
      companyName:          true,
      companyRepName:       true,
      dailyWage:            true,
      monthlySalary:        true,
      serviceFee:           true,
      notes:                true,
      worker: { select: { name: true } },
      site:   { select: { name: true } },
    },
  })

  if (!contract) return notFound()
  if (contract.workerId !== session.sub) return forbidden()

  const guide = contract.contractTemplateType
    ? getWorkerConfirmationByTemplate(contract.contractTemplateType)
    : null

  // notes 필드에서 확인 이력 파싱
  const notes = contract.notes ?? ''
  const viewConfirmed    = notes.includes('[WORKER_VIEW_CONFIRM:')
  const presignConfirmed = notes.includes('[WORKER_PRESIGN_CONFIRM:')

  const wage = contract.monthlySalary
    ? `월 ${contract.monthlySalary.toLocaleString('ko-KR')}원`
    : contract.serviceFee
    ? `계약금액 ${contract.serviceFee.toLocaleString('ko-KR')}원`
    : contract.dailyWage
    ? `일 ${contract.dailyWage.toLocaleString('ko-KR')}원`
    : '임금 미기재'

  return ok({
    id:              contract.id,
    contractStatus:  contract.contractStatus,
    startDate:       contract.startDate,
    endDate:         contract.endDate ?? null,
    companyName:     contract.companyName ?? '',
    companyRepName:  contract.companyRepName ?? '',
    workerName:      contract.worker.name,
    siteName:        contract.site?.name ?? null,
    wage,
    guide,
    viewConfirmed,
    presignConfirmed,
  })
}
