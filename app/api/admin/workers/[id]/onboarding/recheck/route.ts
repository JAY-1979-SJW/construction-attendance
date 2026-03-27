import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { checkWorkerOnboarding } from '@/lib/labor/onboarding-engine'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await checkWorkerOnboarding(params.id)

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'WORKER_ONBOARDING_RECHECK',
      targetType: 'Worker',
      targetId: params.id,
      summary: `온보딩 재검사 실행`,
      metadataJson: { workerId: params.id },
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '재검사 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
