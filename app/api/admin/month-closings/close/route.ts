import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { closeMonth } from '@/lib/labor/month-closing'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey } = body

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  try {
    await closeMonth(monthKey, session.sub)
    return NextResponse.json({ success: true, message: `${monthKey} 마감 완료` })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '마감 실패'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
