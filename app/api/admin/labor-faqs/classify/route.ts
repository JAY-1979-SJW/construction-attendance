/**
 * POST /api/admin/labor-faqs/classify
 *
 * 서버사이드 AI 분류 프록시.
 * classifier.ts 에서 호출하며, ANTHROPIC_API_KEY 를 서버에서만 사용한다.
 * AI 는 JSON 구조만 반환 — 자유 문장 답변 생성 절대 금지.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `당신은 건설현장 관리자 앱의 노동법 FAQ 분류 도우미입니다.

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const body = await req.json()
  const { userMessage } = body

  if (!userMessage || typeof userMessage !== 'string') {
    return NextResponse.json({ error: 'userMessage required' }, { status: 400 })
  }

  try {
    const resp = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    })

    const content = resp.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected AI response type' }, { status: 500 })
    }

    return NextResponse.json({ result: content.text })
  } catch (err) {
    console.error('[classify] AI error:', err)
    return NextResponse.json({ error: 'AI call failed' }, { status: 500 })
  }
}
