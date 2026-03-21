import { prisma } from '@/lib/db/prisma'
import { getSiteByQrToken } from '@/lib/qr/qr-token'
import { isWithinRadius } from '@/lib/gps/distance'
import { validateDevice } from '@/lib/auth/device'

interface MoveInput {
  workerId: string
  deviceToken: string
  qrToken: string
  latitude: number
  longitude: number
}

interface MoveResult {
  success: boolean
  message: string
  eventId?: string
  distance?: number
  newSiteId?: string
  newSiteName?: string
}

export async function processMove(input: MoveInput): Promise<MoveResult> {
  const { workerId, deviceToken, qrToken, latitude, longitude } = input

  // 1. 기기 검증
  const isValidDevice = await validateDevice(workerId, deviceToken)
  if (!isValidDevice) {
    return { success: false, message: '등록된 기기에서만 이동 처리가 가능합니다.' }
  }

  // 2. 열린 세션(WORKING) 확인 — 출근 기록이 있어야 이동 가능
  const openLog = await prisma.attendanceLog.findFirst({
    where: {
      workerId,
      status: 'WORKING',
      checkOutAt: null,
    },
    orderBy: { checkInAt: 'desc' },
  })

  if (!openLog) {
    return { success: false, message: '현재 출근 중인 기록이 없습니다. 먼저 출근하세요.' }
  }

  // 3. QR → 새 현장 조회
  const newSite = await getSiteByQrToken(qrToken)
  if (!newSite) {
    return { success: false, message: '유효하지 않은 QR코드입니다.' }
  }

  // 4. 동일 현장 이동 방지 — 현재 근무 현장(마지막 이동 또는 출근 현장) 기준으로 비교
  const lastMoveCheck = await prisma.attendanceEvent.findFirst({
    where: { attendanceLogId: openLog.id, eventType: 'MOVE' },
    orderBy: { occurredAt: 'desc' },
    select: { siteId: true },
  })
  const currentSiteId = lastMoveCheck?.siteId ?? openLog.siteId

  if (currentSiteId === newSite.id) {
    return { success: false, message: '현재 근무 중인 현장과 동일합니다.' }
  }

  // 5. 새 현장 GPS 반경 체크
  const extraTolerance = parseInt(process.env.GPS_EXTRA_TOLERANCE ?? '0', 10)
  const { within, distance } = isWithinRadius(
    latitude, longitude,
    newSite.latitude, newSite.longitude,
    newSite.allowedRadius, extraTolerance
  )

  if (!within) {
    return {
      success: false,
      message: `새 현장 반경 밖입니다. (거리: ${Math.round(distance)}m, 허용: ${newSite.allowedRadius}m)`,
      distance,
    }
  }

  // 6. 기기 ID 조회 (deviceId 기록용)
  const device = await prisma.workerDevice.findFirst({
    where: { workerId, deviceToken, isActive: true },
    select: { id: true },
  })

  // 7. MOVE 이벤트 기록 (checkOutSiteId는 실제 퇴근 시점에만 기록)
  const event = await prisma.attendanceEvent.create({
    data: {
      attendanceLogId: openLog.id,
      workerId,
      eventType: 'MOVE',
      siteId: newSite.id,
      latitude,
      longitude,
      distanceFromSite: distance,
      deviceId: device?.id ?? null,
    },
  })

  return {
    success: true,
    message: `${newSite.name}으로 이동 처리되었습니다.`,
    eventId: event.id,
    distance,
    newSiteId: newSite.id,
    newSiteName: newSite.name,
  }
}
