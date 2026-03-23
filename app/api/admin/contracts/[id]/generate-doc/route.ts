/**
 * POST /api/admin/contracts/[id]/generate-doc
 * 계약 데이터를 기반으로 문서를 생성하고 GeneratedDocument 레코드를 저장
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'
import {
  renderDailyEmploymentContract,
  renderRegularEmploymentContract,
  renderSubcontractBizContract,
  renderNonbizTeamReviewDocs,
  contractToText,
  type ContractData,
} from '@/lib/contracts/templates'
import {
  renderSafetyEducationNewHire,
  renderTaskChangeEducation,
  renderPPEProvision,
  renderSafetyPledge,
  renderSiteAssignment,
  renderWorkConditionChange,
  renderSafetyCouncilMinutes,
  renderSiteInspection,
  renderSubcontractorEducationRecord,
  type SafetyEducationData,
  type PPEProvisionData,
  type SiteAssignmentData,
  type WorkConditionChangeData,
  type SafetyCouncilData,
  type SiteInspectionData,
  type SubcontractorEducationData,
} from '@/lib/contracts/safety-docs'
import {
  renderSubcontractBody as renderSubBody,
  renderScopeAnnex,
  renderPaymentAnnex,
  renderSafetyProtocolAnnex,
  renderDocumentChecklist,
  renderDistributionReference,
  type SubcontractData,
} from '@/lib/contracts/subcontract-docs'
import {
  renderTeamLeaderResponsibility,
  renderTeamScopeConfirmation,
  renderTeamSafetyCompliance,
  renderTeamDistributionSubmission,
  renderReclassificationWarning,
  type TeamLeaderData,
} from '@/lib/contracts/team-docs'

// 계약 DB 레코드를 ContractData로 변환
function contractToTemplateData(
  contract: Record<string, unknown>,
  worker: { name: string; phone?: string | null },
  site: { name: string; address?: string | null } | null,
  today: string,
): ContractData {
  return {
    companyName:    '주식회사 해한', // TODO: 시스템 설정에서 읽기
    companyCeo:     '대표이사',
    companyAddress: '서울특별시',
    workerName:     worker.name,
    workerPhone:    worker.phone || undefined,
    siteName:       site?.name || '미정',
    siteAddress:    (site as Record<string, unknown>)?.address as string | undefined,
    jobTitle:       (contract.notes as string) || '건설일용직',
    startDate:      contract.startDate as string,
    endDate:        contract.endDate as string | undefined,
    checkInTime:    contract.checkInTime as string | undefined,
    checkOutTime:   contract.checkOutTime as string | undefined,
    workDays:       contract.workDays as string | undefined,
    paymentMethod:  contract.paymentMethod as string | undefined,
    dailyWage:      contract.dailyWage as number | undefined,
    monthlySalary:  contract.monthlySalary as number | undefined,
    serviceFee:     contract.serviceFee as number | undefined,
    paymentDay:     contract.paymentDay as number | undefined,
    breakHours:     Number(contract.breakHours) || undefined,
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
  const { docType, extraData = {} } = body as { docType: string; extraData?: Record<string, unknown> }
  if (!docType) return NextResponse.json({ error: 'docType 필수' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const base  = contractToTemplateData(contract as never, contract.worker, contract.site, today)

  let rendered
  try {
    rendered = renderDoc(docType, base, contract as never, extraData, today)
  } catch (e) {
    return NextResponse.json({ error: `문서 렌더링 실패: ${(e as Error).message}` }, { status: 400 })
  }

  const contentText = contractToText(rendered)
  const fileName    = `${rendered.title}_${contract.worker.name}_${today}.txt`

  const doc = await prisma.generatedDocument.create({
    data: {
      workerId:     contract.workerId,
      contractId:   contract.id,
      documentType: docType as never,
      filePath:     '',
      fileName,
      mimeType:     'text/plain',
      contentText,
      contentJson:  rendered as never,
      status:       'DRAFT',
      generatedBy:  session.sub,
    },
  })

  await writeAdminAuditLog({
    adminId:    session.sub,
    actionType: 'DOCUMENT_GENERATE',
    targetType: 'GeneratedDocument',
    targetId:   doc.id,
    description: `문서 생성: ${docType} / ${contract.worker.name}`,
  })

  return NextResponse.json({ success: true, data: { id: doc.id, docType, fileName, contentText } }, { status: 201 })
}

// ─── 문서 타입별 렌더러 디스패치 ─────────────────────────────

function renderDoc(
  docType: string,
  base: ContractData,
  contract: Record<string, unknown>,
  extra: Record<string, unknown>,
  today: string,
) {
  const tmpl = contract.contractTemplateType as string

  switch (docType) {
    // ── 계약서 본문 ──────────────────────────────────────────
    case 'CONTRACT':
    case 'DAILY_CONTRACT':
      if (tmpl === 'REGULAR_EMPLOYMENT')   return renderRegularEmploymentContract(base, false)
      if (tmpl === 'FIXED_TERM_EMPLOYMENT') return renderRegularEmploymentContract(base, true)
      if (tmpl === 'SUBCONTRACT_WITH_BIZ' || tmpl === 'FREELANCER_SERVICE') {
        return renderSubcontractBizContract(base)
      }
      if (tmpl === 'NONBUSINESS_TEAM_REVIEW') {
        return renderNonbizTeamReviewDocs(buildTeamData(base, contract))
      }
      return renderDailyEmploymentContract(base)

    // ── A 패키지 안전 문서 ────────────────────────────────────
    case 'SAFETY_EDUCATION_NEW_HIRE':
      return renderSafetyEducationNewHire({
        ...base,
        educationDate:    (extra.educationDate as string) || today,
        educationHours:   (extra.educationHours as number) || 1,
        educationPlace:   (extra.educationPlace as string) || base.siteName,
        educatorName:     (extra.educatorName as string) || '현장소장',
      } as SafetyEducationData)

    case 'SAFETY_EDUCATION_TASK_CHANGE':
      return renderTaskChangeEducation({
        ...base,
        educationDate:    (extra.educationDate as string) || today,
        educationHours:   (extra.educationHours as number) || 1,
        educationPlace:   (extra.educationPlace as string) || base.siteName,
        educatorName:     (extra.educatorName as string) || '현장소장',
        prevTask:         (extra.prevTask as string) || '이전 작업',
        newTask:          (extra.newTask as string) || base.jobTitle,
      })

    case 'PPE_PROVISION':
      return renderPPEProvision({
        ...base,
        provisionDate: (extra.provisionDate as string) || today,
        workType:      (extra.workType as string) || base.jobTitle,
        ppeItems:      (extra.ppeItems as PPEProvisionData['ppeItems']) || [
          { name: '안전모', standard: 'KCS 산업용', quantity: 1, condition: '신품' },
          { name: '안전화', standard: 'KCS 안전화', quantity: 1, condition: '신품' },
          { name: '안전대', standard: 'KCS 안전대', quantity: 1, condition: '신품' },
        ],
        issuedBy:  (extra.issuedBy as string) || '현장소장',
      } as PPEProvisionData)

    case 'SAFETY_PLEDGE':
      return renderSafetyPledge(base)

    case 'SITE_ASSIGNMENT':
      return renderSiteAssignment({
        ...base,
        prevSiteName:  (extra.prevSiteName as string) || '이전 현장',
        assignDate:    (extra.assignDate as string) || today,
        wageUnchanged: (extra.wageUnchanged as boolean) ?? true,
      } as SiteAssignmentData)

    case 'WORK_CONDITION_CHANGE':
      return renderWorkConditionChange({
        ...base,
        changeDate:   (extra.changeDate as string) || today,
        changeReason: (extra.changeReason as string) || '현장 조건 변경',
        changes:      (extra.changes as WorkConditionChangeData['changes']) || [],
      } as WorkConditionChangeData)

    // ── B 패키지 하도급 문서 ──────────────────────────────────
    case 'SUBCONTRACT_CONTRACT':
      return renderSubBody(buildSubcontractData(base, contract))

    case 'SUBCONTRACT_SCOPE':
      return renderScopeAnnex({
        ...buildSubcontractData(base, contract),
        scopeDetails: (extra.scopeDetails as { section: string; description: string; unit?: string; qty?: number }[]) || [],
      })

    case 'SUBCONTRACT_PAYMENT_TERMS':
      return renderPaymentAnnex({
        ...buildSubcontractData(base, contract),
        milestones:   (extra.milestones as { name: string; ratio: number; condition: string }[]) || [],
        paymentTerms: (extra.paymentTerms as string) || '기성 검수 후 30일 이내',
      })

    case 'SUBCONTRACT_SAFETY_PROTOCOL':
      return renderSafetyProtocolAnnex(buildSubcontractData(base, contract))

    case 'SUBCONTRACT_DOCUMENT_LIST':
      return renderDocumentChecklist(buildSubcontractData(base, contract))

    case 'SUBCONTRACT_DISTRIBUTION_REF':
      return renderDistributionReference(buildSubcontractData(base, contract))

    // ── C 패키지 팀장형 ───────────────────────────────────────
    case 'TEAM_LEADER_RESPONSIBILITY':
      return renderTeamLeaderResponsibility(buildTeamData(base, contract))

    case 'TEAM_SCOPE_CONFIRMATION':
      return renderTeamScopeConfirmation(buildTeamData(base, contract))

    case 'TEAM_SAFETY_COMPLIANCE':
      return renderTeamSafetyCompliance(buildTeamData(base, contract))

    case 'TEAM_DISTRIBUTION_SUBMISSION':
      return renderTeamDistributionSubmission(buildTeamData(base, contract))

    case 'TEAM_RECLASSIFICATION_WARNING':
      return renderReclassificationWarning(buildTeamData(base, contract))

    // ── 안전관리 공통 ─────────────────────────────────────────
    case 'SAFETY_COUNCIL_MINUTES':
      return renderSafetyCouncilMinutes({
        ...base,
        meetingDate:  (extra.meetingDate as string) || today,
        meetingPlace: (extra.meetingPlace as string) || base.siteName,
        attendees:    (extra.attendees as SafetyCouncilData['attendees']) || [],
        agendaItems:  (extra.agendaItems as string[]) || ['작업 안전사항 점검'],
        decisions:    (extra.decisions as string[]) || [],
      } as SafetyCouncilData)

    case 'SITE_INSPECTION_RECORD':
      return renderSiteInspection({
        ...base,
        inspectionDate:    (extra.inspectionDate as string) || today,
        inspectorName:     (extra.inspectorName as string) || '현장소장',
        inspectorPosition: (extra.inspectorPosition as string) || '안전관리자',
        items:             (extra.items as SiteInspectionData['items']) || [],
        overallResult:     (extra.overallResult as '이상없음' | '시정필요' | '즉시중단') || '이상없음',
      } as SiteInspectionData)

    case 'SUBCONTRACTOR_EDUCATION_RECORD':
      return renderSubcontractorEducationRecord({
        ...base,
        educationDate:     (extra.educationDate as string) || today,
        subcontractorName: (extra.subcontractorName as string) || base.contractorName || '수급인',
        subcontractorRep:  (extra.subcontractorRep as string) || base.workerName,
        educationTopic:    (extra.educationTopic as string) || '현장 안전교육',
        educationHours:    (extra.educationHours as number) || 1,
        attendeeCount:     (extra.attendeeCount as number) || 1,
        confirmedBy:       (extra.confirmedBy as string) || '현장소장',
      } as SubcontractorEducationData)

    default:
      throw new Error(`지원하지 않는 docType: ${docType}`)
  }
}

function buildSubcontractData(base: ContractData, contract: Record<string, unknown>): SubcontractData {
  return {
    ...base,
    subcontractorBizNo:   (contract.businessRegistrationNo as string) || '         ',
    subcontractorName:    (contract.contractorName as string) || base.workerName,
    subcontractorCeo:     base.workerName,
    scopeDescription:     (contract.notes as string) || base.jobTitle,
    contractAmount:       (contract.serviceFee as number) || (contract.dailyWage as number) || 0,
    vatIncluded:          false,
    paymentSchedule:      `매월 ${base.paymentDay || '말일'} 기성 정산`,
    equipmentByContractor: true,
    materialByContractor:  false,
  } as SubcontractData
}

function buildTeamData(base: ContractData, contract: Record<string, unknown>): TeamLeaderData {
  return {
    ...base,
    attendanceControlledByCompany: (contract.attendanceControlledByCompany as boolean) ?? false,
    payDecidedByCompany:           (contract.payDecidedByCompany as boolean) ?? false,
    directPaymentByCompany:        (contract.directPaymentByCompany as boolean) ?? false,
  } as TeamLeaderData
}
