/**
 * GET  /api/admin/insurance-rates/sources  — 고시 소스 목록
 * POST /api/admin/insurance-rates/sources  — 소스 초기화 (최초 1회)
 * PATCH /api/admin/insurance-rates/sources — 마지막 확인 시각 업데이트
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole, SUPER_ADMIN_ONLY } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, internalError } from '@/lib/utils/response'
import { DEFAULT_RATE_SOURCES, shouldCheckNow } from '@/lib/insurance/rate-monitor'

export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const sources = await prisma.insuranceRateSource.findMany({
      orderBy: { rateType: 'asc' },
    })

    const now = new Date()
    const sourcesWithStatus = sources.map(s => ({
      ...s,
      needsCheck: shouldCheckNow(s.lastCheckedAt, now),
      nextCheckDate: s.lastCheckedAt
        ? (() => {
            const month = s.lastCheckedAt.getMonth() + 1
            const next  = new Date(s.lastCheckedAt)
            if (month >= 1 && month <= 7) {
              const daysUntilMonday = (8 - s.lastCheckedAt.getDay()) % 7 || 7
              next.setDate(s.lastCheckedAt.getDate() + daysUntilMonday)
            } else {
              next.setDate(s.lastCheckedAt.getDate() + 1)
              while (next.getDay() === 0 || next.getDay() === 6) {
                next.setDate(next.getDate() + 1)
              }
            }
            next.setHours(9, 0, 0, 0)
            return next.toISOString()
          })()
        : null,
    }))

    return NextResponse.json({ success: true, data: sourcesWithStatus })
  } catch (err) {
    console.error('[insurance-rates/sources GET]', err)
    return internalError()
  }
}

/**
 * POST — 소스 초기화 (DB에 없는 소스만 생성)
 * SUPER_ADMIN 전용
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const created: string[] = []
    const skipped: string[] = []

    for (const config of DEFAULT_RATE_SOURCES) {
      const exists = await prisma.insuranceRateSource.findUnique({
        where: { rateType: config.rateType },
      })
      if (exists) {
        skipped.push(config.rateType)
        continue
      }
      await prisma.insuranceRateSource.create({
        data: {
          rateType:            config.rateType,
          sourceName:          config.sourceName,
          sourceUrl:           config.sourceUrl,
          checkFrequencyDays:  7,
          notes:               config.notes,
        },
      })
      created.push(config.rateType)
    }

    return NextResponse.json({
      success: true,
      message: `초기화 완료. 생성: ${created.length}개, 이미 존재: ${skipped.length}개`,
      created,
      skipped,
    })
  } catch (err) {
    console.error('[insurance-rates/sources POST]', err)
    return internalError()
  }
}

/**
 * PATCH — 마지막 확인 시각 업데이트
 * body: { rateType, note? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, SUPER_ADMIN_ONLY)
    if (deny) return deny

    const body = await req.json()
    const { rateType, note } = body
    if (!rateType) {
      return NextResponse.json({ error: 'rateType이 필요합니다.' }, { status: 400 })
    }

    const now = new Date()
    const updated = await prisma.insuranceRateSource.update({
      where: { rateType },
      data: {
        lastCheckedAt: now,
        ...(note ? { currentRateNote: note } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      message: `${rateType} 마지막 확인 시각이 업데이트되었습니다.`,
      data: updated,
    })
  } catch (err) {
    console.error('[insurance-rates/sources PATCH]', err)
    return internalError()
  }
}
