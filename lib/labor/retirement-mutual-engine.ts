/**
 * 퇴직공제 엔진
 * monthly_work_confirmations 기반으로 퇴직공제 일별 인정 및 월별 요약 생성
 */
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { logCorrection } from './correction-log'

export interface RetirementMutualRunOptions {
  monthKey: string
  siteId?: string
  actedBy?: string
}

/** 특정 날짜에 근로자가 퇴직공제 대상인지 확인 (기간 이력 기반) */
async function isWorkerEligible(workerId: string, workDate: string): Promise<boolean> {
  const record = await prisma.retirementMutualWorker.findFirst({
    where: {
      workerId,
      enabledYn: true,
      startDate: { lte: workDate },
      OR: [{ endDate: null }, { endDate: { gte: workDate } }],
    },
  })
  // RetirementMutualWorker 설정이 없으면 worker.retirementMutualTargetYn 기본값 사용
  if (!record) {
    const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { retirementMutualTargetYn: true } })
    return worker?.retirementMutualTargetYn ?? false
  }
  return record.enabledYn
}

/** 퇴직공제 실행 */
export async function runRetirementMutual(opts: RetirementMutualRunOptions): Promise<{ created: number; updated: number }> {
  const { monthKey, siteId, actedBy } = opts

  // 퇴직공제 대상 현장 목록
  const eligibleSites = await prisma.retirementMutualSite.findMany({
    where: {
      enabledYn: true,
      ...(siteId ? { siteId } : {}),
    },
  })
  const eligibleSiteIds = new Set(eligibleSites.map((s) => s.siteId))

  if (eligibleSiteIds.size === 0) {
    return { created: 0, updated: 0 }
  }

  // 해당 월 확정 근무 조회
  const confirmations = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'CONFIRMED',
      confirmedWorkType: { not: 'INVALID' },
      siteId: { in: Array.from(eligibleSiteIds) },
    },
    orderBy: [{ workerId: 'asc' }, { workDate: 'asc' }],
  })

  let created = 0
  let updated = 0

  for (const conf of confirmations) {
    // 근로자 대상 여부 확인
    const workerEligible = await isWorkerEligible(conf.workerId, conf.workDate)
    if (!workerEligible) continue

    // 현장 설정 조회
    const siteSetting = eligibleSites.find((s) => s.siteId === conf.siteId)
    if (!siteSetting) continue

    // 인정 공수 계산
    let recognizedWorkUnit = Number(conf.confirmedWorkUnits)

    // 반일 처리 규칙
    if (conf.confirmedWorkType === 'HALF_DAY' && siteSetting.halfDayRecognitionRule === 'EXCLUDE') {
      recognizedWorkUnit = 0
    }

    // 기존 레코드 확인
    const existing = await prisma.retirementMutualDailyRecord.findUnique({
      where: { workerId_siteId_workDate: { workerId: conf.workerId, siteId: conf.siteId, workDate: conf.workDate } },
    })

    if (existing) {
      // 수동 오버라이드된 경우 건너뜀
      if (existing.manualOverrideYn) continue

      await prisma.retirementMutualDailyRecord.update({
        where: { id: existing.id },
        data: {
          eligibleYn: recognizedWorkUnit > 0,
          recognizedWorkUnit: new Prisma.Decimal(recognizedWorkUnit),
          sourceConfirmationId: conf.id,
        },
      })
      updated++
    } else {
      await prisma.retirementMutualDailyRecord.create({
        data: {
          workerId: conf.workerId,
          siteId: conf.siteId,
          workDate: conf.workDate,
          monthKey,
          sourceConfirmationId: conf.id,
          eligibleYn: recognizedWorkUnit > 0,
          recognizedWorkUnit: new Prisma.Decimal(recognizedWorkUnit),
        },
      })
      created++
    }
  }

  // 월별 요약 생성
  await generateMonthlySummaries(monthKey, siteId ? [siteId] : Array.from(eligibleSiteIds) as string[])

  if (actedBy) {
    await logCorrection({
      domainType: 'RETIREMENT_MUTUAL',
      domainId: monthKey,
      actionType: 'RECALCULATE',
      afterJson: { monthKey, siteId, created, updated },
      reason: '퇴직공제 실행',
      actedBy,
    })
  }

  return { created, updated }
}

/** 월별 요약 생성 */
async function generateMonthlySummaries(monthKey: string, siteIds: string[]) {
  for (const siteId of siteIds) {
    const records = await prisma.retirementMutualDailyRecord.findMany({
      where: { monthKey, siteId, eligibleYn: true },
      select: { workerId: true, recognizedWorkUnit: true },
    })

    // worker별 집계
    const workerMap = new Map<string, { days: number; units: number }>()
    for (const r of records) {
      const prev = workerMap.get(r.workerId) ?? { days: 0, units: 0 }
      workerMap.set(r.workerId, {
        days: prev.days + 1,
        units: prev.units + Number(r.recognizedWorkUnit),
      })
    }

    for (const [workerId, agg] of Array.from(workerMap.entries())) {
      await prisma.retirementMutualMonthlySummary.upsert({
        where: { workerId_siteId_monthKey: { workerId, siteId, monthKey } },
        create: {
          workerId,
          siteId,
          monthKey,
          recognizedWorkDays: agg.days,
          recognizedWorkUnits: new Prisma.Decimal(agg.units),
          eligibleYn: true,
          reportStatus: 'READY',
        },
        update: {
          recognizedWorkDays: agg.days,
          recognizedWorkUnits: new Prisma.Decimal(agg.units),
        },
      })
    }
  }
}
