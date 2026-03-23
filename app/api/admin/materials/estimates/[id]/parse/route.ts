import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { parseEstimateDocument } from '@/lib/materials/estimate-parser'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  parseEstimateDocument(params.id).catch(console.error)
  return NextResponse.json({ success: true, message: '파싱을 시작했습니다' })
}
