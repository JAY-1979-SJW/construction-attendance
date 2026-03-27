/**
 * 만료 예정 서류 알림 생성 job
 *
 * 매일 1회 실행. 만료 30일 이내 APPROVED 문서 중
 * 아직 DOC_EXPIRING 알림이 생성되지 않은 건에 대해 알림 생성.
 */
import { prisma } from '@/lib/db/prisma'

const SAFETY_DOC_LABELS: Record<string, string> = {
  SAFETY_EDUCATION_NEW_HIRE: '신규채용 안전교육',
  SAFETY_EDUCATION_TASK_CHANGE: '작업변경 교육',
  PPE_PROVISION: '보호구 지급',
  SAFETY_PLEDGE: '안전수칙 서약',
  WORK_CONDITIONS_RECEIPT: '근로조건 수령확인',
  PRIVACY_CONSENT: '개인정보 동의',
  BASIC_SAFETY_EDU_CONFIRM: '기초안전교육 확인',
  SITE_SAFETY_RULES_CONFIRM: '현장 안전수칙 확인',
  HEALTH_DECLARATION: '건강 이상 없음 각서',
  HEALTH_CERTIFICATE: '건강 증명서',
}

export async function runNotifyExpiringDocs(dryRun = false) {
  const now = new Date()
  const in30Days = new Date(now)
  in30Days.setDate(in30Days.getDate() + 30)

  // APPROVED 상태이고 expiresAt이 30일 이내인 문서 조회
  const expiringDocs = await prisma.safetyDocument.findMany({
    where: {
      status: 'APPROVED',
      expiresAt: {
        not: null,
        gt: now,       // 아직 만료 전
        lte: in30Days, // 30일 이내
      },
    },
    select: {
      id: true,
      documentType: true,
      expiresAt: true,
      workerId: true,
      worker: { select: { name: true } },
    },
  })

  if (expiringDocs.length === 0) {
    return { checked: 0, created: 0, skipped: 0 }
  }

  // 이미 DOC_EXPIRING 알림이 있는 문서 ID 조회
  const existingNotifs = await prisma.workerNotification.findMany({
    where: {
      type: 'DOC_EXPIRING',
      referenceId: { in: expiringDocs.map(d => d.id) },
    },
    select: { referenceId: true },
  })
  const alreadyNotified = new Set(existingNotifs.map(n => n.referenceId))

  const toCreate = expiringDocs.filter(d => !alreadyNotified.has(d.id))

  if (dryRun) {
    return { checked: expiringDocs.length, created: 0, skipped: alreadyNotified.size, wouldCreate: toCreate.length }
  }

  let created = 0
  for (const doc of toCreate) {
    const daysLeft = Math.ceil((doc.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const docLabel = SAFETY_DOC_LABELS[doc.documentType] ?? doc.documentType

    await prisma.workerNotification.create({
      data: {
        workerId: doc.workerId,
        type: 'DOC_EXPIRING',
        title: `${docLabel} 만료 예정`,
        body: `${docLabel} 서류가 ${daysLeft}일 후 만료됩니다. 재제출을 준비해 주세요.`,
        linkUrl: `/my/documents/${doc.id}`,
        referenceId: doc.id,
      },
    })
    created++
  }

  return { checked: expiringDocs.length, created, skipped: alreadyNotified.size }
}
