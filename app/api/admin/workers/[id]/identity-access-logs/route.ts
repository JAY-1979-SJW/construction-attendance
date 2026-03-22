import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const deny = requireRole(session, MUTATE_ROLES)
  if (deny) return deny
  const logs = await prisma.identityAccessLog.findMany({
    where: { workerId: params.id }, orderBy: { createdAt: 'desc' }, take: 50,
  })
  return NextResponse.json({ items: logs, total: logs.length })
}
