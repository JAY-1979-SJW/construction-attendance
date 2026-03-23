import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound } from '@/lib/utils/response'

/**
 * PATCH /api/admin/workers/[id]/termination-review/[reviewId]
 * 체크리스트 기본정보 및 최종확인 체크박스 업데이트
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id: workerId, reviewId } = await params

    const existing = await prisma.workerTerminationReview.findFirst({
      where: { id: reviewId, workerId },
    })
    if (!existing) return notFound()

    if (existing.status === 'CONFIRMED' || existing.status === 'CANCELLED') {
      return NextResponse.json({ error: '이미 완료된 검토는 수정할 수 없습니다.' }, { status: 409 })
    }

    const body = await req.json()

    const {
      terminationReason,
      terminationDate,
      reasonCategory,
      detailReason,
      confirmCheckedReason,
      confirmCheckedDocuments,
      confirmCheckedDelivery,
      confirmCheckedWage,
      confirmCheckedDispute,
    } = body as {
      terminationReason?:       string
      terminationDate?:         string
      reasonCategory?:          string
      detailReason?:            string
      confirmCheckedReason?:    boolean
      confirmCheckedDocuments?: boolean
      confirmCheckedDelivery?:  boolean
      confirmCheckedWage?:      boolean
      confirmCheckedDispute?:   boolean
    }

    const updated = await prisma.workerTerminationReview.update({
      where: { id: reviewId },
      data: {
        ...(terminationReason    !== undefined ? { terminationReason: terminationReason as never } : {}),
        ...(terminationDate      !== undefined ? { terminationDate }   : {}),
        ...(reasonCategory       !== undefined ? { reasonCategory }    : {}),
        ...(detailReason         !== undefined ? { detailReason }      : {}),
        ...(confirmCheckedReason    !== undefined ? { confirmCheckedReason }    : {}),
        ...(confirmCheckedDocuments !== undefined ? { confirmCheckedDocuments } : {}),
        ...(confirmCheckedDelivery  !== undefined ? { confirmCheckedDelivery }  : {}),
        ...(confirmCheckedWage      !== undefined ? { confirmCheckedWage }      : {}),
        ...(confirmCheckedDispute   !== undefined ? { confirmCheckedDispute }   : {}),
      },
    })

    return NextResponse.json({ review: updated })
  } catch (err) {
    console.error('[PATCH /termination-review/[reviewId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
