import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { checkWorkerOnboarding } from '@/lib/labor/onboarding-engine'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await checkWorkerOnboarding(params.id)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '재검사 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
