import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest } from '@/lib/utils/response'

/**
 * GET /api/public/companies?search=<name_or_bizno>
 * 업체 검색 — 공개 API (합류 신청 시 업체 선택용).
 * 최소한의 정보만 반환 (id, name, businessNumber 앞 6자리만).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''

  if (search.length < 2) {
    return badRequest('검색어는 2자 이상 입력하세요.')
  }

  const companies = await prisma.company.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { companyName: { contains: search, mode: 'insensitive' } },
        { businessNumber: { startsWith: search.replace(/[^0-9]/g, '') } },
      ],
    },
    take: 20,
    select: {
      id: true,
      companyName: true,
      businessNumber: true,
    },
  })

  return ok({
    items: companies.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      // 사업자번호는 앞 6자리만 노출 (예: 123456****)
      businessNumberHint: c.businessNumber
        ? c.businessNumber.slice(0, 6) + '****'
        : null,
    })),
  })
}
