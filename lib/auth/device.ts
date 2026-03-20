import { prisma } from '@/lib/db/prisma'

export async function validateDevice(workerId: string, deviceToken: string): Promise<boolean> {
  const device = await prisma.workerDevice.findFirst({
    where: {
      workerId,
      deviceToken,
      isActive: true,
    },
  })

  if (!device) return false

  // 마지막 로그인 시각 갱신
  await prisma.workerDevice.update({
    where: { id: device.id },
    data: { lastLoginAt: new Date() },
  })

  return true
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
      isPrimary: hasPrimary === 0, // 첫 기기는 기본 기기
      isActive: true,
      lastLoginAt: new Date(),
    },
  })
}
