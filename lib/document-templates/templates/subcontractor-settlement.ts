import { DocumentTemplateDefinition, PreflightIssue, PreflightContext } from '../types'
import { prisma } from '@/lib/db/prisma'

async function checkSettlementPreflight(ctx: PreflightContext): Promise<PreflightIssue[]> {
  const issues: PreflightIssue[] = []
  if (!ctx.siteId && !ctx.companyId) {
    issues.push({ severity: 'WARNING', code: 'NO_FILTER', message: '현장 또는 협력사를 선택하면 더 정확한 정산서를 출력할 수 있습니다.' })
  }
  const count = await prisma.companySettlement.count({
    where: {
      monthKey: ctx.monthKey,
      ...(ctx.siteId ? { siteId: ctx.siteId } : {}),
      ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
    },
  })
  if (count === 0) {
    issues.push({ severity: 'ERROR', code: 'NO_SETTLEMENT_DATA', message: '협력사 정산 데이터가 없습니다. 정산을 먼저 실행하세요.' })
  }
  return issues
}

export const subcontractorSettlementTemplate: DocumentTemplateDefinition = {
  templateCode: 'SUBCONTRACTOR_SETTLEMENT',
  title: '협력사 정산서',
  fileFormat: 'xlsx',
  fileNamePattern: (ctx) => `${ctx.monthKey}_협력사정산서`,
  columns: [
    { key: '현장명', header: '현장명', required: true, resolver: r => String(r['현장명'] ?? '') },
    { key: '협력사명', header: '협력사명', required: true, resolver: r => String(r['협력사명'] ?? '') },
    { key: '사업자번호', header: '사업자번호', required: false, resolver: r => String(r['사업자번호'] ?? '') },
    { key: '귀속연월', header: '귀속연월', required: true, resolver: r => String(r['귀속연월'] ?? '') },
    { key: '투입인원', header: '투입인원', required: true, resolver: r => Number(r['투입인원'] ?? 0) },
    { key: '확정공수', header: '확정공수', required: true, resolver: r => Number(r['확정공수'] ?? 0) },
    { key: '지급총액', header: '지급총액', required: true, resolver: r => Number(r['지급총액'] ?? 0) },
    { key: '원천세', header: '원천세', required: true, resolver: r => Number(r['원천세'] ?? 0) },
    { key: '최종지급예정액', header: '최종지급예정액', required: true, resolver: r => Number(r['최종지급예정액'] ?? 0) },
  ],
  preflightChecks: [checkSettlementPreflight],
}
