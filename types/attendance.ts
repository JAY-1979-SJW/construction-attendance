export type AttendanceStatus = 'WORKING' | 'COMPLETED' | 'EXCEPTION'

export interface CheckInRequest {
  qrToken: string
  latitude: number
  longitude: number
  deviceToken: string
}

export interface CheckOutRequest {
  qrToken: string
  latitude: number
  longitude: number
  deviceToken: string
}

export interface AttendanceRecord {
  id: string
  workerId: string
  workerName: string
  siteId: string
  siteName: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: AttendanceStatus
  checkInDistance: number | null
  checkOutDistance: number | null
  exceptionReason: string | null
}

export interface ExceptionRequest {
  attendanceLogId?: string
  siteId: string
  workDate: string
  reason: string
  type: 'CHECK_IN' | 'CHECK_OUT' | 'BOTH'
}
