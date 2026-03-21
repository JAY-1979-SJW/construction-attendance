import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { precheckMonthClosing } from '@/lib/labor/month-closing'

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { monthKey } = body

  if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

  const result = await precheckMonthClosing(monthKey)
  return NextResponse.json(result)
}
