import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized } from '@/lib/utils/response'
import { generateRequestNo } from '@/lib/materials/request-service'

/**
 * GET /api/worker/materials/requests
 * 내 자재청구 목록
 */
export async function GET() {
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  const requests = await prisma.materialRequest.findMany({
    where:   { workerRequesterId: session.sub, actorType: 'WORKER' },
    orderBy: { createdAt: 'desc' },
    take:    50,
    select: {
      id:          true,
      requestNo:   true,
      title:       true,
      status:      true,
      siteId:      true,
      site:        { select: { name: true } },
      createdAt:   true,
      _count:      { select: { items: true } },
    },
  })

  return NextResponse.json({ success: true, data: requests })
}

/**
 * POST /api/worker/materials/requests
 * 자재청구서 생성 (SUBMITTED 상태로 직행 — 관리자 검토 대기)
 *
 * body: {
 *   title:   string          // 청구 제목
 *   siteId?: string          // 현장 ID (선택)
 *   items:   {
 *     itemName:     string
 *     spec?:        string
 *     unit?:        string
 *     requestedQty: number
 *     notes?:       string
 *   }[]
 * }
 */
export async function POST(req: NextRequest) {
  const session = await getWorkerSession()
  if (!session) return unauthorized()

  let body: {
    title: string
    siteId?: string
    items: {
      itemName: string
      spec?: string
      unit?: string
      requestedQty: number
      notes?: string
    }[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { title, siteId, items } = body

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ success: false, error: '제목을 입력하세요.' }, { status: 400 })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, error: '청구 항목이 없습니다.' }, { status: 400 })
  }

  for (const item of items) {
    if (!item.itemName || typeof item.itemName !== 'string') {
      return NextResponse.json({ success: false, error: '자재명이 누락된 항목이 있습니다.' }, { status: 400 })
    }
    if (typeof item.requestedQty !== 'number' || item.requestedQty <= 0) {
      return NextResponse.json({ success: false, error: '청구수량은 0보다 커야 합니다.' }, { status: 400 })
    }
  }

  // 현장 귀속 검증: siteId가 있으면 해당 현장에 활성 계약이 있는 근로자인지 확인
  if (siteId) {
    const contract = await prisma.workerContract.findFirst({
      where: {
        workerId: session.sub,
        siteId,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
    })
    if (!contract) {
      return NextResponse.json(
        { success: false, error: '해당 현장의 계약이 없습니다.' },
        { status: 403 }
      )
    }
  }

  const requestNo = await generateRequestNo()

  const created = await prisma.materialRequest.create({
    data: {
      requestNo,
      title:             title.trim(),
      siteId:            siteId ?? null,
      requestedBy:       'WORKER',          // Worker 청구 시 고정값
      workerRequesterId: session.sub,
      actorType:         'WORKER',
      status:            'SUBMITTED',        // 직행: 관리자 검토 대기
      items: {
        create: items.map(item => ({
          itemName:     item.itemName.trim(),
          spec:         item.spec?.trim() ?? null,
          unit:         item.unit?.trim() ?? null,
          requestedQty: item.requestedQty,
          notes:        item.notes?.trim() ?? null,
        })),
      },
    },
    select: {
      id:        true,
      requestNo: true,
      status:    true,
    },
  })

  // 상태 이력 기록
  await prisma.materialRequestHistory.create({
    data: {
      requestId:  created.id,
      fromStatus: 'DRAFT',
      toStatus:   'SUBMITTED',
      actorId:    session.sub,
      actorType:  'WORKER',
      reason:     '근로자 자재청구',
    },
  })

  return NextResponse.json({ success: true, data: created }, { status: 201 })
}
