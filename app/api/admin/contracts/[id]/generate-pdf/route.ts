/**
 * POST /api/admin/contracts/[id]/generate-pdf
 * 계약서 PDF(HTML) 생성 → GeneratedDocument 저장 + 버전 스냅샷 연결
 * 현재는 HTML 텍스트 기반 생성 (인쇄/다운로드용)
 *
 * 데이터 소스 원칙:
 *   - resolveContractDocumentData 를 단일 원천으로 사용
 *   - workerName / workerPhone 은 ContractVersion.snapshotJson 우선 (snapshot-first)
 *   - 그 외 계약 필드는 계약 레코드 자체가 버전별 원천
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, canAccessSite, siteAccessDenied } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'
import {
  renderDailyEmploymentContract,
  renderRegularEmploymentContract,
  renderMonthlyFixedContract,
  renderContinuousContract,
  renderSubcontractBizContract,
  renderNonbizTeamReviewDocs,
  contractToText,
} from '@/lib/contracts/templates'
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
  const { docVariant = 'DRAFT' } = body as { docVariant?: 'DRAFT' | 'SIGNED' | 'DELIVERED' }

  const today = new Date().toISOString().slice(0, 10)

  // 버전 스냅샷 조회 — workerName/workerPhone 불변성 보장 (snapshot-first 원칙)
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

  const tmpl = (contract as never as Record<string, unknown>).contractTemplateType as string

  let rendered
  if (tmpl === 'REGULAR_EMPLOYMENT')            rendered = renderRegularEmploymentContract(base, false)
  else if (tmpl === 'FIXED_TERM_EMPLOYMENT')    rendered = renderRegularEmploymentContract(base, true)
  else if (tmpl === 'MONTHLY_FIXED_EMPLOYMENT') rendered = renderMonthlyFixedContract(base)
  else if (tmpl === 'CONTINUOUS_EMPLOYMENT')    rendered = renderContinuousContract(base)
  else if (tmpl === 'SUBCONTRACT_WITH_BIZ')     rendered = renderSubcontractBizContract(base)
  else if (tmpl === 'NONBUSINESS_TEAM_REVIEW')  rendered = renderNonbizTeamReviewDocs(base)
  else                                          rendered = renderDailyEmploymentContract(base)

  // 위험 문구 검출 — 적용 대상 계약 유형은 contract-policy에서 관리
  // DANGER_PHRASE_MODE = 'ADVISORY': 경고만 반환, 생성 차단 없음
  const dangerCheck = DANGER_PHRASE_APPLICABLE_TEMPLATES.includes(tmpl)
    ? validateDailyContractDangerPhrases(extractContractText(rendered))
    : { hasDanger: false, matches: [] }

  const contentText = contractToText(rendered)
  // 파일명도 snapshot 기준 이름 사용 (base.workerName = snapshot-first 해소된 값)
  const fileName = `${rendered.title}_${base.workerName}_${today}_v${contract.currentVersion}.txt`

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
        contractId:   params.id,
        versionNo:    contract.currentVersion,
        snapshotJson: contract as never,
        draftDocId:   doc.id,
        createdBy:    session.sub,
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
    adminId:    session.sub,
    actionType: 'DOCUMENT_GENERATE',
    targetType: 'WorkerContract',
    targetId:   params.id,
    description: `계약서 PDF 생성: ${rendered.title} / ${base.workerName} / v${contract.currentVersion}`,
  })

  return NextResponse.json({
    success: true,
    data: {
      id: doc.id,
      fileName,
      contentText,
      // 일용직 계약서 위험 문구 경고 (있으면 관리자 수동 검수 필요)
      ...(dangerCheck.hasDanger ? {
        warnings: dangerCheck.matches.map(m => `[위험문구] "${m.phrase}" 발견: ${m.context}`),
      } : {}),
    },
  }, { status: 201 })
}
