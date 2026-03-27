/**
 * 노임서류 집계 엔진
 *
 * 출퇴근 원천기록 → 현장별 투입현황 계산
 * DB 추가 없이 실시간 집계 (Phase 1)
 */

import { prisma } from '@/lib/db/prisma'
import { kstDateStringToDate, toKSTDateString, toKSTTimeString } from '@/lib/utils/date'

// ── 집계 행 타입 ─────────────────────────────────────────────────────

export interface LaborAllocationRow {
  // 원천 기록
  attendanceLogId: string
  workDate: string            // "YYYY-MM-DD"
  workerId: string
  workerName: string
  workerPhone: string | null
  company: string
  jobTitle: string

  // 현장
  checkInSiteId: string
  checkInSiteName: string
  lastSiteId: string          // 마지막 현장 (이동 이력 반영)
  lastSiteName: string
  allocatedSiteId: string     // 인정 현장 (기본: 마지막 현장)
  allocatedSiteName: string
  hasMove: boolean            // 이동 이력 존재 여부

  // 시각
  checkInAt: string | null    // KST HH:mm
  checkOutAt: string | null   // KST HH:mm (보정값 반영)

  // 근무시간
  totalWorkedMinutes: number | null   // 인정 분 (null = 미퇴근)

  // 상태 플래그
  status: string
  isAutoCheckout: boolean     // [AUTO] 태그 여부
  isAdjusted: boolean         // 관리자 보정 여부
  includeInLabor: boolean     // 노임 집계 포함 대상
  needsReview: boolean        // 검토 필요 (MISSING_CHECKOUT)

  adminNote: string | null
}

// ── 노임 합계 행 타입 ─────────────────────────────────────────────────

export interface LaborSummaryRow {
  workerId: string
  workerName: string
  company: string
  jobTitle: string
  allocatedSiteId: string
  allocatedSiteName: string
  totalDays: number           // 인정 투입일수
  totalMinutes: number        // 인정 총 근무분
  adjustedDays: number        // 보정 건수
  autoCheckoutDays: number    // 자동퇴근 건수 (참고용)
  needsReviewDays: number     // 검토 필요 건수
}

// ── 집계 파라미터 ─────────────────────────────────────────────────────

export interface AggregateOptions {
  dateFrom: string            // "YYYY-MM-DD"
  dateTo: string
  siteId?: string             // 인정 현장 필터 (집계 후 필터링)
  workerId?: string
  /** 노임 포함 대상만 반환 (기본 false — 전체 반환) */
  onlyIncluded?: boolean
}

// ── 메인 집계 함수 ────────────────────────────────────────────────────

