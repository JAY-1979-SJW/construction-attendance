import { prisma } from '@/lib/db/prisma'
import { MaterialRequestStatus, MaterialRequestActorType } from '@prisma/client'
import { randomUUID } from 'crypto'

// ─── 허용 상태 전이표 ────────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<MaterialRequestStatus, MaterialRequestStatus[]> = {
  DRAFT:     ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED'],
  REVIEWED:  ['APPROVED', 'REJECTED'],
  APPROVED:  ['ORDERED', 'CANCELLED'],
  ORDERED:   ['RECEIVED', 'CANCELLED'],
  RECEIVED:  [],
  REJECTED:  ['DRAFT'],
  CANCELLED: [],
}

export function isTransitionAllowed(
  from: MaterialRequestStatus,
  to: MaterialRequestStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(
  from: MaterialRequestStatus,
  to: MaterialRequestStatus
): void {
  if (!isTransitionAllowed(from, to)) {
    throw new TransitionError(
      `상태 전이 불가: ${from} → ${to}`,
      from,
      to
    )
  }
}

export class TransitionError extends Error {
  constructor(
    message: string,
    public readonly fromStatus: MaterialRequestStatus,
    public readonly toStatus: MaterialRequestStatus
  ) {
    super(message)
    this.name = 'TransitionError'
  }
}

// ─── 요청번호 생성 ────────────────────────────────────────────────────────────
export async function generateRequestNo(): Promise<string> {
  const today = new Date()
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `MR-${ymd}-`

  const last = await prisma.materialRequest.findFirst({
    where: { requestNo: { startsWith: prefix } },
    orderBy: { requestNo: 'desc' },
    select: { requestNo: true },
  })

  const seq = last
    ? parseInt(last.requestNo.split('-')[2] ?? '0', 10) + 1
    : 1

  return `${prefix}${String(seq).padStart(4, '0')}`
}

// ─── 상태 전이 (트랜잭션) ────────────────────────────────────────────────────
export async function transitionStatus(opts: {
  requestId:  string
  from:       MaterialRequestStatus
  to:         MaterialRequestStatus
  actorId?:   string
  actorType?: MaterialRequestActorType
  reason?:    string
  extra?:     Partial<{
    submittedAt:  Date
    reviewedAt:   Date; reviewedBy:  string
    approvedAt:   Date; approvedBy:  string
    rejectedAt:   Date; rejectedBy:  string; rejectReason: string
    cancelledAt:  Date; cancelledBy: string
  }>
}): Promise<void> {
  assertTransition(opts.from, opts.to)

  await prisma.$transaction([
    prisma.materialRequest.update({
      where: { id: opts.requestId },
      data: { status: opts.to, updatedAt: new Date(), ...opts.extra },
    }),
    prisma.materialRequestStatusHistory.create({
      data: {
        id:        randomUUID(),
        requestId: opts.requestId,
        fromStatus: opts.from,
        toStatus:   opts.to,
        actorId:    opts.actorId ?? null,
        actorType:  opts.actorType ?? 'ADMIN',
        reason:     opts.reason ?? null,
      },
    }),
  ])
}

// ─── 마스터에서 스냅샷 생성 ───────────────────────────────────────────────────
export async function buildSnapshotFromMaster(masterId: string) {
  const m = await prisma.materialMaster.findUnique({
    where: { id: masterId },
    select: {
      itemCode:         true,
      standardItemName: true,
      standardSpec:     true,
      standardUnit:     true,
      disciplineCode:   true,
      subDisciplineCode: true,
      active:           true,
      isRequestable:    true,
    },
  })
  if (!m) throw new Error('자재를 찾을 수 없습니다.')
  if (!m.active || !m.isRequestable) {
    throw new Error('청구 불가 자재입니다.')
  }
  return {
    itemCode:         m.itemCode,
    itemName:         m.standardItemName,
    spec:             m.standardSpec ?? null,
    unit:             m.standardUnit ?? null,
    disciplineCode:   m.disciplineCode ?? null,
    subDisciplineCode: m.subDisciplineCode ?? null,
  }
}
