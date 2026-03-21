import { DocumentTemplateDefinition, PreflightIssue, PreflightContext } from '../types'
import { prisma } from '@/lib/db/prisma'

async function checkAttendancePreflight(ctx: PreflightContext): Promise<PreflightIssue[]> {
  const count = await prisma.monthlyWorkConfirmation.count({
    where: { monthKey: ctx.monthKey, confirmationStatus: 'CONFIRMED', ...(ctx.siteId ? { siteId: ctx.siteId } : {}) },
  })
  if (count === 0) return [{ severity: 'ERROR', code: 'NO_DATA', message: '확정된 근무 데이터가 없습니다.' }]
  return []
}

export const monthlyAttendanceTemplate: DocumentTemplateDefinition = {
  templateCode: 'MONTHLY_ATTENDANCE',
  title: '월 출역표',
  fileFormat: 'xlsx',
  fileNamePattern: (ctx) => `${ctx.monthKey}_월출역표`,
  columns: [
    { key: '현장', header: '현장', required: true, resolver: r => String(r['현장'] ?? '') },
    { key: '성명', header: '성명', required: true, resolver: r => String(r['성명'] ?? '') },
    { key: '직종', header: '직종', required: false, resolver: r => String(r['직종'] ?? '') },
    { key: '합계공수', header: '합계공수', required: true, resolver: r => Number(r['합계공수'] ?? 0) },
  ],
  preflightChecks: [checkAttendancePreflight],
}
