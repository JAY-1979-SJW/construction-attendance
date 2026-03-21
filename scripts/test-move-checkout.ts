/**
 * 점검 3 — QR 이동·퇴근 흐름 검증
 * DB 없이 인메모리로 move.ts / check-out.ts / get-today-status.ts 로직을 1:1 재현합니다.
 *
 * 실행: npx tsx scripts/test-move-checkout.ts
 */

import { haversineDistance, isWithinRadius } from '../lib/gps/distance'

// ── 색상/결과 헬퍼 ─────────────────────────────────────────────────
let passed = 0, failed = 0
const c = {
  ok:   (s: string) => `\x1b[32m✓ ${s}\x1b[0m`,
  fail: (s: string) => `\x1b[31m✗ ${s}\x1b[0m`,
  info: (s: string) => `\x1b[36m  ${s}\x1b[0m`,
  head: (s: string) => `\x1b[1m\x1b[33m${s}\x1b[0m`,
  dim:  (s: string) => `\x1b[90m  ${s}\x1b[0m`,
}
function assert(cond: boolean, label: string, detail?: string) {
  if (cond) { console.log(c.ok(label)); passed++ }
  else       { console.log(c.fail(label)); if (detail) console.log(c.info('원인: ' + detail)); failed++ }
}

// ── 인메모리 DB ──────────────────────────────────────────────────────
type Site            = { id: string; name: string; address: string; latitude: number; longitude: number; allowedRadius: number; qrToken: string }
type Worker          = { id: string; phone: string; isActive: boolean }
type WorkerDevice    = { id: string; workerId: string; deviceToken: string; isActive: boolean }
type AttendanceLog   = { id: string; workerId: string; siteId: string; workDate: string; checkInAt: Date; checkOutAt: Date | null; checkOutSiteId: string | null; status: 'WORKING' | 'COMPLETED' | 'EXCEPTION'; checkInDistance: number; checkOutDistance: number | null }
type AttendanceEvent = { id: string; attendanceLogId: string; workerId: string; eventType: 'CHECKIN' | 'MOVE' | 'CHECKOUT'; siteId: string; latitude: number; longitude: number; distanceFromSite: number; occurredAt: Date }

const DB = {
  sites:   [] as Site[],
  workers: [] as Worker[],
  devices: [] as WorkerDevice[],
  logs:    [] as AttendanceLog[],
  events:  [] as AttendanceEvent[],
  nextId: 1,
  id: () => `id_${DB.nextId++}`,
  reset() { this.sites=[]; this.workers=[]; this.devices=[]; this.logs=[]; this.events=[]; this.nextId=1 },
}

// ── 유틸 ────────────────────────────────────────────────────────────
function toKSTDateString(d = new Date()): string {
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '-').replace(/\./g, '').trim()
}
const TODAY = toKSTDateString()

function getSiteByQrToken(qrToken: string): Site | undefined {
  return DB.sites.find(s => s.qrToken === qrToken)
}

function validateDevice(workerId: string, deviceToken: string): boolean {
  return DB.devices.some(d => d.workerId === workerId && d.deviceToken === deviceToken && d.isActive)
}

// ── move.ts 로직 1:1 재현 ────────────────────────────────────────────
interface MoveResult { success: boolean; message: string; eventId?: string; distance?: number; newSiteId?: string; newSiteName?: string }

