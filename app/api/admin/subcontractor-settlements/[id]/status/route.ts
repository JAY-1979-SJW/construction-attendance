import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

const VALID_STATUSES = ['DRAFT', 'REVIEW_REQUIRED', 'CONFIRMED', 'HOLD']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { status, reviewNote } = body

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 })
  }

  const updated = await prisma.companySettlement.update({
    where: { id: params.id },
    data: {
      status,
      reviewNote,
      ...(status === 'CONFIRMED' ? { confirmedAt: new Date(), confirmedBy: session.sub } : {}),
    },
  })

  return NextResponse.json({ settlement: updated })
}
