export interface WorkerInfo {
  id: string
  name: string
  phone: string
  company: string
  jobTitle: string
  isActive: boolean
}

export interface WorkerDevice {
  id: string
  workerId: string
  deviceToken: string
  deviceName: string
  isPrimary: boolean
  isActive: boolean
  lastLoginAt: string | null
}

export interface DeviceChangeRequest {
  id: string
  workerId: string
  workerName: string
  oldDeviceToken: string | null
  newDeviceToken: string
  newDeviceName: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedAt: string
  processedAt: string | null
}
