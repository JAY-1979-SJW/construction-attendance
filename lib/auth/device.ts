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
): Promise<{ isAutoApproved: boolean }> {
  const existing = await prisma.workerDevice.findFirst({
    where: { workerId, deviceToken },
  })

  if (existing) {
    await prisma.workerDevice.update({
      where: { id: existing.id },
      data: { isActive: true, lastLoginAt: new Date(), deviceName },
    })
    return { isAutoApproved: true }
  }

  // 기기 승인 정책 조회
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' },
    select: { deviceApprovalMode: true },
  })
  const mode = settings?.deviceApprovalMode ?? 'MANUAL'

  const hasPrimary = await prisma.workerDevice.count({
    where: { workerId, isPrimary: true, isActive: true },
  })

  // AUTO_FIRST: 첫 기기는 자동 승인, 이후 기기는 MANUAL과 동일
  const isFirstDevice = hasPrimary === 0
  const autoApprove = mode === 'AUTO_FIRST' && isFirstDevice

  await prisma.workerDevice.create({
    data: {
      workerId,
      deviceToken,
      deviceName,
      isPrimary: isFirstDevice,
      isActive: autoApprove,
      lastLoginAt: new Date(),
      approvedAt: autoApprove ? new Date() : null,
    },
  })

  return { isAutoApproved: autoApprove }
}
