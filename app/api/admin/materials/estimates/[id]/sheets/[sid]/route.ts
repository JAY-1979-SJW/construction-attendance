import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, notFound } from '@/lib/utils/response'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id, sid } = await params
  const sheet = await prisma.estimateDocumentSheet.findFirst({
    where: { id: sid, documentId: id },
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
      parseStatus:      true,
      rowCount:         true,
      headerRowIndex:   true,
      dataStartRowIndex: true,
      rawDataJson:      true,
      mergeRangesJson:  true,
    },
  })
  if (!sheet) return notFound('시트를 찾을 수 없습니다')

  return ok(sheet)
}
