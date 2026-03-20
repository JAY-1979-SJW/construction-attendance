import { prisma } from '@/lib/db/prisma'
import { getSiteByQrToken } from '@/lib/qr/qr-token'
import { isWithinRadius } from '@/lib/gps/distance'
import { validateDevice } from '@/lib/auth/device'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

interface CheckOutInput {
  workerId: string
  deviceToken: string
  qrToken: string
  latitude: number
  longitude: number
}

interface CheckOutResult {
  success: boolean
  message: string
  distance?: number
}

export async function processCheckOut(input: CheckOutInput): Promise<CheckOutResult> {
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

  // 4. 오늘 출근 기록 조회
  const workDate = kstDateStringToDate(toKSTDateString())
  const log = await prisma.attendanceLog.findUnique({
    where: { workerId_siteId_workDate: { workerId, siteId: site.id, workDate } },
  })

  if (!log) {
    return { success: false, message: '오늘 출근 기록이 없습니다.' }
  }

  if (log.checkOutAt) {
    return { success: false, message: '이미 퇴근 처리되었습니다.' }
  }

  if (log.status === 'EXCEPTION') {
    return { success: false, message: '예외 처리 중인 기록입니다. 관리자에게 문의하세요.' }
  }

  // 5. 퇴근 처리
  await prisma.attendanceLog.update({
    where: { id: log.id },
    data: {
      checkOutAt: new Date(),
      checkOutLat: latitude,
      checkOutLng: longitude,
      checkOutDistance: distance,
      status: 'COMPLETED',
    },
  })

  return { success: true, message: '퇴근이 완료되었습니다.', distance }
}
