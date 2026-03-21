import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

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

  return NextResponse.json({ site: updated })
}
