/**
 * POST /api/admin/labor-faqs/triggers
 *
 * 상황기반 자동 FAQ 노출 체크.
 * 입력된 컨텍스트(계약유형, 종료일, 반복횟수 등)를 기반으로
 * 자동 표시해야 할 FAQ 목록을 반환한다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { evaluateTriggerConditions } from '@/lib/labor-faq/classifier'
import type { TriggerCondition, TriggerCheckRequest } from '@/lib/labor-faq/types'

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: TriggerCheckRequest = await req.json()
  const {
    contractType,
    endDate,
    startDate,
    repeatedCount,
    workerSource,
    expectedDurationDays,
  } = body

  const ctx = {
    selectedContractType: contractType,
    endDate:              endDate,
    startDate:            startDate,
    repeatedCount:        repeatedCount,
    workerSource:         workerSource,
    expectedDurationDays: expectedDurationDays,
  }

  const allFaqs = await prisma.laborFaq.findMany({
    where: { isActive: true, status: 'APPROVED' },
    orderBy: [{ priority: 'desc' }],
  })

  const triggeredFaqs = allFaqs.filter(faq => {
    const conditions = faq.triggerConditions as unknown as TriggerCondition[]
    if (!conditions || conditions.length === 0) return false
    return evaluateTriggerConditions(conditions, ctx)
  })

  // 경고 수준 결정
  const warningTags = triggeredFaqs.flatMap(f => {
    const conditions = f.triggerConditions as unknown as TriggerCondition[]
    return conditions.map(c => c.field)
  })

  let warningLevel: 'INFO' | 'WARN' | 'BLOCK' = 'INFO'
  if (workerSource === 'OUTSOURCED' && contractType && ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'].includes(contractType)) {
    warningLevel = 'BLOCK'
  } else if (repeatedCount && repeatedCount >= 3) {
    warningLevel = 'WARN'
  } else if (expectedDurationDays && expectedDurationDays >= 30) {
    warningLevel = 'WARN'
  } else if (contractType === 'REGULAR_EMPLOYMENT' && endDate) {
    warningLevel = 'WARN'
  }

  return NextResponse.json({
    triggeredFaqs: triggeredFaqs.slice(0, 5),
    warningLevel,
    warningTags: [...new Set(warningTags)],
  })
}
