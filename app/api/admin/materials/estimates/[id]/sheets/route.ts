import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound } from '@/lib/utils/response'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const doc = await prisma.estimateDocument.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!doc) return notFound('내역서를 찾을 수 없습니다')

  const sheets = await prisma.estimateDocumentSheet.findMany({
    where: { documentId: id },
    select: {
      id:               true,
      sheetName:        true,
      sheetIndex:       true,
      sheetType:        true,
      discipline:       true,
      maxRows:          true,
      maxCols:          true,
      isHidden:         true,
      needsReview:      true,
      headerRowIndex:   true,
      dataStartRowIndex: true,
      parseStatus:      true,
      rowCount:         true,
    },
    orderBy: { sheetIndex: 'asc' },
  })

  return ok(sheets)
}
