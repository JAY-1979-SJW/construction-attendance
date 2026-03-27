import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { enabledYn, projectType, contractAmount, recognitionRuleType, halfDayRecognitionRule, notes } = body

  const updated = await prisma.retirementMutualSite.upsert({
    where: { siteId: params.id },
    create: {
      siteId: params.id,
      enabledYn: enabledYn ?? false,
      projectType,
      contractAmount,
      recognitionRuleType: recognitionRuleType ?? 'DEFAULT',
      halfDayRecognitionRule: halfDayRecognitionRule ?? 'INCLUDE',
      notes,
    },
    update: {
      enabledYn: enabledYn ?? false,
      projectType,
      contractAmount,
      recognitionRuleType,
      halfDayRecognitionRule,
      notes,
    },
  })

  await writeAuditLog({
    actorUserId: session.sub,
    actorType: 'ADMIN',
    actorRole: session.role,
    actionType: 'RETIREMENT_MUTUAL_SITE_UPDATE',
    targetType: 'RetirementMutualSite',
    targetId: params.id,
    summary: `퇴직공제 현장 설정 변경: ${params.id}`,
  })

  return NextResponse.json({ site: updated })
}
