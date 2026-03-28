/**
 * 출퇴근 검증 공통 엔진
 * QR 출근과 직접 출근 모두 이 엔진을 통해 판정
 */
import { prisma } from '@/lib/db/prisma'
import { isWithinRadius } from '@/lib/gps/distance'
import { validateDeviceDetailed } from '@/lib/auth/device'
import { toKSTDateString, kstDateStringToDate } from '@/lib/utils/date'
import { aggregateAttendanceDays } from '@/lib/labor/attendance-days'
import { generateDraftConfirmations } from '@/lib/labor/work-confirmations'
import { resolveEffectiveSiteAttendancePolicy } from '@/lib/labor/resolve-site-policy'

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
  qrToken?: string            // QR 출근 시 현장 qrToken
  exceptionReason?: string
  checkInPhotoId?: string   // 출근 증빙 사진 ID (필수 — 없으면 PHOTO_REQUIRED)
}

/** 정책 차단 에러 코드 */
export type AttendanceErrorCode =
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_PENDING'
  | 'ACCOUNT_REJECTED'
  | 'ACCOUNT_SUSPENDED'
  | 'DEVICE_PENDING'
  | 'DEVICE_BLOCKED'
  | 'SITE_INACTIVE'
  | 'SITE_MEMBERSHIP_REQUIRED'
  | 'DOCS_INCOMPLETE'
  | 'TIME_RESTRICTED'
  | 'GEO_PERMISSION_DENIED'
  | 'GEO_OUT_OF_RANGE'
  | 'PHOTO_REQUIRED'
  | 'ATTENDANCE_CONFLICT'
  | 'MOVE_CONFLICT'

export interface AttendanceCheckInResult {
  success: boolean
  message: string
  errorCode?: AttendanceErrorCode
  actionRequired?: string  // 사용자에게 안내할 다음 액션
  attendanceId?: string
  distance?: number
  withinRadius?: boolean
  companyId?: string
}

export interface AttendanceCheckOutResult {
  success: boolean
  message: string
  errorCode?: AttendanceErrorCode
  actionRequired?: string
  distance?: number
  withinRadius?: boolean
  isException?: boolean
}

const GPS_EXTRA_TOLERANCE = parseInt(process.env.GPS_EXTRA_TOLERANCE ?? '0', 10)

