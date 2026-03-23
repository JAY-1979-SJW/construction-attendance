/**
 * POST /api/admin/contracts/[id]/generate-pdf
 * 계약서 PDF(HTML) 생성 → GeneratedDocument 저장 + 버전 스냅샷 연결
 * 현재는 HTML 텍스트 기반 생성 (인쇄/다운로드용)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'
import {
  renderDailyEmploymentContract,
  renderRegularEmploymentContract,
  renderMonthlyFixedContract,
  renderContinuousContract,
  renderSubcontractBizContract,
  renderNonbizTeamReviewDocs,
  contractToText,
  type ContractData,
} from '@/lib/contracts/templates'

function buildContractData(
  contract: Record<string, unknown>,
  worker: { name: string; phone?: string | null },
  site: { name: string; address?: string | null } | null,
  today: string,
): ContractData {
  return {
    companyName:    (contract.companyName as string) || '주식회사 해한',
    companyCeo:     (contract.companyRepName as string) || '대표이사',
    companyAddress: (contract.companyAddress as string) || '서울특별시',
    companyBizNo:   contract.companyBizNo as string | undefined,
    workerName:     worker.name,
    workerPhone:    worker.phone || undefined,
    workerBirthDate: contract.workerBirthDate as string | undefined,
    workerAddress:  contract.workerAddress as string | undefined,
    siteName:       site?.name || (contract.siteName as string) || '미정',
    siteAddress:    site?.address as string | undefined,
    jobTitle:       (contract.notes as string) || '건설일용직',
    startDate:      contract.startDate as string,
    endDate:        contract.endDate as string | undefined,
    checkInTime:    contract.checkInTime as string | undefined,
    checkOutTime:   contract.checkOutTime as string | undefined,
    breakStartTime: contract.breakStartTime as string | undefined,
    breakEndTime:   contract.breakEndTime as string | undefined,
    workDays:       contract.workDays as string | undefined,
    weeklyWorkDays: contract.weeklyWorkDays as number | undefined,
    weeklyWorkHours: contract.weeklyWorkHours ? Number(contract.weeklyWorkHours) : undefined,
    breakHours:     Number(contract.breakHours) || undefined,
    holidayRule:    contract.holidayRule as string | undefined,
    annualLeaveRule: contract.annualLeaveRule as string | undefined,
    paymentMethod:  contract.paymentMethod as string | undefined,
    dailyWage:      contract.dailyWage as number | undefined,
    monthlySalary:  contract.monthlySalary as number | undefined,
    serviceFee:     contract.serviceFee as number | undefined,
    paymentDay:     contract.paymentDay as number | undefined,
    allowanceJson:  contract.allowanceJson as { name: string; amount: number }[] | undefined,
    probationYn:    contract.probationYn as boolean | undefined,
    probationMonths: contract.probationMonths as number | undefined,
    attendanceVerificationMethod: contract.attendanceVerificationMethod as string | undefined,
    workUnitRule:   contract.workUnitRule as string | undefined,
    rainDayRule:    contract.rainDayRule as string | undefined,
    siteStopRule:   contract.siteStopRule as string | undefined,
    siteChangeAllowed: contract.siteChangeAllowed as boolean | undefined,
    businessRegistrationNo: contract.businessRegistrationNo as string | undefined,
    contractorName: contract.contractorName as string | undefined,
    nationalPensionYn:     (contract.nationalPensionYn as boolean) ?? false,
    healthInsuranceYn:     (contract.healthInsuranceYn as boolean) ?? false,
    employmentInsuranceYn: (contract.employmentInsuranceYn as boolean) ?? false,
    industrialAccidentYn:  (contract.industrialAccidentYn as boolean) ?? true,
    retirementMutualYn:    (contract.retirementMutualYn as boolean) ?? false,
    safetyClauseYn:        (contract.safetyClauseYn as boolean) ?? true,
    specialTerms:          contract.specialTerms as string | undefined,
    contractDate:          today,
    // v3.4
    projectName:           contract.projectName as string | undefined,
    workType:              contract.workType as string | undefined,
    workTypeSub:           contract.workTypeSub as string | undefined,
    jobCategory:           contract.jobCategory as string | undefined,
    jobCategorySub:        contract.jobCategorySub as string | undefined,
    contractForm:          contract.contractForm as string | undefined,
    taskDescription:       contract.taskDescription as string | undefined,
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const contract = await prisma.workerContract.findUnique({
    where: { id: params.id },
    include: {
      worker: { select: { id: true, name: true, phone: true } },
      site:   { select: { id: true, name: true, address: true } },
    },
  })
  if (!contract) return NextResponse.json({ error: '계약 없음' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { docVariant = 'DRAFT' } = body as { docVariant?: 'DRAFT' | 'SIGNED' | 'DELIVERED' }

  const today = new Date().toISOString().slice(0, 10)
  const base  = buildContractData(contract as never, contract.worker, contract.site, today)
  const tmpl  = (contract as never as Record<string, unknown>).contractTemplateType as string

  let rendered
  if (tmpl === 'REGULAR_EMPLOYMENT')         rendered = renderRegularEmploymentContract(base, false)
  else if (tmpl === 'FIXED_TERM_EMPLOYMENT') rendered = renderRegularEmploymentContract(base, true)
  else if (tmpl === 'MONTHLY_FIXED_EMPLOYMENT') rendered = renderMonthlyFixedContract(base)
  else if (tmpl === 'CONTINUOUS_EMPLOYMENT') rendered = renderContinuousContract(base)
  else if (tmpl === 'SUBCONTRACT_WITH_BIZ') rendered = renderSubcontractBizContract(base)
  else if (tmpl === 'NONBUSINESS_TEAM_REVIEW') rendered = renderNonbizTeamReviewDocs(base)
  else rendered = renderDailyEmploymentContract(base)

  const contentText = contractToText(rendered)
  const fileName    = `${rendered.title}_${contract.worker.name}_${today}_v${contract.currentVersion}.txt`

  const doc = await prisma.generatedDocument.create({
    data: {
      workerId:     contract.workerId,
      contractId:   contract.id,
      documentType: 'DAILY_CONTRACT' as never,
      filePath:     '',
      fileName,
      mimeType:     'text/plain',
      contentText,
      contentJson:  rendered as never,
      status:       docVariant === 'SIGNED' ? 'SIGNED' : 'DRAFT',
      generatedBy:  session.sub,
    },
  })

  // 버전 스냅샷 생성 또는 업데이트
  const existingVersion = await prisma.contractVersion.findUnique({
    where: { contractId_versionNo: { contractId: params.id, versionNo: contract.currentVersion } },
  })

  if (!existingVersion) {
    await prisma.contractVersion.create({
      data: {
        contractId:  params.id,
        versionNo:   contract.currentVersion,
        snapshotJson: contract as never,
        draftDocId:  doc.id,
        createdBy:   session.sub,
      },
    })
  } else if (docVariant === 'DRAFT') {
    await prisma.contractVersion.update({
      where: { contractId_versionNo: { contractId: params.id, versionNo: contract.currentVersion } },
      data: { draftDocId: doc.id },
    })
  } else if (docVariant === 'SIGNED') {
    await prisma.contractVersion.update({
      where: { contractId_versionNo: { contractId: params.id, versionNo: contract.currentVersion } },
      data: { signedDocId: doc.id },
    })
  }

  await writeAdminAuditLog({
    adminId: session.sub,
    actionType: 'DOCUMENT_GENERATE',
    targetType: 'WorkerContract',
    targetId:   params.id,
    description: `계약서 PDF 생성: ${rendered.title} / ${contract.worker.name} / v${contract.currentVersion}`,
  })

  return NextResponse.json({
    success: true,
    data: { id: doc.id, fileName, contentText },
  }, { status: 201 })
}
