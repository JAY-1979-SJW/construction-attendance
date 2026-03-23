import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'

const ALLOWED_CATEGORIES = [
  'MISSING_CHECKIN',
  'MISSING_CHECKOUT',
  'CONTACT_CHANGE',
  'CONTRACT_REVIEW',
  'DOCUMENT_REQUEST',
  'DEVICE_CHANGE',
  'OTHER',
] as const

const MAX_CONTENT_LENGTH = 200

/**
 * GET /api/worker/requests
 * 내 요청 내역 조회
 */
export async function GET() {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const requests = await prisma.workerRequest.findMany({
      where:   { workerId: session.sub },
      orderBy: { createdAt: 'desc' },
      take:    50,
      select: {
        id:         true,
        category:   true,
        content:    true,
        status:     true,
        adminMemo:  true,
        createdAt:  true,
        reviewedAt: true,
      },
    })

    return NextResponse.json({ requests })
  } catch (err) {
    console.error('[GET /api/worker/requests]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/worker/requests
 * 새 요청 접수
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return unauthorized()

    const body = await req.json()
    const { category, content } = body as { category: string; content: string }

    if (!ALLOWED_CATEGORIES.includes(category as typeof ALLOWED_CATEGORIES[number])) {
      return NextResponse.json({ error: '허용되지 않은 요청 유형입니다.' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: '요청 내용을 입력해 주세요.' }, { status: 400 })
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: `요청 내용은 ${MAX_CONTENT_LENGTH}자 이내여야 합니다.` }, { status: 400 })
    }

    // 동일 카테고리 중복 접수 방지 (PENDING 상태인 동일 카테고리 요청이 있으면 거부)
    const existing = await prisma.workerRequest.findFirst({
      where: {
        workerId: session.sub,
        category: category as never,
        status:   'PENDING',
      },
    })
    if (existing) {
      return NextResponse.json({ error: '동일 유형의 요청이 이미 접수되어 처리 중입니다.' }, { status: 409 })
    }

    const request = await prisma.workerRequest.create({
      data: {
        workerId: session.sub,
        category: category as never,
        content:  content.trim(),
        status:   'PENDING',
      },
    })

    return NextResponse.json({ success: true, id: request.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/worker/requests]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
