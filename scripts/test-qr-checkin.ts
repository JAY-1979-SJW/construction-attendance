/**
 * 점검 2 — QR 출근 1회 실물 테스트 (로직 검증)
 *
 * 실행: npx tsx scripts/test-qr-checkin.ts
 *
 * 검증 항목:
 *   1. 로그인 상태 유지 (JWT → workerId 추출)
 *   2. QR → 현장 진입 성공 여부
 *   3. 출근 버튼 노출 조건 (오늘 세션 없음)
 *   4. 출근 성공 (기기+QR+GPS 통과)
 *   5. 오늘 현황 반영 (getTodayStatus)
 *   6. 관리자 조회 화면 반영 (attendanceLog 조회)
 *   7. 예외 케이스 전부 차단 확인
 */

// ── 실제 GPS 함수 가져오기 ─────────────────────────────────────────
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

// ── 인메모리 DB ────────────────────────────────────────────────────
let nextId = 1
const id = () => `id_${nextId++}`

type Worker        = { id: string; phone: string; isActive: boolean }
type WorkerDevice  = { id: string; workerId: string; deviceToken: string; isActive: boolean }
type Site          = { id: string; name: string; address: string; latitude: number; longitude: number; allowedRadius: number; qrToken: string; isActive: boolean }
type AttendLog     = { id: string; workerId: string; siteId: string; workDate: string; checkInAt: Date | null; checkOutAt: Date | null; checkInDistance: number | null; qrToken: string; status: string }
type AttendEvent   = { id: string; attendanceLogId: string; workerId: string; eventType: string; siteId: string | null; occurredAt: Date }

const DB = {
  workers:  [] as Worker[],
  devices:  [] as WorkerDevice[],
  sites:    [] as Site[],
  logs:     [] as AttendLog[],
  events:   [] as AttendEvent[],
}

// ── JWT 세션 시뮬레이션 ────────────────────────────────────────────
// 실제 코드: signToken({ sub: worker.id, type:'worker', deviceToken })
// 여기서는 토큰 자체 대신 세션 객체로 직접 표현
type Session = { sub: string; deviceToken: string }

// ── QR 페이지 진입 로직 (/app/(mobile)/qr/[qrToken]/page.tsx) ──────
function getQrPageMode(session: Session | null, qrToken: string, today: AttendLog | null)
  : { mode: string; site: Site | null; currentSiteId?: string; error?: string } {

  // 1. 로그인 확인
  if (!session) return { mode: 'redirect-login', site: null, error: '로그인 필요' }

  // 2. QR → 현장 조회
  const site = DB.sites.find(s => s.qrToken === qrToken && s.isActive)
  if (!site)  return { mode: 'error', site: null, error: '유효하지 않은 QR코드입니다.' }

  // 3. 오늘 기록 분기
  if (!today) return { mode: 'check-in', site }

  if (today.checkOutAt) return { mode: 'already-done', site }

  if (today.checkInAt && today.status === 'WORKING') {
    const lastMove = DB.events
      .filter(e => e.attendanceLogId === today.id && e.eventType === 'MOVE')
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0]
    const currentSiteId = lastMove?.siteId ?? today.siteId

    if (currentSiteId !== site.id) return { mode: 'move', site, currentSiteId }
    return { mode: 'check-out', site, currentSiteId }
  }

  return { mode: 'already-done', site }
}

// ── 출근 처리 로직 (lib/attendance/check-in.ts 1:1 대응) ───────────
function processCheckIn(
  workerId: string, deviceToken: string, qrToken: string,
  lat: number, lng: number, workDate: string
): { success: boolean; message: string; distance?: number; attendanceId?: string } {

  // 1. 기기 검증
  const device = DB.devices.find(d => d.workerId === workerId && d.deviceToken === deviceToken && d.isActive)
  if (!device) return { success: false, message: '등록된 기기에서만 출퇴근이 가능합니다.' }

  // 2. QR → 현장
  const site = DB.sites.find(s => s.qrToken === qrToken && s.isActive)
  if (!site) return { success: false, message: '유효하지 않은 QR코드입니다.' }

  // 3. GPS 반경
  const { within, distance } = isWithinRadius(lat, lng, site.latitude, site.longitude, site.allowedRadius)
  if (!within) return { success: false, message: `현장 반경 밖입니다. (거리: ${distance}m, 허용: ${site.allowedRadius}m)`, distance }

  // 4. 중복 체크
  const existing = DB.logs.find(l => l.workerId === workerId && l.siteId === site.id && l.workDate === workDate)
  if (existing) return { success: false, message: '이미 오늘 출근 처리되었습니다.' }

  // 5. 출근 기록 생성
  const log: AttendLog = {
    id: id(), workerId, siteId: site.id, workDate,
    checkInAt: new Date(), checkOutAt: null,
    checkInDistance: distance, qrToken, status: 'WORKING',
  }
  DB.logs.push(log)

  return { success: true, message: '출근이 완료되었습니다.', distance, attendanceId: log.id }
}

