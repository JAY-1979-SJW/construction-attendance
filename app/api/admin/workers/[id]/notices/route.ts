import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, notFound, badRequest } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

const ALLOWED_NOTICE_TYPES = ['CONTRACT_END', 'TERMINATION', 'SUSPENSION', 'WARNING', 'OTHER'] as const

/**
 * GET /api/admin/workers/[id]/notices
 * 통지 기록 목록 조회
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { id: workerId } = await params

    const notices = await prisma.workerNoticeRecord.findMany({
      where:   { workerId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ notices })
  } catch (err) {
    console.error('[GET /notices]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/workers/[id]/notices
 * 통지서 생성
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { id: workerId } = await params
    const body = await req.json()
    const { noticeType, title, content, effectiveDate, deliveryMethod } = body as {
      noticeType:      string
      title:           string
      content:         string
      effectiveDate?:  string
      deliveryMethod?: string
    }

    if (!ALLOWED_NOTICE_TYPES.includes(noticeType as never)) return badRequest('noticeType 값이 올바르지 않습니다.')
    if (!title?.trim())   return badRequest('title은 필수입니다.')
    if (!content?.trim()) return badRequest('content는 필수입니다.')

    const worker = await prisma.worker.findUnique({
      where:  { id: workerId },
      select: { companyAssignments: { where: { isActive: true }, select: { companyId: true }, take: 1 } },
    })
    if (!worker) return notFound()

    const companyId = worker.companyAssignments[0]?.companyId ?? ''

    const notice = await prisma.workerNoticeRecord.create({
      data: {
        workerId,
        companyId,
        issuedBy:       session.sub,
        noticeType:     noticeType as never,
        title:          title.trim(),
        content:        content.trim(),
        effectiveDate,
        deliveryMethod,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorRole:   session.role,
      companyId,
      actionType:  'WORKER_NOTICE_ISSUED',
      targetType:  'WORKER',
      targetId:    workerId,
      summary:     `통지서 발행 (${noticeType}): ${title.slice(0, 80)}`,
    })

    return NextResponse.json({ success: true, notice }, { status: 201 })
  } catch (err) {
    console.error('[POST /notices]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
