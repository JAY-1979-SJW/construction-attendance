/**
 * GET /api/admin/contracts/[id]/versions
 * 계약서 버전 이력 목록
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const versions = await prisma.contractVersion.findMany({
    where: { contractId: params.id },
    orderBy: { versionNo: 'asc' },
  })

  return NextResponse.json({ success: true, data: versions })
}
