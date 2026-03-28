/**
 * GET /api/attendance/eligibility?siteId=xxx&deviceToken=xxx&lat=xxx&lng=xxx
 * 출근 가능 조건 사전 검사 — 모든 조건 상태를 일괄 반환.
 * 근로자가 출근 전에 어떤 조건이 미충족인지 확인 가능.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getWorkerSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { validateDeviceDetailed } from '@/lib/auth/device'
import { calcDistance } from '@/lib/attendance/attendance-engine'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'
import { resolveEffectiveSiteAttendancePolicy } from '@/lib/labor/resolve-site-policy'

interface ConditionResult {
  key: string
  label: string
  passed: boolean
  message: string
}

export async function GET(req: NextRequest) {
  try {
    const session = await getWorkerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workerId = session.sub
    const { searchParams } = new URL(req.url)
    const siteId = searchParams.get('siteId')
    const deviceToken = searchParams.get('deviceToken')
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null

    const conditions: ConditionResult[] = []

    // 1. 계정 승인 상태
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { accountStatus: true, isActive: true },
    })
    if (!worker || !worker.isActive) {
      conditions.push({ key: 'account', label: '계정 상태', passed: false, message: '비활성 계정입니다.' })
    } else if (worker.accountStatus !== 'APPROVED') {
      const msgs: Record<string, string> = {
        PENDING: '회원가입 승인 대기 중입니다.',
        REJECTED: '회원가입이 반려되었습니다.',
        SUSPENDED: '계정이 정지되었습니다.',
      }
      conditions.push({ key: 'account', label: '계정 상태', passed: false, message: msgs[worker.accountStatus] || '계정 상태 확인 필요' })
    } else {
      conditions.push({ key: 'account', label: '계정 상태', passed: true, message: '승인됨' })
    }

    // 2. 기기 승인
    if (deviceToken) {
      const deviceStatus = await validateDeviceDetailed(workerId, deviceToken)
      if (deviceStatus === 'APPROVED') {
        conditions.push({ key: 'device', label: '기기 승인', passed: true, message: '승인된 기기' })
      } else if (deviceStatus === 'BLOCKED') {
        conditions.push({ key: 'device', label: '기기 승인', passed: false, message: '차단된 기기입니다.' })
      } else {
        conditions.push({ key: 'device', label: '기기 승인', passed: false, message: '미승인 기기입니다. 관리자 승인 대기.' })
      }
    } else {
      conditions.push({ key: 'device', label: '기기 승인', passed: false, message: '기기 정보가 없습니다.' })
    }

    // 3. 현장 배정
    if (siteId) {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: { id: true, name: true, isActive: true, latitude: true, longitude: true, allowedRadius: true },
      })
      if (!site || !site.isActive) {
        conditions.push({ key: 'site', label: '현장 배정', passed: false, message: '유효하지 않은 현장입니다.' })
      } else {
        const assignment = await prisma.workerSiteAssignment.findFirst({
          where: { workerId, siteId, isActive: true },
        })
        if (!assignment) {
          conditions.push({ key: 'site', label: '현장 배정', passed: false, message: '현장 참여 승인이 필요합니다.' })
        } else {
          conditions.push({ key: 'site', label: '현장 배정', passed: true, message: `${site.name} 배정됨` })
        }

        // 4. 필수 문서 완료
        const docPkg = await prisma.workerDocumentPackage.findFirst({
          where: { workerId, siteId, scope: 'SITE' },
          select: { overallStatus: true, missingDocCount: true, rejectedDocCount: true, approvedDocCount: true, requiredDocCount: true },
        })
        if (!docPkg) {
          conditions.push({ key: 'docs', label: '필수 서류', passed: false, message: '문서 패키지가 없습니다.' })
        } else if (docPkg.overallStatus === 'READY') {
          conditions.push({ key: 'docs', label: '필수 서류', passed: true, message: `${docPkg.approvedDocCount}/${docPkg.requiredDocCount} 완료` })
        } else {
          const reasons: string[] = []
          if (docPkg.missingDocCount > 0) reasons.push(`미제출 ${docPkg.missingDocCount}건`)
          if (docPkg.rejectedDocCount > 0) reasons.push(`반려 ${docPkg.rejectedDocCount}건`)
          conditions.push({ key: 'docs', label: '필수 서류', passed: false, message: reasons.join(', ') || '서류 미완료' })
        }

        // 5. GPS 반경
        if (lat !== null && lng !== null && site) {
          const { within, distance } = calcDistance(lat, lng, site.latitude, site.longitude, site.allowedRadius)
          if (within) {
            conditions.push({ key: 'gps', label: 'GPS 위치', passed: true, message: `반경 내 (${Math.round(distance)}m)` })
          } else {
            conditions.push({ key: 'gps', label: 'GPS 위치', passed: false, message: `반경 밖 (${Math.round(distance)}m / 허용 ${site.allowedRadius}m)` })
          }
        } else {
          conditions.push({ key: 'gps', label: 'GPS 위치', passed: false, message: '위치 정보 없음' })
        }
      }

      // 6. 출근 가능 시간 검증
      try {
        const policy = await resolveEffectiveSiteAttendancePolicy(siteId)
        const now = new Date()
        const kstHour = (now.getUTCHours() + 9) % 24
        const kstMin = now.getUTCMinutes()
        const currentTime = `${String(kstHour).padStart(2, '0')}:${String(kstMin).padStart(2, '0')}`
        const startTime = policy.workStartTime
        const endTime = policy.workEndTime
        if (startTime && endTime) {
          const [sh, sm] = startTime.split(':').map(Number)
          const earlyStart = `${String(Math.max(0, sh - 2)).padStart(2, '0')}:${String(sm).padStart(2, '0')}`
          if (currentTime >= earlyStart && currentTime <= endTime) {
            conditions.push({ key: 'time', label: '출근 시간', passed: true, message: `허용 시간 내 (${earlyStart}~${endTime})` })
          } else {
            conditions.push({ key: 'time', label: '출근 시간', passed: false, message: `출근 가능 시간: ${earlyStart}~${endTime}` })
          }
        } else {
          conditions.push({ key: 'time', label: '출근 시간', passed: true, message: '시간 제한 없음' })
        }
      } catch {
        conditions.push({ key: 'time', label: '출근 시간', passed: true, message: '시간 정책 미설정' })
      }

      // 7. 중복 출근 체크
      const workDate = kstDateStringToDate(toKSTDateString())
      const existing = await prisma.attendanceLog.findFirst({
        where: { workerId, siteId, workDate, status: { not: 'ADJUSTED' } },
      })
      if (existing) {
        conditions.push({ key: 'duplicate', label: '중복 출근', passed: false, message: '이미 오늘 출근 처리되었습니다.' })
      } else {
        conditions.push({ key: 'duplicate', label: '중복 출근', passed: true, message: '출근 가능' })
      }
    }

    const allPassed = conditions.every(c => c.passed)

    return NextResponse.json({
      success: true,
      eligible: allPassed,
      conditions,
    })
  } catch (err) {
    console.error('[attendance/eligibility]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
