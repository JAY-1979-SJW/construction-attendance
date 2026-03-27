/**
 * GET  /api/admin/workers/[id]/safety-documents  — 목록
 * POST /api/admin/workers/[id]/safety-documents  — 신규 생성
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'
import {
  renderSafetyEducationNewHire,
  renderTaskChangeEducation,
  renderPPEProvision,
  renderSafetyPledge,
  renderWorkConditionsReceipt,
  renderPrivacyConsent,
  renderBasicSafetyEduConfirm,
  renderSiteSafetyRulesConfirm,
  renderHealthDeclaration,
  renderHealthCertificate,
  type PPEItem,
} from '@/lib/contracts/safety-docs'

type PPECondition = PPEItem['condition']
import { contractToText } from '@/lib/contracts/templates'

const SAFETY_DOC_TYPES = [
  'SAFETY_EDUCATION_NEW_HIRE',
  'SAFETY_EDUCATION_TASK_CHANGE',
  'PPE_PROVISION',
  'SAFETY_PLEDGE',
  'WORK_CONDITIONS_RECEIPT',
  'PRIVACY_CONSENT',
  'BASIC_SAFETY_EDU_CONFIRM',
  'SITE_SAFETY_RULES_CONFIRM',
  'HEALTH_DECLARATION',
  'HEALTH_CERTIFICATE',
] as const

type SafetyDocType = typeof SAFETY_DOC_TYPES[number]

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const siteId     = searchParams.get('siteId') || undefined
  const docType    = searchParams.get('docType') || undefined
  const contractId = searchParams.get('contractId') || undefined

  const docs = await prisma.safetyDocument.findMany({
    where: {
      workerId:     params.id,
      ...(siteId     && { siteId }),
      ...(docType    && { documentType: docType as SafetyDocType }),
      ...(contractId && { contractId }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      site: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ success: true, data: docs })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const worker = await prisma.worker.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, phone: true },
  })
  if (!worker) return NextResponse.json({ error: '근로자 없음' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const {
    documentType,
    siteId,
    contractId,
    documentDate,
    educationDate,
    educationHours,
    educationPlace,
    educatorName,
    educationItems,
    prevTask,
    newTask,
    issuedItemsJson,
    issuedBy,
    ppeItems,
    // v3.6 신규 문서용
    workDate,
    tradeType,
    jobType,
    workPlace,
    managerName,
    specialSafetyRules,
    eduCompletedYn,
    eduCompletedDate,
    eduOrganization,
    eduCertConfirmedYn,
    eduCertConfirmedDate,
    confirmerName,
  } = body as {
    documentType: SafetyDocType
    siteId?: string
    contractId?: string
    documentDate?: string
    educationDate?: string
    educationHours?: number
    educationPlace?: string
    educatorName?: string
    educationItems?: { item: string; checked: boolean }[]
    prevTask?: string
    newTask?: string
    issuedItemsJson?: { name: string; standard?: string; quantity: number; condition: '신품' | '재사용' }[]
    issuedBy?: string
    ppeItems?: { name: string; qty: number; condition: string; issued: boolean; explanationGiven?: boolean; needsReplacement?: boolean; note?: string }[]
    workDate?: string
    tradeType?: string
    jobType?: string
    workPlace?: string
    managerName?: string
    specialSafetyRules?: string
    eduCompletedYn?: boolean
    eduCompletedDate?: string
    eduOrganization?: string
    eduCertConfirmedYn?: boolean
    eduCertConfirmedDate?: string
    confirmerName?: string
  }

  if (!documentType || !SAFETY_DOC_TYPES.includes(documentType)) {
    return NextResponse.json({ error: '올바른 documentType 필요' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // 사이트 정보 조회
  const site = siteId ? await prisma.site.findUnique({ where: { id: siteId } }) : null

  // 기본 데이터 구성
  const baseData = {
    companyName: '주식회사 해한',
    companyCeo: '대표이사',
    companyAddress: '서울특별시',
    workerName: worker.name,
    workerPhone: worker.phone || undefined,
    siteName: site?.name || '현장',
    jobTitle: '건설일용직',
    startDate: today,
    contractDate: today,
    nationalPensionYn: false,
    healthInsuranceYn: false,
    employmentInsuranceYn: false,
    industrialAccidentYn: true,
    retirementMutualYn: false,
    safetyClauseYn: true,
  }

  // 문서 렌더링
  let rendered
  const eduDate = educationDate || documentDate || today
  const eduHours = educationHours || 1
  const eduPlace = educationPlace || site?.name || '현장'
  const educator = educatorName || '현장소장'

  switch (documentType) {
    case 'SAFETY_EDUCATION_NEW_HIRE':
      rendered = renderSafetyEducationNewHire({
        ...baseData,
        educationDate: eduDate,
        educationHours: eduHours,
        educationPlace: eduPlace,
        educatorName: educator,
      })
      break

    case 'SAFETY_EDUCATION_TASK_CHANGE':
      rendered = renderTaskChangeEducation({
        ...baseData,
        educationDate: eduDate,
        educationHours: eduHours,
        educationPlace: eduPlace,
        educatorName: educator,
        prevTask: prevTask || '이전 작업',
        newTask: newTask || '변경 작업',
      })
      break

    case 'PPE_PROVISION': {
      let resolvedItems: PPEItem[]
      if (ppeItems) {
        resolvedItems = ppeItems.filter(it => it.issued).map(it => ({
          name: it.name,
          quantity: it.qty,
          condition: (['신품', '양호', '재사용', '기타'].includes(it.condition) ? it.condition : '신품') as PPECondition,
          issued: true as const,
          explanationGiven: it.explanationGiven,
          needsReplacement: it.needsReplacement,
          note: it.note,
        }))
      } else if (issuedItemsJson) {
        resolvedItems = issuedItemsJson.map(it => ({
          ...it,
          issued: true as const,
          condition: it.condition as PPECondition,
        }))
      } else {
        resolvedItems = [
          { name: '안전모', quantity: 1, condition: '신품' as PPECondition, issued: true },
          { name: '안전화', quantity: 1, condition: '신품' as PPECondition, issued: true },
        ]
      }
      rendered = renderPPEProvision({
        ...baseData,
        provisionDate: documentDate || today,
        workType: '건설일용직',
        ppeItems: resolvedItems,
        issuedBy: issuedBy || educator,
      })
      break
    }

    case 'SAFETY_PLEDGE':
      rendered = renderSafetyPledge(baseData)
      break

    case 'WORK_CONDITIONS_RECEIPT':
      rendered = renderWorkConditionsReceipt({
        ...baseData,
        workDate: workDate || documentDate || today,
        tradeType,
        jobType,
        workPlace: workPlace || site?.name,
        managerName,
      })
      break

    case 'PRIVACY_CONSENT':
      rendered = renderPrivacyConsent(baseData)
      break

    case 'BASIC_SAFETY_EDU_CONFIRM':
      rendered = renderBasicSafetyEduConfirm({
        ...baseData,
        workDate: workDate || documentDate || today,
        eduCompletedYn,
        eduCompletedDate,
        eduOrganization,
        eduCertConfirmedYn,
        eduCertConfirmedDate,
        confirmerName: confirmerName || educator,
      })
      break

    case 'SITE_SAFETY_RULES_CONFIRM':
      rendered = renderSiteSafetyRulesConfirm({
        ...baseData,
        workDate: workDate || documentDate || today,
        specialSafetyRules,
        confirmerName: confirmerName || educator,
      })
      break

    case 'HEALTH_DECLARATION':
      rendered = renderHealthDeclaration({
        ...baseData,
        declarationDate: documentDate || today,
        managerName: educatorName || '현장소장',
      })
      break

    case 'HEALTH_CERTIFICATE':
      rendered = renderHealthCertificate({
        ...baseData,
        certificateDate: documentDate || today,
        managerName: educatorName || '현장소장',
      })
      break
  }

  const contentText = rendered ? contractToText(rendered) : null

  // 동일 documentType의 최신 REJECTED 문서 검색 → previousDocId 연결
  const rejectedPrev = await prisma.safetyDocument.findFirst({
    where: { workerId: params.id, documentType: documentType as never, status: 'REJECTED' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  const doc = await prisma.safetyDocument.create({
    data: {
      workerId:       params.id,
      siteId:         siteId || null,
      contractId:     contractId || null,
      documentType:   documentType as never,
      status:         'DRAFT',
      previousDocId:  rejectedPrev?.id || null,
      documentDate:   documentDate || today,
      educationDate:  educationDate || null,
      educationHours: educationHours ? String(educationHours) as never : null,
      educationPlace: educationPlace || null,
      educatorName:   educatorName || null,
      educationItems: (educationItems || null) as never,
      prevTask:       prevTask || null,
      newTask:        newTask || null,
      issuedItemsJson: (issuedItemsJson || null) as never,
      issuedBy:       issuedBy || null,
      contentText,
      contentJson:    rendered as never,
      createdBy:      session.sub,
    },
  })

  await writeAdminAuditLog({
    adminId: session.sub,
    actionType: 'SAFETY_DOC_CREATE',
    targetType: 'SafetyDocument',
    targetId:   doc.id,
    description: `안전문서 생성: ${documentType} / ${worker.name}`,
  })

  return NextResponse.json({ success: true, data: doc }, { status: 201 })
}
