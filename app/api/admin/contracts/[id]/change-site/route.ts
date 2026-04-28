/**
 * POST /api/admin/contracts/[id]/change-site
 * 현장배치 확인서 생성: 기존 계약의 현장 변경 + 현장배치확인서 SafetyDocument 생성
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const contract = await prisma.workerContract.findUnique({
    where: { id: params.id },
    include: {
      worker: { select: { id: true, name: true } },
      site:   { select: { id: true, name: true } },
    },
  })
  if (!contract) return NextResponse.json({ error: '계약 없음' }, { status: 404 })
  if (!contract.isActive || contract.contractStatus !== 'ACTIVE') {
    return NextResponse.json({ error: '활성 계약에만 현장배치 처리 가능합니다' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { newSiteId, assignDate, wageUnchanged = true } = body as {
    newSiteId: string
    assignDate?: string
    wageUnchanged?: boolean
  }
  if (!newSiteId) return NextResponse.json({ error: 'newSiteId 필수' }, { status: 400 })

  const newSite = await prisma.site.findUnique({ where: { id: newSiteId } })
  if (!newSite) return NextResponse.json({ error: '현장 없음' }, { status: 404 })

  const today = assignDate || new Date().toISOString().slice(0, 10)
  const prevSiteName = contract.site?.name || '이전 현장'

  // 계약서 현장 변경 + 버전 증가
  await prisma.$transaction(async (tx) => {
    await tx.workerContract.update({
      where: { id: params.id },
      data: {
        siteId: newSiteId,
        currentVersion: { increment: 1 },
      },
    })

    // 새 버전 스냅샷
    const updatedContract = await tx.workerContract.findUnique({ where: { id: params.id } })
    await tx.contractVersion.create({
      data: {
        contractId:   params.id,
        versionNo:    updatedContract!.currentVersion,
        snapshotJson: updatedContract as never,
        changeNote:   `현장배치: ${prevSiteName} → ${newSite.name}`,
        createdBy:    session.sub,
      },
    })

    // 현장배치 확인서 SafetyDocument는 별도 generate-doc으로 처리
  })

  void writeAuditLog({
    actorUserId: session.sub, actorType: 'ADMIN',
    actionType: 'CONTRACT_CHANGE_SITE',
    targetType: 'WorkerContract',
    targetId:   params.id,
    summary: `현장배치 변경: ${contract.worker.name} / ${prevSiteName} → ${newSite.name}`,
  })

  return NextResponse.json({
    success: true,
    data: { newSiteId, newSiteName: newSite.name, assignDate: today, wageUnchanged },
  })
}
