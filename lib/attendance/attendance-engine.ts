/**
 * 출퇴근 검증 공통 엔진
 * QR 출근과 직접 출근 모두 이 엔진을 통해 판정
 */
import { prisma } from '@/lib/db/prisma'
import { isWithinRadius } from '@/lib/gps/distance'
import { validateDevice } from '@/lib/auth/device'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'

export interface SiteInfo {
  id: string
  name: string
  latitude: number
  longitude: number
  allowedRadius: number
}

export interface WorkerSiteAssignmentInfo {
  siteId: string
  companyId: string
  companyName: string
  employmentType: string
  tradeType: string | null
  isPrimary: boolean
}

export interface AttendanceEngineInput {
  workerId: string
  deviceToken: string
  siteId: string
  latitude: number
  longitude: number
  isDirectCheckIn?: boolean
  exceptionReason?: string
}

export interface AttendanceCheckInResult {
  success: boolean
  message: string
  attendanceId?: string
  distance?: number
  withinRadius?: boolean
  companyId?: string
}

export interface AttendanceCheckOutResult {
  success: boolean
  message: string
  distance?: number
  withinRadius?: boolean
  isException?: boolean
}

const GPS_EXTRA_TOLERANCE = parseInt(process.env.GPS_EXTRA_TOLERANCE ?? '0', 10)

/** 기기 검증 */
export async function validateAttendanceDevice(workerId: string, deviceToken: string): Promise<boolean> {
  return validateDevice(workerId, deviceToken)
}

/** 근로자의 배정된 현장 목록 조회 */
export async function getWorkerAvailableSites(workerId: string): Promise<Array<WorkerSiteAssignmentInfo & { site: SiteInfo }>> {
  const now = new Date()
  const assignments = await prisma.workerSiteAssignment.findMany({
    where: {
      workerId,
      isActive: true,
      OR: [
        { assignedTo: null },           // 종료일 없음
        { assignedTo: { gt: now } },    // 아직 종료 안 됨
      ],
    },
    include: {
      site: {
        select: { id: true, name: true, latitude: true, longitude: true, allowedRadius: true, isActive: true },
      },
      company: { select: { companyName: true } },
    },
    orderBy: [{ isPrimary: 'desc' }, { assignedFrom: 'desc' }],
  })

  return assignments
    .filter(a => a.site.isActive)
    .map(a => ({
      siteId: a.siteId,
      companyId: a.companyId,
      companyName: a.company.companyName,
      employmentType: a.tradeType ?? 'DAILY',  // fallback
      tradeType: a.tradeType,
      isPrimary: a.isPrimary,
      site: {
        id: a.site.id,
        name: a.site.name,
        latitude: a.site.latitude,
        longitude: a.site.longitude,
        allowedRadius: a.site.allowedRadius,
      },
    }))
}

/** GPS 거리 계산 */
export function calcDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  allowedRadius: number
): { distance: number; within: boolean } {
  return isWithinRadius(lat1, lng1, lat2, lng2, allowedRadius, GPS_EXTRA_TOLERANCE)
}

/** 현장 배정 조회 (siteId 기준) */
async function getWorkerSiteAssignment(workerId: string, siteId: string) {
  return prisma.workerSiteAssignment.findFirst({
    where: { workerId, siteId, isActive: true },
    include: { company: { select: { companyName: true } } },
    orderBy: { isPrimary: 'desc' },
  })
}