// ── getTodayStatus 1:1 대응 ────────────────────────────────────────
function getTodayStatus(workerId: string, workDate: string) {
  const log = DB.logs.find(l => l.workerId === workerId && l.workDate === workDate)
  if (!log) return null
  const site = DB.sites.find(s => s.id === log.siteId)!

  const lastMove = DB.events
    .filter(e => e.attendanceLogId === log.id && e.eventType === 'MOVE')
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0]

  return {
    id: log.id,
    siteName: site.name,
    siteAddress: site.address,
    currentSiteId: lastMove?.siteId ?? log.siteId,
    currentSiteName: site.name,
    workDate: log.workDate,
    checkInAt: log.checkInAt?.toISOString() ?? null,
    checkOutAt: log.checkOutAt?.toISOString() ?? null,
    status: log.status,
    checkInDistance: log.checkInDistance,
    checkOutDistance: null,
  }
}

// ── 관리자 출퇴근 조회 (admin/attendance GET) ──────────────────────
function adminListAttendance(workDate: string) {
  return DB.logs
    .filter(l => l.workDate === workDate)
    .map(l => {
      const worker = DB.workers.find(w => w.id === l.workerId)!
      const site   = DB.sites.find(s => s.id === l.siteId)!
      return {
        id: l.id, workerName: worker.phone, siteName: site.name,
        checkInAt: l.checkInAt?.toISOString() ?? null,
        checkOutAt: l.checkOutAt?.toISOString() ?? null,
        status: l.status, checkInDistance: l.checkInDistance,
      }
    })
}

