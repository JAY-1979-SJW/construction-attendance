import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// GET /api/admin/workers/[id]/profile
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const profile = await prisma.workerProfile.findUnique({ where: { workerId: params.id } })

  return NextResponse.json({ success: true, data: profile })
}

// POST /api/admin/workers/[id]/profile — 최초 생성
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const worker = await prisma.worker.findUnique({ where: { id: params.id } })
  if (!worker) return NextResponse.json({ error: '근로자 없음' }, { status: 404 })

  const existing = await prisma.workerProfile.findUnique({ where: { workerId: params.id } })
  if (existing) return NextResponse.json({ error: '프로필이 이미 존재합니다. PATCH를 사용하세요.' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const { workerClass, employmentMode, taxMode, insuranceMode, officeWorkerYn, classificationNote } = body

  const effectiveOfficeWorkerYn = officeWorkerYn ?? false
  const autoReview = (effectiveOfficeWorkerYn && (workerClass === 'CONTRACTOR' || taxMode === 'BIZ_3P3'))
    ? 'REVIEW_REQUIRED' : 'OK'

  const profile = await prisma.workerProfile.create({
    data: {
      workerId:             params.id,
      workerClass:          workerClass    || 'EMPLOYEE',
      employmentMode:       employmentMode || 'DAILY',
      taxMode:              taxMode        || 'DAILY_WAGE',
      insuranceMode:        insuranceMode  || 'AUTO_RULE',
      officeWorkerYn:       effectiveOfficeWorkerYn,
      continuousWorkReview: body.continuousWorkReview || autoReview,
      classificationNote:   classificationNote || null,
    } as never,
  })

  void writeAuditLog({
    actorUserId: session.sub, actorType: 'ADMIN',
    actionType: 'WORKER_PROFILE_CREATE',
    targetType: 'WorkerProfile', targetId: profile.id,
    summary: `근로자 분류 프로필 생성: ${workerClass}/${employmentMode}/${taxMode}`,
    afterJson: { workerClass, employmentMode, taxMode, insuranceMode, officeWorkerYn: effectiveOfficeWorkerYn },
  })

  return NextResponse.json({ success: true, data: profile }, { status: 201 })
}

// PATCH /api/admin/workers/[id]/profile
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const existing = await prisma.workerProfile.findUnique({ where: { workerId: params.id } })
  if (!existing) return NextResponse.json({ error: '프로필 없음. POST로 먼저 생성하세요.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { workerClass, employmentMode, taxMode, insuranceMode, officeWorkerYn, continuousWorkReview, classificationNote } = body

  const newOfficeWorkerYn = officeWorkerYn ?? existing.officeWorkerYn
  const newWorkerClass    = workerClass    || existing.workerClass
  const newTaxMode        = taxMode        || existing.taxMode

  const resolvedReview = continuousWorkReview
    || ((newOfficeWorkerYn && (newWorkerClass === 'CONTRACTOR' || newTaxMode === 'BIZ_3P3'))
        ? 'REVIEW_REQUIRED' : existing.continuousWorkReview)

  const updated = await prisma.workerProfile.update({
    where: { workerId: params.id },
    data: {
      ...(workerClass        !== undefined && { workerClass }),
      ...(employmentMode     !== undefined && { employmentMode }),
      ...(taxMode            !== undefined && { taxMode }),
      ...(insuranceMode      !== undefined && { insuranceMode }),
      ...(officeWorkerYn     !== undefined && { officeWorkerYn }),
      ...(classificationNote !== undefined && { classificationNote }),
      continuousWorkReview: resolvedReview,
    } as never,
  })

  void writeAuditLog({
    actorUserId: session.sub, actorType: 'ADMIN',
    actionType: 'WORKER_PROFILE_UPDATE',
    targetType: 'WorkerProfile', targetId: updated.id,
    summary: '근로자 분류 프로필 수정',
    beforeJson: { workerClass: existing.workerClass, employmentMode: existing.employmentMode, taxMode: existing.taxMode, insuranceMode: existing.insuranceMode, officeWorkerYn: existing.officeWorkerYn },
    afterJson: { workerClass: updated.workerClass, employmentMode: updated.employmentMode, taxMode: updated.taxMode, insuranceMode: updated.insuranceMode, officeWorkerYn: updated.officeWorkerYn },
  })

  return NextResponse.json({ success: true, data: updated })
}