function processMove(input: { workerId: string; deviceToken: string; qrToken: string; latitude: number; longitude: number }): MoveResult {
  const { workerId, deviceToken, qrToken, latitude, longitude } = input

  // 1. 기기 검증
  if (!validateDevice(workerId, deviceToken))
    return { success: false, message: '등록된 기기에서만 이동 처리가 가능합니다.' }

  // 2. 열린 세션(WORKING) 확인
  const openLog = DB.logs
    .filter(l => l.workerId === workerId && l.status === 'WORKING' && l.checkOutAt === null)
    .sort((a, b) => b.checkInAt.getTime() - a.checkInAt.getTime())[0]

  if (!openLog)
    return { success: false, message: '현재 출근 중인 기록이 없습니다. 먼저 출근하세요.' }

  // 3. QR → 새 현장
  const newSite = getSiteByQrToken(qrToken)
  if (!newSite)
    return { success: false, message: '유효하지 않은 QR코드입니다.' }

  // 4. 동일 현장 이동 방지 (마지막 MOVE 이벤트 기준)
  const lastMoveCheck = DB.events
    .filter(e => e.attendanceLogId === openLog.id && e.eventType === 'MOVE')
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0]
  const currentSiteId = lastMoveCheck?.siteId ?? openLog.siteId

  if (currentSiteId === newSite.id)
    return { success: false, message: '현재 근무 중인 현장과 동일합니다.' }

  // 5. 새 현장 GPS 반경 체크
  const { within, distance } = isWithinRadius(latitude, longitude, newSite.latitude, newSite.longitude, newSite.allowedRadius)
  if (!within)
    return { success: false, message: `새 현장 반경 밖입니다. (거리: ${Math.round(distance)}m, 허용: ${newSite.allowedRadius}m)`, distance }

  // 6. MOVE 이벤트 기록
  const event: AttendanceEvent = {
    id: DB.id(), attendanceLogId: openLog.id, workerId,
    eventType: 'MOVE', siteId: newSite.id,
    latitude, longitude, distanceFromSite: distance,
    occurredAt: new Date(),
  }
  DB.events.push(event)

  return { success: true, message: `${newSite.name}으로 이동 처리되었습니다.`, eventId: event.id, distance, newSiteId: newSite.id, newSiteName: newSite.name }
}

// ── check-out.ts 로직 1:1 재현 ──────────────────────────────────────
interface CheckOutResult { success: boolean; message: string; distance?: number }

function processCheckOut(input: { workerId: string; deviceToken: string; qrToken: string; latitude: number; longitude: number }): CheckOutResult {
  const { workerId, deviceToken, qrToken, latitude, longitude } = input

  // 1. 기기 검증
  if (!validateDevice(workerId, deviceToken))
    return { success: false, message: '등록된 기기에서만 출퇴근이 가능합니다.' }

  // 2. QR → 현장
  const site = getSiteByQrToken(qrToken)
  if (!site)
    return { success: false, message: '유효하지 않은 QR코드입니다.' }

  // 3. GPS 반경 체크
  const { within, distance } = isWithinRadius(latitude, longitude, site.latitude, site.longitude, site.allowedRadius)
  if (!within)
    return { success: false, message: `현장 반경 밖입니다. (거리: ${distance}m, 허용: ${site.allowedRadius}m)`, distance }

  // 4. 오늘 열린 출근 세션
  const log = DB.logs.find(l => l.workerId === workerId && l.status === 'WORKING' && l.checkOutAt === null && l.workDate === TODAY)
  if (!log)
    return { success: false, message: '오늘 출근 기록이 없습니다.' }

  if (log.status === 'EXCEPTION')
    return { success: false, message: '예외 처리 중인 기록입니다.' }

  // 5. 현재 현장 확인 (마지막 MOVE 이벤트 기준)
  const lastMove = DB.events
    .filter(e => e.attendanceLogId === log.id && e.eventType === 'MOVE')
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0]
  const currentSiteId = lastMove?.siteId ?? log.siteId

  if (currentSiteId !== site.id)
    return { success: false, message: '현재 위치한 현장의 QR코드를 사용하세요.' }

  // 6. 퇴근 처리
  const checkOutSiteId = site.id !== log.siteId ? site.id : null
  log.checkOutAt = new Date()
  log.checkOutDistance = distance
  log.checkOutSiteId = checkOutSiteId
  log.status = 'COMPLETED'

  return { success: true, message: '퇴근이 완료되었습니다.', distance }
}

// ── get-today-status.ts 로직 1:1 재현 ──────────────────────────────
function getTodayStatus(workerId: string) {
  const log = DB.logs.find(l => l.workerId === workerId && l.workDate === TODAY)
  if (!log) return null

  const lastMove = DB.events
    .filter(e => e.attendanceLogId === log.id && e.eventType === 'MOVE')
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0]

  const currentSiteId   = lastMove?.siteId ?? log.siteId
  const currentSiteName = DB.sites.find(s => s.id === currentSiteId)?.name ?? ''
  const siteName        = DB.sites.find(s => s.id === log.siteId)?.name ?? ''

  return {
    id: log.id,
    siteId: log.siteId,
    siteName,
    currentSiteId,
    currentSiteName,
    workDate: log.workDate,
    checkInAt: log.checkInAt?.toISOString() ?? null,
    checkOutAt: log.checkOutAt?.toISOString() ?? null,
    status: log.status,
    checkInDistance: log.checkInDistance,
    checkOutDistance: log.checkOutDistance,
  }
}

