import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string; sheetId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sheet = await prisma.estimateDocumentSheet.findFirst({
    where: { id: params.sheetId, documentId: params.id },
  })

  if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: sheet })
}