export async function aggregateLaborAllocations(opts: AggregateOptions): Promise<LaborAllocationRow[]> {
  const { dateFrom, dateTo, workerId, onlyIncluded = false } = opts

  const logs = await prisma.attendanceLog.findMany({
    where: {
      workDate: {
        gte: kstDateStringToDate(dateFrom),
        lte: kstDateStringToDate(dateTo),
      },
      ...(workerId ? { workerId } : {}),
      // WORKING은 포함하되 needsReview=true로 처리 (미퇴근 감지)
      status: { not: 'EXCEPTION' },
    },
    include: {
      worker: { select: { name: true, phone: true, jobTitle: true } },
      checkInSite: { select: { id: true, name: true } },
      checkOutSite: { select: { id: true, name: true } },
      events: {
        where: { eventType: 'MOVE' },
        include: { site: { select: { id: true, name: true } } },
        orderBy: { occurredAt: 'asc' },
      },
    },
    orderBy: [{ workDate: 'asc' }, { checkInAt: 'asc' }],
  })

  const rows: LaborAllocationRow[] = logs.map((log) => {
    // ── 인정 현장 결정 (최종 현장 기준) ──────────────────────────────
    const movesWithSite = log.events.filter((e) => e.site !== null)
    const lastMove      = movesWithSite[movesWithSite.length - 1]
    const hasMove       = movesWithSite.length > 0

    const lastSiteId   = lastMove?.site?.id   ?? log.checkInSite.id
    const lastSiteName = lastMove?.site?.name ?? log.checkInSite.name

    // 인정 현장 = 마지막 현장 (Phase 1 기본 정책; 향후 관리자 수동 변경 가능)
    const allocatedSiteId   = lastSiteId
    const allocatedSiteName = lastSiteName

    // ── 근무시간 계산 ─────────────────────────────────────────────────
    let totalWorkedMinutes: number | null = null
    if (log.checkInAt && log.checkOutAt) {
      totalWorkedMinutes = Math.round(
        (log.checkOutAt.getTime() - log.checkInAt.getTime()) / 60000
      )
      // 음수 방지 (보정 오류 방어)
      if (totalWorkedMinutes < 0) totalWorkedMinutes = null
    }

    // ── 상태 플래그 ──────────────────────────────────────────────────
    const isAutoCheckout = log.adminNote?.includes('[AUTO]') ?? false
    const isAdjusted     = log.status === 'ADJUSTED'
    // 노임 집계 포함: COMPLETED, ADJUSTED (MISSING_CHECKOUT, EXCEPTION 제외)
    const includeInLabor = log.status === 'COMPLETED' || log.status === 'ADJUSTED'
    const needsReview    = log.status === 'MISSING_CHECKOUT' || log.status === 'WORKING'

    return {
      attendanceLogId: log.id,
      workDate: toKSTDateString(log.workDate),
      workerId: log.workerId,
      workerName: log.worker.name,
      workerPhone: log.worker.phone,
      company: log.companyNameSnapshot ?? '',
      jobTitle: log.worker.jobTitle,
      checkInSiteId: log.checkInSite.id,
      checkInSiteName: log.checkInSite.name,
      lastSiteId,
      lastSiteName,
      allocatedSiteId,
      allocatedSiteName,
      hasMove,
      checkInAt: log.checkInAt ? toKSTTimeString(log.checkInAt) : null,
      checkOutAt: log.checkOutAt ? toKSTTimeString(log.checkOutAt) : null,
      totalWorkedMinutes,
      status: log.status,
      isAutoCheckout,
      isAdjusted,
      includeInLabor,
      needsReview,
      adminNote: log.adminNote,
    }
  })

  // ── siteId 필터 (인정 현장 기준) ──────────────────────────────────
  const filtered = opts.siteId
    ? rows.filter((r) => r.allocatedSiteId === opts.siteId)
    : rows

  return onlyIncluded ? filtered.filter((r) => r.includeInLabor) : filtered
}

// ── 노임 합계 집계 ─────────────────────────────────────────────────────

export function summarizeLaborAllocations(rows: LaborAllocationRow[]): LaborSummaryRow[] {
  const map = new Map<string, LaborSummaryRow>()

  for (const row of rows) {
    if (!row.includeInLabor) continue

    const key = `${row.workerId}::${row.allocatedSiteId}`
    const existing = map.get(key)

    if (existing) {
      existing.totalDays        += 1
      existing.totalMinutes     += row.totalWorkedMinutes ?? 0
      if (row.isAdjusted)      existing.adjustedDays      += 1
      if (row.isAutoCheckout)  existing.autoCheckoutDays  += 1
    } else {
      map.set(key, {
        workerId: row.workerId,
        workerName: row.workerName,
        company: row.company,
        jobTitle: row.jobTitle,
        allocatedSiteId: row.allocatedSiteId,
        allocatedSiteName: row.allocatedSiteName,
        totalDays: 1,
        totalMinutes: row.totalWorkedMinutes ?? 0,
        adjustedDays: row.isAdjusted ? 1 : 0,
        autoCheckoutDays: row.isAutoCheckout ? 1 : 0,
        needsReviewDays: 0,
      })
    }
  }

  // 검토 필요 건 별도 집계 (미포함이지만 참고값)
  for (const row of rows) {
    if (!row.needsReview) continue
    const key = `${row.workerId}::${row.allocatedSiteId}`
    const existing = map.get(key)
    if (existing) {
      existing.needsReviewDays += 1
    } else {
      map.set(key, {
        workerId: row.workerId,
        workerName: row.workerName,
        company: row.company,
        jobTitle: row.jobTitle,
        allocatedSiteId: row.allocatedSiteId,
        allocatedSiteName: row.allocatedSiteName,
        totalDays: 0,
        totalMinutes: 0,
        adjustedDays: 0,
        autoCheckoutDays: 0,
        needsReviewDays: 1,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const site = a.allocatedSiteName.localeCompare(b.allocatedSiteName, 'ko')
    if (site !== 0) return site
    return a.workerName.localeCompare(b.workerName, 'ko')
  })
}

// ── 분 → "H시간 M분" 변환 ─────────────────────────────────────────────
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}
