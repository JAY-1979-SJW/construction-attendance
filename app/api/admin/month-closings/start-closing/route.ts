import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { precheckMonthClosing } from '@/lib/labor/month-closing'
import { logCorrection } from '@/lib/labor/correction-log'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { monthKey } = body
  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  // 기존 상태 확인
  const existing = await prisma.monthClosing.findFirst({
    where: { monthKey, closingScope: 'GLOBAL' },
  })
  if (existing && existing.status !== 'OPEN' && existing.status !== 'REOPENED') {
    return NextResponse.json({ error: `현재 상태(${existing.status})에서는 마감 시작이 불가합니다.` }, { status: 422 })
  }

  // 사전검사 요약 생성
  const precheck = await precheckMonthClosing(monthKey)

  const closing = existing
    ? await prisma.monthClosing.update({
        where: { id: existing.id },
        data: {
          status: 'CLOSING',
          closingStartedAt: new Date(),
          closingStartedBy: session.sub,
          precheckPassedYn: precheck.canClose,
        },
      })
    : await prisma.monthClosing.create({
        data: {
          monthKey,
          closingScope: 'GLOBAL',
          status: 'CLOSING',
          closingStartedAt: new Date(),
          closingStartedBy: session.sub,
          precheckPassedYn: precheck.canClose,
        },
      })

  await logCorrection({
    domainType: 'MONTH_CLOSING',
    domainId: closing.id,
    actionType: 'UPDATE',
    afterJson: { monthKey, status: 'CLOSING', precheck },
    reason: '마감 시작',
    actedBy: session.sub,
  })

  return NextResponse.json({ success: true, closing, precheck })
}
