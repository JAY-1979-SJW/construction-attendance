import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { ok, unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/response'

const RADIUS_MIN = 10
const RADIUS_MAX = 100
const RESPONSE_LIMIT_MIN = 5
const RESPONSE_LIMIT_MAX = 60

/** HH:mm 형식 검증 */
function isValidTime(t: unknown): t is string {
  return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t)
}

/** 분 단위 변환 */
function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// 싱글톤 설정 조회 또는 기본값 반환
async function getOrCreateSettings() {
  return prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
}

function settingsToDto(s: Awaited<ReturnType<typeof getOrCreateSettings>>) {
  return {
    planType:             s.planType,
    featureAvailable:     s.presenceCheckFeatureAvailable,
    enabled:              s.presenceCheckEnabled,
    amEnabled:            s.presenceCheckAmEnabled,
    pmEnabled:            s.presenceCheckPmEnabled,
    radiusMeters:         s.presenceCheckRadiusMeters,
    responseLimitMinutes: s.presenceCheckResponseLimitMinutes,
    failureNeedsReview:   s.presenceCheckFailureNeedsReview,
    amStart:              s.presenceCheckAmStart,
    amEnd:                s.presenceCheckAmEnd,
    pmStart:              s.presenceCheckPmStart,
    pmEnd:                s.presenceCheckPmEnd,
  }
}

// GET /api/admin/settings/attendance
export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const s = await getOrCreateSettings()
    return ok(settingsToDto(s))
  } catch (err) {
    console.error('[settings/attendance GET]', err)
    return internalError()
  }
}

// POST /api/admin/settings/attendance
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    if (session.role === 'VIEWER') return forbidden('조회 전용 계정입니다.')

    const body = await req.json()
    const {
      enabled, amEnabled, pmEnabled,
      radiusMeters, responseLimitMinutes, failureNeedsReview,
      amStart, amEnd, pmStart, pmEnd,
    } = body

    // 유료 플랜 확인
    const current = await getOrCreateSettings()
    if (!current.presenceCheckFeatureAvailable) {
      return forbidden('이 기능은 유료 플랜 전용입니다.')
    }

    // 값 유효성 검사
    if (radiusMeters !== undefined) {
      if (typeof radiusMeters !== 'number' || radiusMeters < RADIUS_MIN || radiusMeters > RADIUS_MAX) {
        return badRequest(`반경은 ${RADIUS_MIN}~${RADIUS_MAX}m 사이여야 합니다.`)
      }
    }
    if (responseLimitMinutes !== undefined) {
      if (typeof responseLimitMinutes !== 'number' || responseLimitMinutes < RESPONSE_LIMIT_MIN || responseLimitMinutes > RESPONSE_LIMIT_MAX) {
        return badRequest(`응답 제한 시간은 ${RESPONSE_LIMIT_MIN}~${RESPONSE_LIMIT_MAX}분 사이여야 합니다.`)
      }
    }

    // AM 시간대 검증
    if (amStart !== undefined || amEnd !== undefined) {
      const start = amStart ?? current.presenceCheckAmStart
      const end   = amEnd   ?? current.presenceCheckAmEnd
      if (!isValidTime(start) || !isValidTime(end)) return badRequest('오전 시간대 형식이 올바르지 않습니다. (HH:mm)')
      if (toMinutes(start) >= toMinutes(end)) return badRequest('오전 시작 시간은 종료 시간보다 빨라야 합니다.')
      const duration = toMinutes(end) - toMinutes(start)
      if (duration < 30) return badRequest('오전 시간대는 최소 30분 이상이어야 합니다.')
    }

    // PM 시간대 검증
    if (pmStart !== undefined || pmEnd !== undefined) {
      const start = pmStart ?? current.presenceCheckPmStart
      const end   = pmEnd   ?? current.presenceCheckPmEnd
      if (!isValidTime(start) || !isValidTime(end)) return badRequest('오후 시간대 형식이 올바르지 않습니다. (HH:mm)')
      if (toMinutes(start) >= toMinutes(end)) return badRequest('오후 시작 시간은 종료 시간보다 빨라야 합니다.')
      const duration = toMinutes(end) - toMinutes(start)
      if (duration < 30) return badRequest('오후 시간대는 최소 30분 이상이어야 합니다.')
    }

    // 오전/오후 둘 다 OFF인데 enabled=true 경고
    const willEnabled = enabled ?? current.presenceCheckEnabled
    const willAm = amEnabled ?? current.presenceCheckAmEnabled
    const willPm = pmEnabled ?? current.presenceCheckPmEnabled
    let warning: string | null = null
    if (willEnabled && !willAm && !willPm) {
      warning = '오전 또는 오후 중 최소 1개는 활성화해야 합니다.'
    }

    // 업데이트
    const updated = await prisma.appSettings.update({
      where: { id: 'singleton' },
      data: {
        ...(enabled              !== undefined && { presenceCheckEnabled:              enabled }),
        ...(amEnabled            !== undefined && { presenceCheckAmEnabled:            amEnabled }),
        ...(pmEnabled            !== undefined && { presenceCheckPmEnabled:            pmEnabled }),
        ...(radiusMeters         !== undefined && { presenceCheckRadiusMeters:         radiusMeters }),
        ...(responseLimitMinutes !== undefined && { presenceCheckResponseLimitMinutes: responseLimitMinutes }),
        ...(failureNeedsReview   !== undefined && { presenceCheckFailureNeedsReview:   failureNeedsReview }),
        ...(amStart              !== undefined && { presenceCheckAmStart:              amStart }),
        ...(amEnd                !== undefined && { presenceCheckAmEnd:                amEnd }),
        ...(pmStart              !== undefined && { presenceCheckPmStart:              pmStart }),
        ...(pmEnd                !== undefined && { presenceCheckPmEnd:                pmEnd }),
      },
    })

    // 감사로그 — 설정 변경 기록
    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId:     session.sub,
          actionType:  'SETTINGS_CHANGE',
          targetType:  'PRESENCE_CHECK_SETTINGS',
          targetId:    'singleton',
          description: `체류 확인 설정 변경: ${JSON.stringify({
            ...(enabled              !== undefined && { enabled }),
            ...(amEnabled            !== undefined && { amEnabled }),
            ...(pmEnabled            !== undefined && { pmEnabled }),
            ...(radiusMeters         !== undefined && { radiusMeters }),
            ...(responseLimitMinutes !== undefined && { responseLimitMinutes }),
            ...(failureNeedsReview   !== undefined && { failureNeedsReview }),
            ...(amStart              !== undefined && { amStart }),
            ...(amEnd                !== undefined && { amEnd }),
            ...(pmStart              !== undefined && { pmStart }),
            ...(pmEnd                !== undefined && { pmEnd }),
          })}`,
        },
      })
    } catch (logErr) {
      console.error('[settings/attendance] 감사로그 기록 실패', logErr)
    }

    return ok({ ...settingsToDto(updated), ...(warning && { warning }) })
  } catch (err) {
    console.error('[settings/attendance POST]', err)
    return internalError()
  }
}
