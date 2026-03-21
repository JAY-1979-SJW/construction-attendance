import { DocumentTemplateDefinition, PreflightIssue, PreflightContext } from '../types'
import { prisma } from '@/lib/db/prisma'

async function checkInsurancePreflight(ctx: PreflightContext): Promise<PreflightIssue[]> {
  const count = await prisma.insuranceEligibilitySnapshot.count({ where: { monthKey: ctx.monthKey } })
  if (count === 0) return [{ severity: 'ERROR', code: 'NO_INSURANCE_DATA', message: '보험판정 데이터가 없습니다. 보험판정을 먼저 실행하세요.' }]
  return []
}

export const insuranceReportTemplate: DocumentTemplateDefinition = {
  templateCode: 'INSURANCE_REPORT',
  title: '보험판정표',
  fileFormat: 'xlsx',
  fileNamePattern: (ctx) => `${ctx.monthKey}_보험판정표`,
  columns: [
    { key: '성명', header: '성명', required: true, resolver: r => String(r['성명'] ?? '') },
    { key: '주민번호', header: '주민번호', required: false, resolver: r => String(r['주민번호'] ?? '') },
    { key: '직종', header: '직종', required: false, resolver: r => String(r['직종'] ?? '') },
    { key: '귀속연월', header: '귀속연월', required: true, resolver: r => String(r['귀속연월'] ?? '') },
    { key: '총근무일', header: '총근무일', required: true, resolver: r => Number(r['총근무일'] ?? 0) },
    { key: '총소득', header: '총소득', required: true, resolver: r => Number(r['총소득'] ?? 0) },
    { key: '국민연금', header: '국민연금', required: true, resolver: r => String(r['국민연금'] ?? '') },
    { key: '건강보험', header: '건강보험', required: true, resolver: r => String(r['건강보험'] ?? '') },
    { key: '고용보험', header: '고용보험', required: true, resolver: r => String(r['고용보험'] ?? '') },
    { key: '산재보험', header: '산재보험', required: true, resolver: r => String(r['산재보험'] ?? '') },
  ],
  preflightChecks: [checkInsurancePreflight],
}
