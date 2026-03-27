import { NextRequest } from 'next/server'
import { ok, badRequest, notFound } from '@/lib/utils/response'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return badRequest('token 파라미터가 필요합니다.')

  const site = await prisma.site.findUnique({
    where: { qrToken: token },
    select: { id: true, name: true, address: true, isActive: true },
  })

  if (!site) return notFound('등록된 현장을 찾을 수 없습니다.')
  if (!site.isActive) return notFound('현재 운영 중이 아닌 현장입니다.')

  return ok({ id: site.id, name: site.name, address: site.address })
}
