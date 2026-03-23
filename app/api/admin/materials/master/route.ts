import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const discipline = searchParams.get('discipline') ?? ''

  const where = {
    active: true,
    ...(q ? { OR: [
      { standardItemName: { contains: q } },
      { itemCode: { contains: q } },
    ]} : {}),
    ...(discipline ? { discipline } : {}),
  }

  const items = await prisma.materialMaster.findMany({
    where,
    orderBy: [{ discipline: 'asc' }, { itemCategory: 'asc' }, { standardItemName: 'asc' }],
  })

  return NextResponse.json({ success: true, data: items })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const item = await prisma.materialMaster.create({ data: body })
  return NextResponse.json({ success: true, data: item })
}
