import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/admin-session'
import { ok, unauthorized, forbidden, badRequest, internalError } from '@/lib/utils/response'

const RADIUS_MIN = 10
const RADIUS_MAX = 100
const RESPONSE_LIMIT_MIN = 5
const RESPONSE_LIMIT_MAX = 60

// 싱글톤 설정 조회 또는 기본값 반환
async function getOrCreateSettings() {
  return prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
}

// GET /api/admin/settings/attendance
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession(req)
    if (!session) return unauthorized()

    const s = await getOrCreateSettings()

    return ok({
      planType: s.planType,
      featureAvailable: s.presenceCheckFeatureAvailable,
      enabled: s.presenceCheckEnabled,
      amEnabled: s.presenceCheckAmEnabled,
      pmEnabled: s.presenceCheckPmEnabled,
      radiusMeters: s.presenceCheckRadiusMeters,
      responseLimitMinutes: s.presenceCheckResponseLimitMinutes,
      failureNeedsReview: s.presenceCheckFailureNeedsReview,
    })
  } catch (err) {
    console.error('[settings/attendance GET]', err)
    return internalError()
  }
}

// POST /api/admin/settings/attendance
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession(req)
    if (!session) return unauthorized()
    if (session.role === 'VIEWER') return forbidden('조회 전용 계정입니다.')

    const body = await req.json()
    const {
      enabled,
      amEnabled,
      pmEnabled,
      radiusMeters,
      responseLimitMinutes,
      failureNeedsReview,
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
        ...(enabled !== undefined && { presenceCheckEnabled: enabled }),
        ...(amEnabled !== undefined && { presenceCheckAmEnabled: amEnabled }),
        ...(pmEnabled !== undefined && { presenceCheckPmEnabled: pmEnabled }),
        ...(radiusMeters !== undefined && { presenceCheckRadiusMeters: radiusMeters }),
        ...(responseLimitMinutes !== undefined && { presenceCheckResponseLimitMinutes: responseLimitMinutes }),
        ...(failureNeedsReview !== undefined && { presenceCheckFailureNeedsReview: failureNeedsReview }),
      },
    })

    return ok({
      planType: updated.planType,
      featureAvailable: updated.presenceCheckFeatureAvailable,
      enabled: updated.presenceCheckEnabled,
      amEnabled: updated.presenceCheckAmEnabled,
      pmEnabled: updated.presenceCheckPmEnabled,
      radiusMeters: updated.presenceCheckRadiusMeters,
      responseLimitMinutes: updated.presenceCheckResponseLimitMinutes,
      failureNeedsReview: updated.presenceCheckFailureNeedsReview,
      ...(warning && { warning }),
    })
  } catch (err) {
    console.error('[settings/attendance POST]', err)
    return internalError()
  }
}
