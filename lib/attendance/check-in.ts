import { getSiteByQrToken } from '@/lib/qr/qr-token'
import { processAttendanceCheckIn } from '@/lib/attendance/attendance-engine'
import { schedulePresenceChecksForAttendance } from '@/lib/attendance/presence-scheduler'

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

  // QR → 현장 ID 조회
  const site = await getSiteByQrToken(qrToken)
  if (!site) {
    return { success: false, message: '유효하지 않은 QR코드입니다.' }
  }

  // 공통 엔진으로 위임
  return processAttendanceCheckIn(
    {
      workerId,
      deviceToken,
      siteId: site.id,
      latitude,
      longitude,
      isDirectCheckIn: false,
      qrToken,
    },
    (attendanceId) => schedulePresenceChecksForAttendance(attendanceId)
  )
}
