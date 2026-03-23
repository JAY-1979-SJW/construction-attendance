/**
 * GET  /api/admin/sites/[id]/policy — 현장 출퇴근 정책 조회 (실효값 포함)
 * PUT  /api/admin/sites/[id]/policy — 현장 출퇴근 정책 설정
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { resolveEffectiveSiteAttendancePolicy } from '@/lib/labor/resolve-site-policy'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// HH:mm 형식 검증
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

const putSchema = z.object({
  workStartTime:  z.string().regex(timePattern, '시작 시각 형식이 올바르지 않습니다 (HH:mm)').nullable().optional(),
  workEndTime:    z.string().regex(timePattern, '종료 시각 형식이 올바르지 않습니다 (HH:mm)').nullable().optional(),
  breakStartTime: z.string().regex(timePattern, '휴게 시작 형식이 올바르지 않습니다 (HH:mm)').nullable().optional(),
  breakEndTime:   z.string().regex(timePattern, '휴게 종료 형식이 올바르지 않습니다 (HH:mm)').nullable().optional(),
  breakMinutes:   z.number().int().min(0).max(480).nullable().optional(),
})

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await params

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const raw = await prisma.siteAttendancePolicy.findUnique({ where: { siteId: id } })
    const effective = await resolveEffectiveSiteAttendancePolicy(id)

    return ok({
      siteId:   id,
      siteName: site.name,
      // 현장 직접 설정값 (null = 회사 기본값 사용)
      custom: raw ? {
        workStartTime:  raw.workStartTime,
        workEndTime:    raw.workEndTime,
        breakStartTime: raw.breakStartTime,
        breakEndTime:   raw.breakEndTime,
        breakMinutes:   raw.breakMinutes,
      } : null,
      // 실효값 (null 필드는 회사 기본값으로 채워진 결과)
      effective: {
        workStartTime:  effective.workStartTime,
        workEndTime:    effective.workEndTime,
        breakStartTime: effective.breakStartTime,
        breakEndTime:   effective.breakEndTime,
        breakMinutes:   effective.breakMinutes,
      },
      isCustom: effective.isCustom,
    })
  } catch (err) {
    console.error('[sites/[id]/policy GET]', err)
    return internalError()
  }
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { id } = await params

    const site = await prisma.site.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!site) return notFound('현장을 찾을 수 없습니다.')

    const body = await request.json()
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const data = parsed.data

    // upsert: 정책 레코드가 없으면 생성, 있으면 업데이트
    await prisma.siteAttendancePolicy.upsert({
      where:  { siteId: id },
      create: {
        siteId: id,
        workStartTime:  data.workStartTime  ?? null,
        workEndTime:    data.workEndTime    ?? null,
        breakStartTime: data.breakStartTime ?? null,
        breakEndTime:   data.breakEndTime   ?? null,
        breakMinutes:   data.breakMinutes   ?? null,
      },
      update: {
        ...(data.workStartTime  !== undefined ? { workStartTime:  data.workStartTime  } : {}),
        ...(data.workEndTime    !== undefined ? { workEndTime:    data.workEndTime    } : {}),
        ...(data.breakStartTime !== undefined ? { breakStartTime: data.breakStartTime } : {}),
        ...(data.breakEndTime   !== undefined ? { breakEndTime:   data.breakEndTime   } : {}),
        ...(data.breakMinutes   !== undefined ? { breakMinutes:   data.breakMinutes   } : {}),
      },
    })

    const effective = await resolveEffectiveSiteAttendancePolicy(id)

    await writeAuditLog({
      adminId:     session.sub,
      actionType:  'UPDATE_SITE',
      targetType:  'Site',
      targetId:    id,
      description: `현장 근무시간 정책 설정: ${site.name} | breakMinutes=${effective.breakMinutes}`,
    })

    return ok({ effective }, '현장 근무시간 정책이 저장되었습니다.')
  } catch (err) {
    console.error('[sites/[id]/policy PUT]', err)
    return internalError()
  }
}
