import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/response'

function isValidTime(t: unknown): t is string {
  return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t)
}

async function getOrCreate() {
  return prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
}

function toDto(s: Awaited<ReturnType<typeof getOrCreate>>) {
  return {
    // 메타
    planType: s.planType,
    updatedAt: s.updatedAt.toISOString(),
    // 출퇴근 기준
    checkInStart: s.checkInStart,
    checkOutEnd: s.checkOutEnd,
    tardyMinutes: s.tardyMinutes,
    earlyLeaveMinutes: s.earlyLeaveMinutes,
    absentMarkHour: s.absentMarkHour,
    reviewOnException: s.reviewOnException,
    // 체류 확인
    presenceCheckFeatureAvailable: s.presenceCheckFeatureAvailable,
    presenceCheckEnabled: s.presenceCheckEnabled,
    presenceCheckAmEnabled: s.presenceCheckAmEnabled,
    presenceCheckPmEnabled: s.presenceCheckPmEnabled,
    presenceCheckRadiusMeters: s.presenceCheckRadiusMeters,
    presenceCheckResponseLimitMinutes: s.presenceCheckResponseLimitMinutes,
    presenceCheckFailureNeedsReview: s.presenceCheckFailureNeedsReview,
    presenceCheckAmStart: s.presenceCheckAmStart,
    presenceCheckAmEnd: s.presenceCheckAmEnd,
    presenceCheckPmStart: s.presenceCheckPmStart,
    presenceCheckPmEnd: s.presenceCheckPmEnd,
    // 공수 기준
    mandayFullMinutes: s.mandayFullMinutes,
    mandayPartialOk: s.mandayPartialOk,
    mandayManualOk: s.mandayManualOk,
    mandayAutoReview: s.mandayAutoReview,
    // 노임 기준
    wageByManday: s.wageByManday,
    wageMonthly: s.wageMonthly,
    wageTotal: s.wageTotal,
    wageManualOk: s.wageManualOk,
    // 관리자 설정
    adminDisplayName: s.adminDisplayName,
    adminContact: s.adminContact,
    requireReasonOnEdit: s.requireReasonOnEdit,
    keepEditHistory: s.keepEditHistory,
    confirmBeforeSave: s.confirmBeforeSave,
    // 현장 운영
    siteDefaultStatus: s.siteDefaultStatus,
    siteEndingWarnDays: s.siteEndingWarnDays,
    siteDefaultSort: s.siteDefaultSort,
    siteAutoReview: s.siteAutoReview,
    // 미출근 기준: N명 이상 미출근 시 확인필요 처리 (임시값, 추후 sites 화면에서 자동 연동)
    absentAlertThreshold: s.absentAlertThreshold,
  }
}

// GET /api/admin/settings
export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const s = await getOrCreate()
    return ok(toDto(s))
  } catch (err) {
    console.error('[settings GET]', err)
    return internalError()
  }
}

