import { DocumentTemplateDefinition, PreflightIssue, PreflightContext } from '../types'
import { prisma } from '@/lib/db/prisma'

async function checkRetirementPreflight(ctx: PreflightContext): Promise<PreflightIssue[]> {
  const count = await prisma.retirementMutualMonthlySummary.count({
    where: { monthKey: ctx.monthKey, ...(ctx.siteId ? { siteId: ctx.siteId } : {}) },
  })
  if (count === 0) return [{ severity: 'WARNING', code: 'NO_RETIREMENT_DATA', message: '퇴직공제 요약 데이터가 없습니다.' }]
  return []
}

export const retirementMutualTemplate: DocumentTemplateDefinition = {
  templateCode: 'RETIREMENT_MUTUAL_SUMMARY',
  title: '퇴직공제 요약표',
  fileFormat: 'xlsx',
  fileNamePattern: (ctx) => `${ctx.monthKey}_퇴직공제요약표`,
  columns: [
    { key: '현장명', header: '현장명', required: true, resolver: r => String(r['현장명'] ?? '') },
    { key: '성명', header: '성명', required: true, resolver: r => String(r['성명'] ?? '') },
    { key: '주민번호', header: '주민번호', required: false, resolver: r => String(r['주민번호'] ?? '') },
    { key: '귀속연월', header: '귀속연월', required: true, resolver: r => String(r['귀속연월'] ?? '') },
    { key: '인정일수', header: '인정일수', required: true, resolver: r => Number(r['인정일수'] ?? 0) },
    { key: '인정공수', header: '인정공수', required: true, resolver: r => Number(r['인정공수'] ?? 0) },
    { key: '대상여부', header: '대상여부', required: true, resolver: r => String(r['대상여부'] ?? '') },
    { key: '신고상태', header: '신고상태', required: true, resolver: r => String(r['신고상태'] ?? '') },
  ],
  preflightChecks: [checkRetirementPreflight],
}
