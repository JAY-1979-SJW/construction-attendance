import { NextRequest } from 'next/server'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
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
    select: {
      id:           true,
      fileName:     true,
      fileSize:     true,
      documentType: true,
      parseStatus:  true,
      parseVersion: true,
      sheetCount:   true,
      notes:        true,
      uploadedAt:   true,
      errorMessage: true,
      site:         { select: { id: true, name: true } },
    },
  })
  if (!doc) return notFound('내역서를 찾을 수 없습니다')

  return ok(doc)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const doc = await prisma.estimateDocument.findUnique({
    where: { id },
    select: { filePath: true },
  })
  if (!doc) return notFound('내역서를 찾을 수 없습니다')

  // DB 삭제 (Cascade로 sheets, billRows, aggregateRows 자동 삭제)
  await prisma.estimateDocument.delete({ where: { id } })

  // 파일 삭제 (실패해도 무시)
  if (doc.filePath && existsSync(doc.filePath)) {
    await unlink(doc.filePath).catch(() => {})
  }

  return ok({ id })
}
