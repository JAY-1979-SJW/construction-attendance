/**
 * 기존 계약 데이터로부터 온보딩 문서 패키지를 백필한다.
 *
 * 실행: npx tsx scripts/backfill-onboarding-packages.ts
 *
 * 동작:
 * 1. 모든 contracts를 조회
 * 2. 각 계약에 대해 worker_document_packages + 5종 문서 row 생성
 * 3. CONTRACT 문서의 상태를 계약 상태에서 매핑
 * 4. 패키지 집계 재계산
 */
import { PrismaClient, ContractStatus, OnboardingDocStatus } from '@prisma/client'

const prisma = new PrismaClient()

const CONTRACT_STATUS_MAP: Record<ContractStatus, OnboardingDocStatus> = {
  DRAFT: 'NOT_SUBMITTED',
  SIGNED: 'SUBMITTED',
  REVIEW_REQUESTED: 'SUBMITTED',
  ACTIVE: 'APPROVED',
  REJECTED: 'REJECTED',
  ENDED: 'APPROVED',
}

const REQUIRED_DOC_TYPES = [
  'CONTRACT',
  'PRIVACY_CONSENT',
  'HEALTH_DECLARATION',
  'HEALTH_CERTIFICATE',
  'SAFETY_ACK',
] as const

const DOC_TYPE_LABELS: Record<string, string> = {
  CONTRACT: '근로계약서',
  PRIVACY_CONSENT: '개인정보 제공 동의서',
  HEALTH_DECLARATION: '건강 이상 없음 각서',
  HEALTH_CERTIFICATE: '건강증명서',
  SAFETY_ACK: '안전서류 확인 및 서명',
}

async function main() {
  console.log('=== 온보딩 문서 패키지 백필 시작 ===')

  // 기존 패키지가 이미 있는 workerId+siteId 조합 확인
  const existingPkgs = await prisma.workerDocumentPackage.findMany({
    select: { workerId: true, siteId: true },
  })
  const existingSet = new Set(
    existingPkgs.map((p) => `${p.workerId}::${p.siteId ?? ''}`)
  )
  console.log(`기존 패키지 수: ${existingSet.size}`)

  // 모든 계약 조회
  const contracts = await prisma.workerContract.findMany({
    select: {
      id: true,
      workerId: true,
      siteId: true,
      contractStatus: true,
      signedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`전체 계약 수: ${contracts.length}`)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const contract of contracts) {
    const key = `${contract.workerId}::${contract.siteId ?? ''}`
    if (existingSet.has(key)) {
      skipped++
      continue
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. 패키지 생성
        const pkg = await tx.workerDocumentPackage.create({
          data: {
            workerId: contract.workerId,
            siteId: contract.siteId || null,
          },
        })

        // 2. 5종 문서 생성
        for (const docType of REQUIRED_DOC_TYPES) {
          const isContract = docType === 'CONTRACT'
          const docStatus = isContract
            ? CONTRACT_STATUS_MAP[contract.contractStatus]
            : 'NOT_SUBMITTED'

          await tx.onboardingDocument.create({
            data: {
              workerId: contract.workerId,
              siteId: contract.siteId || null,
              packageId: pkg.id,
              docType,
              status: docStatus,
              title: DOC_TYPE_LABELS[docType],
              contractId: isContract ? contract.id : null,
              submittedAt: isContract && docStatus !== 'NOT_SUBMITTED'
                ? (contract.signedAt ?? new Date())
                : null,
              approvedAt: isContract && docStatus === 'APPROVED'
                ? new Date()
                : null,
              rejectedAt: isContract && docStatus === 'REJECTED'
                ? new Date()
                : null,
            },
          })
        }

        // 3. 패키지 집계 계산
        const contractDocStatus = CONTRACT_STATUS_MAP[contract.contractStatus]
        const approved = contractDocStatus === 'APPROVED' ? 1 : 0
        const rejected = contractDocStatus === 'REJECTED' ? 1 : 0
        const pending = contractDocStatus === 'SUBMITTED' ? 1 : 0
        const missing = 5 - approved - rejected - pending - (contractDocStatus === 'NOT_SUBMITTED' ? 0 : -1)

        let overallStatus: string = 'NOT_READY'
        if (rejected > 0) overallStatus = 'REJECTED'

        await tx.workerDocumentPackage.update({
          where: { id: pkg.id },
          data: {
            overallStatus: overallStatus as any,
            approvedDocCount: approved,
            rejectedDocCount: rejected,
            pendingDocCount: pending,
            missingDocCount: 5 - approved - rejected - pending,
          },
        })
      })

      existingSet.add(key)
      created++
    } catch (err: any) {
      // unique constraint 실패 시 스킵 (동시 workerId+siteId)
      if (err?.code === 'P2002') {
        skipped++
      } else {
        errors++
        console.error(`에러 (contract=${contract.id}):`, err?.message)
      }
    }
  }

  console.log(`\n=== 백필 결과 ===`)
  console.log(`생성: ${created}`)
  console.log(`스킵 (이미 존재): ${skipped}`)
  console.log(`에러: ${errors}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