/** 출근 처리 (직접/QR 공통) */
export async function processAttendanceCheckIn(
  input: AttendanceEngineInput,
  schedulePresence: (attendanceId: string) => Promise<void>
): Promise<AttendanceCheckInResult> {
  const { workerId, deviceToken, siteId, latitude, longitude, isDirectCheckIn, exceptionReason } = input

  // 1. 기기 검증
  if (!(await validateAttendanceDevice(workerId, deviceToken))) {
    return { success: false, message: '등록된 기기에서만 출퇴근이 가능합니다.' }
  }

  // 2. 현장 조회
  const site = await prisma.site.findUnique({
    where: { id: siteId, isActive: true },
    select: { id: true, name: true, latitude: true, longitude: true, allowedRadius: true },
  })
  if (!site) {
    return { success: false, message: '유효하지 않은 현장입니다.' }
  }

  // 3. 현장 배정 검증
  const assignment = await getWorkerSiteAssignment(workerId, siteId)
  if (!assignment) {
    return { success: false, message: '배정되지 않은 현장입니다. 관리자에게 문의하세요.' }
  }

  // 4. GPS 거리 계산
  const { within, distance } = calcDistance(latitude, longitude, site.latitude, site.longitude, site.allowedRadius)

  if (!within && !exceptionReason) {
    return {
      success: false,
      message: `현장 반경 밖입니다. (거리: ${Math.round(distance)}m, 허용: ${site.allowedRadius}m)`,
      distance,
      withinRadius: false,
    }
  }

  // 5. 날짜 계산 (KST)
  const workDateStr = toKSTDateString()
  const workDate = kstDateStringToDate(workDateStr)

  // 6. 중복 출근 체크
  const existing = await prisma.attendanceLog.findUnique({
    where: { workerId_siteId_workDate: { workerId, siteId: site.id, workDate } },
  })
  if (existing) {
    return { success: false, message: '이미 오늘 출근 처리되었습니다.' }
  }

  // 7. 출근 기록 생성 (회사 스냅샷 포함)
  const log = await prisma.attendanceLog.create({
    data: {
      workerId,
      siteId: site.id,
      workDate,
      checkInAt: new Date(),
      checkInLat: latitude,
      checkInLng: longitude,
      checkInDistance: distance,
      checkInWithinRadius: within,
      isDirectCheckIn: true,
      status: 'WORKING',
      // 회사 스냅샷
      companyId: assignment.companyId,
      companyNameSnapshot: assignment.company.companyName,
      employmentTypeSnapshot: assignment.tradeType ?? null,
      tradeTypeSnapshot: assignment.tradeType,
    },
  })

  // 8. 출근 이벤트 생성
  await prisma.attendanceEvent.create({
    data: {
      attendanceLogId: log.id,
      workerId,
      siteId: site.id,
      companyId: assignment.companyId,
      eventType: 'CHECK_IN',
      latitude,
      longitude,
      distanceFromSite: distance,
      withinRadius: within,
      deviceTokenSnapshot: deviceToken,
      reason: exceptionReason ?? null,
    },
  })

  // 9. PresenceCheck 예약 (실패해도 출근 유지)
  try {
    await schedulePresence(log.id)
  } catch (err) {
    console.error('[presence] scheduling failed after check-in', { attendanceId: log.id, err })
  }

  return {
    success: true,
    message: '출근이 완료되었습니다.',
    attendanceId: log.id,
    distance,
    withinRadius: within,
    companyId: assignment.companyId,
  }
}

export interface AttendanceSiteMoveResult {
  success: boolean
  message: string
  distance?: number
  withinRadius?: boolean
  fromSiteId?: string
  toSiteId?: string
}

/** 현장 이동 처리 */
export async function processAttendanceSiteMove(
  workerId: string,
  deviceToken: string,
  targetSiteId: string,
  latitude: number,
  longitude: number,
): Promise<AttendanceSiteMoveResult> {

  // 1. 기기 검증
  if (!(await validateAttendanceDevice(workerId, deviceToken))) {
    return { success: false, message: '등록된 기기에서만 이동 처리가 가능합니다.' }
  }

  // 2. 오늘 열린 출근 세션 조회
  const workDate = kstDateStringToDate(toKSTDateString())
  const log = await prisma.attendanceLog.findFirst({
    where: { workerId, status: 'WORKING', checkOutAt: null, workDate },
  })
  if (!log) {
    return { success: false, message: '출근 기록이 없습니다. 먼저 출근하세요.' }
  }

  // 3. 현재 위치 현장 확인
  const lastMove = await prisma.attendanceEvent.findFirst({
    where: { attendanceLogId: log.id, eventType: 'MOVE' },
    orderBy: { occurredAt: 'desc' },
    select: { siteId: true },
  })
  const currentSiteId = lastMove?.siteId ?? log.siteId

  // 4. 같은 현장 이동 차단
  if (currentSiteId === targetSiteId) {
    return { success: false, message: '현재 근무 중인 현장과 동일합니다.' }
  }

  // 5. 이동 대상 현장 배정 확인
  const assignment = await getWorkerSiteAssignment(workerId, targetSiteId)
  if (!assignment) {
    return { success: false, message: '배정되지 않은 현장입니다. 관리자에게 문의하세요.' }
  }

  // 6. 이동 대상 현장 조회
  const site = await prisma.site.findUnique({
    where: { id: targetSiteId, isActive: true },
    select: { id: true, name: true, latitude: true, longitude: true, allowedRadius: true },
  })
  if (!site) {
    return { success: false, message: '유효하지 않은 현장입니다.' }
  }

  // 7. GPS 거리 계산
  const { within, distance } = calcDistance(latitude, longitude, site.latitude, site.longitude, site.allowedRadius)
  if (!within) {
    return {
      success: false,
      message: `이동할 현장 반경 밖입니다. (거리: ${Math.round(distance)}m, 허용: ${site.allowedRadius}m)`,
      distance,
      withinRadius: false,
    }
  }

  // 8. MOVE 이벤트 생성
  await prisma.attendanceEvent.create({
    data: {
      attendanceLogId: log.id,
      workerId,
      siteId: targetSiteId,
      companyId: assignment.companyId,
      eventType: 'MOVE',
      latitude,
      longitude,
      distanceFromSite: distance,
      withinRadius: within,
      deviceTokenSnapshot: deviceToken,
    },
  })

  return {
    success: true,
    message: `현장 이동이 기록되었습니다. 현재 작업 현장: ${site.name}`,
    distance,
    withinRadius: true,
    fromSiteId: currentSiteId,
    toSiteId: targetSiteId,
  }
}

