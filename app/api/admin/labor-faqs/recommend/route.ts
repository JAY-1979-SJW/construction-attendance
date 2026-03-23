/**
 * POST /api/admin/labor-faqs/recommend
 *
 * FAQ 추천 API.
 * 1순위: AI 분류기 (confidence >= 0.85)
 * 2순위: AI 분류기 저신뢰도 (0.60 ~ 0.84) — 상위 3개
 * 3순위: 키워드 fallback 검색
 * 4순위: 카테고리별 상위 FAQ
 *
 * AI는 JSON 구조만 반환. 최종 답변은 DB FAQ에서만 출력.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { searchFaqByKeyword } from '@/lib/labor-faq/classifier'
import Anthropic from '@anthropic-ai/sdk'
import type { FaqClassifyOutput, FaqCategory } from '@/lib/labor-faq/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CLASSIFIER_SYSTEM_PROMPT = `당신은 건설현장 관리자 앱의 노동법 FAQ 분류 도우미입니다.

## 역할 제한 (반드시 준수)
- 관리자의 질문을 분류하고 관련 FAQ ID를 찾아주는 역할만 합니다.
- 절대 새로운 법률 해석이나 법적 조언을 생성하지 마세요.
- 절대 자유 문장으로 답변을 생성하지 마세요.
- 등록된 FAQ ID 목록에서만 후보를 선택하세요.

## 출력 형식 (JSON만 반환. 설명 텍스트 없음)
{"category":"카테고리코드","normalizedQuestion":"정규화질문","faqCandidateIds":["faq_xxxx"],"confidence":0.0,"warningTags":[]}

## 카테고리 코드
CONTRACT_TYPE | DAILY_WORKER | REGULAR_EMPLOYMENT | FIXED_TERM | REPEATED_CONTRACT | OUTSOURCING | DOCUMENT_SELECTION | LEGAL_WARNING`

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { question, contractType, page, formContext } = body

  // 활성 FAQ ID 목록 조회
  const allFaqs = await prisma.laborFaq.findMany({
    where: { isActive: true, status: 'APPROVED' },
    select: {
      id: true, category: true, question: true,
      questionAliases: true, shortAnswer: true, priority: true,
    },
    orderBy: [{ priority: 'desc' }],
  })

  if (allFaqs.length === 0) {
    return NextResponse.json({ faqs: [], source: 'CATEGORY_FALLBACK' })
  }

  const faqIds = allFaqs.map(f => f.id)

  let classifyResult: FaqClassifyOutput | null = null
  let source: 'AI' | 'KEYWORD' | 'CATEGORY_FALLBACK' = 'CATEGORY_FALLBACK'

  // ── AI 분류 시도 ─────────────────────────────────────────
  if (question && process.env.ANTHROPIC_API_KEY) {
    try {
      const userMsg = buildClassifyMessage(question, contractType, page, formContext, faqIds)
      const aiResp = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system:     CLASSIFIER_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMsg }],
      })

      const content = aiResp.content[0]
      if (content.type === 'text') {
        classifyResult = parseAndValidateAIOutput(content.text, faqIds)
      }
    } catch {
      // AI 실패 → fallback
    }
  }

  // ── 결과 처리 ────────────────────────────────────────────
  let selectedIds: string[] = []

  if (classifyResult && classifyResult.confidence >= 0.85 && classifyResult.faqCandidateIds.length > 0) {
    selectedIds = classifyResult.faqCandidateIds.slice(0, 5)
    source = 'AI'
  } else if (classifyResult && classifyResult.confidence >= 0.60 && classifyResult.faqCandidateIds.length > 0) {
    selectedIds = classifyResult.faqCandidateIds.slice(0, 3)
    source = 'AI'
  } else if (question) {
    // 키워드 검색 fallback
    const kwResults = searchFaqByKeyword(
      question,
      allFaqs.map(f => ({
        id: f.id,
        category: f.category as FaqCategory,
        question: f.question,
        questionAliases: Array.isArray(f.questionAliases) ? f.questionAliases as string[] : [],
        shortAnswer: f.shortAnswer,
        priority: f.priority,
      })),
      5,
    )
    selectedIds = kwResults.map(f => f.id)
    source = selectedIds.length > 0 ? 'KEYWORD' : 'CATEGORY_FALLBACK'
  }

  // 선택된 ID 없으면 카테고리 상위 FAQ
  if (selectedIds.length === 0) {
    const topFaqs = allFaqs
      .filter(f => !contractType || (f.questionAliases as unknown as string[]).length > 0)
      .slice(0, 5)
    selectedIds = topFaqs.map(f => f.id)
    source = 'CATEGORY_FALLBACK'
  }

  // 최종 FAQ 조회 (순서 유지)
  const faqs = await prisma.laborFaq.findMany({
    where: { id: { in: selectedIds }, isActive: true, status: 'APPROVED' },
  })
  const orderedFaqs = selectedIds
    .map(id => faqs.find(f => f.id === id))
    .filter(Boolean)

  return NextResponse.json({
    faqs:        orderedFaqs,
    source,
    confidence:  classifyResult?.confidence,
    warningTags: classifyResult?.warningTags ?? [],
  })
}

function buildClassifyMessage(
  question: string,
  contractType?: string,
  page?: string,
  formContext?: Record<string, unknown>,
  faqIds?: string[],
): string {
  const lines: string[] = [`질문: ${question}`]
  if (contractType) lines.push(`선택된 계약유형: ${contractType}`)
  if (page) lines.push(`현재 화면: ${page}`)
  if (formContext) {
    if (formContext.hasEndDate !== undefined) lines.push(`종료일: ${formContext.hasEndDate ? '있음' : '없음'}`)
    if (formContext.isRepeatedRegistration) lines.push('반복 등록: 예')
    if (formContext.expectedDurationDays) lines.push(`예상 근무기간: ${formContext.expectedDurationDays}일`)
  }
  if (faqIds?.length) lines.push(`\n선택 가능한 FAQ ID: ${faqIds.slice(0, 30).join(', ')}`)
  return lines.join('\n')
}

const VALID_CATEGORIES: FaqCategory[] = [
  'CONTRACT_TYPE', 'DAILY_WORKER', 'REGULAR_EMPLOYMENT', 'FIXED_TERM',
  'REPEATED_CONTRACT', 'OUTSOURCING', 'DOCUMENT_SELECTION', 'LEGAL_WARNING',
]

function parseAndValidateAIOutput(
  content: string,
  availableFaqIds: string[],
): FaqClassifyOutput | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])

    if (!VALID_CATEGORIES.includes(parsed.category)) return null
    if (typeof parsed.confidence !== 'number') return null

    const validIds = Array.isArray(parsed.faqCandidateIds)
      ? parsed.faqCandidateIds.filter(
          (id: unknown) => typeof id === 'string' && availableFaqIds.includes(id)
        )
      : []

    return {
      category:           parsed.category,
      normalizedQuestion: String(parsed.normalizedQuestion ?? '').slice(0, 60),
      faqCandidateIds:    validIds,
      confidence:         Math.max(0, Math.min(1, parsed.confidence)),
      warningTags:        Array.isArray(parsed.warningTags)
        ? parsed.warningTags.filter((t: unknown) => typeof t === 'string').slice(0, 5)
        : [],
    }
  } catch {
    return null
  }
}
