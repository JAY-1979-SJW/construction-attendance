import { DocumentTemplateDefinition, PreflightIssue, PreflightContext } from '../types'
import { prisma } from '@/lib/db/prisma'

async function checkWageLedgerPreflight(ctx: PreflightContext): Promise<PreflightIssue[]> {
  const issues: PreflightIssue[] = []

  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey: ctx.monthKey,
      confirmationStatus: 'CONFIRMED',
      ...(ctx.siteId ? { siteId: ctx.siteId } : {}),
    },
    include: { worker: { select: { id: true, name: true, residentIdMasked: true, retirementMutualStatus: true } } },
  })

  if (confirmations.length === 0) {
    issues.push({ severity: 'ERROR', code: 'NO_CONFIRMED_WORK', message: '확정된 근무 데이터가 없습니다.' })
    return issues
  }

  // 주민번호 누락
  const missingResident = confirmations.filter(c => !c.worker.residentIdMasked)
  if (missingResident.length > 0) {
    issues.push({
      severity: 'WARNING',
      code: 'MISSING_RESIDENT_ID',
      message: `주민번호가 없는 근로자가 ${missingResident.length}명 있습니다.`,
      workerIds: missingResident.map(c => c.worker.id),
    })
  }

  // 퇴직공제 PENDING_REVIEW
  const pendingRetirement = confirmations.filter(
    c => (c.worker as unknown as { retirementMutualStatus?: string }).retirementMutualStatus === 'PENDING_REVIEW'
  )
  if (pendingRetirement.length > 0) {
    issues.push({
      severity: 'WARNING',
      code: 'RETIREMENT_PENDING_REVIEW',
      message: `퇴직공제 상태 검토 필요 근로자가 ${pendingRetirement.length}명 있습니다.`,
      workerIds: pendingRetirement.map(c => c.worker.id),
    })
  }

  // 지급액 0원
  const zeroAmount = confirmations.filter(c => c.confirmedTotalAmount === 0 && Number(c.confirmedWorkUnits) > 0)
  if (zeroAmount.length > 0) {
    issues.push({
      severity: 'WARNING',
      code: 'ZERO_AMOUNT',
      message: `지급액이 0원인 근무확정이 ${zeroAmount.length}건 있습니다.`,
    })
  }

  return issues
}

export const wageLedgerTemplate: DocumentTemplateDefinition = {
  templateCode: 'WAGE_LEDGER',
  title: '노임대장',
  fileFormat: 'xlsx',
  fileNamePattern: (ctx) => `${ctx.monthKey}_노임대장${ctx.siteId ? '_현장' : ''}`,
  columns: [
    { key: '현장명', header: '현장명', required: true, resolver: r => String(r['현장명'] ?? '') },
    { key: '성명', header: '성명', required: true, resolver: r => String(r['성명'] ?? ''), validator: v => !v ? '성명 누락' : null },
    { key: '주민번호', header: '주민등록번호', required: false, resolver: r => String(r['주민번호'] ?? '') },
    { key: '직종', header: '직종', required: false, resolver: r => String(r['직종'] ?? '') },
    { key: '근무일', header: '근무일자', required: true, resolver: r => String(r['근무일'] ?? '') },
    { key: '공수', header: '공수', required: true, resolver: r => Number(r['공수'] ?? 0) },
    { key: '일당', header: '일급', required: true, resolver: r => Number(r['일당'] ?? 0) },
    { key: '제수당', header: '제수당', required: false, resolver: r => Number(r['제수당'] ?? 0) },
    { key: '지급총액', header: '지급총액', required: true, resolver: r => Number(r['지급총액'] ?? 0) },
    { key: '소득세', header: '소득세', required: false, resolver: r => Number(r['소득세'] ?? 0) },
    { key: '지방소득세', header: '지방소득세', required: false, resolver: r => Number(r['지방소득세'] ?? 0) },
    { key: '비고', header: '비고', required: false, resolver: r => String(r['비고'] ?? '') },
  ],
  preflightChecks: [checkWageLedgerPreflight],
}
