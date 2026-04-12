import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, ok } from '@/lib/utils/response'

/**
 * GET /api/worker/my-contract
 * 근로자 본인의 최신 유효 계약서 내용 + 동의 상태 반환
 */
export async function GET() {
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const worker = await prisma.worker.findUnique({
    where: { id: session.sub },
    select: { laborContractAgreedAt: true },
  })
  if (!worker) return unauthorized()

  // 최신 유효 계약 조회 — ACTIVE > REVIEW_REQUESTED > DRAFT
  const contracts = await prisma.workerContract.findMany({
    where: {
      workerId: session.sub,
      contractStatus: { in: ['ACTIVE', 'REVIEW_REQUESTED', 'DRAFT'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      worker: { select: { name: true } },
      site:   { select: { name: true } },
      generatedDocuments: {
        orderBy: { generatedAt: 'desc' },
        take: 1,
      },
    },
  })

  // ACTIVE 우선 선택
  const priority = ['ACTIVE', 'REVIEW_REQUESTED', 'DRAFT']
  const contract = contracts.sort((a, b) =>
    priority.indexOf(a.contractStatus) - priority.indexOf(b.contractStatus)
  )[0] ?? null

  if (!contract) {
    return ok({ contract: null, agreedAt: worker.laborContractAgreedAt })
  }

  const doc = contract.generatedDocuments[0] ?? null

  let sections: { title: string; content: string }[] = []
  let contractTitle = '근로계약서'

  if (doc?.contentJson) {
    const rendered = doc.contentJson as {
      title?: string
      sections?: { title: string; content: string }[]
    }
    contractTitle = rendered.title ?? '근로계약서'
    sections = rendered.sections ?? []
  } else {
    // GeneratedDocument 없을 때 주요 필드로 합성
    const wage = contract.monthlySalary
      ? `월 ${Number(contract.monthlySalary).toLocaleString('ko-KR')}원`
      : contract.serviceFee
      ? `계약금액 ${Number(contract.serviceFee).toLocaleString('ko-KR')}원`
      : contract.dailyWage
      ? `일 ${Number(contract.dailyWage).toLocaleString('ko-KR')}원`
      : '임금 미기재'

    const insurances = [
      contract.nationalPensionYn    && '국민연금',
      contract.healthInsuranceYn    && '건강보험',
      contract.employmentInsuranceYn && '고용보험',
      contract.industrialAccidentYn && '산재보험',
    ].filter(Boolean).join(', ') || '해당 없음'

    sections = [
      {
        title: '1. 계약 당사자',
        content: [
          `사업주: ${contract.companyName ?? ''} (대표 ${contract.companyRepName ?? ''})`,
          contract.companyBizNo ? `사업자등록번호: ${contract.companyBizNo}` : '',
          contract.companyAddress ? `주소: ${contract.companyAddress}` : '',
          contract.companyPhone ? `전화: ${contract.companyPhone}` : '',
          `근로자: ${contract.worker.name}`,
        ].filter(Boolean).join('\n'),
      },
      {
        title: '2. 근로 기간',
        content: `계약 시작일: ${contract.startDate}\n계약 종료일: ${contract.endDate ?? '기간의 정함 없음'}`,
      },
      {
        title: '3. 근무 현장',
        content: contract.site?.name ?? '현장 미지정',
      },
      {
        title: '4. 임금',
        content: wage,
      },
      {
        title: '5. 근로시간',
        content: [
          contract.checkInTime && contract.checkOutTime
            ? `출퇴근: ${contract.checkInTime} ~ ${contract.checkOutTime}`
            : '',
          contract.standardWorkHours
            ? `1일 소정근로시간: ${contract.standardWorkHours}시간`
            : '',
          contract.workDays ? `근무요일: ${contract.workDays}` : '',
        ].filter(Boolean).join('\n') || '협의',
      },
      {
        title: '6. 사회보험',
        content: insurances,
      },
    ].filter(s => s.content.trim() !== '')
  }

  return ok({
    contract: {
      id:             contract.id,
      contractStatus: contract.contractStatus,
      title:          contractTitle,
      companyName:    contract.companyName ?? '',
      workerName:     contract.worker.name,
      siteName:       contract.site?.name ?? null,
      startDate:      contract.startDate,
      endDate:        contract.endDate ?? null,
      sections,
      generatedAt:    doc?.generatedAt ?? null,
    },
    agreedAt: worker.laborContractAgreedAt,
  })
}