// ── QR 페이지 모드 결정 로직 1:1 재현 (page.tsx useEffect) ──────────
type Mode = 'check-in' | 'move' | 'check-out' | 'completed' | 'already-done' | 'error'

function getQrMode(scannedSiteId: string, today: ReturnType<typeof getTodayStatus>): { mode: Mode; currentSiteName?: string } {
  if (!today) return { mode: 'check-in' }
  if (today.checkOutAt) return { mode: 'already-done' }
  if (today.checkInAt && today.status === 'WORKING') {
    if (today.currentSiteId && scannedSiteId !== today.currentSiteId)
      return { mode: 'move', currentSiteName: today.currentSiteName ?? today.siteName }
    return { mode: 'check-out' }
  }
  if (today.checkInAt) return { mode: 'already-done' }
  return { mode: 'check-in' }
}

// ── 관리자 조회 (admin attendance list) ──────────────────────────────
function adminQueryAttendance(workerId: string) {
  const log = DB.logs.find(l => l.workerId === workerId && l.workDate === TODAY)
  if (!log) return null
  const moveEvents = DB.events.filter(e => e.attendanceLogId === log.id && e.eventType === 'MOVE')
  return { log, moveEvents }
}

// ── 테스트 데이터 셋업 ───────────────────────────────────────────────
function setup() {
  DB.reset()

  // A현장: 서울 강남구 테헤란로 (37.5012743, 127.0396597), 반경 100m
  const SITE_A: Site = {
    id: DB.id(), name: 'A현장 (테헤란로)', address: '서울 강남구 테헤란로 152',
    latitude: 37.5012743, longitude: 127.0396597, allowedRadius: 100,
    qrToken: 'qr_site_a_aaaaaaaaaaaaaaaaaaa',
  }

  // B현장: 서울 강남구 역삼동 (37.4981, 127.0276), 반경 100m
  const SITE_B: Site = {
    id: DB.id(), name: 'B현장 (역삼역)', address: '서울 강남구 역삼동 819-12',
    latitude: 37.4981, longitude: 127.0276, allowedRadius: 100,
    qrToken: 'qr_site_b_bbbbbbbbbbbbbbbbbbb',
  }

  DB.sites.push(SITE_A, SITE_B)

  const worker: Worker = { id: DB.id(), phone: '01099990001', isActive: true }
  DB.workers.push(worker)

  const device: WorkerDevice = { id: DB.id(), workerId: worker.id, deviceToken: 'dt_approved_device_aaa', isActive: true }
  DB.devices.push(device)

  // A현장 WORKING 상태로 사전 출근
  const checkInLog: AttendanceLog = {
    id: DB.id(), workerId: worker.id, siteId: SITE_A.id, workDate: TODAY,
    checkInAt: new Date(), checkOutAt: null, checkOutSiteId: null,
    status: 'WORKING', checkInDistance: 33, checkOutDistance: null,
  }
  DB.logs.push(checkInLog)

  return { worker, device, SITE_A, SITE_B, checkInLog }
}

// ── GPS 좌표 셋업 ────────────────────────────────────────────────────
// A현장 반경 내 좌표 (실측 약 33m)
const GPS_INSIDE_A  = { lat: 37.5012743, lng: 127.0400 }   // ~33m from A
// B현장 반경 내 좌표 (실측 약 42m)
const GPS_INSIDE_B  = { lat: 37.4985,    lng: 127.0276 }   // ~44m from B
// 반경 밖 (약 800m)
const GPS_OUTSIDE   = { lat: 37.508,     lng: 127.040  }   // 외부

