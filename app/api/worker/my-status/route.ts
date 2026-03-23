import { NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'

/**
 * GET /api/worker/my-status
 * 현재 로그인한 근로자의 전체 상태 조회:
 * - 계정 승인 상태
 * - 기기 승인 상태
 * - 현장 참여 신청 목록 + 상태
 * - 배정된 현장 목록
 * - 출퇴근 가능 여부 + 불가 사유
 */
export async function GET() {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const worker = await prisma.worker.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        name: true,
        phone: true,
        jobTitle: true,
        accountStatus: true,
        rejectReason: true,
        reviewedAt: true,
        createdAt: true,
        complianceStatus: {
          select: {
            basicIdentityChecked: true,
            rrnCollected: true,
            bankInfoCollected: true,
            nationalPensionStatus: true,
            healthInsuranceStatus: true,
            employmentInsuranceStatus: true,
            industrialAccidentStatus: true,
            retirementMutualStatus: true,
          },
        },
      },
    })
    if (!worker) return unauthorized()

    // 기기 상태
    const latestDeviceReq = await prisma.deviceChangeRequest.findFirst({
      where: { workerId: session.sub },
      orderBy: { requestedAt: 'desc' },
      select: { status: true, newDeviceName: true, requestedAt: true },
    })
    const approvedDevice = await prisma.workerDevice.findFirst({
      where: { workerId: session.sub, isActive: true },
      select: { deviceName: true, approvedAt: true },
    })

    // 현장 참여 신청 목록
    const joinRequests = await prisma.siteJoinRequest.findMany({
      where: { workerId: session.sub },
      include: {
        site: { select: { id: true, name: true, address: true, isActive: true } },
      },
      orderBy: { requestedAt: 'desc' },
    })

    // 배정된 현장 목록
    const assignments = await prisma.workerSiteAssignment.findMany({
      where: { workerId: session.sub, isActive: true },
      include: {
        site: { select: { id: true, name: true, address: true, isActive: true } },
        company: { select: { companyName: true } },
      },
      orderBy: { assignedFrom: 'desc' },
    })

    // ── 출퇴근 가능 여부 판단 ────────────────────────────────
    type BlockReason = {
      code: string
      message: string
      actionRequired: string
    }

    const blockReasons: BlockReason[] = []

    if (worker.accountStatus === 'PENDING') {
      blockReasons.push({ code: 'ACCOUNT_PENDING', message: '계정 승인 대기 중입니다.', actionRequired: '관리자 승인을 기다려 주세요.' })
    } else if (worker.accountStatus === 'REJECTED') {
      blockReasons.push({ code: 'ACCOUNT_REJECTED', message: '회원가입이 반려되었습니다.', actionRequired: '관리자에게 문의하거나 재신청하세요.' })
    } else if (worker.accountStatus === 'SUSPENDED') {
      blockReasons.push({ code: 'ACCOUNT_SUSPENDED', message: '계정이 정지된 상태입니다.', actionRequired: '관리자에게 문의하세요.' })
    }

    if (worker.accountStatus === 'APPROVED') {
      if (!approvedDevice) {
        blockReasons.push({ code: 'DEVICE_PENDING', message: '기기 승인이 필요합니다.', actionRequired: '관리자의 기기 승인을 기다려 주세요.' })
      }

      const hasApprovedSite = assignments.some(a => a.site.isActive)
      if (!hasApprovedSite) {
        const hasPendingJoin = joinRequests.some(j => j.status === 'PENDING')
        if (hasPendingJoin) {
          blockReasons.push({ code: 'SITE_MEMBERSHIP_PENDING', message: '현장 참여 승인 대기 중입니다.', actionRequired: '관리자의 현장 참여 승인을 기다려 주세요.' })
        } else {
          blockReasons.push({ code: 'SITE_MEMBERSHIP_REQUIRED', message: '승인된 현장이 없습니다.', actionRequired: '현장 참여를 신청하세요.' })
        }
      }
    }

    const canCheckIn = blockReasons.length === 0

    // 사용자 친화적 상태 메시지
    const accountStatusMessages: Record<string, string> = {
      PENDING:   '회원가입 승인 대기 중입니다.',
      APPROVED:  '계정이 승인되었습니다.',
      REJECTED:  '회원가입이 반려되었습니다.',
      SUSPENDED: '계정이 정지된 상태입니다.',
    }

    return NextResponse.json({
      success: true,
      data: {
        worker: {
          id: worker.id,
          name: worker.name,
          phone: worker.phone,
          jobTitle: worker.jobTitle,
          createdAt: worker.createdAt,
        },
        accountStatus: {
          status: worker.accountStatus,
          message: accountStatusMessages[worker.accountStatus] ?? '',
          rejectReason: worker.rejectReason ?? null,
          reviewedAt: worker.reviewedAt ?? null,
        },
        deviceStatus: approvedDevice
          ? { status: 'APPROVED', deviceName: approvedDevice.deviceName, approvedAt: approvedDevice.approvedAt }
          : latestDeviceReq
          ? { status: latestDeviceReq.status, deviceName: latestDeviceReq.newDeviceName, requestedAt: latestDeviceReq.requestedAt }
          : { status: 'NO_DEVICE', deviceName: null },
        joinRequests: joinRequests.map(j => ({
          requestId: j.id,
          siteId: j.siteId,
          siteName: j.site.name,
          address: j.site.address,
          status: j.status,
          requestedAt: j.requestedAt,
          reviewedAt: j.reviewedAt,
          rejectReason: j.rejectReason,
        })),
        assignedSites: assignments.map(a => ({
          siteId: a.siteId,
          siteName: a.site.name,
          address: a.site.address,
          isActive: a.site.isActive,
          companyName: a.company.companyName,
          assignedFrom: a.assignedFrom,
          assignedTo: a.assignedTo,
        })),
        // 출퇴근 가능 여부
        attendanceEligibility: {
          canCheckIn,
          blockReasons,
          summary: canCheckIn
            ? '출퇴근이 가능합니다.'
            : blockReasons.map(r => r.message).join(' '),
        },
        // 노무/보험 상태 (출퇴근 가능 여부와 별도)
        complianceStatus: worker.complianceStatus
          ? {
              basicIdentityChecked:      worker.complianceStatus.basicIdentityChecked,
              rrnCollected:              worker.complianceStatus.rrnCollected,
              bankInfoCollected:         worker.complianceStatus.bankInfoCollected,
              nationalPensionStatus:     worker.complianceStatus.nationalPensionStatus,
              healthInsuranceStatus:     worker.complianceStatus.healthInsuranceStatus,
              employmentInsuranceStatus: worker.complianceStatus.employmentInsuranceStatus,
              industrialAccidentStatus:  worker.complianceStatus.industrialAccidentStatus,
              retirementMutualStatus:    worker.complianceStatus.retirementMutualStatus,
            }
          : null,
      },
    })
  } catch (err) {
    console.error('[worker/my-status]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
