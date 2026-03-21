import { DocumentTemplateDefinition, PreflightIssue, PreflightContext } from '../types'
import { prisma } from '@/lib/db/prisma'

async function checkTaxPreflight(ctx: PreflightContext): Promise<PreflightIssue[]> {
  const count = await prisma.withholdingCalculation.count({ where: { monthKey: ctx.monthKey } })
  if (count === 0) return [{ severity: 'ERROR', code: 'NO_TAX_DATA', message: '세금계산 데이터가 없습니다. 세금계산을 먼저 실행하세요.' }]
  return []
}

export const taxReportTemplate: DocumentTemplateDefinition = {
  templateCode: 'TAX_REPORT',
  title: '세금계산표',
  fileFormat: 'xlsx',
  fileNamePattern: (ctx) => `${ctx.monthKey}_세금계산표`,
  columns: [
    { key: '성명', header: '성명', required: true, resolver: r => String(r['성명'] ?? '') },
    { key: '주민번호', header: '주민번호', required: false, resolver: r => String(r['주민번호'] ?? '') },
    { key: '귀속연월', header: '귀속연월', required: true, resolver: r => String(r['귀속연월'] ?? '') },
    { key: '소득유형', header: '소득유형', required: true, resolver: r => String(r['소득유형'] ?? '') },
    { key: '지급총액', header: '지급총액', required: true, resolver: r => Number(r['지급총액'] ?? 0) },
    { key: '비과세', header: '비과세액', required: false, resolver: r => Number(r['비과세'] ?? 0) },
    { key: '과세소득', header: '과세소득', required: true, resolver: r => Number(r['과세소득'] ?? 0) },
    { key: '소득세', header: '소득세', required: true, resolver: r => Number(r['소득세'] ?? 0) },
    { key: '지방소득세', header: '지방소득세', required: true, resolver: r => Number(r['지방소득세'] ?? 0) },
    { key: '합계세액', header: '합계세액', required: true, resolver: r => Number(r['합계세액'] ?? 0) },
  ],
  preflightChecks: [checkTaxPreflight],
}
