/**
 * GET  /api/admin/labor-faqs  — FAQ 목록 조회 (검색, 카테고리 필터, 상태 필터)
 * POST /api/admin/labor-faqs  — FAQ 신규 등록 (SUPER_ADMIN 전용)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q        = searchParams.get('q')?.trim()
  const category = searchParams.get('category')
  const status   = searchParams.get('status') ?? 'APPROVED'
  const limit    = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset   = Number(searchParams.get('offset') ?? '0')

  const where: Record<string, unknown> = {
    isActive: true,
  }

  // 관리자가 아닌 일반 사용은 APPROVED만 노출
  if (session.role !== 'SUPER_ADMIN') {
    where.status = 'APPROVED'
  } else if (status) {
    where.status = status
  }

  if (category) where.category = category

  if (q) {
    where.OR = [
      { question:     { contains: q } },
      { shortAnswer:  { contains: q } },
    ]
  }

  const [faqs, total] = await Promise.all([
    prisma.laborFaq.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit,
      skip: offset,
    }),
    prisma.laborFaq.count({ where }),
  ])

  return NextResponse.json({ faqs, total, limit, offset })
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const {
    category, question, questionAliases, shortAnswer, fullAnswer,
    appRule, caution, sourceOrg, sourceTitle, sourceUrl, effectiveDate,
    relatedContractTypes, triggerConditions, priority, status,
  } = body

  if (!category || !question || !shortAnswer || !fullAnswer || !sourceOrg || !effectiveDate) {
    return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
  }

  const faq = await prisma.laborFaq.create({
    data: {
      category,
      question,
      questionAliases:    questionAliases    ?? [],
      shortAnswer,
      fullAnswer,
      appRule:            appRule            ?? null,
      caution:            caution            ?? null,
      sourceOrg,
      sourceTitle:        sourceTitle        ?? sourceOrg,
      sourceUrl:          sourceUrl          ?? null,
      effectiveDate,
      relatedContractTypes: relatedContractTypes ?? [],
      triggerConditions:    triggerConditions    ?? [],
      priority:             priority             ?? 50,
      status:               status               ?? 'DRAFT',
      createdBy:            session.sub,
    },
  })

  await prisma.laborFaqChangeLog.create({
    data: {
      faqId:         faq.id,
      changedBy:     session.sub,
      changeType:    'CREATE',
      afterSnapshot: faq as unknown as Record<string, unknown>,
    },
  })

  return NextResponse.json({ faq }, { status: 201 })
}
