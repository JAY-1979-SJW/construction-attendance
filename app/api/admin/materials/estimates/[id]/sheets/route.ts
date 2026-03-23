import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const withRaw = searchParams.get('withRaw') === 'true'

  const sheets = await prisma.estimateDocumentSheet.findMany({
    where: { documentId: params.id },
    orderBy: { sheetIndex: 'asc' },
    select: {
      id: true,
      sheetName: true,
      sheetIndex: true,
      sheetType: true,
      discipline: true,
      maxRows: true,
      maxCols: true,
      isHidden: true,
      needsReview: true,
      parseStatus: true,
      rowCount: true,
      mergeRangesJson: withRaw,
      rawDataJson: withRaw,
    },
  })

  return NextResponse.json({ success: true, data: sheets })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sheetId, sheetType, discipline } = body

  const updated = await prisma.estimateDocumentSheet.update({
    where: { id: sheetId, documentId: params.id },
    data: {
      ...(sheetType ? { sheetType: sheetType as never } : {}),
      ...(discipline !== undefined ? { discipline } : {}),
      needsReview: false,
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
