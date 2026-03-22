import { getSiteByQrToken } from '@/lib/qr/qr-token'
import { processAttendanceCheckOut } from '@/lib/attendance/attendance-engine'

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

  // QR → 현장 ID 조회
  const site = await getSiteByQrToken(qrToken)
  if (!site) {
    return { success: false, message: '유효하지 않은 QR코드입니다.' }
  }

  // 공통 엔진으로 위임
  return processAttendanceCheckOut(workerId, deviceToken, site.id, latitude, longitude)
}
