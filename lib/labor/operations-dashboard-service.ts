/**
 * 운영 대시보드 집계 서비스
 */
import { prisma } from '@/lib/db/prisma'

export interface OperationsDashboardData {
  monthKey: string
  kpi: {
    todayActiveWorkers: number
    monthWorkerCount: number
    pendingOnboardingCount: number
    retirementPendingCount: number
    exceptionWorkerCount: number
    unconfirmedSettlementCount: number
    thisMonthDownloadCount: number
  }
  monthClosingStatus: {
    status: string
    closedAt: string | null
    reopenReason: string | null
  } | null
  recentDownloads: {
    id: string
    exportType: string
    monthKey: string
    createdAt: string
    createdBy: string | null
    versionNo: number
  }[]
  settlementSummary: {
    total: number
    confirmed: number
    reviewRequired: number
    draft: number
    hold: number
  }
  onboardingIssues: {
    workerId: string
    workerName: string
    issueCount: number
    topIssue: string
  }[]
}

export async function getOperationsDashboard(monthKey: string): Promise<OperationsDashboardData> {
  const today = new Date().toISOString().split('T')[0]

  // 오늘 출근 중 인원
  const todayLogs = await prisma.attendanceLog.count({
    where: {
      workDate: new Date(today),
      status: { in: ['WORKING', 'COMPLETED', 'ADJUSTED'] },
    },
  })

  // 이번 달 등록 근로자
  const monthWorkers = await prisma.monthlyWorkConfirmation.findMany({
    where: { monthKey, confirmationStatus: 'CONFIRMED' },
    select: { workerId: true },
    distinct: ['workerId'],
  })
  const monthWorkerCount = monthWorkers.length
  const workerIds = monthWorkers.map(w => w.workerId)

  // 온보딩 미완료 (PENDING_REVIEW status)
  const pendingOnboarding = workerIds.length > 0
    ? await prisma.worker.count({
        where: {
          id: { in: workerIds },
          retirementMutualStatus: 'PENDING_REVIEW',
        },
      })
    : 0

  // 예외 처리 근로자 (보험예외 or 세금예외)
  const exceptionWorkers = workerIds.length > 0
    ? await prisma.worker.count({
        where: {
          id: { in: workerIds },
          OR: [{ insuranceExceptionYn: true }, { taxExceptionYn: true }],
        },
      })
    : 0

  // 협력사 정산 미확정
  const unconfirmedSettlement = await prisma.subcontractorSettlement.count({
    where: { monthKey, status: { not: 'CONFIRMED' } },
  })

  // 이번 달 다운로드 수
  const [yearStr, monthStr] = monthKey.split('-')
  const monthStart = new Date(`${yearStr}-${monthStr}-01`)
  const monthEnd = new Date(Number(yearStr), Number(monthStr), 1)

  const downloadCount = await prisma.filingExport.count({
    where: {
      createdAt: { gte: monthStart, lt: monthEnd },
      status: 'COMPLETED',
    },
  })

  // 월마감 상태
  const closing = await prisma.monthClosing.findFirst({
    where: { monthKey, closingScope: 'GLOBAL' },
  })

  // 최근 다운로드 5건
  const recentDownloads = await prisma.filingExport.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, exportType: true, monthKey: true, createdAt: true, createdBy: true, versionNo: true },
  })

  // 협력사 정산 현황
  const settlements = await prisma.subcontractorSettlement.groupBy({
    by: ['status'],
    where: { monthKey },
    _count: { id: true },
  })
  const settlementMap = Object.fromEntries(settlements.map(s => [s.status, s._count.id]))

  // 온보딩 위험 근로자 TOP 5
  const pendingWorkers = workerIds.length > 0
    ? await prisma.worker.findMany({
        where: {
          id: { in: workerIds },
          retirementMutualStatus: 'PENDING_REVIEW',
        },
        select: { id: true, name: true },
        take: 5,
      })
    : []

  return {
    monthKey,
    kpi: {
      todayActiveWorkers: todayLogs,
      monthWorkerCount,
      pendingOnboardingCount: pendingOnboarding,
      retirementPendingCount: pendingOnboarding,
      exceptionWorkerCount: exceptionWorkers,
      unconfirmedSettlementCount: unconfirmedSettlement,
      thisMonthDownloadCount: downloadCount,
    },
    monthClosingStatus: closing
      ? {
          status: closing.status,
          closedAt: closing.closedAt?.toISOString() ?? null,
          reopenReason: closing.reopenReason,
        }
      : null,
    recentDownloads: recentDownloads.map(d => ({
      id: d.id,
      exportType: d.exportType,
      monthKey: d.monthKey,
      createdAt: d.createdAt.toISOString(),
      createdBy: d.createdBy,
      versionNo: d.versionNo,
    })),
    settlementSummary: {
      total: settlements.reduce((a, s) => a + s._count.id, 0),
      confirmed: settlementMap['CONFIRMED'] ?? 0,
      reviewRequired: settlementMap['REVIEW_REQUIRED'] ?? 0,
      draft: settlementMap['DRAFT'] ?? 0,
      hold: settlementMap['HOLD'] ?? 0,
    },
    onboardingIssues: pendingWorkers.map(w => ({
      workerId: w.id,
      workerName: w.name,
      issueCount: 1,
      topIssue: '퇴직공제 상태 미확인',
    })),
  }
}
