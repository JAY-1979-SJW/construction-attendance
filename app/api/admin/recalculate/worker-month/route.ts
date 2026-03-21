import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { recalculateWorkerMonth } from '@/lib/labor/recalculate'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey, workerIds, reason } = body

  if (!monthKey || !workerIds?.length) {
    return NextResponse.json({ error: 'monthKey and workerIds required' }, { status: 400 })
  }

  try {
    await recalculateWorkerMonth({ monthKey, workerIds, actedBy: session.sub, reason })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '재산출 실패'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
