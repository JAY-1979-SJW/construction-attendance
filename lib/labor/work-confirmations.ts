/**
 * 근무확정 서비스
 * attendance_days → monthly_work_confirmations (DRAFT 생성)
 * 관리자 확정 → CONFIRMED 상태로 전환, 보수 계산
 *
 * 공수 판정 기준 (07:00~16:00, 점심 1시간, 실근로 8시간 = 1.0 공수)
 *   - 실근로 8시간 이상 (4시간 초과 시 점심 1시간 차감) → FULL_DAY  1.0
 *   - 실근로 4~8시간                                    → HALF_DAY  0.5
 *   - 실근로 4시간 미만 / 미퇴근 / 무효                 → INVALID   0
 */
import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * 최종 분(workedMinutesRawFinal) 기준 공수 자동 판정
 * - 수동 override가 있으면 그것을 우선 사용
 * - 경과 4시간 초과 시 점심 1시간 차감하여 실근로 계산
 * - MISSING_CHECKOUT / INVALID presenceStatus는 무조건 INVALID
 */
function calcWorkUnits(
  workedMinutesRaw: number | null,
  presenceStatus: string,
): { workType: string; workUnits: Decimal } {
  if (['MISSING_CHECKOUT', 'INVALID'].includes(presenceStatus) || workedMinutesRaw == null) {
    return { workType: 'INVALID', workUnits: new Decimal(0) }
  }

  // 4시간(240분) 초과 시 점심 60분 차감 → 실근로 산출
  const effectiveMinutes = workedMinutesRaw > 240 ? workedMinutesRaw - 60 : workedMinutesRaw

  if (effectiveMinutes >= 480) {
    // 실근로 8시간 이상 → 1.0 공수
    return { workType: 'FULL_DAY', workUnits: new Decimal(1) }
  } else if (effectiveMinutes >= 240) {
    // 실근로 4~8시간 → 0.5 공수
    return { workType: 'HALF_DAY', workUnits: new Decimal('0.5') }
  } else {
    // 실근로 4시간 미만 → 무효 (관리자 직접 조정 필요)
    return { workType: 'INVALID', workUnits: new Decimal(0) }
  }
}

export interface GenerateConfirmationsOptions {
  monthKey: string   // 'YYYY-MM'
  siteId?: string
  workerId?: string
}

export interface GenerateResult {
  created: number
  skipped: number
  errors: number
}

/** attendance_days 기반 DRAFT 근무확정 레코드 생성 */
export async function generateDraftConfirmations(
  opts: GenerateConfirmationsOptions,
): Promise<GenerateResult> {
  const { monthKey, siteId, workerId } = opts
  const result: GenerateResult = { created: 0, skipped: 0, errors: 0 }

  // monthKey의 시작/종료 날짜 계산
  const [year, month] = monthKey.split('-').map(Number)
  const startDate = `${monthKey}-01`
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10) // 말일

  const days = await prisma.attendanceDay.findMany({
    where: {
      workDate: { gte: startDate, lte: endDate },
      ...(siteId   ? { siteId }   : {}),
      ...(workerId ? { workerId } : {}),
    },
    include: { worker: true },
  })

  for (const day of days) {
    try {
      // 이미 CONFIRMED인 경우 건너뜀
      const existing = await prisma.monthlyWorkConfirmation.findUnique({
        where: { workerId_siteId_workDate: { workerId: day.workerId, siteId: day.siteId, workDate: day.workDate } },
      })
      if (existing?.confirmationStatus === 'CONFIRMED') {
        result.skipped++
        continue
      }

      // 공수 판정: 수동 override 우선, 없으면 auto 값 사용
      // workedMinutesRawFinal = workedMinutesOverride ?? workedMinutesAuto ?? workedMinutesRaw
      const finalMinutes = day.workedMinutesRawFinal ?? day.workedMinutesOverride ?? day.workedMinutesRaw
      const { workType: defaultWorkType, workUnits: defaultWorkUnits } = calcWorkUnits(
        finalMinutes,
        day.presenceStatus,
      )
      const isInvalid = defaultWorkType === 'INVALID'

      // 해당 날짜 유효 계약 조회
      const contract = await prisma.workerContract.findFirst({
        where: {
          workerId: day.workerId,
          isActive: true,
          startDate: { lte: day.workDate },
          OR: [{ endDate: null }, { endDate: { gte: day.workDate } }],
        },
        orderBy: { startDate: 'desc' },
      })

      const dailyWage = contract?.dailyWage ?? 0
      const baseAmount = isInvalid ? 0 : Math.round(Number(defaultWorkUnits) * dailyWage)

      if (existing) {
        // DRAFT 업데이트
        await prisma.monthlyWorkConfirmation.update({
          where: { id: existing.id },
          data: {
            attendanceDayId:               day.id,
            confirmedWorkType:             defaultWorkType as never,
            confirmedWorkUnits:            defaultWorkUnits,
            confirmedWorkMinutes:          finalMinutes ?? 0,
            confirmedBaseAmount:           baseAmount,
            confirmedTotalAmount:          baseAmount,
            incomeTypeSnapshot:            day.worker.incomeType,
            employmentTypeSnapshot:        day.worker.employmentType,
            retirementMutualTargetSnapshot: day.worker.retirementMutualTargetYn,
          },
        })
        result.skipped++
      } else {
        await prisma.monthlyWorkConfirmation.create({
          data: {
            workerId:                      day.workerId,
            siteId:                        day.siteId,
            workDate:                      day.workDate,
            monthKey,
            attendanceDayId:               day.id,
            confirmationStatus:            'DRAFT',
            confirmedWorkType:             defaultWorkType as never,
            confirmedWorkUnits:            defaultWorkUnits,
            confirmedWorkMinutes:          finalMinutes ?? 0,
            confirmedBaseAmount:           baseAmount,
            confirmedTotalAmount:          baseAmount,
            incomeTypeSnapshot:            day.worker.incomeType,
            employmentTypeSnapshot:        day.worker.employmentType,
            retirementMutualTargetSnapshot: day.worker.retirementMutualTargetYn,
          },
        })
        result.created++
      }
    } catch (err) {
      console.error('[work-confirmations] generate error', { dayId: day.id, err })
      result.errors++
    }
  }

  console.info('[work-confirmations] generate done', { monthKey, ...result })
  return result
}