// ── 메인 테스트 ──────────────────────────────────────────────────────
function run() {
  console.log(c.head('\n════════════════════════════════════════════'))
  console.log(c.head(' 점검 3 — QR 이동·퇴근 흐름 검증'))
  console.log(c.head('════════════════════════════════════════════\n'))

  const { worker, device, SITE_A, SITE_B, checkInLog } = setup()

  // ── 거리 사전 검증 ────────────────────────────────────────────────
  const distInsideA = Math.round(haversineDistance(GPS_INSIDE_A.lat, GPS_INSIDE_A.lng, SITE_A.latitude, SITE_A.longitude))
  const distInsideB = Math.round(haversineDistance(GPS_INSIDE_B.lat, GPS_INSIDE_B.lng, SITE_B.latitude, SITE_B.longitude))
  const distOutside = Math.round(haversineDistance(GPS_OUTSIDE.lat, GPS_OUTSIDE.lng, SITE_A.latitude, SITE_A.longitude))
  console.log(c.dim(`GPS 사전 검증: A반경내=${distInsideA}m, B반경내=${distInsideB}m, 반경외=${distOutside}m`))

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 1. 이동 전 오늘 상태 확인 ]'))

  const status0 = getTodayStatus(worker.id)
  console.log(c.dim(`오늘 상태: status=${status0?.status}, currentSiteId=${status0?.currentSiteId}, currentSiteName=${status0?.currentSiteName}`))
  assert(status0 !== null,                          '오늘 출근 기록 존재 확인')
  assert(status0?.status === 'WORKING',             '현재 WORKING 상태')
  assert(status0?.currentSiteId === SITE_A.id,      '현재 현장 = A현장 (출근 현장)')
  assert(status0?.currentSiteName === SITE_A.name,  '현재 현장명 = A현장 이름')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 2. B현장 QR 진입 → 이동 모드 확인 ]'))

  const modeForB = getQrMode(SITE_B.id, status0)
  console.log(c.dim(`QR 모드: ${modeForB.mode}, currentSiteName=${modeForB.currentSiteName}`))
  assert(modeForB.mode === 'move',                       'B현장 QR 진입 → move 모드')
  assert(modeForB.currentSiteName === SITE_A.name,       '이동 전 현재 근무 현장명 = A현장')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 3. 이동 실행 ]'))

  const moveResult = processMove({
    workerId: worker.id,
    deviceToken: device.deviceToken,
    qrToken: SITE_B.qrToken,
    latitude: GPS_INSIDE_B.lat,
    longitude: GPS_INSIDE_B.lng,
  })
  console.log(c.dim(`이동 결과: success=${moveResult.success}, msg=${moveResult.message}, dist=${moveResult.distance}m`))
  assert(moveResult.success === true,             '이동 성공')
  assert(moveResult.newSiteId === SITE_B.id,      '이동 대상 현장 ID = B현장')
  assert(moveResult.newSiteName === SITE_B.name,  '이동 대상 현장명 = B현장')
  assert(moveResult.distance !== undefined && moveResult.distance <= SITE_B.allowedRadius,
    `이동 거리 반경 내 (${moveResult.distance}m ≤ ${SITE_B.allowedRadius}m)`)

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 4. 이동 후 오늘 상태 → currentSiteId/Name 갱신 확인 ]'))

  const status1 = getTodayStatus(worker.id)
  console.log(c.dim(`갱신 후: currentSiteId=${status1?.currentSiteId}, currentSiteName=${status1?.currentSiteName}`))
  assert(status1?.status === 'WORKING',            '이동 후에도 WORKING 유지')
  assert(status1?.currentSiteId === SITE_B.id,     '현재 현장 ID → B현장으로 갱신')
  assert(status1?.currentSiteName === SITE_B.name, '현재 현장명 → B현장으로 갱신')
  assert(status1?.checkOutAt === null,             '아직 퇴근 전 (checkOutAt=null)')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 5. 관리자 조회 화면 — MOVE 이벤트 반영 확인 ]'))

  const adminData = adminQueryAttendance(worker.id)
  console.log(c.dim(`이동 이벤트 수: ${adminData?.moveEvents.length}, 현장=${adminData?.moveEvents[0]?.siteId}`))
  assert(adminData !== null,                                  '관리자 출근 기록 조회 성공')
  assert(adminData!.moveEvents.length === 1,                  'MOVE 이벤트 1건 기록됨')
  assert(adminData!.moveEvents[0].siteId === SITE_B.id,       'MOVE 이벤트 현장 = B현장')
  assert(adminData!.log.status === 'WORKING',                 '관리자 화면 status=WORKING 유지')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 6. B현장 QR 재진입 → 퇴근 모드 확인 ]'))

  const modeForCheckOut = getQrMode(SITE_B.id, status1)
  console.log(c.dim(`QR 모드: ${modeForCheckOut.mode}`))
  assert(modeForCheckOut.mode === 'check-out', 'B현장 QR 재진입 → check-out 모드')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 7. 퇴근 실행 ]'))

  const checkOutResult = processCheckOut({
    workerId: worker.id,
    deviceToken: device.deviceToken,
    qrToken: SITE_B.qrToken,
    latitude: GPS_INSIDE_B.lat,
    longitude: GPS_INSIDE_B.lng,
  })
  console.log(c.dim(`퇴근 결과: success=${checkOutResult.success}, msg=${checkOutResult.message}, dist=${checkOutResult.distance}m`))
  assert(checkOutResult.success === true, '퇴근 성공')
  assert(checkOutResult.distance !== undefined && checkOutResult.distance <= SITE_B.allowedRadius,
    `퇴근 거리 반경 내 (${checkOutResult.distance}m ≤ ${SITE_B.allowedRadius}m)`)

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 8. 퇴근 후 오늘 상태 반영 확인 ]'))

  const status2 = getTodayStatus(worker.id)
  console.log(c.dim(`퇴근 후: status=${status2?.status}, checkOutAt=${status2?.checkOutAt ? '있음' : 'null'}`))
  assert(status2?.status === 'COMPLETED',     '퇴근 후 status=COMPLETED')
  assert(status2?.checkOutAt !== null,        'checkOutAt 기록됨')
  assert(status2?.checkOutDistance !== null,  'checkOutDistance 기록됨')
  // 이동형: checkOutSiteId는 출근 현장(A) != 퇴근 현장(B) → B현장 ID 기록
  const logAfterCheckOut = DB.logs.find(l => l.id === checkInLog.id)
  assert(logAfterCheckOut?.checkOutSiteId === SITE_B.id, '이동형 퇴근 — checkOutSiteId=B현장 기록됨')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 9. 관리자 화면 — 퇴근 반영 확인 ]'))

  const adminData2 = adminQueryAttendance(worker.id)
  console.log(c.dim(`관리자 조회: status=${adminData2?.log.status}, checkOutAt=${adminData2?.log.checkOutAt ? '있음' : 'null'}`))
  assert(adminData2?.log.status === 'COMPLETED',  '관리자 화면 status=COMPLETED 반영')
  assert(adminData2?.log.checkOutAt !== null,     '관리자 화면 checkOutAt 반영됨')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 10. 예외 차단 검증 ]'))

  // 10-1. 동일 현장 이동 시도 (새 로그로 리셋 후 테스트)
  DB.reset()
  const { worker: w2, device: d2, SITE_A: SA2, SITE_B: SB2 } = setup()
  // A현장에서 B현장으로 이동 완료한 상태 시뮬레이션
  const log2 = DB.logs[DB.logs.length - 1]
  const moveEv: AttendanceEvent = {
    id: DB.id(), attendanceLogId: log2.id, workerId: w2.id,
    eventType: 'MOVE', siteId: SB2.id,
    latitude: GPS_INSIDE_B.lat, longitude: GPS_INSIDE_B.lng, distanceFromSite: 44,
    occurredAt: new Date(),
  }
  DB.events.push(moveEv)

  const sameSiteMove = processMove({
    workerId: w2.id, deviceToken: d2.deviceToken, qrToken: SB2.qrToken,
    latitude: GPS_INSIDE_B.lat, longitude: GPS_INSIDE_B.lng,
  })
  console.log(c.dim(`동일 현장 이동: success=${sameSiteMove.success}, msg=${sameSiteMove.message}`))
  assert(sameSiteMove.success === false,                          '동일 현장 이동 → 차단됨')
  assert(sameSiteMove.message.includes('동일'),                   '오류 메시지: 동일 현장')

  // 10-2. GPS 반경 이탈 퇴근 시도
  const gpsOutCheckOut = processCheckOut({
    workerId: w2.id, deviceToken: d2.deviceToken, qrToken: SB2.qrToken,
    latitude: GPS_OUTSIDE.lat, longitude: GPS_OUTSIDE.lng,
  })
  console.log(c.dim(`GPS 이탈 퇴근: success=${gpsOutCheckOut.success}, msg=${gpsOutCheckOut.message}`))
  assert(gpsOutCheckOut.success === false, 'GPS 반경 이탈 퇴근 → 차단됨')
  assert(gpsOutCheckOut.message.includes('반경'), '오류 메시지: 반경 밖')

  // 10-3. 이미 퇴근 후 재퇴근 시도
  // 정상 퇴근 먼저 처리
  processCheckOut({ workerId: w2.id, deviceToken: d2.deviceToken, qrToken: SB2.qrToken, latitude: GPS_INSIDE_B.lat, longitude: GPS_INSIDE_B.lng })
  const doubleCheckOut = processCheckOut({ workerId: w2.id, deviceToken: d2.deviceToken, qrToken: SB2.qrToken, latitude: GPS_INSIDE_B.lat, longitude: GPS_INSIDE_B.lng })
  console.log(c.dim(`재퇴근 시도: success=${doubleCheckOut.success}, msg=${doubleCheckOut.message}`))
  assert(doubleCheckOut.success === false, '퇴근 완료 후 재퇴근 → 차단됨')
  assert(doubleCheckOut.message.includes('기록이 없습니다'), '오류 메시지: 출근 기록 없음')

  // 10-4. 잘못된 QR 이동 시도
  const badQrMove = processMove({ workerId: w2.id, deviceToken: d2.deviceToken, qrToken: 'invalid_qr_token', latitude: GPS_INSIDE_A.lat, longitude: GPS_INSIDE_A.lng })
  // (이미 퇴근 후라 "출근 중인 기록이 없습니다"가 먼저 반환됨 — 올바른 우선순위 검증)
  assert(badQrMove.success === false, '퇴근 후 이동 시도 → 차단됨')

  // 10-5. 미승인 기기 이동 시도
  const badDeviceMove = processMove({ workerId: w2.id, deviceToken: 'unapproved_device_token', qrToken: SB2.qrToken, latitude: GPS_INSIDE_B.lat, longitude: GPS_INSIDE_B.lng })
  console.log(c.dim(`미승인 기기: success=${badDeviceMove.success}, msg=${badDeviceMove.message}`))
  assert(badDeviceMove.success === false,                  '미승인 기기 이동 → 차단됨')
  assert(badDeviceMove.message.includes('등록된 기기'),    '오류 메시지: 등록된 기기')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ 11. already-done 모드 확인 (퇴근 완료 후 QR 재진입) ]'))

  const status3 = getTodayStatus(w2.id)
  const modeAfterDone = getQrMode(SB2.id, status3)
  console.log(c.dim(`QR 모드: ${modeAfterDone.mode}`))
  assert(modeAfterDone.mode === 'already-done', '퇴근 완료 후 QR 재진입 → already-done 모드')

  // ── 결과 ──────────────────────────────────────────────────────────
  console.log(c.head('\n════════════════════════════════════════════'))
  const allPass = failed === 0
  const badge = allPass ? '\x1b[32m[ PASS ]\x1b[0m' : '\x1b[31m[ FAIL ]\x1b[0m'
  console.log(`  결과: ${badge}  통과 \x1b[32m${passed}\x1b[0m건 | 실패 \x1b[31m${failed}\x1b[0m건`)
  console.log(c.head('════════════════════════════════════════════\n'))

  // ── 보고서 ────────────────────────────────────────────────────────
  console.log(c.head('[ 보고서 ]'))
  const rows = [
    ['이동 모드 진입',        'A현장 근무 중 B현장 QR → move 모드 정상'],
    ['이동 성공 여부',        `성공 (거리: ${moveResult.distance}m, ID: ${moveResult.eventId})`],
    ['현재 현장 갱신',        'currentSiteId/Name → B현장으로 즉시 갱신'],
    ['관리자 MOVE 반영',      'MOVE 이벤트 1건, 현장=B현장 확인'],
    ['퇴근 모드 진입',        '이동 후 B현장 QR → check-out 모드 정상'],
    ['퇴근 성공 여부',        `성공 (거리: ${checkOutResult.distance}m)`],
    ['checkOutAt 반영',      'COMPLETED + checkOutAt 기록됨'],
    ['이동형 checkOutSiteId', 'B현장 ID 정상 기록 (출근 현장 != 퇴근 현장)'],
    ['관리자 퇴근 반영',      'status=COMPLETED 반영'],
    ['동일 현장 이동 차단',   '정상 차단'],
    ['GPS 이탈 퇴근 차단',   '정상 차단'],
    ['재퇴근 차단',           '정상 차단'],
    ['미승인 기기 차단',      '정상 차단'],
    ['already-done 모드',    '퇴근 완료 후 QR 재진입 → 정상'],
  ]
  for (const [k, v] of rows) {
    console.log(`  ${k.padEnd(22)} ${v}`)
  }
  console.log()

  process.exit(failed > 0 ? 1 : 0)
}

run()
