import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, badRequest } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

/**
 * POST /api/admin/workers/[id]/termination-review/[reviewId]/confirm
 *
 * 종료 최종 확정:
 *  1. 5개 확인 체크박스 모두 완료 여부 검증
 *  2. 필수 입력값 검증 (terminationReason, terminationDate, detailReason)
 *  3. 종료 스냅샷 저장 (모든 관련 데이터)
 *  4. Worker.isActive = false, accountStatus = SUSPENDED
 *  5. 감사로그 기록
 *  6. 검토 상태 → CONFIRMED
 *
 * 이 엔드포인트를 통해야만 근로자를 종료 처리할 수 있다.
 * 직접 isActive=false 변경은 별도 가드에서 차단됨.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { id: workerId, reviewId } = await params

    const review = await prisma.workerTerminationReview.findFirst({
      where: { id: reviewId, workerId },
    })
    if (!review) return notFound()
    if (review.status === 'CONFIRMED') {
      return NextResponse.json({ error: '이미 확정된 검토입니다.' }, { status: 409 })
    }
    if (review.status === 'CANCELLED') {
      return NextResponse.json({ error: '취소된 검토는 확정할 수 없습니다.' }, { status: 409 })
    }

    // 5개 확인 체크박스 검증
    const allChecked = (
      review.confirmCheckedReason    &&
      review.confirmCheckedDocuments &&
      review.confirmCheckedDelivery  &&
      review.confirmCheckedWage      &&
      review.confirmCheckedDispute
    )
    if (!allChecked) {
      return badRequest('모든 최종 확인 체크박스를 완료해야 종료를 확정할 수 있습니다.')
    }

    // 필수 입력 검증
    if (!review.terminationReason) return badRequest('종료 사유(terminationReason)를 입력해 주세요.')
    if (!review.terminationDate)   return badRequest('종료일(terminationDate)을 입력해 주세요.')
    if (!review.detailReason?.trim()) return badRequest('상세 사유(detailReason)를 입력해 주세요.')

    // 스냅샷 데이터 수집
    const [worker, contracts, deliveryLogs, attendanceSummary, warnings, explanations, notices] = await Promise.all([
      prisma.worker.findUnique({
        where:  { id: workerId },
        select: { id: true, name: true, phone: true, jobTitle: true, employmentType: true, accountStatus: true, createdAt: true },
      }),
      prisma.workerContract.findMany({
        where:   { workerId },
        orderBy: { createdAt: 'desc' },
        take:    10,
        select:  { id: true, contractType: true, startDate: true, endDate: true, contractStatus: true, signedAt: true },
      }),
      prisma.documentDeliveryLog.findMany({
        where:   { workerId },
        orderBy: { createdAt: 'desc' },
        select:  { id: true, documentType: true, deliveryMethod: true, status: true, deliveredAt: true },
      }),
      prisma.attendanceLog.aggregate({
        where: { workerId },
        _count: { id: true },
      }),
      prisma.workerWarningRecord.findMany({
        where:   { workerId },
        orderBy: { createdAt: 'desc' },
        select:  { id: true, warningLevel: true, reason: true, createdAt: true },
      }),
      prisma.workerExplanationRequest.findMany({
        where:   { workerId },
        orderBy: { createdAt: 'desc' },
        select:  { id: true, subject: true, status: true, createdAt: true },
      }),
      prisma.workerNoticeRecord.findMany({
        where:   { workerId },
        orderBy: { createdAt: 'desc' },
        select:  { id: true, noticeType: true, title: true, deliveredAt: true },
      }),
    ])

    if (!worker) return notFound()

    const companyId = review.companyId

    // 트랜잭션으로 종료 확정
    await prisma.$transaction([
      // 스냅샷 저장
      prisma.workerTerminationSnapshot.create({
        data: {
          reviewId,
          workerId,
          companyId,
          takenBy:              session.sub,
          workerJson:           worker           as never,
          contractsJson:        contracts         as never,
          attendanceSummaryJson: { totalDays: attendanceSummary._count.id } as never,
          documentsJson:        deliveryLogs      as never,
          warningsJson:         warnings          as never,
          explanationsJson:     explanations      as never,
          noticesJson:          notices           as never,
          checklistJson:        (review.autoCheckResultJson ?? []) as never,
        },
      }),
      // 검토 상태 CONFIRMED
      prisma.workerTerminationReview.update({
        where: { id: reviewId },
        data: {
          status:      'CONFIRMED',
          confirmedBy: session.sub,
          confirmedAt: new Date(),
        },
      }),
      // 근로자 비활성화
      prisma.worker.update({
        where: { id: workerId },
        data: {
          isActive:      false,
          accountStatus: 'SUSPENDED',
        },
      }),
      // 기기 비활성화
      prisma.workerDevice.updateMany({
        where: { workerId, isActive: true },
        data:  { isActive: false },
      }),
    ])

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      companyId,
      actionType:  'WORKER_TERMINATED',
      targetType:  'WORKER',
      targetId:    workerId,
      summary:     `근로자 종료 확정 — 사유: ${review.terminationReason}, 종료일: ${review.terminationDate}`,
      afterJson:   {
        terminationReason: review.terminationReason,
        terminationDate:   review.terminationDate,
        detailReason:      review.detailReason,
        confirmedBy:       session.sub,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /termination-review/[reviewId]/confirm]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