// PATCH /api/admin/settings
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (session.role === 'VIEWER') return forbidden('조회 전용 계정입니다.')

    const body = await req.json()
    const data: Record<string, unknown> = {}

    // ── 출퇴근 기준 ──────────────────────────────────────────────────
    if (body.checkInStart !== undefined) {
      if (!isValidTime(body.checkInStart)) return badRequest('출근 기준 시간 형식이 올바르지 않습니다. (HH:mm)')
      data.checkInStart = body.checkInStart
    }
    if (body.checkOutEnd !== undefined) {
      if (!isValidTime(body.checkOutEnd)) return badRequest('퇴근 기준 시간 형식이 올바르지 않습니다. (HH:mm)')
      data.checkOutEnd = body.checkOutEnd
    }
    if (body.tardyMinutes !== undefined) {
      if (typeof body.tardyMinutes !== 'number' || body.tardyMinutes < 0 || body.tardyMinutes > 120)
        return badRequest('지각 판정 기준은 0~120분 사이여야 합니다.')
      data.tardyMinutes = body.tardyMinutes
    }
    if (body.earlyLeaveMinutes !== undefined) {
      if (typeof body.earlyLeaveMinutes !== 'number' || body.earlyLeaveMinutes < 0 || body.earlyLeaveMinutes > 120)
        return badRequest('조기퇴근 기준은 0~120분 사이여야 합니다.')
      data.earlyLeaveMinutes = body.earlyLeaveMinutes
    }
    if (body.absentMarkHour !== undefined) {
      if (!isValidTime(body.absentMarkHour)) return badRequest('미출근 판정 시각 형식이 올바르지 않습니다. (HH:mm)')
      data.absentMarkHour = body.absentMarkHour
    }
    if (body.reviewOnException !== undefined) data.reviewOnException = Boolean(body.reviewOnException)

    // ── 체류 확인 (유료) ─────────────────────────────────────────────
    const presenceFields = [
      'presenceCheckEnabled', 'presenceCheckAmEnabled', 'presenceCheckPmEnabled',
      'presenceCheckRadiusMeters', 'presenceCheckResponseLimitMinutes',
      'presenceCheckFailureNeedsReview', 'presenceCheckAmStart', 'presenceCheckAmEnd',
      'presenceCheckPmStart', 'presenceCheckPmEnd',
    ]
    if (presenceFields.some((f) => body[f] !== undefined)) {
      const current = await getOrCreate()
      if (!current.presenceCheckFeatureAvailable) {
        return forbidden('이 기능은 유료 플랜 전용입니다.')
      }
      if (body.presenceCheckEnabled !== undefined) data.presenceCheckEnabled = Boolean(body.presenceCheckEnabled)
      if (body.presenceCheckAmEnabled !== undefined) data.presenceCheckAmEnabled = Boolean(body.presenceCheckAmEnabled)
      if (body.presenceCheckPmEnabled !== undefined) data.presenceCheckPmEnabled = Boolean(body.presenceCheckPmEnabled)
      if (body.presenceCheckRadiusMeters !== undefined) {
        if (typeof body.presenceCheckRadiusMeters !== 'number' || body.presenceCheckRadiusMeters < 10 || body.presenceCheckRadiusMeters > 100)
          return badRequest('체류 확인 반경은 10~100m 사이여야 합니다.')
        data.presenceCheckRadiusMeters = body.presenceCheckRadiusMeters
      }
      if (body.presenceCheckResponseLimitMinutes !== undefined) {
        if (typeof body.presenceCheckResponseLimitMinutes !== 'number' || body.presenceCheckResponseLimitMinutes < 5 || body.presenceCheckResponseLimitMinutes > 60)
          return badRequest('응답 제한 시간은 5~60분 사이여야 합니다.')
        data.presenceCheckResponseLimitMinutes = body.presenceCheckResponseLimitMinutes
      }
      if (body.presenceCheckFailureNeedsReview !== undefined)
        data.presenceCheckFailureNeedsReview = Boolean(body.presenceCheckFailureNeedsReview)
      if (body.presenceCheckAmStart !== undefined) {
        if (!isValidTime(body.presenceCheckAmStart)) return badRequest('오전 시작 시간 형식이 올바르지 않습니다.')
        data.presenceCheckAmStart = body.presenceCheckAmStart
      }
      if (body.presenceCheckAmEnd !== undefined) {
        if (!isValidTime(body.presenceCheckAmEnd)) return badRequest('오전 종료 시간 형식이 올바르지 않습니다.')
        data.presenceCheckAmEnd = body.presenceCheckAmEnd
      }
      if (body.presenceCheckPmStart !== undefined) {
        if (!isValidTime(body.presenceCheckPmStart)) return badRequest('오후 시작 시간 형식이 올바르지 않습니다.')
        data.presenceCheckPmStart = body.presenceCheckPmStart
      }
      if (body.presenceCheckPmEnd !== undefined) {
        if (!isValidTime(body.presenceCheckPmEnd)) return badRequest('오후 종료 시간 형식이 올바르지 않습니다.')
        data.presenceCheckPmEnd = body.presenceCheckPmEnd
      }
    }

    // ── 공수 기준 ────────────────────────────────────────────────────
    if (body.mandayFullMinutes !== undefined) {
      if (typeof body.mandayFullMinutes !== 'number' || body.mandayFullMinutes < 60 || body.mandayFullMinutes > 1200)
        return badRequest('공수 기준 시간은 60~1200분 사이여야 합니다.')
      data.mandayFullMinutes = body.mandayFullMinutes
    }
    if (body.mandayPartialOk !== undefined) data.mandayPartialOk = Boolean(body.mandayPartialOk)
    if (body.mandayManualOk !== undefined) data.mandayManualOk = Boolean(body.mandayManualOk)
    if (body.mandayAutoReview !== undefined) data.mandayAutoReview = Boolean(body.mandayAutoReview)

    // ── 노임 기준 ────────────────────────────────────────────────────
    if (body.wageByManday !== undefined) data.wageByManday = Boolean(body.wageByManday)
    if (body.wageMonthly !== undefined) data.wageMonthly = Boolean(body.wageMonthly)
    if (body.wageTotal !== undefined) data.wageTotal = Boolean(body.wageTotal)
    if (body.wageManualOk !== undefined) data.wageManualOk = Boolean(body.wageManualOk)

    // ── 관리자 설정 ──────────────────────────────────────────────────
    if (body.adminDisplayName !== undefined) data.adminDisplayName = String(body.adminDisplayName).slice(0, 50)
    if (body.adminContact !== undefined) data.adminContact = String(body.adminContact).slice(0, 100)
    if (body.requireReasonOnEdit !== undefined) data.requireReasonOnEdit = Boolean(body.requireReasonOnEdit)
    if (body.keepEditHistory !== undefined) data.keepEditHistory = Boolean(body.keepEditHistory)
    if (body.confirmBeforeSave !== undefined) data.confirmBeforeSave = Boolean(body.confirmBeforeSave)

    // ── 현장 운영 ────────────────────────────────────────────────────
    if (body.siteDefaultStatus !== undefined) {
      if (!['ACTIVE', 'INACTIVE'].includes(body.siteDefaultStatus))
        return badRequest('유효하지 않은 현장 기본 상태입니다.')
      data.siteDefaultStatus = body.siteDefaultStatus
    }
    if (body.siteEndingWarnDays !== undefined) {
      if (typeof body.siteEndingWarnDays !== 'number' || body.siteEndingWarnDays < 0 || body.siteEndingWarnDays > 90)
        return badRequest('종료임박 기준은 0~90일 사이여야 합니다.')
      data.siteEndingWarnDays = body.siteEndingWarnDays
    }
    if (body.siteDefaultSort !== undefined) {
      if (!['endDate_asc', 'createdAt_desc', 'name_asc'].includes(body.siteDefaultSort))
        return badRequest('유효하지 않은 정렬 기준입니다.')
      data.siteDefaultSort = body.siteDefaultSort
    }
    if (body.siteAutoReview !== undefined) data.siteAutoReview = Boolean(body.siteAutoReview)
    if (body.absentAlertThreshold !== undefined) {
      if (typeof body.absentAlertThreshold !== 'number' || body.absentAlertThreshold < 1 || body.absentAlertThreshold > 50)
        return badRequest('미출근 확인필요 기준은 1~50명 사이여야 합니다.')
      data.absentAlertThreshold = body.absentAlertThreshold
    }

    if (Object.keys(data).length === 0) return badRequest('변경할 항목이 없습니다.')

    const updated = await prisma.appSettings.update({
      where: { id: 'singleton' },
      data,
    })

    // 감사로그
    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId: session.sub,
          actionType: 'SETTINGS_CHANGE',
          targetType: 'OPERATIONAL_SETTINGS',
          targetId: 'singleton',
          description: `운영 설정 변경: ${JSON.stringify(data)}`,
        },
      })
    } catch (logErr) {
      console.error('[settings PATCH] 감사로그 실패', logErr)
    }

    return ok(toDto(updated))
  } catch (err) {
    console.error('[settings PATCH]', err)
    return internalError()
  }
}
