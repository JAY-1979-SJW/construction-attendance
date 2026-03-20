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

  // 4. 오늘 열린 출근 세션 조회 (이동형 근무 지원: 출근 현장 무관)
  const workDate = kstDateStringToDate(toKSTDateString())
  const log = await prisma.attendanceLog.findFirst({
    where: {
      workerId,
      status: 'WORKING',
      checkOutAt: null,
      workDate,
    },
  })

  if (!log) {
    return { success: false, message: '오늘 출근 기록이 없습니다.' }
  }

  if (log.status === 'EXCEPTION') {
    return { success: false, message: '예외 처리 중인 기록입니다. 관리자에게 문의하세요.' }
  }

  // 5. 현재 위치 현장 확인
  //    마지막 MOVE 이벤트가 있으면 그 현장이 현재 현장, 없으면 체크인 현장
  const lastMove = await prisma.attendanceEvent.findFirst({
    where: {
      attendanceLogId: log.id,
      eventType: 'MOVE',
    },
    orderBy: { occurredAt: 'desc' },
  })

  const currentSiteId = lastMove?.siteId ?? log.siteId

  if (currentSiteId !== site.id) {
    return {
      success: false,
      message: '현재 위치한 현장의 QR코드를 사용하세요.',
    }
  }

  // 6. 퇴근 처리 — checkOutSiteId는 실제 퇴근 시점에 기록
  //    출근 현장과 퇴근 현장이 같으면 checkOutSiteId는 null 유지 (불필요한 중복)
  const checkOutSiteId = site.id !== log.siteId ? site.id : null

  await prisma.attendanceLog.update({
    where: { id: log.id },
    data: {
      checkOutAt: new Date(),
      checkOutLat: latitude,
      checkOutLng: longitude,
      checkOutDistance: distance,
      checkOutSiteId,
      status: 'COMPLETED',
    },
  })

  return { success: true, message: '퇴근이 완료되었습니다.', distance }
}
