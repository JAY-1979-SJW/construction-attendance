import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'

// GET /api/admin/contracts/[id]/docs/[docId]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const doc = await prisma.generatedDocument.findFirst({
    where: { id: params.docId, contractId: params.id },
  })
  if (!doc) return NextResponse.json({ error: '문서 없음' }, { status: 404 })

  return NextResponse.json({ success: true, data: doc })
}
