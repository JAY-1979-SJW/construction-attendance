import { prisma } from '@/lib/db/prisma'

export type DeviceValidationResult =
  | 'APPROVED'
  | 'BLOCKED'
  | 'NOT_FOUND'

/**
 * 기기 검증 — 차단(BLOCKED)과 미승인(NOT_FOUND)을 분리 반환
 */
export async function validateDeviceDetailed(
  workerId: string,
  deviceToken: string
): Promise<DeviceValidationResult> {
  const device = await prisma.workerDevice.findFirst({
    where: { workerId, deviceToken, isActive: true },
    select: { id: true, isBlocked: true },
  })

  if (!device) return 'NOT_FOUND'
  if (device.isBlocked) {
    return 'BLOCKED'
  }

  // 마지막 로그인 시각 갱신
  await prisma.workerDevice.update({
    where: { id: device.id },
    data: { lastLoginAt: new Date() },
  })

  return 'APPROVED'
}

/**
 * 기기 검증 — boolean 반환 (레거시 호환)
 * isBlocked=true인 기기는 false 반환
 */
export async function validateDevice(workerId: string, deviceToken: string): Promise<boolean> {
  const result = await validateDeviceDetailed(workerId, deviceToken)
  return result === 'APPROVED'
}

export async function registerDevice(
  workerId: string,
  deviceToken: string,
  deviceName: string
): Promise<void> {
  const existing = await prisma.workerDevice.findFirst({
    where: { workerId, deviceToken },
  })

  if (existing) {
    await prisma.workerDevice.update({
      where: { id: existing.id },
      data: { isActive: true, lastLoginAt: new Date(), deviceName },
    })
    return
  }

  const hasPrimary = await prisma.workerDevice.count({
    where: { workerId, isPrimary: true, isActive: true },
  })

  await prisma.workerDevice.create({
    data: {
      workerId,
      deviceToken,
      deviceName,
      isPrimary: hasPrimary === 0,
      isActive: true,
      lastLoginAt: new Date(),
    },
  })
}
