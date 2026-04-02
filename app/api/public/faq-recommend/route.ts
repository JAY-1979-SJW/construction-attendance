/**
 * POST /api/public/faq-recommend
 * 공개 FAQ 추천 API — 인증 불필요 (가입 전/둘러보기 사용자용)
 * 관리자 전용 /api/admin/labor-faqs/recommend 의 공개 버전
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { searchFaqByKeyword } from '@/lib/labor-faq/classifier'
import Anthropic from '@anthropic-ai/sdk'
import type { FaqCategory } from '@/lib/labor-faq/types'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const CLASSIFIER_SYSTEM_PROMPT = `당신은 건설현장 노동법 FAQ 분류 도우미입니다.
질문을 분류하고 관련 FAQ ID만 찾아주세요. 법적 조언이나 자유 답변을 생성하지 마세요.
출력: {"category":"카테고리코드","faqCandidateIds":["faq_xxxx"],"confidence":0.0}
카테고리: CONTRACT_TYPE | DAILY_WORKER | REGULAR_EMPLOYMENT | FIXED_TERM | REPEATED_CONTRACT | OUTSOURCING | DOCUMENT_SELECTION | LEGAL_WARNING`

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = checkRateLimit(`public-faq:${ip}`, { maxAttempts: 20, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 200) : ''
  if (!question) {
    return NextResponse.json({ faqs: [], source: 'CATEGORY_FALLBACK' })
  }

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
  let selectedIds: string[] = []
  let source: 'AI' | 'KEYWORD' | 'CATEGORY_FALLBACK' = 'CATEGORY_FALLBACK'

  // AI 분류 시도
  if (anthropic) {
    try {
      const userMsg = `질문: ${question}\n선택 가능한 FAQ ID: ${faqIds.slice(0, 30).join(', ')}`
      const aiResp = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: CLASSIFIER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      })
      const content = aiResp.content[0]
      if (content.type === 'text') {
        const match = content.text.match(/\{[\s\S]*\}/)
        if (match) {
          const parsed = JSON.parse(match[0])
          const validIds = Array.isArray(parsed.faqCandidateIds)
            ? parsed.faqCandidateIds.filter((id: unknown) => typeof id === 'string' && faqIds.includes(id as string))
            : []
          const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0
          if (confidence >= 0.6 && validIds.length > 0) {
            selectedIds = validIds.slice(0, 5)
            source = 'AI'
          }
        }
      }
    } catch { /* AI 실패 → fallback */ }
  }

  // 키워드 검색 fallback
  if (selectedIds.length === 0) {
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

  // 카테고리 fallback
  if (selectedIds.length === 0) {
    selectedIds = allFaqs.slice(0, 5).map(f => f.id)
    source = 'CATEGORY_FALLBACK'
  }

  const faqs = await prisma.laborFaq.findMany({
    where: { id: { in: selectedIds }, isActive: true, status: 'APPROVED' },
    select: {
      id: true, category: true, question: true,
      shortAnswer: true, longAnswer: true, legalBasis: true, priority: true,
    },
  })
  const orderedFaqs = selectedIds.map(id => faqs.find(f => f.id === id)).filter(Boolean)

  return NextResponse.json({ faqs: orderedFaqs, source })
}