export interface ConfirmOptions {
  confirmationId: string
  confirmedBy: string  // AdminUser.id
  workType?: string
  workUnits?: number
  baseAmount?: number
  allowanceAmount?: number
  notes?: string
}

/** 개별 근무확정 처리 */
export async function confirmWorkDay(opts: ConfirmOptions) {
  const mc = await prisma.monthlyWorkConfirmation.findUnique({
    where: { id: opts.confirmationId },
    include: { worker: true },
  })
  if (!mc) throw new Error('NOT_FOUND')
  if (mc.confirmationStatus === 'CONFIRMED') throw new Error('ALREADY_CONFIRMED')

  const workType     = (opts.workType ?? mc.confirmedWorkType ?? 'FULL_DAY') as never
  const workUnits    = opts.workUnits    != null ? new Decimal(opts.workUnits)    : mc.confirmedWorkUnits
  const baseAmount   = opts.baseAmount   != null ? opts.baseAmount                : mc.confirmedBaseAmount
  const allowance    = opts.allowanceAmount != null ? opts.allowanceAmount        : mc.confirmedAllowanceAmount
  const totalAmount  = baseAmount + allowance
  const now          = new Date()

  const updated = await prisma.monthlyWorkConfirmation.update({
    where: { id: mc.id },
    data: {
      confirmationStatus:   'CONFIRMED',
      confirmedWorkType:    workType,
      confirmedWorkUnits:   workUnits,
      confirmedBaseAmount:  baseAmount,
      confirmedAllowanceAmount: allowance,
      confirmedTotalAmount: totalAmount,
      confirmedBy:          opts.confirmedBy,
      confirmedAt:          now,
      notes:                opts.notes ?? mc.notes,
      incomeTypeSnapshot:       mc.worker.incomeType,
      employmentTypeSnapshot:   mc.worker.employmentType,
      retirementMutualTargetSnapshot: mc.worker.retirementMutualTargetYn,
    },
  })

  // 퇴직공제 대상 기록 생성/업데이트
  if (mc.worker.retirementMutualTargetYn && workType !== 'INVALID') {
    await prisma.retirementMutualDailyRecord.upsert({
      where: { workerId_siteId_workDate: { workerId: mc.workerId, siteId: mc.siteId, workDate: mc.workDate } },
      update: { eligibleYn: true, recognizedWorkUnit: workUnits, sourceConfirmationId: mc.id },
      create: {
        workerId:            mc.workerId,
        siteId:              mc.siteId,
        workDate:            mc.workDate,
        monthKey:            mc.monthKey,
        eligibleYn:          true,
        recognizedWorkUnit:  workUnits,
        sourceConfirmationId: mc.id,
      },
    })
  }

  return updated
}

/** 월 일괄 확정 */
export async function finalizeMonth(monthKey: string, confirmedBy: string, siteId?: string) {
  const drafts = await prisma.monthlyWorkConfirmation.findMany({
    where: {
      monthKey,
      confirmationStatus: 'DRAFT',
      ...(siteId ? { siteId } : {}),
    },
  })

  let confirmed = 0
  for (const d of drafts) {
    await confirmWorkDay({ confirmationId: d.id, confirmedBy }).catch(() => {})
    confirmed++
  }
  return { confirmed }
}
