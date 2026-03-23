import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.estimateDocument.findUnique({
    where: { id: params.id },
    include: {
      site: { select: { id: true, name: true } },
      sheets: { orderBy: { sheetIndex: 'asc' } },
      _count: { select: { billRows: true, aggregateRows: true } },
    },
  })

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: doc })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.estimateDocument.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