/** 기기 검증 */
export async function validateAttendanceDevice(workerId: string, deviceToken: string): Promise<boolean> {
  const result = await validateDeviceDetailed(workerId, deviceToken)
  return result === 'APPROVED'
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
  const { workerId, deviceToken, siteId, latitude, longitude, isDirectCheckIn, qrToken, exceptionReason, checkInPhotoId } = input

  // 0. 계정 승인 상태 검증
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { accountStatus: true, isActive: true },
  })
  if (!worker || !worker.isActive) {
    return { success: false, errorCode: 'ACCOUNT_INACTIVE', message: '비활성 계정입니다. 관리자에게 문의하세요.', actionRequired: '관리자 문의' }
  }
  if (worker.accountStatus === 'PENDING') {
    return { success: false, errorCode: 'ACCOUNT_PENDING', message: '회원가입 승인 대기 중입니다. 승인 완료 후 출퇴근이 가능합니다.', actionRequired: '관리자 승인 대기' }
  }
  if (worker.accountStatus === 'REJECTED') {
    return { success: false, errorCode: 'ACCOUNT_REJECTED', message: '회원가입이 반려된 계정입니다. 관리자에게 문의하세요.', actionRequired: '관리자 문의' }
  }
  if (worker.accountStatus === 'SUSPENDED') {
    return { success: false, errorCode: 'ACCOUNT_SUSPENDED', message: '계정이 정지된 상태입니다. 관리자에게 문의하세요.', actionRequired: '관리자 문의' }
  }

  // 1. 기기 검증 — BLOCKED와 미승인(PENDING)을 분리
  const deviceStatus = await validateDeviceDetailed(workerId, deviceToken)
  if (deviceStatus === 'BLOCKED') {
    return { success: false, errorCode: 'DEVICE_BLOCKED', message: '차단된 기기입니다. 관리자에게 문의하세요.', actionRequired: '관리자 문의' }
  }
  if (deviceStatus === 'NOT_FOUND') {
    return { success: false, errorCode: 'DEVICE_PENDING', message: '이 기기는 아직 승인되지 않았습니다. 관리자 승인 후 사용 가능합니다.', actionRequired: '기기 승인 대기' }
  }

  // 2. 현장 조회
  const site = await prisma.site.findUnique({
    where: { id: siteId, isActive: true },
    select: { id: true, name: true, latitude: true, longitude: true, allowedRadius: true },
  })
  if (!site) {
    return { success: false, errorCode: 'SITE_INACTIVE', message: '유효하지 않은 현장입니다.', actionRequired: '현장 정보 확인' }
  }

  // 3. 현장 배정 검증 (현장 참여 승인 여부)
  const assignment = await getWorkerSiteAssignment(workerId, siteId)
  if (!assignment) {
    return { success: false, errorCode: 'SITE_MEMBERSHIP_REQUIRED', message: '현장 참여 승인이 필요합니다. 현장 참여를 신청하고 승인을 기다려 주세요.', actionRequired: '현장 참여 신청' }
  }

  // 3-1. 필수 문서 완료 검증
  const docPackage = await prisma.workerDocumentPackage.findFirst({
    where: { workerId, siteId, scope: 'SITE' },
    select: { overallStatus: true, missingDocCount: true, rejectedDocCount: true },
  })
  if (docPackage && docPackage.overallStatus !== 'READY') {
    const reasons: string[] = []
    if (docPackage.missingDocCount > 0) reasons.push(`미제출 ${docPackage.missingDocCount}건`)
    if (docPackage.rejectedDocCount > 0) reasons.push(`반려 ${docPackage.rejectedDocCount}건`)
    const detail = reasons.length > 0 ? ` (${reasons.join(', ')})` : ''
    return {
      success: false,
      errorCode: 'DOCS_INCOMPLETE',
      message: `필수 서류가 완료되지 않았습니다${detail}. 서류를 먼저 제출해 주세요.`,
      actionRequired: '필수 서류 제출',
    }
  }

  // 3-2. 출근 가능 시간 검증 (현장별 정책 → 전역 설정 순)
  try {
    const policy = await resolveEffectiveSiteAttendancePolicy(siteId)
    const now = new Date()
    const kstHour = (now.getUTCHours() + 9) % 24
    const kstMin = now.getUTCMinutes()
    const currentTime = `${String(kstHour).padStart(2, '0')}:${String(kstMin).padStart(2, '0')}`
    const startTime = policy.workStartTime  // e.g. "07:00"
    const endTime = policy.workEndTime      // e.g. "17:00"
    // 출근 허용: 시작 2시간 전 ~ 종료 시각
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number)
      const earlyStart = `${String(Math.max(0, sh - 2)).padStart(2, '0')}:${String(sm).padStart(2, '0')}`
      if (currentTime < earlyStart || currentTime > endTime) {
        return {
          success: false,
          errorCode: 'TIME_RESTRICTED',
          message: `출근 가능 시간이 아닙니다. (${earlyStart}~${endTime})`,
          actionRequired: '출근 가능 시간에 다시 시도하세요.',
        }
      }
    }
  } catch { /* 정책 조회 실패 시 시간 검증 건너뜀 */ }

  // 4. GPS 거리 계산
  const { within, distance } = calcDistance(latitude, longitude, site.latitude, site.longitude, site.allowedRadius)

  if (!within && !exceptionReason) {
    return {
      success: false,
      errorCode: 'GEO_OUT_OF_RANGE',
      message: `현장 반경 밖입니다. (거리: ${Math.round(distance)}m, 허용: ${site.allowedRadius}m)`,
      actionRequired: '현장 위치로 이동하거나 예외 사유를 입력하세요.',
      distance,
      withinRadius: false,
    }
  }

  // 4-1. 사진 증빙 검증 (photoId가 있으면 유효한 미사용 사진인지 확인)
  const photoEnabled = process.env.ATTENDANCE_PHOTO_REQUIRED !== 'false'
  if (photoEnabled) {
    if (!checkInPhotoId) {
      return { success: false, errorCode: 'PHOTO_REQUIRED', message: '출근 사진이 필요합니다. 사진을 촬영해 주세요.', actionRequired: '사진 촬영' }
    }
    const photo = await prisma.attendancePhotoEvidence.findFirst({
      where: {
        id: checkInPhotoId,
        workerId,
        siteId: site.id,
        photoType: 'CHECK_IN',
        attendanceLogId: null,  // 아직 다른 출근에 사용되지 않은 사진
      },
    })
    if (!photo) {
      return { success: false, errorCode: 'PHOTO_REQUIRED', message: '유효한 출근 사진이 필요합니다. 다시 사진을 촬영해 주세요.', actionRequired: '사진 촬영' }
    }
  }

  // 5. 날짜 계산 (KST)
  const workDateStr = toKSTDateString()
  const workDate = kstDateStringToDate(workDateStr)

  // 6. 중복 출근 체크 (ADJUSTED는 무효 처리된 기록이므로 재출근 허용)
  const existing = await prisma.attendanceLog.findFirst({
    where: { workerId, siteId: site.id, workDate, status: { not: 'ADJUSTED' } },
  })
  if (existing) {
    return { success: false, errorCode: 'ATTENDANCE_CONFLICT', message: '이미 오늘 출근 처리되었습니다.' }
  }

  // 7. 출근 기록 생성 — ADJUSTED 기록이 있으면 재활성화(UPDATE), 없으면 신규 생성
  const adjustedLog = await prisma.attendanceLog.findFirst({
    where: { workerId, siteId: site.id, workDate, status: 'ADJUSTED' },
  })

  const checkInPayload = {
    checkInAt: new Date(),
    checkInLat: latitude,
    checkInLng: longitude,
    checkInDistance: distance,
    checkInWithinRadius: within,
    isDirectCheckIn: isDirectCheckIn ?? false,
    qrToken: qrToken ?? null,
    status: 'WORKING' as const,
    checkOutAt: null,
    checkOutLat: null,
    checkOutLng: null,
    checkOutDistance: null,
    checkOutWithinRadius: null,
    adminNote: null,
    companyId: assignment.companyId,
    companyNameSnapshot: assignment.company.companyName,
    employmentTypeSnapshot: assignment.tradeType ?? null,
    tradeTypeSnapshot: assignment.tradeType,
  }

  let log
  if (adjustedLog) {
    // 재활성화: 기존 이벤트(이동 기록 등) 삭제 후 UPDATE
    await prisma.attendanceEvent.deleteMany({ where: { attendanceLogId: adjustedLog.id } })
    log = await prisma.attendanceLog.update({ where: { id: adjustedLog.id }, data: checkInPayload })
  } else {
    log = await prisma.attendanceLog.create({
      data: { workerId, siteId: site.id, workDate, ...checkInPayload },
    })
  }

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

  // 9. 사진 증빙을 출근 기록에 연결
  if (checkInPhotoId) {
    await prisma.attendancePhotoEvidence.update({
      where: { id: checkInPhotoId },
      data: { attendanceLogId: log.id },
    }).catch(() => {})  // 연결 실패해도 출근은 유지
  }

  // 10. PresenceCheck 예약 (실패해도 출근 유지)
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

  // 5. 이동 대상 현장 배정(참여 승인) 확인
  const assignment = await getWorkerSiteAssignment(workerId, targetSiteId)
  if (!assignment) {
    return { success: false, message: '현장 참여 승인이 필요합니다. 현장 참여를 신청하고 승인을 기다려 주세요.' }
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
  exceptionReason?: string,
  checkOutPhotoId?: string
): Promise<AttendanceCheckOutResult> {

  // 1. 기기 검증 — BLOCKED/NOT_FOUND 분리
  const deviceStatus = await validateDeviceDetailed(workerId, deviceToken)
  if (deviceStatus === 'BLOCKED') {
    return { success: false, errorCode: 'DEVICE_BLOCKED', message: '차단된 기기입니다. 관리자에게 문의하세요.' }
  }
  if (deviceStatus === 'NOT_FOUND') {
    return { success: false, errorCode: 'DEVICE_PENDING', message: '등록된 기기에서만 퇴근이 가능합니다.' }
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
      errorCode: 'GEO_OUT_OF_RANGE',
      message: `현장 반경 밖입니다. (거리: ${Math.round(distance)}m) 퇴근 사유를 입력해주세요.`,
      actionRequired: '현장 위치로 이동하거나 예외 사유를 입력하세요.',
      distance,
      withinRadius: false,
    }
  }

  // 4-1. 퇴근 사진 증빙 검증
  const photoEnabled = process.env.ATTENDANCE_PHOTO_REQUIRED !== 'false'
  if (photoEnabled) {
    if (!checkOutPhotoId) {
      return { success: false, errorCode: 'PHOTO_REQUIRED', message: '퇴근 사진이 필요합니다. 사진을 촬영해 주세요.', actionRequired: '사진 촬영' }
    }
    const photo = await prisma.attendancePhotoEvidence.findFirst({
      where: {
        id: checkOutPhotoId,
        workerId,
        siteId,
        photoType: 'CHECK_OUT',
        attendanceLogId: null,
      },
    })
    if (!photo) {
      return { success: false, errorCode: 'PHOTO_REQUIRED', message: '유효한 퇴근 사진이 필요합니다. 다시 사진을 촬영해 주세요.', actionRequired: '사진 촬영' }
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

  // 퇴근 사진 연결
  if (checkOutPhotoId) {
    await prisma.attendancePhotoEvidence.update({
      where: { id: checkOutPhotoId },
      data: { attendanceLogId: log.id },
    }).catch(() => {})
  }

  // 퇴근 후 공수 자동 계산 (실패해도 퇴근 유지)
  try {
    const workDateStr = toKSTDateString()
    await aggregateAttendanceDays({ workDate: workDateStr, siteId: site.id, workerId })
    const monthKey = workDateStr.slice(0, 7) // 'YYYY-MM'
    await generateDraftConfirmations({ monthKey, siteId: site.id, workerId })
  } catch (calcErr) {
    console.error('[checkout] 공수 자동계산 실패 (퇴근은 유지)', calcErr)
  }

  return {
    success: true,
    message: isException ? '예외 퇴근이 처리되었습니다.' : '퇴근이 완료되었습니다.',
    distance,
    withinRadius: within,
    isException,
  }
}
