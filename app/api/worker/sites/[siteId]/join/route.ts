import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { badRequest, unauthorized } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const schema = z.object({
  companyId: z.string().optional(),
  note: z.string().max(200).optional(),
})

/**
 * POST /api/worker/sites/[siteId]/join
 * 현장 참여 신청.
 * APPROVED 계정만 신청 가능. 이미 신청했거나 배정된 현장은 재신청 불가(반려된 경우는 재신청 가능).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const { siteId } = await params

    const body = await request.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)
    const { companyId, note } = parsed.data

    // 계정 상태 확인
    const worker = await prisma.worker.findUnique({
      where: { id: session.sub },
      select: { accountStatus: true, name: true },
    })
    if (!worker || worker.accountStatus !== 'APPROVED') {
      return NextResponse.json({
        success: false,
        message: '계정 승인 후 현장 참여를 신청할 수 있습니다.',
      }, { status: 403 })
    }

    // 현장 존재 확인
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true, isActive: true },
    })
    if (!site || !site.isActive) {
      return NextResponse.json({
        success: false,
        message: '존재하지 않거나 비활성 현장입니다.',
      }, { status: 404 })
    }

    // 이미 배정된 현장인지 확인
    const assignment = await prisma.workerSiteAssignment.findFirst({
      where: { workerId: session.sub, siteId, isActive: true },
    })
    if (assignment) {
      return NextResponse.json({
        success: false,
        status: 'ALREADY_ASSIGNED',
        message: '이미 해당 현장에 배정된 근로자입니다.',
      })
    }

    // 기존 신청 내역 확인
    const existingJoin = await prisma.siteJoinRequest.findUnique({
      where: { workerId_siteId: { workerId: session.sub, siteId } },
    })
    if (existingJoin) {
      if (existingJoin.status === 'PENDING') {
        return NextResponse.json({
          success: false,
          status: 'ALREADY_PENDING',
          message: '현장 참여 승인 대기 중입니다.',
        })
      }
      if (existingJoin.status === 'APPROVED') {
        return NextResponse.json({
          success: false,
          status: 'ALREADY_APPROVED',
          message: '이미 승인된 참여 신청이 있습니다.',
        })
      }
      // REJECTED → 재신청: 기존 레코드 업데이트
      const updated = await prisma.siteJoinRequest.update({
        where: { id: existingJoin.id },
        data: {
          companyId: companyId ?? null,
          status: 'PENDING',
          joinMethod: 'SITE_LIST',
          requestedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          rejectReason: null,
          note: note ?? null,
        },
      })
      await writeAuditLog({
        actorUserId: session.sub,
        actorType: 'WORKER',
        actionType: 'SITE_JOIN_REQUESTED',
        targetType: 'SiteJoinRequest',
        targetId: updated.id,
        summary: `현장 참여 재신청 — ${worker.name} → ${site.name}`,
        metadataJson: { siteId, companyId },
      })
      return NextResponse.json({
        success: true,
        status: 'REQUESTED',
        data: { requestId: updated.id },
        message: '현장 참여 신청이 재접수되었습니다. 관리자 승인 후 출퇴근이 가능합니다.',
      })
    }

    // 신규 신청 생성
    const joinRequest = await prisma.siteJoinRequest.create({
      data: {
        workerId: session.sub,
        siteId,
        companyId: companyId ?? null,
        status: 'PENDING',
        joinMethod: 'SITE_LIST',
        note: note ?? null,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'WORKER',
      actionType: 'SITE_JOIN_REQUESTED',
      targetType: 'SiteJoinRequest',
      targetId: joinRequest.id,
      summary: `현장 참여 신청 — ${worker.name} → ${site.name}`,
      metadataJson: { siteId, companyId },
    })

    return NextResponse.json({
      success: true,
      status: 'REQUESTED',
      data: { requestId: joinRequest.id },
      message: '현장 참여 신청이 접수되었습니다. 관리자 승인 후 출퇴근이 가능합니다.',
    })
  } catch (err) {
    console.error('[worker/sites/join]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
