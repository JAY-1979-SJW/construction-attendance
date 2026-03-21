/**
 * 문서 사전검사 서비스
 * 다운로드 전 데이터 품질 검사 실행
 */
import { prisma } from '@/lib/db/prisma'
import { getTemplate } from '@/lib/document-templates/registry'
import { PreflightIssue, PreflightContext } from '@/lib/document-templates/types'

export interface PreflightResult {
  ok: boolean
  canDownload: boolean
  summary: {
    errorCount: number
    warningCount: number
    infoCount: number
  }
  issues: PreflightIssue[]
}

export async function runPreflight(
  templateCode: string,
  ctx: PreflightContext,
  actedBy?: string
): Promise<PreflightResult> {
  const template = getTemplate(templateCode)

  // 공통 검사
  const commonIssues: PreflightIssue[] = []

  if (!ctx.monthKey || !/^\d{4}-\d{2}$/.test(ctx.monthKey)) {
    commonIssues.push({ severity: 'ERROR', code: 'INVALID_MONTH', message: '유효하지 않은 월 형식입니다.' })
  }

  // 월마감 상태 확인
  const closing = await prisma.monthClosing.findFirst({
    where: { monthKey: ctx.monthKey, closingScope: 'GLOBAL' },
  })
  if (!closing || closing.status === 'OPEN') {
    commonIssues.push({
      severity: 'INFO',
      code: 'MONTH_NOT_CLOSED',
      message: '월마감이 완료되지 않았습니다. 확정 전 자료입니다.',
    })
  }

  // 템플릿별 검사 실행
  const templateIssues: PreflightIssue[] = []
  for (const check of template.preflightChecks) {
    const issues = await check(ctx)
    templateIssues.push(...issues)
  }

  const allIssues = [...commonIssues, ...templateIssues]

  const errorCount = allIssues.filter(i => i.severity === 'ERROR').length
  const warningCount = allIssues.filter(i => i.severity === 'WARNING').length
  const infoCount = allIssues.filter(i => i.severity === 'INFO').length

  const result: PreflightResult = {
    ok: errorCount === 0,
    canDownload: errorCount === 0,
    summary: { errorCount, warningCount, infoCount },
    issues: allIssues,
  }

  // 실행 이력 저장
  try {
    await prisma.preflightCheckRun.create({
      data: {
        siteId: ctx.siteId ?? null,
        monthKey: ctx.monthKey,
        templateCode,
        resultSummaryJson: result.summary as never,
        errorCount,
        warningCount,
        infoCount,
        createdBy: actedBy ?? null,
      },
    })
  } catch {
    // 이력 저장 실패해도 결과는 반환
  }

  return result
}
