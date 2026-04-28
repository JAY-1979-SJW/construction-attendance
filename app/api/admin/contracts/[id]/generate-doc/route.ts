/**
 * POST /api/admin/contracts/[id]/generate-doc
 * 계약 데이터를 기반으로 문서를 생성하고 GeneratedDocument 레코드를 저장
 *
 * 데이터 소스 원칙:
 *   - resolveContractDocumentData 를 단일 원천으로 사용 (generate-pdf와 동일 resolver)
 *   - workerName / workerPhone 은 ContractVersion.snapshotJson 우선 (snapshot-first)
 *   - CONTRACT / DAILY_CONTRACT 타입에 위험 문구 검사 적용 (generate-pdf와 동일 기준)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
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
  renderWorkConditionsReceipt,
  renderWorkConditionsReceiptRegular,
  renderPrivacyConsent,
  renderBasicSafetyEduConfirm,
  renderSiteSafetyRulesConfirm,
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
import {
  validateDailyContractDangerPhrases,
  extractContractText,
} from '@/lib/contracts/validate-contract'
import { DANGER_PHRASE_APPLICABLE_TEMPLATES } from '@/lib/policies/contract-policy'
import { resolveContractDocumentData } from '@/lib/contracts/resolve-document-data'

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
  if (contract.siteId && !await canAccessSite(session, contract.siteId)) return siteAccessDenied()

  const body = await req.json().catch(() => ({}))
  const { docType, extraData = {} } = body as { docType: string; extraData?: Record<string, unknown> }
  if (!docType) return NextResponse.json({ error: 'docType 필수' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)

  // 버전 스냅샷 조회 — workerName/workerPhone 불변성 보장 (generate-pdf와 동일 원칙)
  const existingSnap = await prisma.contractVersion.findUnique({
    where: { contractId_versionNo: { contractId: params.id, versionNo: contract.currentVersion } },
    select: { snapshotJson: true },
  })

  // 공통 resolver — PDF / DOC / 화면 모두 동일한 원천
  const base = resolveContractDocumentData(
    contract as never,
    contract.worker,
    contract.site,
    existingSnap?.snapshotJson ?? null,
    today,
  )

  let rendered
  try {
    rendered = renderDoc(docType, base, contract as never, extraData, today)
  } catch (e) {
    return NextResponse.json({ error: `문서 렌더링 실패: ${(e as Error).message}` }, { status: 400 })
  }

  // 위험 문구 검출 — CONTRACT / DAILY_CONTRACT 타입에 한해 generate-pdf와 동일 기준 적용
  const tmpl = (contract as never as Record<string, unknown>).contractTemplateType as string
  const isContractDoc = docType === 'CONTRACT' || docType === 'DAILY_CONTRACT'
  const dangerCheck = isContractDoc && DANGER_PHRASE_APPLICABLE_TEMPLATES.includes(tmpl)
    ? validateDailyContractDangerPhrases(extractContractText(rendered))
    : { hasDanger: false, matches: [] }

  const contentText = contractToText(rendered)
  // 파일명도 snapshot 기준 이름 사용 (base.workerName = snapshot-first 해소된 값)
  const fileName = `${rendered.title}_${base.workerName}_${today}.txt`

  // docType 'CONTRACT' → DB enum 매핑 (GeneratedDocumentType에 CONTRACT가 없음)
  const resolvedDocType = resolveDocumentType(docType, tmpl)

  let doc
  try {
    doc = await prisma.generatedDocument.create({
      data: {
        workerId:     contract.workerId,
        contractId:   contract.id,
        documentType: resolvedDocType as never,
        filePath:     '',
        fileName,
        mimeType:     'text/plain',
        contentText,
        contentJson:  rendered as never,
        status:       'DRAFT',
        generatedBy:  session.sub,
      },
    })
  } catch (dbErr) {
    console.error('[generate-doc] DB 저장 실패:', dbErr)
    return NextResponse.json({ error: `문서 DB 저장 실패: ${(dbErr as Error).message}` }, { status: 500 })
  }

  void writeAuditLog({
    actorUserId: session.sub, actorType: 'ADMIN',
    actionType: 'DOCUMENT_GENERATE',
    targetType: 'GeneratedDocument',
    targetId:   doc.id,
    summary: `문서 생성: ${docType} / ${base.workerName}`,
  })

  return NextResponse.json({
    success: true,
    data: {
      id: doc.id,
      docType,
      fileName,
      contentText,
      // 일용직 계약서 위험 문구 경고 (있으면 관리자 수동 검수 필요)
      ...(dangerCheck.hasDanger ? {
        warnings: dangerCheck.matches.map(m => `[위험문구] "${m.phrase}" 발견: ${m.context}`),
      } : {}),
    },
  }, { status: 201 })
}

// ─── 문서 타입별 렌더러 디스패치 ─────────────────────────────

function renderDoc(
  docType:  string,
  base:     ContractData,
  contract: Record<string, unknown>,
  extra:    Record<string, unknown>,
  today:    string,
) {
  const tmpl = contract.contractTemplateType as string

  switch (docType) {
    // ── 계약서 본문 ──────────────────────────────────────────
    case 'CONTRACT':
    case 'DAILY_CONTRACT':
      if (tmpl === 'REGULAR_EMPLOYMENT' || tmpl === 'CONTINUOUS_EMPLOYMENT')
        return renderRegularEmploymentContract(base, false)
      if (tmpl === 'FIXED_TERM_EMPLOYMENT' || tmpl === 'MONTHLY_FIXED_EMPLOYMENT')
        return renderRegularEmploymentContract(base, true)
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
        educationDate:  (extra.educationDate  as string) || today,
        educationHours: (extra.educationHours as number) || 1,
        educationPlace: (extra.educationPlace as string) || base.siteName,
        educatorName:   (extra.educatorName   as string) || '현장소장',
      } as SafetyEducationData)

    case 'SAFETY_EDUCATION_TASK_CHANGE':
      return renderTaskChangeEducation({
        ...base,
        educationDate:  (extra.educationDate  as string) || today,
        educationHours: (extra.educationHours as number) || 1,
        educationPlace: (extra.educationPlace as string) || base.siteName,
        educatorName:   (extra.educatorName   as string) || '현장소장',
        prevTask:       (extra.prevTask        as string) || '이전 작업',
        newTask:        (extra.newTask         as string) || base.jobTitle,
      })

    case 'PPE_PROVISION':
      return renderPPEProvision({
        ...base,
        provisionDate: (extra.provisionDate as string) || today,
        workType:      (extra.workType      as string) || base.jobTitle,
        ppeItems:      (extra.ppeItems as PPEProvisionData['ppeItems']) || [
          { name: '안전모', standard: 'KCS 산업용', quantity: 1, condition: '신품' },
          { name: '안전화', standard: 'KCS 안전화', quantity: 1, condition: '신품' },
          { name: '안전대', standard: 'KCS 안전대', quantity: 1, condition: '신품' },
        ],
        issuedBy: (extra.issuedBy as string) || '현장소장',
      } as PPEProvisionData)

    case 'SAFETY_PLEDGE':
      return renderSafetyPledge(base)

    case 'SITE_ASSIGNMENT':
      return renderSiteAssignment({
        ...base,
        prevSiteName:  (extra.prevSiteName  as string)  || '이전 현장',
        assignDate:    (extra.assignDate    as string)  || today,
        wageUnchanged: (extra.wageUnchanged as boolean) ?? true,
      } as SiteAssignmentData)

    case 'WORK_CONDITION_CHANGE':
      return renderWorkConditionChange({
        ...base,
        changeDate:   (extra.changeDate   as string) || today,
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
        milestones:   (extra.milestones   as { name: string; ratio: number; condition: string }[]) || [],
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

    // ── 안전·동의 문서 (일용직/상용직 분기) ─────────────────────
    case 'WORK_CONDITIONS_RECEIPT_REGULAR':
      return renderWorkConditionsReceiptRegular({
        ...base,
        managerName:     (extra.managerName     as string)  || base.managerName,
        probationYn:     (base as ContractData).probationYn,
        probationMonths: (base as ContractData).probationMonths,
        annualLeaveRule: (base as ContractData).annualLeaveRule,
      })

    case 'WORK_CONDITIONS_RECEIPT':
      return renderWorkConditionsReceipt({
        ...base,
        workDate:            (extra.workDate            as string) || base.workDate,
        tradeType:           (extra.tradeType           as string) || undefined,
        jobType:             (extra.jobType             as string) || undefined,
        workPlace:           (extra.workPlace           as string) || undefined,
        managerName:         (extra.managerName         as string) || base.managerName,
        workerBankName:      (extra.workerBankName      as string) || base.workerBankName,
        workerAccountNumber: (extra.workerAccountNumber as string) || base.workerAccountNumber,
        workerAccountHolder: (extra.workerAccountHolder as string) || base.workerAccountHolder,
      })

    case 'PRIVACY_CONSENT':
      return renderPrivacyConsent(base)

    case 'BASIC_SAFETY_EDU_CONFIRM':
      return renderBasicSafetyEduConfirm({
        ...base,
        workDate:             (extra.workDate             as string)  || base.workDate,
        eduCompletedYn:       (extra.eduCompletedYn       as boolean) ?? false,
        eduCompletedDate:     (extra.eduCompletedDate     as string)  || undefined,
        eduOrganization:      (extra.eduOrganization      as string)  || undefined,
        eduCertConfirmedYn:   (extra.eduCertConfirmedYn   as boolean) ?? false,
        eduCertConfirmedDate: (extra.eduCertConfirmedDate as string)  || undefined,
        confirmerName:        (extra.confirmerName        as string)  || base.managerName,
      })

    case 'SITE_SAFETY_RULES_CONFIRM':
      return renderSiteSafetyRulesConfirm({
        ...base,
        workDate:           (extra.workDate           as string) || base.workDate,
        specialSafetyRules: (extra.specialSafetyRules as string) || undefined,
        confirmerName:      (extra.confirmerName      as string) || base.managerName,
      })

    // ── 안전관리 공통 ─────────────────────────────────────────
    case 'SAFETY_COUNCIL_MINUTES':
      return renderSafetyCouncilMinutes({
        ...base,
        meetingDate:  (extra.meetingDate  as string) || today,
        meetingPlace: (extra.meetingPlace as string) || base.siteName,
        attendees:    (extra.attendees    as SafetyCouncilData['attendees']) || [],
        agendaItems:  (extra.agendaItems  as string[]) || ['작업 안전사항 점검'],
        decisions:    (extra.decisions    as string[]) || [],
      } as SafetyCouncilData)

    case 'SITE_INSPECTION_RECORD':
      return renderSiteInspection({
        ...base,
        inspectionDate:    (extra.inspectionDate    as string) || today,
        inspectorName:     (extra.inspectorName     as string) || '현장소장',
        inspectorPosition: (extra.inspectorPosition as string) || '안전관리자',
        items:             (extra.items             as SiteInspectionData['items']) || [],
        overallResult:     (extra.overallResult     as '이상없음' | '시정필요' | '즉시중단') || '이상없음',
      } as SiteInspectionData)

    case 'SUBCONTRACTOR_EDUCATION_RECORD':
      return renderSubcontractorEducationRecord({
        ...base,
        educationDate:     (extra.educationDate     as string) || today,
        subcontractorName: (extra.subcontractorName as string) || base.contractorName || '수급인',
        subcontractorRep:  (extra.subcontractorRep  as string) || base.workerName,
        educationTopic:    (extra.educationTopic    as string) || '현장 안전교육',
        educationHours:    (extra.educationHours    as number) || 1,
        attendeeCount:     (extra.attendeeCount     as number) || 1,
        confirmedBy:       (extra.confirmedBy       as string) || '현장소장',
      } as SubcontractorEducationData)

    default:
      throw new Error(`지원하지 않는 docType: ${docType}`)
  }
}

function buildSubcontractData(base: ContractData, contract: Record<string, unknown>): SubcontractData {
  return {
    ...base,
    subcontractorBizNo:    (contract.businessRegistrationNo as string) || '         ',
    subcontractorName:     (contract.contractorName         as string) || base.workerName,
    subcontractorCeo:      base.workerName,
    scopeDescription:      (contract.notes                  as string) || base.jobTitle,
    contractAmount:        (contract.serviceFee             as number) || (contract.dailyWage as number) || 0,
    vatIncluded:           false,
    paymentSchedule:       `매월 ${base.paymentDay || '말일'} 기성 정산`,
    equipmentByContractor: true,
    materialByContractor:  false,
  } as SubcontractData
}

/**
 * docType 'CONTRACT' → DB GeneratedDocumentType enum 매핑
 * DB enum에 CONTRACT가 없으므로 contractTemplateType에 따라 분기
 */
function resolveDocumentType(docType: string, tmpl: string): string {
  if (docType !== 'CONTRACT') return docType
  if (tmpl === 'DAILY_EMPLOYMENT') return 'DAILY_CONTRACT'
  if (tmpl === 'SUBCONTRACT_WITH_BIZ' || tmpl === 'FREELANCER_SERVICE') return 'SERVICE_CONTRACT'
  return 'REGULAR_CONTRACT'
}

function buildTeamData(base: ContractData, contract: Record<string, unknown>): TeamLeaderData {
  return {
    ...base,
    attendanceControlledByCompany: (contract.attendanceControlledByCompany as boolean) ?? false,
    payDecidedByCompany:           (contract.payDecidedByCompany           as boolean) ?? false,
    directPaymentByCompany:        (contract.directPaymentByCompany        as boolean) ?? false,
  } as TeamLeaderData
}