/** 퇴근 처리 (직접/QR 공통) */
export async function processAttendanceCheckOut(
  workerId: string,
  deviceToken: string,
  siteId: string,
  latitude: number,
  longitude: number,
  exceptionReason?: string
): Promise<AttendanceCheckOutResult> {

  // 1. 기기 검증
  if (!(await validateAttendanceDevice(workerId, deviceToken))) {
    return { success: false, message: '등록된 기기에서만 출퇴근이 가능합니다.' }
  }

  // 2. 현장 조회
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, latitude: true, longitude: true, allowedRadius: true },
  })
  if (!site) {
    return { success: false, message: '유효하지 않은 현장입니다.' }
  }

  // 3. GPS 거리 계산
  const { within, distance } = calcDistance(latitude, longitude, site.latitude, site.longitude, site.allowedRadius)

  // 4. 반경 밖 퇴근: 사유 필요
  if (!within && !exceptionReason) {
    return {
      success: false,
      message: `현장 반경 밖입니다. (거리: ${Math.round(distance)}m) 퇴근 사유를 입력해주세요.`,
      distance,
      withinRadius: false,
    }
  }

  // 5. 오늘 열린 출근 세션 조회
  const workDate = kstDateStringToDate(toKSTDateString())
  const log = await prisma.attendanceLog.findFirst({
    where: { workerId, status: 'WORKING', checkOutAt: null, workDate },
  })

  if (!log) {
    return { success: false, message: '오늘 출근 기록이 없습니다.' }
  }

  // 6. 현재 위치 현장 확인
  const lastMove = await prisma.attendanceEvent.findFirst({
    where: { attendanceLogId: log.id, eventType: 'MOVE' },
    orderBy: { occurredAt: 'desc' },
  })
  const currentSiteId = lastMove?.siteId ?? log.siteId

  if (currentSiteId !== site.id) {
    return { success: false, message: '현재 위치한 현장 기준으로 퇴근해주세요.' }
  }

  // 7. 퇴근 처리
  const isException = !within && !!exceptionReason
  const checkOutSiteId = site.id !== log.siteId ? site.id : null

  await prisma.attendanceLog.update({
    where: { id: log.id },
    data: {
      checkOutAt: new Date(),
      checkOutLat: latitude,
      checkOutLng: longitude,
      checkOutDistance: distance,
      checkOutWithinRadius: within,
      checkOutSiteId,
      status: isException ? 'EXCEPTION' : 'COMPLETED',
      exceptionReason: exceptionReason ?? null,
    },
  })

  // 8. 퇴근 이벤트 생성
  await prisma.attendanceEvent.create({
    data: {
      attendanceLogId: log.id,
      workerId,
      siteId: site.id,
      companyId: log.companyId ?? null,
      eventType: isException ? 'EXCEPTION_CHECK_OUT' : 'CHECK_OUT',
      latitude,
      longitude,
      distanceFromSite: distance,
      withinRadius: within,
      deviceTokenSnapshot: deviceToken,
      reason: exceptionReason ?? null,
    },
  })

  return {
    success: true,
    message: isException ? '예외 퇴근이 처리되었습니다.' : '퇴근이 완료되었습니다.',
    distance,
    withinRadius: within,
    isException,
  }
}
