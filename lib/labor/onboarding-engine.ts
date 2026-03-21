/**
 * 온보딩 경고 엔진
 * 근로자 등록/수정 시 누락/오류 항목 감지
 */
import { prisma } from '@/lib/db/prisma'

export interface OnboardingCheckResult {
  hasIssues: boolean
  warnings: string[]
  errors: string[]
  checkTypes: string[]
}

/** 근로자 온보딩 상태 검사 */
export async function checkWorkerOnboarding(workerId: string): Promise<OnboardingCheckResult> {
  const worker = await prisma.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new Error('Worker not found')

  const warnings: string[] = []
  const errors: string[] = []
  const checkTypes: string[] = []

  // 1. 퇴직공제 대상 여부 미확정
  if ((worker as unknown as { retirementMutualStatus: string }).retirementMutualStatus === 'PENDING_REVIEW') {
    warnings.push('퇴직공제 대상 여부가 확인되지 않았습니다.')
    checkTypes.push('RETIREMENT_MUTUAL_STATUS')
  }

  // 2. 3.3% 근로자성 검토
  if (worker.employmentType === 'BUSINESS_33') {
    warnings.push('3.3% 사업소득자로 등록되어 있습니다. 실제 근로자성이 있다면 소득 유형 재검토가 필요합니다.')
    checkTypes.push('TAX_TYPE_33')
  }

  // 3. 외국인 특수 과세 검토
  if (worker.foreignerYn) {
    warnings.push('외국인 근로자입니다. 조세조약 적용 여부 및 특수 과세 여부를 확인하세요.')
    checkTypes.push('FOREIGNER_STATUS')
  }

  // 4. 주민번호 미입력
  if (!worker.residentIdMasked) {
    warnings.push('주민등록번호(마스킹)가 입력되지 않았습니다. 세금/보험 신고에 필요합니다.')
    checkTypes.push('RESIDENT_ID_MISSING')
  }

  return {
    hasIssues: warnings.length > 0 || errors.length > 0,
    warnings,
    errors,
    checkTypes,
  }
}

/** 월마감 전 온보딩 미완료 근로자 탐지 */
export async function detectPendingOnboardingForMonth(monthKey: string): Promise<{
  workerId: string
  workerName: string
  issues: string[]
}[]> {
  // 해당 월 출역 근로자 목록
  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: { monthKey, confirmationStatus: 'CONFIRMED' },
    include: { worker: true },
    distinct: ['workerId'],
  })

  const results = []
  for (const c of confirmations) {
    const check = await checkWorkerOnboarding(c.workerId)
    if (check.hasIssues) {
      results.push({
        workerId: c.workerId,
        workerName: c.worker.name,
        issues: [...check.warnings, ...check.errors],
      })
    }
  }

  return results
}
