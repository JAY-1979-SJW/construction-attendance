/**
 * GET /api/worker/materials/catalog?q=xxx&discipline=E&page=1&pageSize=20
 * 근로자용 자재 카탈로그 검색 — 가격 정보 제외, 공종별 필터 지원
 */
import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await getWorkerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const discipline = searchParams.get('discipline') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(50, Math.max(5, parseInt(searchParams.get('pageSize') || '20', 10)))

  const where: Record<string, unknown> = {
    active: true,
    isRequestable: true,
  }

  if (discipline) {
    where.disciplineCode = discipline
  }

  if (q.trim()) {
    where.OR = [
      { standardItemName: { contains: q.trim(), mode: 'insensitive' } },
      { standardSpec: { contains: q.trim(), mode: 'insensitive' } },
      { searchKeywords: { contains: q.trim(), mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.materialMaster.findMany({
      where: where as any,
      select: {
        id: true,
        itemCode: true,
        standardItemName: true,
        standardSpec: true,
        standardUnit: true,
        disciplineCode: true,
        subDisciplineCode: true,
        itemCategory: true,
        // 가격 정보 제외
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { standardItemName: 'asc' },
    }),
    prisma.materialMaster.count({ where: where as any }),
  ])

  // 공종 코드별 건수 (필터 참고용)
  const disciplines = await prisma.materialMaster.groupBy({
    by: ['disciplineCode'],
    where: { active: true, isRequestable: true },
    _count: true,
  })

  const DISCIPLINE_LABELS: Record<string, string> = {
    E: '전기',
    T: '통신',
    M: '기계/설비',
    A: '건축',
    C: '토목',
    ETC: '기타',
  }

  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      disciplines: disciplines.map(d => ({
        code: d.disciplineCode || 'ETC',
        label: DISCIPLINE_LABELS[d.disciplineCode || 'ETC'] || d.disciplineCode || '기타',
        count: d._count,
      })),
    },
  })
}
