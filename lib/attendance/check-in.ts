import { prisma } from '@/lib/db/prisma'
import { getSiteByQrToken } from '@/lib/qr/qr-token'
import { isWithinRadius } from '@/lib/gps/distance'
import { validateDevice } from '@/lib/auth/device'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

interface CheckInInput {
  workerId: string
  deviceToken: string
  qrToken: string
  latitude: number
  longitude: number
}

interface CheckInResult {
  success: boolean
  message: string
  attendanceId?: string
  distance?: number
}

export async function processCheckIn(input: CheckInInput): Promise<CheckInResult> {
  const { workerId, deviceToken, qrToken, latitude, longitude } = input

  // 1. 기기 검증
  const validDevice = await validateDevice(workerId, deviceToken)
  if (!validDevice) {
    return { success: false, message: '등록된 기기에서만 출퇴근이 가능합니다.' }
  }

  // 2. QR → 현장 조회
  const site = await getSiteByQrToken(qrToken)
  if (!site) {
    return { success: false, message: '유효하지 않은 QR코드입니다.' }
  }

  // 3. GPS 반경 체크
  const extraTolerance = parseInt(process.env.GPS_EXTRA_TOLERANCE ?? '0', 10)
  const { within, distance } = isWithinRadius(
    latitude, longitude,
    site.latitude, site.longitude,
    site.allowedRadius, extraTolerance
  )

  if (!within) {
    return {
      success: false,
      message: `현장 반경 밖입니다. (거리: ${distance}m, 허용: ${site.allowedRadius}m)`,
      distance,
    }
  }

  // 4. 오늘 날짜 (KST)
  const workDateStr = toKSTDateString()
  const workDate = kstDateStringToDate(workDateStr)

  // 5. 중복 체크
  const existing = await prisma.attendanceLog.findUnique({
    where: { workerId_siteId_workDate: { workerId, siteId: site.id, workDate } },
  })

  if (existing) {
    return { success: false, message: '이미 오늘 출근 처리되었습니다.' }
  }

  // 6. 출근 기록 생성
  const log = await prisma.attendanceLog.create({
    data: {
      workerId,
      siteId: site.id,
      workDate,
      checkInAt: new Date(),
      checkInLat: latitude,
      checkInLng: longitude,
      checkInDistance: distance,
      qrToken,
      status: 'WORKING',
    },
  })

  return { success: true, message: '출근이 완료되었습니다.', attendanceId: log.id, distance }
}
