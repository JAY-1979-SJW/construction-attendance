import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { closeMonth } from '@/lib/labor/month-closing'
import { prisma } from '@/lib/db/prisma'

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey } = body

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  // close 전에 상태 검증
  const current = await prisma.monthClosing.findFirst({
    where: { monthKey, closingScope: 'GLOBAL', siteId: null }
  })
  if (current && current.status !== 'CLOSING' && current.status !== 'OPEN' && current.status !== 'REOPENED') {
    return badRequest('CLOSING 또는 OPEN 상태에서만 마감할 수 있습니다.')
  }

  try {
    await closeMonth(monthKey, session.sub)
    return NextResponse.json({ success: true, message: `${monthKey} 마감 완료` })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '마감 실패'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