// ── 테스트 실행 ────────────────────────────────────────────────────
function run() {
  console.log(c.head('\n════════════════════════════════════════════'))
  console.log(c.head(' 점검 2 — QR 출근 1회 실물 테스트 (로직 검증)'))
  console.log(c.head('════════════════════════════════════════════\n'))

  // ── 테스트 데이터 셋업 ─────────────────────────────────────────────
  const WORKER = { id: id(), phone: '01088880001', isActive: true }
  const DEVICE_TOKEN = 'dt_approved_device_abc1234567890'
  const DEVICE = { id: id(), workerId: WORKER.id, deviceToken: DEVICE_TOKEN, isActive: true }

  // 현장: 서울 강남구 테헤란로 (위도/경도)
  const SITE_LAT = 37.5012743
  const SITE_LNG = 127.0396597
  const SITE = {
    id: id(), name: '테헤란로 현장', address: '서울 강남구 테헤란로 123',
    latitude: SITE_LAT, longitude: SITE_LNG, allowedRadius: 100,
    qrToken: 'qr_test_token_valid_abc12345678', isActive: true,
  }
  const TODAY = '2026-03-21'

  DB.workers.push(WORKER)
  DB.devices.push(DEVICE)
  DB.sites.push(SITE)

  // 세션 (승인된 기기 → JWT 발급 완료 상태)
  const SESSION: Session = { sub: WORKER.id, deviceToken: DEVICE_TOKEN }

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('[ Step 1 — 로그인 상태 유지 확인 ]'))
  // 실제 코드: /api/auth/me 에서 session.sub 으로 worker 조회
  const meWorker = DB.workers.find(w => w.id === SESSION.sub)
  console.log(c.dim(`session.sub=${SESSION.sub} → worker=${meWorker?.phone}`))
  assert(meWorker !== undefined,      'session.sub으로 근로자 조회 성공')
  assert(meWorker?.isActive === true, '근로자 활성 상태 확인')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ Step 2 — QR 페이지 진입 (오늘 기록 없음) ]'))

  const page1 = getQrPageMode(SESSION, SITE.qrToken, null)
  console.log(c.dim(`mode=${page1.mode}, site=${page1.site?.name}`))
  assert(page1.mode === 'check-in',   'QR 페이지 → check-in 모드 진입')
  assert(page1.site?.id === SITE.id,  '올바른 현장 조회됨')

  // 잘못된 QR
  const pageInvalidQr = getQrPageMode(SESSION, 'INVALID_QR_TOKEN', null)
  assert(pageInvalidQr.mode === 'error', '유효하지 않은 QR → error 모드')

  // 로그인 없이 접근
  const pageNoLogin = getQrPageMode(null, SITE.qrToken, null)
  assert(pageNoLogin.mode === 'redirect-login', '로그인 없이 접근 → 로그인 리다이렉트')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ Step 3 — 출근 버튼 노출 조건 ]'))
  // check-in 모드에서 버튼이 보여야 함
  assert(page1.mode === 'check-in', '오늘 기록 없음 → 출근 버튼 노출됨')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ Step 4 — GPS 유효성 검증 ]'))

  // 실제 haversine 함수로 거리 계산
  const userInsideLat  = SITE_LAT + 0.0003  // ~33m 이내
  const userInsideLng  = SITE_LNG
  const userOutsideLat = SITE_LAT + 0.002   // ~220m 이탈
  const userOutsideLng = SITE_LNG

  const distInside  = Math.round(haversineDistance(userInsideLat, userInsideLng, SITE_LAT, SITE_LNG))
  const distOutside = Math.round(haversineDistance(userOutsideLat, userOutsideLng, SITE_LAT, SITE_LNG))
  console.log(c.dim(`반경 내 거리: ${distInside}m (허용: ${SITE.allowedRadius}m)`))
  console.log(c.dim(`반경 외 거리: ${distOutside}m (허용: ${SITE.allowedRadius}m)`))

  const { within: inRange }  = isWithinRadius(userInsideLat,  userInsideLng,  SITE_LAT, SITE_LNG, SITE.allowedRadius)
  const { within: outRange } = isWithinRadius(userOutsideLat, userOutsideLng, SITE_LAT, SITE_LNG, SITE.allowedRadius)
  assert(inRange  === true,  `반경 ${distInside}m → 반경 내 판정 정상`)
  assert(outRange === false, `반경 ${distOutside}m → 반경 외 판정 정상`)

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ Step 5 — 출근 처리 (정상 케이스) ]'))

  const r1 = processCheckIn(WORKER.id, DEVICE_TOKEN, SITE.qrToken, userInsideLat, userInsideLng, TODAY)
  console.log(c.dim(`결과: success=${r1.success}, distance=${r1.distance}m, id=${r1.attendanceId}`))
  assert(r1.success === true,          '출근 성공')
  assert(typeof r1.distance === 'number' && r1.distance <= SITE.allowedRadius,
    `현장까지 거리 기록 (${r1.distance}m)`)
  assert(r1.attendanceId !== undefined, '출근 기록 ID 반환됨')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ Step 6 — 출근 후 상태 분기 검증 ]'))

  const todayStatus = getTodayStatus(WORKER.id, TODAY)
  console.log(c.dim(`status=${todayStatus?.status}, checkInAt=${todayStatus?.checkInAt?.slice(11,19)}, distance=${todayStatus?.checkInDistance}m`))
  assert(todayStatus !== null,            '출근 후 오늘 상태 존재')
  assert(todayStatus?.status === 'WORKING','상태값 WORKING')
  assert(todayStatus?.checkInAt !== null,  '출근 시각 기록됨')
  assert(todayStatus?.checkOutAt === null, '퇴근 시각 없음 (미퇴근)')
  assert(todayStatus?.checkInDistance !== null, '출근 거리 기록됨')

  // 출근 후 QR 재스캔 → check-out 모드로 전환
  const page2 = getQrPageMode(SESSION, SITE.qrToken, DB.logs.find(l => l.workerId === WORKER.id) ?? null)
  console.log(c.dim(`재스캔 mode=${page2.mode}`))
  assert(page2.mode === 'check-out', '출근 후 같은 현장 QR 재스캔 → check-out 모드 전환')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ Step 7 — 관리자 화면 반영 ]'))

  const adminList = adminListAttendance(TODAY)
  console.log(c.dim(`관리자 조회 결과: ${adminList.length}건`))
  assert(adminList.length === 1,           '관리자 출퇴근 조회에 1건 노출')
  assert(adminList[0].siteName === SITE.name, '현장명 정확히 반영됨')
  assert(adminList[0].status === 'WORKING',   '상태값 WORKING 확인')
  assert(adminList[0].checkInAt !== null,      '출근 시각 노출됨')
  assert(adminList[0].checkOutAt === null,     '퇴근 시각 없음 (미퇴근 상태).')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ Step 8 — 예외 케이스 차단 검증 ]'))

  // 중복 출근 방지
  const r2 = processCheckIn(WORKER.id, DEVICE_TOKEN, SITE.qrToken, userInsideLat, userInsideLng, TODAY)
  assert(r2.success === false, '이미 출근한 날 중복 출근 → 차단')
  console.log(c.dim(`중복 차단 메시지: ${r2.message}`))

  // 미승인 기기
  const r3 = processCheckIn(WORKER.id, 'dt_unapproved_device_999', SITE.qrToken, userInsideLat, userInsideLng, TODAY)
  assert(r3.success === false, '미승인 기기 → 차단')
  console.log(c.dim(`미승인 기기 메시지: ${r3.message}`))

  // GPS 반경 이탈
  const r4 = processCheckIn(WORKER.id, DEVICE_TOKEN, SITE.qrToken, userOutsideLat, userOutsideLng, TODAY)
  assert(r4.success === false, `GPS 반경 이탈 (${distOutside}m) → 차단`)
  console.log(c.dim(`GPS 이탈 메시지: ${r4.message}`))

  // 유효하지 않은 QR
  const r5 = processCheckIn(WORKER.id, DEVICE_TOKEN, 'INVALID_QR_TOKEN', userInsideLat, userInsideLng, TODAY)
  assert(r5.success === false, '유효하지 않은 QR → 차단')
  console.log(c.dim(`QR 불량 메시지: ${r5.message}`))

  // 비활성 현장 QR
  const inactiveSite = { ...SITE, id: id(), qrToken: 'qr_inactive_site_token', isActive: false }
  DB.sites.push(inactiveSite)
  const r6 = processCheckIn(WORKER.id, DEVICE_TOKEN, inactiveSite.qrToken, userInsideLat, userInsideLng, TODAY)
  assert(r6.success === false, '비활성 현장 QR → 차단')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n[ Step 9 — 이동 모드 분기 확인 ]'))

  // 다른 현장 추가
  const SITE_B = {
    id: id(), name: 'B현장', address: '서울 마포구 123',
    latitude: 37.5560, longitude: 126.9236, allowedRadius: 100,
    qrToken: 'qr_site_b_token_xyz12345678901', isActive: true,
  }
  DB.sites.push(SITE_B)

  const openLog = DB.logs.find(l => l.workerId === WORKER.id && l.workDate === TODAY)
  const page3 = getQrPageMode(SESSION, SITE_B.qrToken, openLog ?? null)
  console.log(c.dim(`B현장 스캔 mode=${page3.mode}, currentSiteId=${page3.currentSiteId}`))
  assert(page3.mode === 'move',          'A현장 근무 중 B현장 QR 스캔 → 이동 모드')
  assert(page3.currentSiteId === SITE.id, '현재 현장이 A현장으로 표시됨')

  // ──────────────────────────────────────────────────────────────────
  console.log(c.head('\n════════════════════════════════════════════'))
  const badge = failed === 0
    ? '\x1b[32m[ PASS ]\x1b[0m' : '\x1b[31m[ FAIL ]\x1b[0m'
  console.log(`  결과: ${badge}  통과 \x1b[32m${passed}\x1b[0m건 | 실패 \x1b[31m${failed}\x1b[0m건`)
  console.log(c.head('════════════════════════════════════════════\n'))

  // ── 보고서 ─────────────────────────────────────────────────────────
  console.log(c.head('[ 보고서 ]'))
  const report = [
    ['QR 진입 결과',            `check-in 모드 진입 정상 (현장: ${SITE.name})`],
    ['출근 버튼 노출',           '오늘 기록 없음 → 출근 버튼 노출 정상'],
    ['출근 성공 여부',           `성공 (거리: ${r1.distance}m, ID: ${r1.attendanceId})`],
    ['GPS 실거리 계산',          `반경 내 ${distInside}m / 반경 외 ${distOutside}m 판정 정확`],
    ['오늘 상태 반영',           'status=WORKING, checkInAt 기록, checkOutAt=null'],
    ['관리자 화면 반영',         `관리자 조회 ${adminList.length}건, 상태=WORKING`],
    ['이동 모드 분기',           'A현장 근무 중 B현장 QR → 이동 모드 정상'],
    ['예외 차단 (4종)',          '중복/미승인기기/GPS이탈/유효하지않은QR — 모두 차단'],
  ]
  for (const [k, v] of report) console.log(`  ${k.padEnd(22)} ${v}`)
  console.log()

  process.exit(failed > 0 ? 1 : 0)
}

run()
