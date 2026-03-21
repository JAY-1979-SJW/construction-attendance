import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { getOperationsDashboard } from '@/lib/labor/operations-dashboard-service'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const d = new Date()
  const defaultMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const monthKey = searchParams.get('monthKey') ?? defaultMonth

  try {
    const data = await getOperationsDashboard(monthKey)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '대시보드 조회 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
